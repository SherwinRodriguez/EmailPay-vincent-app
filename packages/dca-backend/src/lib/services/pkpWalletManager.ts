/**
 * EmailPay PKP Wallet Manager with Stytch OTP Integration
 * 
 * This implementation supports two modes:
 * 1. Stytch OTP Mode (when STYTCH credentials are provided) - Professional OTP emails
 * 2. Fallback Mode (no Stytch) - Random PKP generation for development
 * 
 * For production: Add STYTCH_PROJECT_ID and STYTCH_SECRET to .env
 */

import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import * as stytch from 'stytch';

import { LitPKPResource } from '@lit-protocol/auth-helpers';
import { AuthMethodType, AuthMethodScope, LitAbility } from '@lit-protocol/constants';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { StytchOtpProvider, LitRelay } from '@lit-protocol/lit-auth-client';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';

import { env } from '../env';
import { consola } from '../logger';
import { User } from '../mongo/models/EmailPayUser';

const serviceLogger = consola.withTag('emailpay:pkp');

class PKPWalletManager {
  private litNodeClient!: LitNodeClient;

  private litRelay!: LitRelay;

  private stytchClient!: stytch.Client;

  private provider: ethers.providers.JsonRpcProvider;

  private controllerWallet: ethers.Wallet;

  private initialized = false;

  private useStytchOtp = false; // Flag to check if Stytch is configured

  private useLitRelay = false; // Flag to check if Lit Relay is configured

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(env.SEPOLIA_RPC);
    this.controllerWallet = new ethers.Wallet(env.HOT_WALLET_PRIVATE_KEY!, this.provider);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      serviceLogger.info(`Initializing Lit Node Client for EmailPay on ${env.LIT_NETWORK} network...`);

      // Initialize Lit Node Client
      this.litNodeClient = new LitNodeClient({
        debug: false,
        litNetwork: env.LIT_NETWORK as any,
      });

      await this.litNodeClient.connect();
      serviceLogger.success('✓ Lit Node Client connected');
      
      // Initialize Lit Relay for gasless PKP minting
      if (env.LIT_RELAY_API_KEY) {
        this.litRelay = new LitRelay({
          relayApiKey: env.LIT_RELAY_API_KEY,
        });
        this.useLitRelay = true;
        serviceLogger.success(`✓ Lit Relay initialized for gasless PKP minting`);
        serviceLogger.success(`  API Key: ${env.LIT_RELAY_API_KEY.substring(0, 15)}...`);
      } else {
        serviceLogger.warn('⚠️  No LIT_RELAY_API_KEY - Will use deterministic wallets');
      }

      // Check if Stytch credentials are provided
      if (env.STYTCH_PROJECT_ID && env.STYTCH_SECRET) {
        try {
          // Initialize Stytch Client for OTP sending
          this.stytchClient = new stytch.Client({
            project_id: env.STYTCH_PROJECT_ID,
            secret: env.STYTCH_SECRET,
          });

          this.useStytchOtp = true;
          serviceLogger.success('✓ Stytch OTP initialized - professional OTP emails enabled');
          serviceLogger.info('✨ Users will receive OTP codes via Stytch email');
        } catch (error) {
          serviceLogger.warn('⚠️  Stytch initialization failed, falling back to simplified mode');
          serviceLogger.warn(`Error: ${error}`);
          this.useStytchOtp = false;
        }
      } else {
        serviceLogger.warn('⚠️  STYTCH_PROJECT_ID or STYTCH_SECRET not found in .env');
        serviceLogger.warn('⚠️  Using fallback PKP generation (not production-ready)');
        serviceLogger.info('📘 To enable professional OTP emails:');
        serviceLogger.info('   1. Sign up at https://stytch.com/');
        serviceLogger.info('   2. Add STYTCH_PROJECT_ID and STYTCH_SECRET to .env');
        serviceLogger.info('   3. Restart the server');
        this.useStytchOtp = false;
      }

