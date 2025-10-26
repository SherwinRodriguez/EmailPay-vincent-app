/** Simple ETH Transfer Script Send ETH from Wallet 1 to Wallet 2 using their PKP wallets */
import { ethers } from 'ethers';

// Wallet addresses
const WALLET_1_EMAIL = 'sherwin7rodriguez10@gmail.com';
const WALLET_1_ADDRESS = '0x40E6c07c45e8818e5fD6DD9fb57a505d200649E9';

const WALLET_2_EMAIL = 'sherwinrod10@gmail.com';
const WALLET_2_ADDRESS = '0x4d1Abf8F6ECb6edc176354536F52c9e35dC1e0B4';

// Network config
const RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/3dNXGnASt-nTG8frv4CLB';
const CHAIN_ID = 11155111; // Sepolia
const EXPLORER_URL = 'https://sepolia.etherscan.io';

// Hot wallet (for funding) - from your .env
const HOT_WALLET_KEY = '0x51d609085dd326b3933db88e809cbe0b7053148b691fdc44c62bcd3129b70a9f';

async function checkBalances() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  console.log('💰 Checking Balances...\n');

  const balance1 = await provider.getBalance(WALLET_1_ADDRESS);
  const balance2 = await provider.getBalance(WALLET_2_ADDRESS);
  const hotWallet = new ethers.Wallet(HOT_WALLET_KEY, provider);
  const hotBalance = await provider.getBalance(hotWallet.address);

  console.log(`🔵 Hot Wallet (${hotWallet.address}):`, ethers.utils.formatEther(hotBalance), 'ETH');
  console.log(`📧 Wallet 1 (${WALLET_1_EMAIL}):`, ethers.utils.formatEther(balance1), 'ETH');
  console.log(`📧 Wallet 2 (${WALLET_2_EMAIL}):`, ethers.utils.formatEther(balance2), 'ETH');
  console.log('');

  return { balance1, balance2, hotBalance, hotWallet };
}

async function fundWallet1(amount = '0.01') {
  console.log(`💸 Funding Wallet 1 with ${amount} ETH from hot wallet...\n`);

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const hotWallet = new ethers.Wallet(HOT_WALLET_KEY, provider);

  const tx = await hotWallet.sendTransaction({
    to: WALLET_1_ADDRESS,
    value: ethers.utils.parseEther(amount),
  });

  console.log('⏳ Transaction sent:', tx.hash);
  console.log(`🔍 ${EXPLORER_URL}/tx/${tx.hash}\n`);

  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();

  console.log('✅ Funding complete!');
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);

  return receipt;
}

async function sendToWallet2ViaAPI(amount = '0.001') {
  console.log(`📤 Sending ${amount} ETH from Wallet 1 to Wallet 2 via EmailPay...\n`);

  // This will use the EmailPay backend to create a transaction
  // The backend will handle PKP signing
  const response = await fetch('http://localhost:3000/emailpay/transactions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderEmail: WALLET_1_EMAIL,
      recipientEmail: WALLET_2_EMAIL,
      amount: amount,
      asset: 'ETH',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create transaction: ${error}`);
  }

  const data = await response.json();
  console.log('✅ Transaction created:', data);

  return data;
}

async function main() {
  console.log('🚀 EmailPay Simple Transfer Tool\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Check balances
    const { balance1, hotBalance } = await checkBalances();

    // Step 2: Fund wallet 1 if needed
    if (balance1.lt(ethers.utils.parseEther('0.005'))) {
      console.log('⚠️  Wallet 1 balance is low, funding from hot wallet...\n');

      if (hotBalance.lt(ethers.utils.parseEther('0.02'))) {
        console.error('❌ Hot wallet needs funds! Please fund it with Sepolia ETH');
        console.log('   Get testnet ETH from: https://sepoliafaucet.com/');
        return;
      }

      await fundWallet1('0.01');
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s
      await checkBalances();
    } else {
      console.log('✅ Wallet 1 has sufficient balance\n');
    }

    // Step 3: Send transaction via EmailPay API
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    const txData = await sendToWallet2ViaAPI('0.001');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TRANSACTION COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 From: ${WALLET_1_EMAIL}`);
    console.log(`📧 To: ${WALLET_2_EMAIL}`);
    console.log(`💰 Amount: 0.001 ETH`);
    if (txData.txHash) {
      console.log(`🔍 Explorer: ${EXPLORER_URL}/tx/${txData.txHash}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 4: Check final balances
    await checkBalances();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkBalances, fundWallet1, sendToWallet2ViaAPI };
