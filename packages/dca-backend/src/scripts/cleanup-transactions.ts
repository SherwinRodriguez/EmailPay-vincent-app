/* eslint-disable no-console */
import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://username:password@localhost:27017/dca?authSource=dca';

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
    
    const EmailPayTransaction = mongoose.connection.collection('emailpaytransactions');
    
    // Find all pending transactions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const oldTransactions = await EmailPayTransaction.find({
      createdAt: { $lt: oneHourAgo },
      status: 'pending'
    }).toArray();
    
    console.log(`\nFound ${oldTransactions.length} old pending transactions`);
    
    if (oldTransactions.length > 0) {
      console.log('\nDetails:');
      oldTransactions.forEach((tx: any) => {
        console.log(`  • ${tx.amount} ${tx.asset} | ${tx.senderEmail} → ${tx.recipientEmail}`);
        console.log(`    Created: ${tx.createdAt}, ID: ${tx.txId.substring(0, 8)}...`);
      });
      
      // Mark them as expired
      const result = await EmailPayTransaction.updateMany(
        {
          createdAt: { $lt: oneHourAgo },
          status: 'pending'
        },
        {
          $set: { 
            error: 'Expired - cleaned up old pending transactions', 
            failedAt: new Date(),
            status: 'expired'
          }
        }
      );
      
      console.log(`\n✅ Marked ${result.modifiedCount} transactions as expired`);
    } else {
      console.log('✅ No old pending transactions found');
    }
    
    // Also show current pending transactions
    const currentPending = await EmailPayTransaction.countDocuments({ status: 'pending' });
    console.log(`\n📊 Current pending transactions: ${currentPending}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

cleanup().catch(console.error);

