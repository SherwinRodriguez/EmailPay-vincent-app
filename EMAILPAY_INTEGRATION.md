# EmailPay-Vincent Integration Guide

This guide explains how EmailPay has been integrated into the Vincent starter app monorepo.

## Overview

EmailPay is now a first-class package in the Vincent monorepo, located at `packages/emailpay-backend`. It provides email-native PYUSD wallet functionality using Lit Protocol PKP wallets.

## Architecture

### Monorepo Structure

```
EmailPay-vincent-app/
├── packages/
│   ├── dca-backend/          # Vincent DCA backend
│   ├── dca-frontend/         # Vincent DCA frontend
│   └── emailpay-backend/     # ✨ NEW: EmailPay backend
```

### Key Integration Points

1. **Shared Dependencies**

   - Lit Protocol SDK v7.3.0 (both packages)
   - MongoDB via Mongoose
   - Express.js API patterns
   - TypeScript + unbuild for building

2. **PKP Signing Fixed**

   - Upgraded from Lit SDK v6.4.0 to v7.3.0
   - Proper SIWE message format with SiweMessage
   - Correct session signature generation with LitPKPResource
   - Fixed base64 decoding errors

3. **MCP Integration**
   - Express routes following Vincent's pattern
   - Agenda job scheduling (like DCA backend)
   - MongoDB models with Mongoose
   - Structured logging with consola

## Setup Instructions

### 1. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

This will install dependencies for all packages including emailpay-backend.

### 2. Set Up MongoDB

You can share the MongoDB instance with the DCA backend:

```bash
# From dca-backend directory
cd packages/dca-backend
pnpm mongo:up
```

Or start your own MongoDB instance:

```bash
docker run -d -p 27017:27017 --name emailpay-mongo mongo
```

### 3. Configure Environment

Create `.env` file in `packages/emailpay-backend/`:

```bash
cd packages/emailpay-backend
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# MongoDB (shared with DCA backend)
MONGODB_URI=mongodb://localhost:27017/emailpay

# Sepolia RPC
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Gmail OAuth
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER=your-email@gmail.com

# Hot Wallet (PKP Controller)
HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Lit Protocol (aligned with DCA backend)
LIT_NETWORK=datil-dev
```

### 4. Run EmailPay Backend

#### Option A: Development Mode (API + Worker)

```bash
cd packages/emailpay-backend
pnpm dev
```

#### Option B: Separate Processes

Terminal 1 (API Server):

```bash
cd packages/emailpay-backend
pnpm dev:api
```

Terminal 2 (Job Worker):

```bash
cd packages/emailpay-backend
pnpm dev:worker
```

### 5. Run All Services Together

From the monorepo root, you can run all services:

```bash
# Terminal 1: DCA Backend
cd packages/dca-backend && pnpm dev

# Terminal 2: EmailPay Backend
cd packages/emailpay-backend && pnpm dev

# Terminal 3: Frontend
cd packages/dca-frontend && pnpm dev
```

## API Endpoints

### EmailPay Backend (Port 3002)

- `POST /api/wallets/create` - Create PKP wallet
- `POST /api/wallets/verify` - Verify with OTP
- `GET /api/wallets/:email` - Get wallet info
- `GET /api/transactions/:txId` - Get transaction
- `GET /api/transactions/user/:email` - List transactions

### DCA Backend (Port from env)

- Vincent DCA routes (unchanged)

## Email Commands

Send emails to the configured Gmail address:

### 1. Create Wallet

```
To: emailpay.demo@gmail.com
Subject: Create Wallet
Body: CREATE WALLET
```

Response: You'll receive a 6-digit OTP code.

### 2. Verify Wallet

```
To: emailpay.demo@gmail.com
Subject: Verify
Body: VERIFY 123456
```

### 3. Send Payment

```
To: emailpay.demo@gmail.com
Subject: Send Payment
Body: SEND 10 PYUSD TO recipient@example.com
```

### 4. Check Balance

```
To: emailpay.demo@gmail.com
Subject: Balance
Body: BALANCE
```

## PKP Signing Implementation

### Fixed Issues

1. **Session Signature Generation**

   - ✅ Proper SIWE format using `SiweMessage` class
   - ✅ Correct `LitPKPResource` usage
   - ✅ Fixed base64 decoding errors
   - ✅ Added proper nonce from `getLatestBlockhash()`

2. **Lit SDK Version**
   - ✅ Upgraded to v7.3.0 (matching DCA backend)
   - ✅ Migrated from deprecated Habanero to Datil-dev
   - ✅ Removed hot wallet fallback (PKP-only)

### Key Code

See `packages/emailpay-backend/src/lib/services/pkpWalletManager.ts`:

