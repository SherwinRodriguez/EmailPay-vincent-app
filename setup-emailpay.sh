#!/bin/bash

# EmailPay-Vincent Setup Script

echo "🚀 Setting up EmailPay-Vincent Integration..."
echo ""

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Error: Node.js version must be ^22.16.0"
    echo "Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm not found. Please install pnpm ^10.7.0"
    echo "Run: npm install -g pnpm@10.7.0"
    exit 1
fi
echo "✅ pnpm version: $(pnpm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Check MongoDB
echo ""
echo "🔍 Checking MongoDB..."
if ! command -v mongosh &> /dev/null && ! command -v docker &> /dev/null; then
    echo "⚠️  Warning: Neither mongosh nor docker found"
    echo "Please ensure MongoDB is running or start it with Docker"
else
    echo "✅ MongoDB tools available"
fi

# Setup EmailPay backend
echo ""
echo "⚙️  Setting up EmailPay backend..."
cd packages/emailpay-backend

if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit packages/emailpay-backend/.env with your credentials"
else
    echo "✅ .env file already exists"
fi

cd ../..

# Setup instructions
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Start MongoDB:"
echo "   cd packages/dca-backend && pnpm mongo:up"
echo ""
echo "2. Configure EmailPay backend:"
echo "   Edit packages/emailpay-backend/.env with your:"
echo "   - SEPOLIA_RPC (Alchemy/Infura key)"
echo "   - GMAIL_* credentials"
echo "   - HOT_WALLET_PRIVATE_KEY"
echo ""
echo "3. Start services:"
echo ""
echo "   # Option A: All services separately"
echo "   Terminal 1: cd packages/dca-backend && pnpm dev"
echo "   Terminal 2: cd packages/emailpay-backend && pnpm dev"
echo "   Terminal 3: cd packages/dca-frontend && pnpm dev"
echo ""
echo "   # Option B: EmailPay only"
echo "   cd packages/emailpay-backend && pnpm dev"
echo ""
echo "4. Test EmailPay API:"
echo "   curl http://localhost:3002/health"
echo ""
echo "📚 Documentation:"
echo "   - EmailPay Integration: EMAILPAY_INTEGRATION.md"
echo "   - EmailPay Backend: packages/emailpay-backend/README.md"
echo "   - Vincent DCA: packages/dca-backend/README.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
