/** Schedule a pending transaction for execution Usage: node schedule-transaction.cjs <txId> */

const dotenv = require('dotenv');
const { Agenda } = require('@whisthub/agenda');

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dca';

async function scheduleTransaction(txId) {
  try {
    console.log(`\n🔄 Scheduling transaction: ${txId}\n`);

    // Initialize Agenda
    const agenda = new Agenda({
      db: { address: MONGO_URI, collection: 'agendaJobs' },
      processEvery: '10 seconds',
    });

    console.log('✅ Connected to Agenda');

    // Schedule the transaction execution job
    await agenda.start();
    console.log('✅ Agenda started');

    await agenda.now('emailpay-execute-transaction', { txId });
    console.log(`\n✅ Transaction ${txId} scheduled for execution!\n`);

    // Wait a bit for the job to be queued
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await agenda.stop();
    console.log('✅ Agenda stopped');

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    process.exit(1);
  }
}

// Get txId from command line
const txId = process.argv[2];
if (!txId) {
  console.error('Usage: node schedule-transaction.cjs <txId>');
  process.exit(1);
}

scheduleTransaction(txId);
