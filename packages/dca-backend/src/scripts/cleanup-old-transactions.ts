import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb://username:password@localhost:27017/dca?authSource=dca';

async function cleanup() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');
    
    const db = client.db('dca');
    const transactions = db.collection('emailpaytransactions');
    
    // Find all pending transactions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const oldTransactions = await transactions.find({
      createdAt: { $lt: oneHourAgo },
      status: 'pending'
    }).toArray();
    
    console.log(`\nFound ${oldTransactions.length} old pending transactions`);
    
    if (oldTransactions.length > 0) {
      console.log('\nDetails:');
      oldTransactions.forEach(tx => {
        console.log(`  • ${tx.amount} ${tx.asset} | ${tx.senderEmail} → ${tx.recipientEmail}`);
        console.log(`    Created: ${tx.createdAt}, ID: ${tx.txId}`);
      });
      
      // Mark them as expired
      const result = await transactions.updateMany(
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
    const currentPending = await transactions.countDocuments({ status: 'pending' });
    console.log(`\n📊 Current pending transactions: ${currentPending}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

cleanup().catch(console.error);
