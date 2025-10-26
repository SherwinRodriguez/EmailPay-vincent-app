/** Test script to verify PKP minting with real Lit Relay Run this to test the complete flow */

const axios = require('axios');

const API_URL = 'http://localhost:3000';
const TEST_EMAIL = `test${Date.now()}@example.com`;

async function testPKPMinting() {
  console.log('🧪 Testing PKP Minting Flow...\n');

  try {
    // Step 1: Register/Request OTP
    console.log(`1️⃣ Requesting OTP for ${TEST_EMAIL}...`);
    const registerResponse = await axios.post(`${API_URL}/emailpay/register`, {
      email: TEST_EMAIL,
    });

    console.log('✅ OTP Request Response:', registerResponse.data);
    const methodId = registerResponse.data.methodId;

    if (!methodId) {
      console.error('❌ No methodId received!');
      return;
    }

    // Step 2: Get OTP code from user
    console.log('\n2️⃣ Please check your email and enter the OTP code:');
    console.log(`   (For testing, check the Stytch dashboard or email: ${TEST_EMAIL})`);
    console.log('   Run the verification manually with:');
    console.log(
      `   curl -X POST ${API_URL}/emailpay/verify -H "Content-Type: application/json" -d '{"email":"${TEST_EMAIL}","otpCode":"YOUR_CODE","methodId":"${methodId}"}'`
    );

    return {
      email: TEST_EMAIL,
      methodId: methodId,
    };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run the test
testPKPMinting()
  .then((result) => {
    console.log('\n✅ Test setup complete!');
    console.log('Next step: Verify with the OTP code you receive');
    console.log('Result:', result);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
