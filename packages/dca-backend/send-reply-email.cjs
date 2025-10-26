/** Send a reply email for a completed transaction Usage: node send-reply-email.cjs <txHash> */

const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { google } = require('googleapis');

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dca';

// Gmail credentials
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

// Define transaction schema
const EmailPayTransactionSchema = new mongoose.Schema({
  txId: String,
  senderEmail: String,
  recipientEmail: String,
  amount: Number,
  asset: String,
  status: String,
  txHash: String,
  blockNumber: Number,
  metadata: mongoose.Schema.Types.Mixed,
  completedAt: Date,
});

const Transaction = mongoose.model('EmailPayTransaction', EmailPayTransactionSchema);

async function sendReplyEmail(txHash) {
  try {
    console.log(`\n📧 Sending reply email for transaction: ${txHash}\n`);

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find transaction by hash
    const transaction = await Transaction.findOne({ txHash });
    if (!transaction) {
      console.error(`❌ Transaction with hash ${txHash} not found`);
      process.exit(1);
    }

    console.log(`📊 Transaction Details:`);
    console.log(`   From: ${transaction.senderEmail}`);
    console.log(`   To: ${transaction.recipientEmail}`);
    console.log(`   Amount: ${transaction.amount} ${transaction.asset}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Block: ${transaction.blockNumber}\n`);

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      'http://localhost'
    );

    oauth2Client.setCredentials({
      refresh_token: GMAIL_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('✅ Gmail API initialized');

    // Prepare email content
    const explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;

    const emailBody =
      `✅ Transaction Successful!\n\n` +
      `Amount: ${transaction.amount} ${transaction.asset}\n` +
      `From: ${transaction.senderEmail}\n` +
      `To: ${transaction.recipientEmail}\n` +
      `Transaction Hash: ${txHash}\n` +
      `Block: ${transaction.blockNumber}\n` +
      `Explorer: ${explorerUrl}\n\n` +
      `Your ${transaction.asset} has been sent successfully via EmailPay! 🚀\n\n` +
      `--\n` +
      `EmailPay - Send crypto with just an email`;

    // Create email message
    const messageParts = [
      `To: ${transaction.senderEmail}`,
      `Subject: ✅ EmailPay: ${transaction.amount} ${transaction.asset} sent to ${transaction.recipientEmail}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
    ];

    const messageId = transaction.metadata?.messageId;
    if (messageId) {
      messageParts.push(`In-Reply-To: ${messageId}`);
      messageParts.push(`References: ${messageId}`);
    }

    messageParts.push('');
    messageParts.push(emailBody);

    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email
    console.log('📤 Sending email...');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`\n✅ Reply email sent successfully to ${transaction.senderEmail}!\n`);
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Get txHash from command line
const txHash = process.argv[2];
if (!txHash) {
  console.error('Usage: node send-reply-email.cjs <txHash>');
  process.exit(1);
}

sendReplyEmail(txHash);
