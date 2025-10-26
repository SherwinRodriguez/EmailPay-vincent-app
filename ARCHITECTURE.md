# EmailPay Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     EmailPay System Architecture                 │
└─────────────────────────────────────────────────────────────────┘

                         User Interactions
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                ┌───▼───┐   ┌───▼────┐  ┌──▼──────┐
                │ Email │   │ API    │  │ Frontend│
                │(Gmail)│   │ Calls  │  │  (TBD)  │
                └───┬───┘   └───┬────┘  └──┬──────┘
                    │           │           │
                    └───────────┼───────────┘
                                │
            ┌───────────────────▼───────────────────┐
            │    EmailPay Backend (Port 3002)       │
            ├───────────────────────────────────────┤
            │                                       │
            │  ┌─────────────┐  ┌──────────────┐  │
            │  │ API Server  │  │ Job Worker   │  │
            │  │  (Express)  │  │   (Agenda)   │  │
            │  └──────┬──────┘  └──────┬───────┘  │
            │         │                │          │
            │    ┌────▼────────────────▼─────┐   │
            │    │      Core Services         │   │
            │    ├──────────────────────────┤   │
            │    │ • PKP Wallet Manager     │   │
            │    │ • Gmail Poller           │   │
            │    │ • Intent Parser          │   │
            │    │ • Transaction Processor  │   │
            │    └────┬────────────────┬────┘   │
            │         │                │          │
            └─────────┼────────────────┼──────────┘
                      │                │
        ┌─────────────▼────┐    ┌─────▼──────────┐
        │    MongoDB        │    │ Lit Protocol   │
        ├──────────────────┤    │  Datil-dev     │
        │ • Users          │    ├────────────────┤
        │ • Transactions   │    │ • PKP Wallets  │
        │ • Agenda Jobs    │    │ • Session Sigs │
        └──────────────────┘    │ • TX Signing   │
                                └────────┬───────┘
                                         │
                                ┌────────▼────────┐
                                │ Sepolia Testnet │
                                ├─────────────────┤
                                │ • PYUSD Token   │
                                │ • Gas (ETH)     │
                                │ • Transactions  │
                                └─────────────────┘
```

## Email Flow

```
┌──────────┐
│  User    │  1. Sends email: "SEND 10 PYUSD TO bob@example.com"
└────┬─────┘
     │
     ▼
┌────────────┐
│   Gmail    │  2. Email arrives in inbox
└────┬───────┘
     │
     ▼
┌──────────────────┐
│ Gmail Poller     │  3. Polls every 30s, fetches new emails
│ (Agenda Job)     │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Intent Parser    │  4. Parses: { type: 'send', amount: 10, recipient: 'bob@...' }
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Process Send TX  │  5. Validates sender verified, recipient exists
│ (Agenda Job)     │     Creates transaction record in MongoDB
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Execute TX       │  6. Creates PYUSD transfer transaction
│ (Agenda Job)     │     Gets PKP wallet with session signatures
│                  │     Signs & broadcasts to Sepolia
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Lit Protocol     │  7. PKP signs transaction using MPC
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Sepolia Network  │  8. Transaction confirmed on-chain
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ MongoDB          │  9. Transaction status updated to 'completed'
│ (Update Record)  │
└──────────────────┘
```

## PKP Signing Flow

```
┌────────────────────────────────────────────────────────────┐
│              PKP Transaction Signing Process                │
└────────────────────────────────────────────────────────────┘

1. Initialize Lit Node Client
   ┌───────────────────┐
   │ LitNodeClient     │  Network: datil-dev
   │   .connect()      │  Debug: false
   └─────────┬─────────┘
             │
2. Generate Session Signatures
   ┌─────────▼─────────┐
   │ Controller Wallet │  Hot wallet signs SIWE message
   │  (Hot Wallet)     │
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │  SIWE Message     │  domain, address, statement, nonce,
   │  (SiweMessage)    │  chainId, issuedAt, expirationTime
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ Sign Message      │  controller.signMessage(siweMessage)
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ getSessionSigs()  │  resourceAbilityRequests: [
   │                   │    {resource: LitPKPResource(pkpPubKey),
   │                   │     ability: LitAbility.PKPSigning}
   │                   │  ]
   └─────────┬─────────┘
             │
3. Create PKP Wallet
   ┌─────────▼─────────┐
   │ PKPEthersWallet   │  pkpPubKey + sessionSigs
   │   .init()         │
   └─────────┬─────────┘
             │
4. Sign Transaction
   ┌─────────▼─────────┐
   │ Create TX Request │  to: PYUSD contract
   │                   │  data: transfer(recipient, amount)
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ pkpWallet         │  Signs via Lit Protocol's MPC network
   │  .sendTransaction │  (multiple nodes participate)
   └─────────┬─────────┘
             │
5. Broadcast
   ┌─────────▼─────────┐
   │ Sepolia RPC       │  Transaction submitted to network
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ Transaction Hash  │  0x123abc...
   │ Block Number      │  #12345678
   └───────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                     MongoDB Collections                      │
└─────────────────────────────────────────────────────────────┘

