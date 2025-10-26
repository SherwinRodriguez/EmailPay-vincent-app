# 🚀 Step-by-Step Setup Guide: Stytch OTP + Lit Protocol

Follow these steps **in order** to implement the official Lit Protocol OTP flow.

---

## ✅ Step 1: Sign Up for Stytch (5 minutes)

### 1.1 Create Account

1. Go to https://stytch.com/
2. Click **"Start now"** or **"Get started"**
3. Sign up with your email
4. Verify your email

### 1.2 Create Project

1. After login, click **"Create Project"**
2. Name it: `EmailPay` (or any name you prefer)
3. Select **"Consumer Auth"** as project type
4. Click **"Create Project"**

### 1.3 Get API Credentials

1. Go to **"API Keys"** in the left sidebar
2. You'll see two environments:

   - **Test** (for development) ✅ Use this
   - **Live** (for production)

3. Copy these credentials:
   ```
   Project ID (Test): project-test-xxxxx-xxxxx-xxxxx
   Secret (Test): secret-test-xxxxx-xxxxx-xxxxx
   ```

### 1.4 Configure Email Settings (Optional but Recommended)

1. Go to **"Email"** → **"Settings"**
2. Customize your OTP email template:
   - Company name: "EmailPay"
   - Logo: Upload your logo
   - From email: Choose default or custom domain

---

## ✅ Step 2: Update Your .env File (2 minutes)

1. Open `/packages/dca-backend/.env`

2. Find these lines:

   ```bash
   STYTCH_PROJECT_ID=project-test-REPLACE-WITH-YOUR-PROJECT-ID
   STYTCH_SECRET=secret-test-REPLACE-WITH-YOUR-SECRET
   ```

3. Replace with your actual credentials:

   ```bash
   STYTCH_PROJECT_ID=project-test-abc123-def456-ghi789
   STYTCH_SECRET=secret-test-xyz789-uvw456-rst123
   ```

4. Save the file

---

## ✅ Step 3: Replace pkpWalletManager.ts (3 minutes)

### Option A: Copy the Complete File (Recommended)

1. Copy the file: `COMPLETE_PKP_IMPLEMENTATION.ts`

2. Replace the existing file:

   ```bash
   cp COMPLETE_PKP_IMPLEMENTATION.ts packages/dca-backend/src/lib/services/pkpWalletManager.ts
   ```

3. Done! ✅

### Option B: Manual Update

If you prefer to update manually, follow the code in `COMPLETE_PKP_IMPLEMENTATION.ts` and update these sections:

1. **Imports** - Add Stytch and LitAuthClient imports
2. **Class Properties** - Add `litAuthClient`, `stytchOtpProvider`, `stytchClient`
3. **initialize()** - Add Stytch initialization
4. **createWallet()** - Update to send OTP via Stytch
5. **verifyWallet()** - Update to verify OTP and mint PKP via Relay
6. **loginWithEmail()** - New method for login OTP
7. **verifyLogin()** - New method to verify login OTP

---

## ✅ Step 4: Update API Routes (5 minutes)

Update `/packages/dca-backend/src/routes/emailpay.ts`:

### 4.1 Update Create Wallet Route

```typescript
// POST /api/emailpay/create-wallet
router.post('/create-wallet', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pkpWalletManager.createWallet(email);

    return res.json({
      success: true,
      email: result.email,
      otpSent: result.otpSent,
      methodId: result.methodId, // Required for Stytch verification
      // Dev mode fields (only if fallback):
      otpCode: result.otpCode,
      address: result.address,
      publicKey: result.publicKey,
    });
  } catch (error: any) {
    console.error('Create wallet error:', error);
    return res.status(500).json({ error: error.message });
  }
});
```

### 4.2 Add Verify Wallet Route (NEW)

```typescript
// POST /api/emailpay/verify-wallet
router.post('/verify-wallet', async (req, res) => {
  try {
    const { email, otpCode, methodId } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    const result = await pkpWalletManager.verifyWallet(email, otpCode, methodId);

    return res.json({
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
    console.error('Verify wallet error:', error);
    return res.status(400).json({ error: error.message });
  }
});
```

