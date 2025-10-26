# EmailPay Quick Reference

## 🚀 Quick Start

```bash
# 1. Setup
./setup-emailpay.sh

# 2. Start MongoDB
cd packages/dca-backend && pnpm mongo:up

# 3. Configure
cd packages/emailpay-backend
cp .env.example .env
# Edit .env with your credentials

# 4. Run
pnpm dev

# 5. Test
curl http://localhost:3002/health
```

## 📧 Email Commands

### Create Wallet

```
To: your-emailpay@gmail.com
Subject: Create Wallet
Body: CREATE WALLET
```

→ Returns 6-digit OTP

### Verify Wallet

```
To: your-emailpay@gmail.com
Subject: Verify
Body: VERIFY 123456
```

### Send Payment

```
To: your-emailpay@gmail.com
Subject: Send Payment
Body: SEND 10 PYUSD TO recipient@example.com
```

### Check Balance

```
To: your-emailpay@gmail.com
Subject: Balance
Body: BALANCE
```

## 🔧 API Endpoints

### Wallets

```bash
# Create wallet
POST /api/wallets/create
{"email": "user@example.com"}

# Verify wallet
POST /api/wallets/verify
{"email": "user@example.com", "otpCode": "123456"}

# Get wallet
GET /api/wallets/:email
```

### Transactions

```bash
# Get transaction
GET /api/transactions/:txId

# List user transactions
GET /api/transactions/user/:email?limit=50&status=completed
```

## 📁 Project Structure

```
packages/emailpay-backend/
├── src/
│   ├── bin/              # Entry points
│   │   ├── serverWorker.ts   # API + Worker
│   │   ├── apiServer.ts      # API only
│   │   └── jobWorker.ts      # Worker only
│   ├── lib/
│   │   ├── express/      # Routes
│   │   ├── services/     # Core logic
│   │   ├── mongo/        # Database
│   │   └── agenda/       # Jobs
```

## 🔑 Environment Variables

```env
# Required
MONGODB_URI=mongodb://localhost:27017/emailpay
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/KEY
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER=your-email@gmail.com
HOT_WALLET_PRIVATE_KEY=0x...

# Optional
PORT=3002
LIT_NETWORK=datil-dev
MAX_TX_AMOUNT=100
DAILY_TX_CAP=500
```

## 🐛 Troubleshooting

### MongoDB Connection

```bash
docker ps | grep mongo
mongosh $MONGODB_URI
```

### PKP Signing Errors

1. Check `HOT_WALLET_PRIVATE_KEY`
2. Verify `LIT_NETWORK=datil-dev`
3. Check PKP public key format (0x04...)
4. Review session signature logs

### Gmail Not Polling

1. Verify OAuth credentials
2. Check refresh token validity
3. Review `GMAIL_POLL_QUERY`

## 📊 Monitoring

### Check Jobs

```bash
# MongoDB jobs
mongosh $MONGODB_URI
use emailpay
db.agendaJobs.find().pretty()
```

### Check Logs

```bash
# Console logs (uses consola)
cd packages/emailpay-backend
pnpm dev
```

### Check Transactions

```bash
# Via API
curl http://localhost:3002/api/transactions/user/test@example.com

# Via MongoDB
mongosh $MONGODB_URI
use emailpay
db.transactions.find().pretty()
```

## 🔗 Resources

- [Integration Guide](EMAILPAY_INTEGRATION.md)
- [Backend README](packages/emailpay-backend/README.md)
- [Lit Protocol Docs](https://developer.litprotocol.com/)
- [PYUSD on Sepolia](https://sepolia.etherscan.io/token/0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9)

## 🎯 Next Steps

1. Configure Gmail OAuth
2. Add Alchemy RPC key
3. Generate hot wallet key
4. Test email commands
5. Monitor transactions
6. Build frontend (optional)

## 💡 Tips

- Use test emails for development
- Monitor Agenda jobs in MongoDB
- Check Sepolia Etherscan for txs
- Keep hot wallet funded with ETH
- Gmail polls every 30 seconds
- Transactions expire after 30 minutes
