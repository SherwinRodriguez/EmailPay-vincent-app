import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailPayTransaction extends Document {
  amount: number;
  asset: string;
  blockNumber?: number;
  completedAt?: Date;
  createdAt: Date;
  error?: string;
  expiresAt: Date;
  failedAt?: Date;
  recipientEmail: string;
  senderEmail: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  txHash?: string;
  txId: string;
  updatedAt: Date;
}

const EmailPayTransactionSchema = new Schema<IEmailPayTransaction>(
  {
    amount: {
      required: true,
      type: Number,
    },
    asset: {
      default: 'PYUSD',
      type: String,
    },
    blockNumber: Number,
    completedAt: Date,
    error: String,
    expiresAt: {
      required: true,
      type: Date,
    },
    failedAt: Date,
    recipientEmail: {
      lowercase: true,
      required: true,
      type: String,
    },
    senderEmail: {
      lowercase: true,
      required: true,
      type: String,
    },
    status: {
      default: 'pending',
      enum: ['pending', 'completed', 'failed', 'expired'],
      type: String,
    },
    txHash: String,
    txId: {
      required: true,
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

EmailPayTransactionSchema.index({ txId: 1 });
EmailPayTransactionSchema.index({ createdAt: -1, senderEmail: 1 });
EmailPayTransactionSchema.index({ createdAt: -1, recipientEmail: 1 });
EmailPayTransactionSchema.index({ status: 1 });

export const EmailPayTransaction = mongoose.model<IEmailPayTransaction>(
  'EmailPayTransaction',
  EmailPayTransactionSchema
);