### 4.3 Update Login Routes

```typescript
// POST /api/emailpay/login - Send OTP
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pkpWalletManager.loginWithEmail(email);

    return res.json({
      success: true,
      email: result.email,
      otpSent: result.otpSent,
      methodId: result.methodId,
      // Dev mode field (only if fallback):
      otpCode: result.otpCode,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/emailpay/login/verify - Verify OTP
router.post('/login/verify', async (req, res) => {
  try {
    const { email, otpCode, methodId } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    const result = await pkpWalletManager.verifyLogin(email, otpCode, methodId);

    return res.json({
      success: true,
      verified: result.verified,
      wallet: {
        email: result.email,
        address: result.address,
        publicKey: result.publicKey,
        tokenId: result.tokenId,
      },
    });
  } catch (error: any) {
    console.error('Login verification error:', error);
    return res.status(400).json({ error: error.message });
  }
});
```

---

## ✅ Step 5: Update Frontend (10 minutes)

### 5.1 Update Create Wallet Page

Update `/packages/dca-frontend/src/pages/create-wallet.tsx`:

```typescript
const [email, setEmail] = useState('');
const [otpCode, setOtpCode] = useState('');
const [methodId, setMethodId] = useState('');
const [currentStep, setCurrentStep] = useState<'input' | 'otp' | 'creating' | 'success'>('input');
const [walletAddress, setWalletAddress] = useState('');

// Step 1: Request OTP
const handleCreateWallet = async () => {
  setCurrentStep('creating');

  try {
    const response = await fetch('http://localhost:3000/api/emailpay/create-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (data.success) {
      setMethodId(data.methodId);
      setCurrentStep('otp'); // Show OTP input
      toast.success('OTP sent to your email!');
    }
  } catch (error) {
    console.error('Create wallet error:', error);
    toast.error('Failed to send OTP');
    setCurrentStep('input');
  }
};

// Step 2: Verify OTP and mint PKP
const handleVerifyOtp = async () => {
  setCurrentStep('creating');

  try {
    const response = await fetch('http://localhost:3000/api/emailpay/verify-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otpCode, methodId }),
    });

    const data = await response.json();

    if (data.success) {
      setWalletAddress(data.wallet.address);
      setCurrentStep('success');
      toast.success('Wallet created successfully! 🎉');
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    toast.error('Invalid OTP code');
    setCurrentStep('otp');
  }
};
```

### 5.2 Update Login Page

Update `/packages/dca-frontend/src/pages/emailpay-login.tsx` similarly with:

- Step 1: Request login OTP
- Step 2: Verify OTP and retrieve wallet

---

## ✅ Step 6: Test the Flow (5 minutes)

### 6.1 Start Backend

```bash
cd packages/dca-backend
pnpm dev
```

**Look for these success messages:**

```
✓ Lit Node Client connected
✓ Stytch OTP Provider initialized - using official Lit Protocol flow
✓ EmailPay PKP Wallet Manager initialized on datil-dev
Server is listening on port 3000
```

If you see **"Using simplified PKP generation"** - check your `.env` file!

### 6.2 Start Frontend

```bash
cd packages/dca-frontend
pnpm dev
```

### 6.3 Test Create Wallet

1. Go to http://localhost:5173/create-wallet
2. Enter your email
3. Click "Create Wallet"
4. Check your email for OTP (from Stytch)
5. Enter OTP code
6. ✅ Real PKP minted via Lit Relay!

### 6.4 Test Login

1. Go to http://localhost:5173/emailpay-login
2. Enter same email
3. Click "Login"
4. Check email for OTP
5. Enter OTP code
6. ✅ Retrieved same PKP!

---

## ✅ Step 7: Verify Real PKP Creation

### 7.1 Check Backend Logs

You should see:

```
✓ OTP sent to user@email.com via Stytch
✓ OTP verified for user@email.com
✓ Real PKP NFT minted for user@email.com via Lit Relay (Token ID: 12345...)
✓ NO GAS FEES - Minted via Lit Relay! 🎉
```

