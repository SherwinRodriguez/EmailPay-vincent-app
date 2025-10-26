import express, { Request, Response } from 'express';

import { serviceLogger } from '../logger';
import { EmailPayTransaction } from '../mongo/models/EmailPayTransaction';

const router = express.Router();

// Get EmailPay transaction by ID
router.get('/:txId', async (req: Request, res: Response) => {
  try {
    const { txId } = req.params;

    const transaction = await EmailPayTransaction.findOne({ txId });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction: {
        amount: transaction.amount,
        asset: transaction.asset,
        blockNumber: transaction.blockNumber,
        completedAt: transaction.completedAt,
        createdAt: transaction.createdAt,
        recipientEmail: transaction.recipientEmail,
        senderEmail: transaction.senderEmail,
        status: transaction.status,
        txHash: transaction.txHash,
        txId: transaction.txId,
      },
    });
  } catch (error: any) {
    serviceLogger.error('Error getting EmailPay transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to get transaction' });
  }
});

// Get EmailPay transactions for user
router.get('/user/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const { limit = 50, status } = req.query;

    const query: any = {
      $or: [{ senderEmail: email }, { recipientEmail: email }],
    };

    if (status) {
      query.status = status;
    }

    const transactions = await EmailPayTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      transactions: transactions.map((tx) => ({
        amount: tx.amount,
        asset: tx.asset,
        completedAt: tx.completedAt,
        createdAt: tx.createdAt,
        recipientEmail: tx.recipientEmail,
        senderEmail: tx.senderEmail,
        status: tx.status,
        txHash: tx.txHash,
        txId: tx.txId,
      })),
    });
  } catch (error: any) {
    serviceLogger.error('Error getting EmailPay transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to get transactions' });
  }
});

export default router;
