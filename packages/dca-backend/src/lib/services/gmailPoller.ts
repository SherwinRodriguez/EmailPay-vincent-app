import { google } from 'googleapis';

import { env } from '../env';
import { serviceLogger } from '../logger';

export class GmailPoller {
  private gmail: any;

  private oauth2Client: any;

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.oauth2Client = new google.auth.OAuth2(
        env.GMAIL_CLIENT_ID,
        env.GMAIL_CLIENT_SECRET,
        'http://localhost'
      );

      this.oauth2Client.setCredentials({
        refresh_token: env.GMAIL_REFRESH_TOKEN,
      });

      this.gmail = google.gmail({ auth: this.oauth2Client, version: 'v1' });

      this.initialized = true;
      serviceLogger.success('✓ EmailPay Gmail Poller initialized');
    } catch (error) {
      serviceLogger.error('Failed to initialize EmailPay Gmail Poller:', error);
      throw error;
    }
  }

  async pollForEmails(): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Gmail Poller not initialized');
    }

    try {
      const response = await this.gmail.users.messages.list({
        maxResults: 10,
        q: env.GMAIL_POLL_QUERY,
        userId: 'me',
      });

      const messages = response.data.messages || [];
      
      if (messages.length === 0) {
        return [];
      }

      // Fetch full message details
      const fullMessages = await Promise.all(
        messages.map(async (message: any) => {
          const details = await this.gmail.users.messages.get({
            format: 'full',
            id: message.id,
            userId: 'me',
          });
          return details.data;
        })
      );

      return fullMessages;
    } catch (error) {
      serviceLogger.error('Error polling for EmailPay emails:', error);
      return [];
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
        userId: 'me',
      });
      serviceLogger.info(`✓ Marked EmailPay email ${messageId} as read`);
    } catch (error) {
      serviceLogger.error(`Error marking EmailPay email ${messageId} as read:`, error);
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.trash({
        id: messageId,
        userId: 'me',
      });
      serviceLogger.info(`✓ Deleted EmailPay email ${messageId}`);
    } catch (error) {
      serviceLogger.error(`Error deleting EmailPay email ${messageId}:`, error);
    }
  }

  parseEmailBody(message: any): string | null {
    try {
      const parts = message.payload.parts || [message.payload];
      
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }

      // Fallback to body data if no parts
      if (message.payload.body?.data) {
        return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      serviceLogger.error('Error parsing EmailPay email body:', error);
      return null;
    }
  }

  extractSenderEmail(message: any): string | null {
    try {
      const {headers} = message.payload;
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
      
      if (!fromHeader) return null;

      // Extract email from "Name <email@domain.com>" format
      const match = fromHeader.value.match(/<(.+?)>/) || fromHeader.value.match(/([^\s]+@[^\s]+)/);
      return match ? match[1] : null;
    } catch (error) {
      serviceLogger.error('Error extracting sender email:', error);
      return null;
    }
  }

  async sendReply(to: string, subject: string, body: string, inReplyTo?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Gmail Poller not initialized');
    }

    try {
      // Create email message
      const messageParts = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
      ];

      if (inReplyTo) {
        messageParts.push(`In-Reply-To: ${inReplyTo}`);
        messageParts.push(`References: ${inReplyTo}`);
      }

      messageParts.push('');
      messageParts.push(body);

      const message = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await this.gmail.users.messages.send({
        requestBody: {
          raw: encodedMessage,
        },
        userId: 'me',
      });

      serviceLogger.success(`[EmailPay] ✓ Sent reply to ${to}`);
    } catch (error) {
      serviceLogger.error(`[EmailPay] Failed to send reply to ${to}:`, error);
      throw error;
    }
  }

  getGmail() {
    return this.gmail;
  }
}

// Export singleton instance
export const gmailPoller = new GmailPoller();
