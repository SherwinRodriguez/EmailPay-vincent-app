import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailPayUser extends Document {
  createdAt: Date;
  email: string;
  // Store the PKP NFT token ID
  otpCode?: string;
  pkpEthAddress?: string; 
  pkpPublicKey?: string;
  pkpTokenId?: string;
  updatedAt: Date;
  verified: boolean;
}

const EmailPayUserSchema = new Schema<IEmailPayUser>(
  {
    email: {
      lowercase: true,
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    otpCode: {
      type: String,
    },
    pkpEthAddress: {
      sparse: true,
      type: String,
    },
    pkpPublicKey: {
      sparse: true,
      type: String,
    },
    pkpTokenId: {
      sparse: true,
      type: String,
    },
    verified: {
      default: false,
      type: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

EmailPayUserSchema.index({ email: 1 });
EmailPayUserSchema.index({ pkpEthAddress: 1 }, { sparse: true });

export const User = mongoose.model<IEmailPayUser>('EmailPayUser', EmailPayUserSchema);