```typescript
private async generateSessionSignatures(pkpPublicKey: string) {
  // Create proper SIWE message
  const nonce = await this.litNodeClient.getLatestBlockhash();
  const siweMessage = new SiweMessage({
    domain: 'emailpay.local',
    address: this.controllerWallet.address,
    statement: 'Sign in to EmailPay to authorize PKP transaction signing',
    uri: 'https://emailpay.local',
    version: '1',
    chainId: env.CHAIN_ID,
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  });

  const messageToSign = siweMessage.prepareMessage();
  const signature = await this.controllerWallet.signMessage(messageToSign);

  // Generate session signatures
  return await this.litNodeClient.getSessionSigs({
    chain: 'ethereum',
    expiration: siweMessage.expirationTime,
    resourceAbilityRequests: [
      {
        resource: new LitPKPResource(pkpPublicKey),
        ability: LitAbility.PKPSigning,
      },
    ],
    authNeededCallback: async () => ({
      sig: signature,
      derivedVia: 'web3.eth.personal.sign',
      signedMessage: messageToSign,
      address: this.controllerWallet.address,
    }),
  });
}
```

## Background Jobs

EmailPay uses Agenda for job scheduling (same pattern as DCA backend):

- **poll-gmail**: Runs every 30 seconds to check for new emails
- **process-send-transaction**: Validates and creates transaction records
- **execute-transaction**: Signs and broadcasts transactions via PKP
- **process-verification**: Handles OTP verification
- **process-balance-check**: Queries PYUSD balance

Jobs are stored in MongoDB collection `agendaJobs`.

## Database Models

### User

```typescript
{
  email: string;           // User's email (unique)
  pkpPublicKey?: string;   // PKP public key (0x04...)
  pkpEthAddress?: string;  // Derived ETH address
  otpCode?: string;        // 6-digit verification code
  verified: boolean;       // Verification status
  createdAt: Date;
  updatedAt: Date;
}
```

### Transaction

```typescript
{
  txId: string;            // Unique transaction ID (UUID)
  senderEmail: string;
  recipientEmail: string;
  amount: number;          // Amount in PYUSD
  asset: string;           // 'PYUSD'
  status: 'pending' | 'completed' | 'failed' | 'expired';
  txHash?: string;         // Blockchain tx hash
  blockNumber?: number;
  error?: string;
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
}
```

## Extending with Vincent Abilities

You can create custom Vincent abilities for EmailPay operations:

1. Create ability in `src/lib/abilities/`
2. Follow Vincent's ability pattern
3. Register with Vincent dashboard
4. Use ability client in jobs

Example structure:

```typescript
// src/lib/abilities/emailPaymentAbility.ts
export const emailPaymentAbility = {
  name: 'email-payment',
  version: '1.0.0',
  // ... ability implementation
};
```

## Testing

### Test Wallet Creation

```bash
curl -X POST http://localhost:3002/api/wallets/create \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Test Verification

```bash
curl -X POST http://localhost:3002/api/wallets/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otpCode":"123456"}'
```

### Test Transaction Query

```bash
curl http://localhost:3002/api/transactions/user/test@example.com
```

## Production Deployment

### Build

```bash
cd packages/emailpay-backend
pnpm build
```

### Run

```bash
# Combined (API + Worker)
pnpm start

# Or separate
pnpm startApiServer  # Terminal 1
pnpm startWorker     # Terminal 2
```

### Environment

Ensure production `.env` has:

- Secure `HOT_WALLET_PRIVATE_KEY`
- Production MongoDB URI
- Production RPC endpoints
- Valid Gmail OAuth tokens

## Troubleshooting

### Issue: PKP Signing Fails

**Solution**: Check these in order:

1. Hot wallet private key is valid
2. Lit network is `datil-dev`
3. Session signatures are being generated
4. PKP public key format is correct (0x04...)

### Issue: MongoDB Connection Fails

**Solution**:

```bash
# Test MongoDB connection
mongosh $MONGODB_URI

# Restart MongoDB
docker restart emailpay-mongo
```

### Issue: Gmail Not Polling

**Solution**:

1. Check Gmail OAuth credentials
2. Verify refresh token is valid
3. Check poll query in `.env`
4. Look at job worker logs

## Next Steps

1. **Add Email Notifications**: Implement nodemailer for sending emails
2. **Create Vincent Abilities**: Package EmailPay operations as Vincent abilities
3. **Frontend Integration**: Build UI for wallet management
4. **Add More Assets**: Support ETH, USDC, etc.
5. **Enhanced Security**: Add rate limiting, IP whitelisting

## Support

For issues or questions:

- Check logs in console (uses consola)
- Review MongoDB agendaJobs collection
- Check Sepolia Etherscan for transactions
- Verify Lit Protocol network status

## Resources

- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [Vincent Dashboard](https://dashboard.heyvincent.ai/)
- [PYUSD on Sepolia](https://sepolia.etherscan.io/token/0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9)
- [Gmail API Setup](https://developers.google.com/gmail/api/quickstart/nodejs)