┌────────────────┐
│     users      │
├────────────────┤
│ _id            │ ObjectId (auto)
│ email          │ String (unique, indexed)
│ pkpPublicKey   │ String (0x04...)
│ pkpEthAddress  │ String (0x...)
│ otpCode        │ String (6 digits)
│ verified       │ Boolean
│ createdAt      │ Date
│ updatedAt      │ Date
└────────────────┘

┌────────────────┐
│ transactions   │
├────────────────┤
│ _id            │ ObjectId (auto)
│ txId           │ String (UUID, unique, indexed)
│ senderEmail    │ String (indexed)
│ recipientEmail │ String (indexed)
│ amount         │ Number
│ asset          │ String ('PYUSD')
│ status         │ Enum (pending/completed/failed/expired)
│ txHash         │ String (0x...)
│ blockNumber    │ Number
│ error          │ String (optional)
│ expiresAt      │ Date
│ completedAt    │ Date (optional)
│ failedAt       │ Date (optional)
│ createdAt      │ Date
│ updatedAt      │ Date
└────────────────┘

┌────────────────┐
│  agendaJobs    │
├────────────────┤
│ _id            │ ObjectId (auto)
│ name           │ String (job name)
│ data           │ Object (job data)
│ priority       │ Number
│ nextRunAt      │ Date
│ lastRunAt      │ Date
│ lockedAt       │ Date
│ failCount      │ Number
│ failReason     │ String
└────────────────┘
```

## Integration with Vincent DCA

```
┌─────────────────────────────────────────────────────────────┐
│              Vincent Monorepo Structure                      │
└─────────────────────────────────────────────────────────────┘

├── packages/
│   ├── dca-backend/          ← Vincent DCA Backend
│   │   ├── Vincent App SDK
│   │   ├── Uniswap abilities
│   │   ├── ERC20 abilities
│   │   └── Lit SDK v7.3.0
│   │
│   ├── dca-frontend/         ← Vincent DCA Frontend
│   │   └── React UI
│   │
│   └── emailpay-backend/     ← EmailPay Backend
│       ├── Gmail integration
│       ├── PKP wallet mgmt
│       ├── Email commands
│       └── Lit SDK v7.3.0
│
├── Shared Infrastructure:
│   ├── MongoDB (single instance)
│   ├── Lit Protocol (same SDK version)
│   ├── Agenda (job scheduling)
│   └── Express (API patterns)
```

## Deployment Options

```
┌─────────────────────────────────────────────────────────────┐
│                   Deployment Strategies                      │
└─────────────────────────────────────────────────────────────┘

Option 1: All-in-One
┌─────────────────────┐
│   Single Server     │
├─────────────────────┤
│ • DCA Backend       │
│ • EmailPay Backend  │
│ • DCA Frontend      │
└─────────────────────┘

Option 2: Separate Services
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ DCA Backend  │  │EmailPay API  │  │EmailPay Job  │
│  (Vincent)   │  │   Server     │  │   Worker     │
└──────────────┘  └──────────────┘  └──────────────┘

Option 3: Microservices
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ DCA API      │  │EmailPay API  │  │   Shared     │
└──────────────┘  └──────────────┘  │   Worker     │
┌──────────────┐  ┌──────────────┐  │   (Agenda)   │
│ DCA Worker   │  │EmailPay Wrkr │  └──────────────┘
└──────────────┘  └──────────────┘
         │                │
         └────────┬───────┘
                  │
         ┌────────▼────────┐
         │     MongoDB     │
         │   (Shared DB)   │
         └─────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      Tech Stack                              │
└─────────────────────────────────────────────────────────────┘

Backend Runtime:
├── Node.js v22+
├── TypeScript v5.8+
└── pnpm v10.7+

Blockchain:
├── ethers.js v6.15.0
├── Lit Protocol SDK v7.3.0
├── SIWE v2.3.2
└── Sepolia Testnet

Database:
├── MongoDB v8.10+
├── Mongoose v8.10+
└── Agenda v7.0.2

API & Services:
├── Express.js v4.21+
├── Gmail API (googleapis)
├── Helmet (security)
└── CORS

Development:
├── tsx (TypeScript runner)
├── unbuild (bundler)
├── consola (logging)
└── dotenvx (env management)
```

## Security Considerations

```
┌─────────────────────────────────────────────────────────────┐
│                   Security Layers                            │
└─────────────────────────────────────────────────────────────┘

1. PKP Wallets (Lit Protocol)
   ✓ Decentralized key management via MPC
   ✓ No single point of failure
   ✓ Session-based authorization

2. Hot Wallet Controller
   ✓ Only signs session auth messages
   ✓ Cannot directly access user funds
   ✓ Separate from PKP private keys

3. Email Verification
   ✓ OTP verification required
   ✓ 6-digit codes (1M combinations)
   ✓ Wallets locked until verified

4. Transaction Policies
   ✓ Max per-transaction limit
   ✓ Daily spending cap
   ✓ Transaction expiration (30 min)

5. API Security
   ✓ Helmet middleware (security headers)
   ✓ CORS protection
   ✓ Input validation
   ✓ Rate limiting (TODO)

6. Environment Security
   ✓ Secrets via .env (not committed)
   ✓ Production uses secret managers
   ✓ Private keys encrypted at rest
```