### 7.2 Check Database

```bash
mongosh dca
db.emailpayusers.findOne({ email: "your-test-email@example.com" })
```

You should see:

```json
{
  "_id": "...",
  "email": "your-test-email@example.com",
  "pkpPublicKey": "0x04...", // Real public key
  "pkpEthAddress": "0x...", // Real Ethereum address
  "pkpTokenId": "12345...", // Real PKP NFT token ID
  "verified": true
}
```

### 7.3 Check Lit Protocol Explorer (Optional)

1. Go to https://explorer.litprotocol.com/
2. Search for your PKP token ID
3. Verify it exists on-chain! ✅

---

## 🎉 Success Indicators

✅ **Stytch OTP emails** - Professional OTP emails from Stytch
✅ **Real PKP Token ID** - Actual NFT token ID in database
✅ **No Gas Fees** - Backend logs show "NO GAS FEES"
✅ **Email Recovery** - Can login with same email and retrieve PKP
✅ **On-Chain Verification** - PKP exists on Lit Protocol explorer

---

## 🐛 Troubleshooting

### Issue 1: "Using simplified PKP generation"

**Problem:** Stytch credentials not detected

**Solution:**

1. Check `.env` file has correct `STYTCH_PROJECT_ID` and `STYTCH_SECRET`
2. Restart backend server
3. Look for "✓ Stytch OTP Provider initialized" in logs

### Issue 2: "OTP not received"

**Problem:** Stytch email not sent

**Solution:**

1. Check spam folder
2. Verify email address in Stytch dashboard
3. Check Stytch logs in dashboard: Logs → Email sends
4. For development, check backend logs for OTP code (fallback mode)

### Issue 3: "Invalid OTP code"

**Problem:** OTP expired or incorrect

**Solution:**

1. Stytch OTPs expire after 10 minutes
2. Request new OTP
3. Check for typos in OTP code

### Issue 4: "Failed to mint PKP"

**Problem:** Lit Relay error

**Solution:**

1. Check network connection
2. Verify LIT_NETWORK is set to 'datil-dev' in `.env`
3. Check Lit Protocol status: https://status.litprotocol.com/

---

## 📊 Comparison: Before vs After

### Before (Simplified Mode)

- ❌ Fake PKPs (random wallets)
- ❌ No on-chain proof
- ❌ Custom Gmail OTP (less professional)
- ❌ Can't recover if database lost
- ❌ Would need gas fees for signing

### After (Official Lit Protocol + Stytch)

- ✅ Real PKP NFTs on-chain
- ✅ Verifiable on Lit Explorer
- ✅ Professional OTP emails
- ✅ Email recovery always works
- ✅ No gas fees via Lit Relay

---

## 🚀 Next Steps

1. **Production Setup:**

   - Switch to Stytch **Live** credentials
   - Set `LIT_NETWORK=datil` in `.env`
   - Add custom email domain in Stytch

2. **Security:**

   - Add rate limiting for OTP requests
   - Implement email verification for new users
   - Add 2FA for high-value transactions

3. **UX Improvements:**
   - Add email validation
   - Show countdown timer for OTP expiry
   - Add "Resend OTP" button

---

## 📚 Resources

- **Stytch Dashboard:** https://stytch.com/dashboard
- **Lit Protocol Docs:** https://developer.litprotocol.com/
- **Lit Relay Info:** https://developer.litprotocol.com/resources/how-it-works/authentication/lit-relay
- **Support:** https://discord.gg/litprotocol

---

## ✅ Final Checklist

- [ ] Stytch account created
- [ ] API credentials copied
- [ ] .env file updated
- [ ] pkpWalletManager.ts replaced
- [ ] API routes updated
- [ ] Frontend updated
- [ ] Backend started successfully
- [ ] Test wallet created
- [ ] OTP email received
- [ ] Real PKP minted
- [ ] Database verified
- [ ] Login tested
- [ ] Same PKP retrieved

**Congratulations! You now have production-ready PKP minting with Lit Protocol + Stytch! 🎉**
