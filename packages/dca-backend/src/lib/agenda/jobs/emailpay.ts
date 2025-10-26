import { Agenda, Job } from '@whisthub/agenda';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';

import { env } from '../../env';
import { serviceLogger } from '../../logger';
import { EmailPayTransaction } from '../../mongo/models/EmailPayTransaction';
import { User } from '../../mongo/models/EmailPayUser';
import { gmailPoller } from '../../services/gmailPoller';
import { intentParser } from '../../services/intentParser';
import { pkpWalletManager } from '../../services/pkpWalletManager';


export function defineEmailPayJobs(agenda: Agenda): void {
  // Poll Gmail for new emails
  agenda.define('emailpay-poll-gmail', async (job: Job) => {
    try {
      serviceLogger.info('[EmailPay] Polling Gmail for new emails...');

      const messages = await gmailPoller.pollForEmails();

      if (messages.length === 0) {
        return;
      }

      serviceLogger.info(`[EmailPay] Found ${messages.length} new emails`);

      for (const message of messages) {
        // Parse email
        const senderEmail = gmailPoller.extractSenderEmail(message);
        const emailBody = gmailPoller.parseEmailBody(message);

        if (!senderEmail || !emailBody) {
          continue;
        }

        serviceLogger.info(`[EmailPay] Processing email from ${senderEmail}`);

        // Parse intent
        const intent = intentParser.parseEmailIntent(emailBody, senderEmail);

        if (!intent) {
          continue;
        }

        // Handle different intent types
        if (intent.type === 'send') {
          await agenda.now('emailpay-process-send-transaction', {
            senderEmail,
            amount: intent.amount,
            asset: intent.asset || 'PYUSD',
            messageId: message.id,
            recipientEmail: intent.recipientEmail,
          });
          // Delete transaction emails after processing (both PYUSD and ETH)
          await gmailPoller.deleteMessage(message.id);
        } else if (intent.type === 'verify') {
          await agenda.now('emailpay-process-verification', {
            senderEmail,
            messageId: message.id,
            otpCode: intent.otpCode,
          });
        } else if (intent.type === 'balance') {
          await agenda.now('emailpay-process-balance-check', {
            senderEmail,
            messageId: message.id,
          });
        }

        // Mark email as read (for non-transaction emails)
        if (intent.type !== 'send') {
          await gmailPoller.markAsRead(message.id);
        }
      }
    } catch (error) {
      serviceLogger.error('[EmailPay] Error polling Gmail:', error);
    }
  });

  // Process send transaction
  agenda.define('emailpay-process-send-transaction', async (job: Job) => {
    const { amount, asset, messageId, recipientEmail, senderEmail } = job.attrs.data as {
      amount: number;
      asset: string;
      messageId: string;
      recipientEmail: string;
      senderEmail: string;
    };

    try {
      serviceLogger.info(
        `[EmailPay] Processing send transaction: ${amount} ${asset} from ${senderEmail} to ${recipientEmail}`
      );

      // Check sender is verified
      const sender = await User.findOne({ email: senderEmail });
      if (!sender || !sender.verified) {
        serviceLogger.warn(`[EmailPay] Sender ${senderEmail} not verified`);
        return;
      }

      // Check recipient exists and is verified
      const recipient = await User.findOne({ email: recipientEmail });
      if (!recipient || !recipient.verified) {
        serviceLogger.warn(`[EmailPay] Recipient ${recipientEmail} not found or not verified`);
        return;
      }

      // Check amount limits
      if (amount > env.MAX_TX_AMOUNT) {
        serviceLogger.warn(`[EmailPay] Amount ${amount} exceeds max ${env.MAX_TX_AMOUNT}`);
        return;
      }

      // Create transaction record
      const txId = uuidv4();
      const expiresAt = new Date(Date.now() + env.TX_EXPIRY_MINUTES * 60 * 1000);

      await EmailPayTransaction.create({
        amount,
        asset,
        expiresAt,
        recipientEmail,
        senderEmail,
        txId,
        metadata: { messageId },
        status: 'pending', // Store messageId for reply
      });

      serviceLogger.info(`[EmailPay] Transaction ${txId} created, scheduling execution...`);

      // Schedule transaction execution
      await agenda.now('emailpay-execute-transaction', { txId });
    } catch (error) {
      serviceLogger.error('[EmailPay] Error processing send transaction:', error);
    }
  });

  // Execute transaction with PKP signing
  agenda.define('emailpay-execute-transaction', async (job: Job) => {
    const { txId } = job.attrs.data as { txId: string };

    try {
      serviceLogger.info(`[EmailPay] Executing transaction ${txId}...`);

      const transaction = await EmailPayTransaction.findOne({ txId });
      if (!transaction) {
        serviceLogger.error(`[EmailPay] Transaction ${txId} not found`);
        return;
      }

      if (transaction.status !== 'pending') {
        serviceLogger.warn(
          `[EmailPay] Transaction ${txId} already processed with status ${transaction.status}`
        );
        return;
      }

      // Check expiration
      if (new Date() > transaction.expiresAt) {
        transaction.status = 'expired';
        await transaction.save();
        serviceLogger.warn(`[EmailPay] Transaction ${txId} expired`);
        return;
      }

      // Get sender and recipient
      const sender = await User.findOne({ email: transaction.senderEmail });
      const recipient = await User.findOne({ email: transaction.recipientEmail });

      if (!sender || !recipient || !sender.pkpPublicKey || !recipient.pkpEthAddress) {
        transaction.status = 'failed';
        transaction.error = 'Sender or recipient wallet not found';
        await transaction.save();
        return;
      }

      // Validate sender has token ID
      if (!sender.pkpTokenId) {
        transaction.status = 'failed';
        transaction.error = 'Sender PKP token ID not found';
        await transaction.save();
        serviceLogger.error(`[EmailPay] Sender ${sender.email} missing pkpTokenId`);
        return;
      }

      // Execute transfer via PKP (ethers v5)
      const provider = new ethers.providers.JsonRpcProvider(env.SEPOLIA_RPC!);

      let txRequest: ethers.providers.TransactionRequest;

      if (transaction.asset === 'ETH') {
        // ETH transfer
        const amountInWei = ethers.utils.parseEther(transaction.amount.toString());
        
        txRequest = {
          chainId: env.CHAIN_ID,
          to: recipient.pkpEthAddress,
          value: amountInWei,
        };
      } else if (transaction.asset === 'PYUSD') {
        // PYUSD transfer
        const pyusdInterface = new ethers.utils.Interface([
          'function transfer(address to, uint256 amount) returns (bool)',
        ]);

        const amountInSmallestUnit = ethers.utils.parseUnits(transaction.amount.toString(), 6); // PYUSD has 6 decimals

        const txData = pyusdInterface.encodeFunctionData('transfer', [
          recipient.pkpEthAddress,
          amountInSmallestUnit,
        ]);

        txRequest = {
          chainId: env.CHAIN_ID,
          data: txData,
          to: env.PYUSD_ADDRESS,
          value: 0,
        };
      } else {
        transaction.status = 'failed';
        transaction.error = `Unsupported asset: ${transaction.asset}`;
        await transaction.save();
        serviceLogger.error(`[EmailPay] Unsupported asset: ${transaction.asset}`);
        return;
      }

      // Check if sender is using hot wallet or PKP
      let tx;
      if (sender.pkpTokenId === 'hot_wallet') {
        // Use hot wallet for signing
        serviceLogger.info('[EmailPay] Using hot wallet for transaction signing...');
        
        if (!env.HOT_WALLET_PRIVATE_KEY) {
          throw new Error('HOT_WALLET_PRIVATE_KEY not configured');
        }
        
        const hotWallet = new ethers.Wallet(env.HOT_WALLET_PRIVATE_KEY, provider);
        
        // Verify hot wallet address matches sender
        if (hotWallet.address.toLowerCase() !== sender.pkpEthAddress.toLowerCase()) {
          throw new Error(`Hot wallet address mismatch: expected ${sender.pkpEthAddress}, got ${hotWallet.address}`);
        }
        
        tx = await hotWallet.sendTransaction(txRequest);
        serviceLogger.info(`[EmailPay] ✓ Hot wallet transaction sent: ${tx.hash}`);
      } else {
        // Use PKP for signing
        serviceLogger.info('[EmailPay] Using PKP for transaction signing...');
        tx = await pkpWalletManager.sendTransaction(
          sender.pkpPublicKey,
          txRequest,
          sender.pkpTokenId // Pass token ID for LitPKPResource
        );
        serviceLogger.info(`[EmailPay] ✓ PKP transaction sent: ${tx.hash}`);
      }

      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        transaction.status = 'completed';
        transaction.txHash = receipt.transactionHash;
        transaction.blockNumber = receipt.blockNumber;
        transaction.completedAt = new Date();
        await transaction.save();

        serviceLogger.success(`[EmailPay] ✓ Transaction ${txId} completed: ${receipt.transactionHash}`);

        // Send reply email to sender
        try {
          const messageId = (transaction as any).metadata?.messageId;
          const explorerUrl = `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`;
          
          const emailBody = `✅ Transaction Successful!\n\n` +
            `Amount: ${transaction.amount} ${transaction.asset}\n` +
            `From: ${transaction.senderEmail}\n` +
            `To: ${transaction.recipientEmail}\n` +
            `Transaction Hash: ${receipt.transactionHash}\n` +
            `Block: ${receipt.blockNumber}\n` +
            `Explorer: ${explorerUrl}\n\n` +
            `Your ${transaction.asset} has been sent successfully via EmailPay! 🚀`;

          await gmailPoller.sendReply(
            transaction.senderEmail,
            `✅ EmailPay: ${transaction.amount} ${transaction.asset} sent to ${transaction.recipientEmail}`,
            emailBody,
            messageId
          );
        } catch (emailError) {
          serviceLogger.error(`[EmailPay] Failed to send reply email:`, emailError);
          // Don't fail the transaction if email fails
        }
      } else {
        transaction.status = 'failed';
        transaction.error = 'Transaction reverted';
        transaction.failedAt = new Date();
        await transaction.save();

        serviceLogger.error(`[EmailPay] ✗ Transaction ${txId} failed`);

        // Send failure email to sender
        try {
          const messageId = (transaction as any).metadata?.messageId;
          
          const emailBody = `❌ Transaction Failed\n\n` +
            `Amount: ${transaction.amount} ${transaction.asset}\n` +
            `From: ${transaction.senderEmail}\n` +
            `To: ${transaction.recipientEmail}\n` +
            `Error: Transaction reverted\n\n` +
            `Please try again or check your wallet balance.`;

          await gmailPoller.sendReply(
            transaction.senderEmail,
            `❌ EmailPay: Transaction failed`,
            emailBody,
            messageId
          );
        } catch (emailError) {
          serviceLogger.error(`[EmailPay] Failed to send failure email:`, emailError);
        }
      }
    } catch (error: any) {
      serviceLogger.error(`[EmailPay] Error executing transaction ${txId}:`, error);

      const transaction = await EmailPayTransaction.findOne({ txId });
      if (transaction) {
        transaction.status = 'failed';
        transaction.error = error.message;
        transaction.failedAt = new Date();
        await transaction.save();

        // Send error email to sender
        try {
          const messageId = (transaction as any).metadata?.messageId;
          
          const emailBody = `❌ Transaction Error\n\n` +
            `Amount: ${transaction.amount} ${transaction.asset}\n` +
            `From: ${transaction.senderEmail}\n` +
            `To: ${transaction.recipientEmail}\n` +
            `Error: ${error.message}\n\n` +
            `Please check your wallet configuration and try again.`;

          await gmailPoller.sendReply(
            transaction.senderEmail,
            `❌ EmailPay: Transaction error`,
            emailBody,
            messageId
          );
        } catch (emailError) {
          serviceLogger.error(`[EmailPay] Failed to send error email:`, emailError);
        }
      }
    }
  });

  // Process verification OTP
  agenda.define('emailpay-process-verification', async (job: Job) => {
    const { otpCode, senderEmail } = job.attrs.data as {
      messageId: string;
      otpCode: string;
      senderEmail: string;
    };

    try {
      serviceLogger.info(`[EmailPay] Processing verification for ${senderEmail}`);

      const verified = await pkpWalletManager.verifyWallet(senderEmail, otpCode);

      if (verified) {
        serviceLogger.success(`[EmailPay] ✓ User ${senderEmail} verified`);
      } else {
        serviceLogger.warn(`[EmailPay] Invalid OTP for ${senderEmail}`);
      }
    } catch (error) {
      serviceLogger.error('[EmailPay] Error processing verification:', error);
    }
  });

  // Process balance check
  agenda.define('emailpay-process-balance-check', async (job: Job) => {
    const { senderEmail } = job.attrs.data as {
      messageId: string;
      senderEmail: string;
    };

    try {
      serviceLogger.info(`[EmailPay] Processing balance check for ${senderEmail}`);

      const user = await User.findOne({ email: senderEmail });
      if (!user || !user.pkpEthAddress) {
        serviceLogger.warn(`[EmailPay] User ${senderEmail} not found`);
        return;
      }

      // Check PYUSD balance (ethers v5)
      const provider = new ethers.providers.JsonRpcProvider(env.SEPOLIA_RPC!);
      const pyusdContract = new ethers.Contract(
        env.PYUSD_ADDRESS!,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );

      const balance = await pyusdContract.balanceOf(user.pkpEthAddress);
      const formattedBalance = ethers.utils.formatUnits(balance, 6); // PYUSD has 6 decimals

      serviceLogger.info(`[EmailPay] Balance for ${senderEmail}: ${formattedBalance} PYUSD`);
    } catch (error) {
      serviceLogger.error('[EmailPay] Error processing balance check:', error);
    }
  });

  serviceLogger.info('[EmailPay] Jobs defined');
}
