import { serviceLogger } from '../logger';

export interface EmailIntent {
  amount?: number;
  asset?: string;
  otpCode?: string;
  rawText: string;
  recipientEmail?: string;
  type: 'send' | 'balance' | 'verify' | 'unknown';
}

export class IntentParser {
  parseEmailIntent(emailBody: string, senderEmail: string): EmailIntent | null {
    try {
      const cleanBody = emailBody.trim().toLowerCase();

      // Pattern: SEND <amount> <asset> TO <email>
      const sendPattern = /send\s+([\d.]+)\s+(\w+)\s+to\s+([\w._%+-]+@[\w.-]+\.\w+)/i;
      const sendMatch = cleanBody.match(sendPattern);

      if (sendMatch) {
        const [, amountStr, asset, recipientEmail] = sendMatch;
        const amount = parseFloat(amountStr);

        if (isNaN(amount) || amount <= 0) {
          serviceLogger.warn(`Invalid amount in EmailPay email from ${senderEmail}: ${amountStr}`);
          return null;
        }

        return {
          amount,
          asset: asset.toUpperCase(),
          rawText: emailBody,
          recipientEmail: recipientEmail.toLowerCase(),
          type: 'send',
        };
      }

      // Pattern: BALANCE or CHECK BALANCE
      if (cleanBody.includes('balance')) {
        return {
          rawText: emailBody,
          type: 'balance',
        };
      }

      // Pattern: VERIFY <6-digit code>
      const verifyPattern = /verify\s+(\d{6})/i;
      const verifyMatch = cleanBody.match(verifyPattern);

      if (verifyMatch) {
        return {
          otpCode: verifyMatch[1],
          rawText: emailBody,
          type: 'verify',
        };
      }

      serviceLogger.warn(`Could not parse EmailPay intent from email: ${emailBody.substring(0, 100)}`);
      return {
        rawText: emailBody,
        type: 'unknown',
      };
    } catch (error) {
      serviceLogger.error('Error parsing EmailPay email intent:', error);
      return null;
    }
  }

  validateIntent(intent: EmailIntent, senderEmail: string): { error?: string, valid: boolean; } {
    if (intent.type === 'send') {
      if (!intent.amount || intent.amount <= 0) {
        return { error: 'Invalid amount', valid: false };
      }

      if (!intent.recipientEmail) {
        return { error: 'Recipient email not found', valid: false };
      }

      if (intent.recipientEmail === senderEmail) {
        return { error: 'Cannot send to yourself', valid: false };
      }

      // Validate asset (currently only PYUSD supported)
      if (intent.asset !== 'PYUSD') {
        return { error: 'Only PYUSD is currently supported', valid: false };
      }
    }

    return { valid: true };
  }
}

// Export singleton instance
export const intentParser = new IntentParser();
