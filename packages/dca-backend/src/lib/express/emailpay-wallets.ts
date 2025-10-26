import express, { Request, Response } from 'express';

import { serviceLogger } from '../logger';
import { gmailPoller } from '../services/gmailPoller';
import { pkpWalletManager } from '../services/pkpWalletManager';

const router = express.Router();

// Helper function to send OTP email
async function sendOtpEmail(email: string, otpCode: string, isLogin: boolean = false) {
  try {
    const gmail = gmailPoller.getGmail();
    if (!gmail) {
      serviceLogger.warn('Gmail not initialized, cannot send OTP email');
      return false;
    }

    const subject = isLogin ? 'EmailPay Login Code' : 'EmailPay Wallet Verification Code';
    const message = isLogin 
      ? `Your EmailPay login code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
      : `Your EmailPay wallet verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't create a wallet, please ignore this email.`;

    const raw = [
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${email}`,
      `Subject: ${subject}`,
      '',
      message
    ].join('\n');

    const encodedMessage = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      requestBody: {
        raw: encodedMessage,
      },
      userId: 'me',
    });

    serviceLogger.info(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    serviceLogger.error('Failed to send OTP email:', error);
    return false;
  }
}

// Create EmailPay wallet - Step 1: Send OTP
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Create wallet and send OTP (via Stytch or fallback)
    const result = await pkpWalletManager.createWallet(email);

    serviceLogger.info(`EmailPay wallet creation initiated for ${email}`);

    // Build response
    const isDev = process.env.NODE_ENV !== 'production';
    const response: any = {
      email: result.email,
      message: 'Verification code sent to your email.',
      otpSent: result.otpSent,
      success: true,
    };

    // Include methodId for Stytch verification
    if (result.methodId) {
      response.methodId = result.methodId;
    }

    // In development or fallback mode, include additional info
    if (isDev || result.otpCode) {
      if (result.otpCode) {
        response.otpCode = result.otpCode;
        response.devNote = 'OTP included (fallback mode)';
      }
      if (result.address) {
        response.address = result.address;
      }
      if (result.publicKey) {
        response.publicKey = result.publicKey;
      }
    }

    res.json(response);
  } catch (error: any) {
    serviceLogger.error('Error creating EmailPay wallet:', error);
    res.status(500).json({ error: error.message || 'Failed to create wallet' });
  }
});

// Verify EmailPay wallet - Step 2: Verify OTP and mint PKP
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { email, methodId, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    // Verify OTP and mint PKP (via Stytch or fallback)
    const result = await pkpWalletManager.verifyWallet(email, otpCode, methodId);

    serviceLogger.success(`EmailPay wallet verified for ${email}: ${result.address}`);

    return res.json({
      message: 'EmailPay wallet verified successfully',
      success: true,
      verified: result.verified,
      wallet: {
        email,
        address: result.address,
        publicKey: result.publicKey,
        tokenId: result.tokenId,
      },
    });
  } catch (error: any) {
    serviceLogger.error('Error verifying EmailPay wallet:', error);
    return res.status(400).json({ error: error.message || 'Invalid OTP code' });
  }
});

// Get EmailPay wallet info
router.get('/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const wallet = await pkpWalletManager.getWallet(email);

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (!wallet.verified) {
      return res.status(400).json({ error: 'Wallet not verified' });
    }

    return res.json({
      address: wallet.address,
      email: wallet.email,
      publicKey: wallet.publicKey,
      success: true,
      tokenId: wallet.tokenId,
      verified: wallet.verified,
    });
  } catch (error: any) {
    serviceLogger.error('Error getting EmailPay wallet:', error);
    return res.status(500).json({ error: error.message || 'Failed to get wallet' });
  }
});

// Resend OTP for unverified wallet
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { User } = await import('../mongo/models/EmailPayUser');
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (user.verified) {
      return res.status(400).json({ 
        alreadyVerified: true,
        error: 'Wallet already verified. Use login instead.',
        useLogin: true
      });
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = newOtp;
    await user.save();

    // Send OTP email
    await sendOtpEmail(email, newOtp, false);

    const response: any = {
      message: 'Verification code resent. Check your email.',
      success: true,
    };

    if (process.env.NODE_ENV !== 'production') {
      response.otpCode = newOtp;
      response.devNote = 'OTP included for development';
    }

    res.json(response);
  } catch (error: any) {
    serviceLogger.error('Error resending OTP:', error);
    res.status(500).json({ error: error.message || 'Failed to resend OTP' });
  }
});

// Login - Step 1: Send OTP
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Send login OTP (via Stytch or fallback)
    const result = await pkpWalletManager.loginWithEmail(email);

    serviceLogger.info(`Login OTP sent to ${email}`);

    const response: any = {
      email: result.email,
      message: 'Login code sent to your email.',
      otpSent: result.otpSent,
      success: true,
    };

    // Include methodId for Stytch verification
    if (result.methodId) {
      response.methodId = result.methodId;
    }

    // In development or fallback mode
    if (process.env.NODE_ENV !== 'production' || result.otpCode) {
      if (result.otpCode) {
        response.otpCode = result.otpCode;
        response.devNote = 'OTP included (fallback mode)';
      }
    }

    return res.json(response);
  } catch (error: any) {
    serviceLogger.error('Error sending login OTP:', error);
    return res.status(500).json({ error: error.message || 'Failed to send login code' });
  }
});

// Login - Step 2: Verify OTP
router.post('/login/verify', async (req: Request, res: Response) => {
  try {
    const { email, methodId, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    // Verify login OTP (via Stytch or fallback)
    const result = await pkpWalletManager.verifyLogin(email, otpCode, methodId);

    serviceLogger.success(`Login verified for ${email}`);

    // Create simple session token (in production, use JWT)
    const sessionToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hours

    return res.json({
      expiresAt,
      sessionToken,
      message: 'Login successful',
      success: true,
      verified: result.verified,
      wallet: {
        address: result.address,
        email: result.email,
        publicKey: result.publicKey,
        tokenId: result.tokenId,
      },
    });
  } catch (error: any) {
    serviceLogger.error('Error verifying login:', error);
    
    // Handle wallet not created error specifically
    if (error.code === 'WALLET_NOT_CREATED') {
      return res.status(400).json({ 
        code: 'WALLET_NOT_CREATED',
        error: error.message,
        needsWalletCreation: true
      });
    }
    
    return res.status(400).json({ error: error.message || 'Invalid login code' });
  }
});

// Get wallet balance (PYUSD and ETH)
router.get('/:email/balance', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const { User } = await import('../mongo/models/EmailPayUser');
    const { env } = await import('../env');
    const { ethers } = await import('ethers');

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (!user.verified) {
      return res.status(400).json({ error: 'Wallet not verified' });
    }

    if (!user.pkpEthAddress) {
      return res.status(400).json({ error: 'Wallet address not found' });
    }

    const walletAddress = user.pkpEthAddress;
    
    // Set up provider and contract
    const provider = new ethers.providers.JsonRpcProvider(env.SEPOLIA_RPC);
    const ERC20_ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ];
    const pyusdContract = new ethers.Contract(env.PYUSD_ADDRESS!, ERC20_ABI, provider);

    // Get balances
    const [ethBalance, pyusdBalance, pyusdDecimals] = await Promise.all([
      provider.getBalance(walletAddress),
      pyusdContract.balanceOf(walletAddress),
      pyusdContract.decimals()
    ]);

    return res.json({
      email,
      address: walletAddress,
      balances: {
        eth: ethers.utils.formatEther(ethBalance),
        pyusd: ethers.utils.formatUnits(pyusdBalance, pyusdDecimals)
      },
      raw: {
        eth: ethBalance.toString(),
        pyusd: pyusdBalance.toString()
      },
      success: true
    });
  } catch (error: any) {
    serviceLogger.error('Error getting wallet balance:', error);
    return res.status(500).json({ error: error.message || 'Failed to get balance' });
  }
});

export default router;