      this.initialized = true;
      serviceLogger.success(`✓ EmailPay PKP Wallet Manager initialized on ${env.LIT_NETWORK}`);
    } catch (error) {
      serviceLogger.error('Failed to initialize EmailPay PKP Wallet Manager:', error);
      throw error;
    }
  }

  /**
   * CREATE WALLET - Step 1: Send OTP to user's email
   */
  async createWallet(email: string): Promise<{
    // Only for fallback mode
    address?: string;
    email: string;
    methodId?: string;
    otpCode?: string; 
    otpSent: boolean; // Only for fallback mode
    publicKey?: string; // Only for fallback mode
  }> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.verified && existingUser.pkpPublicKey) {
        throw new Error('Wallet already exists for this email. Use login instead.');
      }

      if (this.useStytchOtp) {
        // STYTCH METHOD: Send OTP via Stytch
        serviceLogger.info(`Sending OTP to ${email} via Stytch...`);

        const otpResponse = await this.stytchClient.otps.email.loginOrCreate({
          email,
        });

        const methodId = (otpResponse as any).email_id || 'stytch-otp';
        serviceLogger.success(`✓ Professional OTP email sent to ${email} via Stytch`);

        // Create or update user with pending status
        if (existingUser) {
          existingUser.verified = false;
          existingUser.otpCode = methodId; // Store method ID temporarily
          await existingUser.save();
        } else {
          await User.create({
            email,
            otpCode: methodId,
            verified: false,
          });
        }

        return {
          email,
          methodId,
          otpSent: true,
        };
      } 
        // FALLBACK METHOD: Create wallet immediately with fake OTP
        serviceLogger.warn(`⚠️  Using fallback PKP generation for ${email}`);

        const { pkpPublicKey, pkpTokenId } = await this.generatePKPForEmail(email);
        const pkpAddress = ethers.utils.computeAddress(pkpPublicKey);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        if (existingUser) {
          existingUser.otpCode = otpCode;
          existingUser.pkpEthAddress = pkpAddress;
          existingUser.pkpPublicKey = pkpPublicKey;
          existingUser.pkpTokenId = pkpTokenId;
          existingUser.verified = false;
          await existingUser.save();
        } else {
          await User.create({
            email,
            otpCode,
            pkpPublicKey,
            pkpTokenId,
            pkpEthAddress: pkpAddress,
            verified: false,
          });
        }

        serviceLogger.warn(`⚠️  Fallback wallet created - OTP: ${otpCode}`);

        return {
          email,
          otpCode,
          // Return OTP for dev mode
address: pkpAddress, 
          otpSent: true,
          publicKey: pkpPublicKey,
        };
      
    } catch (error) {
      serviceLogger.error('Error creating EmailPay wallet:', error);
      throw error;
    }
  }

  /**
   * VERIFY WALLET - Step 2: Verify OTP and mint PKP
   */
  async verifyWallet(
    email: string,
    otpCode: string,
    methodId?: string
  ): Promise<{
    address: string;
    publicKey: string;
    tokenId: string;
    verified: boolean;
  }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if already verified
      if (user.verified && user.pkpPublicKey && user.pkpEthAddress) {
        serviceLogger.info(`User ${email} already verified`);
        return {
          address: user.pkpEthAddress,
          publicKey: user.pkpPublicKey,
          tokenId: user.pkpTokenId || 'fallback',
          verified: true,
        };
      }

      if (this.useStytchOtp && methodId) {
        // STYTCH METHOD: Verify OTP with Stytch
        serviceLogger.info(`Verifying Stytch OTP for ${email}...`);

        let stytchToken: string | undefined;
        try {
          // Verify OTP with Stytch and CREATE a session to get the JWT token
          const authResponse = await this.stytchClient.otps.authenticate({
            code: otpCode,
            method_id: methodId as any,
            // CRITICAL: Tell Stytch to create a session and return JWT
            session_duration_minutes: 60, // Session valid for 1 hour
          });

          // Extract JWT token from response
          stytchToken = authResponse.session_jwt || authResponse.session_token;

          serviceLogger.success(`✓ Stytch OTP verified for ${email}`);
          if (stytchToken) {
            serviceLogger.info(`✓ Stytch JWT token obtained (length: ${stytchToken.length} chars)`);
          } else {
            serviceLogger.warn('⚠️ No Stytch token found in response');
            serviceLogger.info(`Response keys: ${Object.keys(authResponse).join(', ')}`);
          }
        } catch (error) {
          serviceLogger.error(`Stytch OTP verification failed: ${error}`);
          throw new Error('Invalid OTP code');
        }

        // Generate PKP for this verified email with Stytch token
        const { pkpPublicKey, pkpTokenId } = await this.generatePKPForEmail(email, stytchToken);
        const pkpEthAddress = ethers.utils.computeAddress(pkpPublicKey);

        // Update user in database
        user.pkpPublicKey = pkpPublicKey;
        user.pkpTokenId = pkpTokenId;
        user.pkpEthAddress = pkpEthAddress;
        user.verified = true;
        user.otpCode = undefined; // Clear OTP
        await user.save();

        serviceLogger.success(`✓ PKP wallet created for ${email}: ${pkpEthAddress}`);

        return {
          address: pkpEthAddress,
          publicKey: pkpPublicKey,
          tokenId: pkpTokenId,
          verified: true,
        };
      } 
        // FALLBACK METHOD: Simple OTP verification
        if (user.otpCode !== otpCode) {
          serviceLogger.warn(`Invalid OTP for ${email}`);
          throw new Error('Invalid OTP code');
        }

        user.verified = true;
        user.otpCode = undefined;
        await user.save();

        serviceLogger.success(`✓ Fallback verification complete for ${email}`);

        return {
          address: user.pkpEthAddress!,
          publicKey: user.pkpPublicKey!,
          tokenId: user.pkpTokenId || 'fallback',
          verified: true,
        };
      
    } catch (error) {
      serviceLogger.error('OTP verification failed:', error);
      throw new Error('Invalid OTP code or verification failed');
    }
  }

  /**
   * LOGIN - Step 1: Send OTP for existing user
   */
  async loginWithEmail(email: string): Promise<{
    email: string;
    methodId?: string;
    otpCode?: string;
    otpSent: boolean; // Only for fallback
  }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('User not found. Please create a wallet first.');
      }

      if (this.useStytchOtp) {
        // STYTCH METHOD: Send OTP via Stytch
        serviceLogger.info(`Sending login OTP to ${email} via Stytch...`);

        const otpResponse = await this.stytchClient.otps.email.loginOrCreate({
          email,
        });

        const methodId = (otpResponse as any).email_id || 'stytch-otp';
        serviceLogger.success(`✓ Professional login OTP sent to ${email} via Stytch`);

        return {
          email,
          methodId,
          otpSent: true,
        };
      } 
        // FALLBACK METHOD: Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode = otpCode;
        await user.save();

        serviceLogger.warn(`⚠️  Fallback login OTP for ${email}: ${otpCode}`);

        return {
          email,
          otpCode,
          otpSent: true,
        };
      
    } catch (error) {
      serviceLogger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * LOGIN - Step 2: Verify OTP and return wallet info
   */
  async verifyLogin(
    email: string,
    otpCode: string,
    methodId?: string
  ): Promise<{
    address: string;
    email: string;
    publicKey: string;
    tokenId: string;
    verified: boolean;
  }> {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }

      if (this.useStytchOtp && methodId) {
        // STYTCH METHOD: Verify login OTP with Stytch
        serviceLogger.info(`Verifying Stytch login OTP for ${email}...`);

        try {
          // Verify OTP with Stytch
          await this.stytchClient.otps.authenticate({
            code: otpCode,
            method_id: methodId as any,
          });

          serviceLogger.success(`✓ Stytch login OTP verified for ${email}`);
        } catch (error) {
          serviceLogger.error(`Stytch login OTP verification failed: ${error}`);
          throw new Error('Invalid OTP code');
        }

        if (!user.pkpPublicKey || !user.pkpEthAddress) {
          const walletError = new Error('WALLET_NOT_CREATED') as any;
          walletError.code = 'WALLET_NOT_CREATED';
          walletError.message = 'Wallet not found. Please create a wallet first.';
          throw walletError;
        }

        serviceLogger.success(`✓ Retrieved PKP for ${email}: ${user.pkpEthAddress}`);

        return {
          address: user.pkpEthAddress,
          email: user.email,
          publicKey: user.pkpPublicKey,
          tokenId: user.pkpTokenId || 'stytch',
          verified: true,
        };
      } 
        // FALLBACK METHOD: Simple OTP check
        if (user.otpCode !== otpCode) {
          throw new Error('Invalid OTP code');
        }

        if (!user.pkpPublicKey || !user.pkpEthAddress) {
          const walletError = new Error('WALLET_NOT_CREATED') as any;
          walletError.code = 'WALLET_NOT_CREATED';
          walletError.message = 'Wallet not found. Please create a wallet first.';
          throw walletError;
        }

        user.otpCode = undefined;
        await user.save();

        serviceLogger.success(`✓ Fallback login verified for ${email}`);

        return {
          address: user.pkpEthAddress,
          email: user.email,
          publicKey: user.pkpPublicKey,
          tokenId: user.pkpTokenId || 'fallback',
          verified: true,
        };
      
    } catch (error: any) {
      serviceLogger.error('Login verification failed:', error);
      // Preserve specific error codes
      if (error.code === 'WALLET_NOT_CREATED') {
        throw error;
      }
      throw new Error('Invalid OTP code or login verification failed');
    }
  }

  async getWallet(email: string) {
    const user = await User.findOne({ email });
    if (!user) return null;

    return {
      address: user.pkpEthAddress,
      email: user.email,
      publicKey: user.pkpPublicKey,
      tokenId: user.pkpTokenId,
      verified: user.verified,
    };
  }

  async createPKPWalletInstance(pkpPublicKey: string, pkpTokenId?: string): Promise<PKPEthersWallet> {
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client not initialized');
    }

    // Check if this is a deterministic wallet (fake PKP) - they won't work with Lit Protocol
    const isValidTokenId = pkpTokenId && pkpTokenId.length >= 64;
    if (!isValidTokenId) {
      serviceLogger.error('❌ Cannot use deterministic wallet with Lit Protocol signing!');
      serviceLogger.error('   Deterministic wallets are for testing only and do not exist on Lit network.');
      serviceLogger.error('   You need to mint a real PKP using Lit Relay or Lit Contracts.');
      serviceLogger.error('   Please ensure LIT_RELAY_API_KEY is set and retry wallet creation.');
      throw new Error('Deterministic wallet cannot be used for actual PKP signing. Please mint a real PKP first.');
    }

    // Generate session signatures with proper SIWE format
    const sessionSigs = await this.generateSessionSignatures(pkpPublicKey, pkpTokenId);

    const pkpWallet = new PKPEthersWallet({
      controllerSessionSigs: sessionSigs,
      litNodeClient: this.litNodeClient,
      pkpPubKey: pkpPublicKey,
      rpc: env.SEPOLIA_RPC!,
    });

    await pkpWallet.init();
    return pkpWallet;
  }

  /**
   * Generate session signatures for PKP transaction signing
   * Uses token ID for LitPKPResource (must be 64 chars or less)
   */
  private async generateSessionSignatures(pkpPublicKey: string, pkpTokenId?: string) {
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client not initialized');
    }

    // IMPORTANT: Only use tokenId if it's a valid 64+ char hex string (real PKP)
    // Short token IDs (like deterministic wallet hashes) are not real PKPs
    let resourceId: string;
    const isValidTokenId = pkpTokenId && pkpTokenId.length >= 64;
    
    if (isValidTokenId) {
      resourceId = pkpTokenId!;
      serviceLogger.info('Using real PKP token ID for session signatures');
    } else {
      // For deterministic wallets or invalid token IDs, use public key
      resourceId = pkpPublicKey;
      serviceLogger.warn('Using PKP public key as resource (deterministic wallet mode)');
    }
    
    // Remove 0x prefix if present - LitPKPResource expects raw hex
    if (resourceId.startsWith('0x')) {
      resourceId = resourceId.slice(2);
    }
    
    // Validate length - LitPKPResource requires <= 64 chars (32 bytes) for token ID
    // or 130 chars (65 bytes) for uncompressed public key
    if (resourceId.length > 130) {
      throw new Error(`PKP resource ID too long: ${resourceId.length} chars (max 130).`);
    }

    serviceLogger.info(`Using PKP resource: ${resourceId.slice(0, 10)}...`);

    // Generate session signatures
    // For NodeJS, we need to provide a wallet that can sign
    // The SDK will automatically create the SIWE message with ReCap capabilities
    const sessionSigs = await this.litNodeClient.getSessionSigs({
      // Provide a callback that signs messages with our controller wallet
// The SDK will create a proper SIWE message with ReCap and ask us to sign it
authNeededCallback: async (params: any) => {
        // params contains the SIWE message components, we need to construct the message
        // and convert it to string format using prepareMessage()
        if (!params.uri || !params.expiration || !params.resources) {
          throw new Error('Invalid SIWE params received in authNeededCallback');
        }

        // Create a proper SIWE message from the params
        const siweMessage = new SiweMessage({
          address: this.controllerWallet.address,
          chainId: params.chain === 'ethereum' ? 1 : params.chainId || 1,
          domain: params.domain || 'localhost',
          expirationTime: params.expiration,
          issuedAt: params.issuedAt || new Date().toISOString(),
          nonce: params.nonce,
          resources: params.resources,
          statement: params.statement,
          uri: params.uri,
          version: '1',
        });

        // Convert to the string format that needs to be signed
        const messageToSign = siweMessage.prepareMessage();
        const signature = await this.controllerWallet.signMessage(messageToSign);
        
        return {
          address: this.controllerWallet.address,
          derivedVia: 'web3.eth.personal.sign',
          sig: signature,
          signedMessage: messageToSign,
        };
      },
      

chain: 'ethereum',
      

expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      
      
      resourceAbilityRequests: [
        {
          ability: LitAbility.PKPSigning,
          resource: new LitPKPResource(resourceId),
        },
      ],
    });

    serviceLogger.success('✓ EmailPay session signatures generated successfully');
    return sessionSigs;
  }

  /**
   * PRODUCTION-READY: Generate PKP using Lit Protocol Contracts
   * 
   * This method implements THREE approaches in order of preference:
   * 1. Lit Relay (gasless minting via API) - FASTEST, NO GAS
   * 2. Lit Contracts (on-chain minting) - MOST ROBUST, REQUIRES GAS
   * 3. Deterministic wallet (fallback) - FOR TESTING ONLY
   * 
   * Returns a real PKP NFT with proper auth method binding
   */
  private async generatePKPForEmail(email: string, stytchToken?: string): Promise<{
    pkpPublicKey: string;
    pkpTokenId: string;
  }> {
    serviceLogger.info(`🔨 Generating PKP for ${email}...`);

    // ============================================================
    // APPROACH 1: Lit Relay (Gasless Minting via API)
    // ============================================================
    serviceLogger.info(`🔍 Debug - useLitRelay: ${this.useLitRelay}, LIT_RELAY_API_KEY present: ${!!env.LIT_RELAY_API_KEY}`);

    // METHOD 1: Try Lit Relay gasless minting (PREFERRED - FREE!)
    if (this.useLitRelay && env.LIT_RELAY_API_KEY && stytchToken) {
      try {
        serviceLogger.info('⏳ [Method 1] Minting PKP via Lit Relay (gasless)...');

        // Use the real Stytch session token for authentication
        const authMethod = {
          accessToken: stytchToken,
          authMethodType: AuthMethodType.StytchOtp, // Use real Stytch JWT token
        };

        // Mint PKP via Lit Relay - NO GAS FEES!
        const mintResult = await this.litRelay.mintPKPWithAuthMethods(
          [authMethod],
          {
            addPkpEthAddressAsPermittedAddress: true,
            pkpPermissionScopes: [[AuthMethodScope.SignAnything]],
            sendPkpToitself: false,
          }
        );

        if (mintResult.pkpPublicKey && mintResult.pkpTokenId) {
          const {pkpPublicKey} = mintResult;
          const {pkpTokenId} = mintResult;
          const pkpEthAddress = mintResult.pkpEthAddress!;

          serviceLogger.success(`✅ PKP NFT minted via Lit Relay (Method 1):`);
          serviceLogger.success(`  Token ID: ${pkpTokenId}`);
          serviceLogger.success(`  Public Key: ${pkpPublicKey}`);
          serviceLogger.success(`  Address: ${pkpEthAddress}`);
          serviceLogger.success(`  ⛽ NO GAS FEES! 🎉`);

          return { pkpPublicKey, pkpTokenId };
        }
      } catch (error) {
        serviceLogger.warn(`⚠️  Lit Relay failed: ${error}`);
        serviceLogger.info('📋 Trying Method 2: On-chain minting...');
      }
    } else if (this.useLitRelay && env.LIT_RELAY_API_KEY && !stytchToken) {
      serviceLogger.warn('⚠️  Lit Relay available but no Stytch token provided');
      serviceLogger.info('📋 Skipping Method 1, trying Method 2...');
    }
    
    if (this.useLitRelay && env.LIT_RELAY_API_KEY) {
      try {
        serviceLogger.info('⏳ [Method 1] Minting PKP via Lit Relay (gasless)...');

        // Create auth method for this email
        const emailHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(email));
        
        const authMethod = {
          accessToken: emailHash,
          authMethodType: AuthMethodType.StytchOtp,
        };

        // Mint PKP via Lit Relay - NO GAS FEES!
        const mintResult = await this.litRelay.mintPKPWithAuthMethods(
          [authMethod],
          {
            addPkpEthAddressAsPermittedAddress: true,
            pkpPermissionScopes: [[AuthMethodScope.SignAnything]],
            sendPkpToitself: false,
          }
        );

        if (mintResult.pkpPublicKey && mintResult.pkpTokenId) {
          const {pkpPublicKey} = mintResult;
          const {pkpTokenId} = mintResult;
          const pkpEthAddress = mintResult.pkpEthAddress!;

          serviceLogger.success(`✅ PKP NFT minted via Lit Relay (Method 1):`);
          serviceLogger.success(`  Token ID: ${pkpTokenId}`);
          serviceLogger.success(`  Public Key: ${pkpPublicKey}`);
          serviceLogger.success(`  Address: ${pkpEthAddress}`);
          serviceLogger.success(`  ⛽ NO GAS FEES! 🎉`);

          return { pkpPublicKey, pkpTokenId };
        }
      } catch (error) {
        serviceLogger.warn(`⚠️  Lit Relay failed: ${error}`);
        serviceLogger.info('📋 Trying Method 2: On-chain minting...');
      }
    }

    // ============================================================
    // APPROACH 2: Lit Contracts (On-chain Minting with Gas)
    // ============================================================
    try {
      serviceLogger.info('⏳ [Method 2] Minting PKP on-chain via Lit Contracts...');

      // Initialize Lit Contracts with controller wallet
      const litContracts = new LitContracts({
        debug: false,
        network: env.LIT_NETWORK as any,
        signer: this.controllerWallet,
      });

      await litContracts.connect();
      serviceLogger.info('✓ Connected to Lit Contracts');

      // Create authentication signature for PKP minting
      const nonce = await this.litNodeClient.getLatestBlockhash();
      const address = ethers.utils.getAddress(await this.controllerWallet.getAddress());
      
      const siweMessage = new SiweMessage({
        address,
        // Sepolia
nonce,
        
chainId: 11155111,
        
domain: 'emailpay.app',
        
statement: `Mint PKP for EmailPay user: ${email}`,
        
expirationTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), 
        uri: 'https://emailpay.app',
        version: '1', // 24 hours
      });

      const messageToSign = siweMessage.prepareMessage();
      const signature = await this.controllerWallet.signMessage(messageToSign);

      const authSig = {
        address,
        derivedVia: 'web3.eth.personal.sign',
        sig: signature,
        signedMessage: messageToSign,
      };

      // Create auth method for contract minting
      const authMethod = {
        accessToken: JSON.stringify(authSig),
        authMethodType: AuthMethodType.EthWallet,
      };

      serviceLogger.info('⏳ Minting PKP on-chain (this may take 30-60 seconds)...');
      
      // Mint PKP with auth method
      const mintInfo = await litContracts.mintWithAuth({
        authMethod,
        scopes: [AuthMethodScope.SignAnything],
      });

      const pkpPublicKey = mintInfo.pkp.publicKey;
      const pkpTokenId = mintInfo.pkp.tokenId;
      const pkpEthAddress = mintInfo.pkp.ethAddress;

      serviceLogger.success(`✅ Real PKP NFT minted on-chain (Method 2):`);
      serviceLogger.success(`  Token ID: ${pkpTokenId}`);
      serviceLogger.success(`  Public Key: ${pkpPublicKey}`);
      serviceLogger.success(`  Address: ${pkpEthAddress}`);
      serviceLogger.success(`  Transaction Hash: ${mintInfo.tx.hash}`);
      serviceLogger.info(`  ⛽ Gas used: Check transaction on Etherscan`);

      return {
        pkpPublicKey,
        pkpTokenId,
      };
    } catch (error) {
      serviceLogger.error(`❌ On-chain minting failed: ${error}`);
      serviceLogger.warn('⚠️  Falling back to Method 3: Deterministic wallet...');
    }

    // ============================================================
    // APPROACH 3: Deterministic Wallet (Testing Fallback)
    // ============================================================
    try {
      serviceLogger.info('⏳ [Method 3] Generating deterministic wallet (DEV MODE)...');
      
      const emailHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(email));
      const wallet = new ethers.Wallet(emailHash);
      
      serviceLogger.success(`✓ Deterministic wallet generated for ${email}:`);
      serviceLogger.success(`  Public Key: ${wallet.publicKey}`);
      serviceLogger.success(`  Address: ${wallet.address}`);
      serviceLogger.warn(`  ⚠️  NOT A REAL PKP NFT - Testing only!`);
      serviceLogger.warn(`  ⚠️  Private key is derivable from email hash!`);

      return {
        pkpPublicKey: wallet.publicKey,
        pkpTokenId: emailHash.slice(0, 10),
      };
    } catch (error) {
      serviceLogger.error(`❌ Deterministic wallet failed: ${error}`);
      
      // Ultimate fallback: random wallet
      const wallet = ethers.Wallet.createRandom();
      const authMethodId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(email));

      serviceLogger.warn(`⚠️  Using random wallet - NOT RECOMMENDED`);

      return {
        pkpPublicKey: wallet.publicKey,
        pkpTokenId: authMethodId.slice(0, 10),
      };
    }
  }

  async signTransaction(pkpPublicKey: string, transaction: ethers.providers.TransactionRequest, pkpTokenId?: string) {
    const pkpWallet = await this.createPKPWalletInstance(pkpPublicKey, pkpTokenId);
    return pkpWallet.signTransaction(transaction);
  }

  async sendTransaction(pkpPublicKey: string, transaction: ethers.providers.TransactionRequest, pkpTokenId?: string) {
    const pkpWallet = await this.createPKPWalletInstance(pkpPublicKey, pkpTokenId);
    return pkpWallet.sendTransaction(transaction);
  }

  getLitNodeClient(): LitNodeClient {
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client not initialized');
    }
    return this.litNodeClient;
  }

  isUsingStytchOtp(): boolean {
    return this.useStytchOtp;
  }
}

// Export singleton instance
export const pkpWalletManager = new PKPWalletManager();
