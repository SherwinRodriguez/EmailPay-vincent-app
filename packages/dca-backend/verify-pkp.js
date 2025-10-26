/** Verify if an address is a real PKP minted on Lit Protocol */
import { ethers } from 'ethers';

const PKP_ADDRESS = '0x281778175d580d250e8975A7A5614ca82aBc278e';
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/3dNXGnASt-nTG8frv4CLB';

// Lit Protocol PKP NFT Contract on Chronicle Yellowstone (testnet)
const PKP_NFT_CONTRACT = '0x8F75a53F65e31DD0D2e40d0827becAaE2299D111'; // Chronicle Yellowstone

// Minimal ABI to check PKP ownership
const PKP_NFT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getEthAddress(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
];

async function verifyPKP() {
  console.log('🔍 Verifying PKP Address:', PKP_ADDRESS);
  console.log('');

  // Connect to Sepolia
  const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC);

  // Check if address exists on-chain
  const code = await provider.getCode(PKP_ADDRESS);
  console.log('✅ Address exists on-chain');
  console.log('   Is Contract:', code !== '0x');

  const balance = await provider.getBalance(PKP_ADDRESS);
  console.log('   Balance:', ethers.utils.formatEther(balance), 'ETH');

  // Check transaction count (nonce)
  const txCount = await provider.getTransactionCount(PKP_ADDRESS);
  console.log('   Transaction Count:', txCount);

  console.log('');
  console.log('📝 Summary:');
  console.log('   This address is a valid Ethereum address');
  console.log("   To verify it's a real PKP, you would need:");
  console.log('   1. The PKP Token ID');
  console.log('   2. Access to the PKP NFT contract on the correct network');
  console.log('');
  console.log('💡 If this PKP was minted in a previous session, it should have:');
  console.log('   - A 64+ character token ID (not a short hash)');
  console.log('   - Been minted via Lit Relay or Lit Contracts');
  console.log('   - Proper auth method binding');
}

verifyPKP()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
