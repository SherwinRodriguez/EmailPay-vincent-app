import { useState, useEffect, FormEvent } from 'react';
import { Mail, CheckCircle, ArrowLeft, Wallet } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function VerifyPage() {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [balances, setBalances] = useState<any>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [mode, setMode] = useState<'verify' | 'login'>('verify');

  useEffect(() => {
    // Get email and mode from URL query params
    const hash = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(hash);
    const emailParam = params.get('email');
    const modeParam = params.get('mode');
    
    if (emailParam) {
      setEmail(emailParam);
      setStep('otp'); // Go directly to OTP step if email is provided
    }
    
    if (modeParam === 'login') {
      setMode('login');
    }
  }, []);

  // Function to fetch wallet balances
  const fetchBalances = async (email: string) => {
    setLoadingBalances(true);
    try {
      const response = await axios.get(`${API_URL}/emailpay/wallets/${encodeURIComponent(email)}/balance`);
      if (response.data.success) {
        setBalances(response.data.balances);
      }
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleSendOTP = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' 
        ? `${API_URL}/emailpay/wallets/login`
        : `${API_URL}/emailpay/wallets/resend-otp`;
        
      const response = await axios.post(endpoint, { email });

      if (response.data.success) {
        setStep('otp');
        
        // Store methodId for Stytch verification
        if (response.data.methodId) {
          if (mode === 'login') {
            sessionStorage.setItem('login_methodId', response.data.methodId);
          } else {
            sessionStorage.setItem('wallet_methodId', response.data.methodId);
          }
        }
        
        // Show OTP in dev mode
        if (response.data.otpCode) {
          setError(`Dev mode: OTP is ${response.data.otpCode}`);
        }
      }
    } catch (err: any) {
      // Check if wallet is already verified
      if (err.response?.data?.alreadyVerified || err.response?.data?.useLogin) {
        setError('Wallet already verified. Redirecting to login...');
        setTimeout(() => {
          window.location.href = `/#/verify?email=${encodeURIComponent(email)}&mode=login`;
        }, 1500);
      } else if (err.response?.data?.needsVerification) {
        setError('Please verify your wallet first');
        setTimeout(() => {
          window.location.href = `/#/verify?email=${encodeURIComponent(email)}`;
        }, 1500);
      } else {
        setError(err.response?.data?.error || `Failed to send ${mode === 'login' ? 'login code' : 'OTP'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login'
        ? `${API_URL}/emailpay/wallets/login/verify`
        : `${API_URL}/emailpay/wallets/verify`;
      
      // Get methodId from sessionStorage
      // For login: use 'login_methodId', for wallet creation: use 'wallet_methodId'
      const methodId = mode === 'login' 
        ? sessionStorage.getItem('login_methodId')
        : sessionStorage.getItem('wallet_methodId');
      
      const response = await axios.post(endpoint, {
        email,
        otpCode,
        ...(methodId ? { methodId } : {})
      });

      if (response.data.success) {
        setSuccess(true);
        
        if (mode === 'login') {
          // Clear methodId from sessionStorage after successful login
          sessionStorage.removeItem('login_methodId');
          
          // Store session token
          const token = response.data.sessionToken;
          localStorage.setItem('sessionToken', token);
          localStorage.setItem('sessionEmail', email);
          localStorage.setItem('sessionExpiry', response.data.expiresAt);
          
          // Set wallet info from response
          setWalletInfo(response.data.wallet);
          
          // Fetch live balances from blockchain
          await fetchBalances(email);
        } else {
          // Regular verification - clear wallet methodId and redirect to login
          sessionStorage.removeItem('wallet_methodId');
          setTimeout(() => {
            window.location.href = `/#/verify?email=${encodeURIComponent(email)}&mode=login`;
          }, 2000);
        }
      }
    } catch (err: any) {
      const errorResponse = err.response?.data;
      const errorMessage = errorResponse?.error || `${mode === 'login' ? 'Login' : 'Verification'} failed`;
      
      // Check if wallet needs to be created
      if (errorResponse?.code === 'WALLET_NOT_CREATED' || 
          errorResponse?.needsWalletCreation ||
          errorMessage.includes('create a wallet') || 
          errorMessage.includes('Wallet not found')) {
        setError('Wallet not set up yet. Redirecting to wallet creation...');
        setTimeout(() => {
          window.location.href = `/#/create-wallet?email=${encodeURIComponent(email)}`;
        }, 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' 
        ? `${API_URL}/emailpay/wallets/login`
        : `${API_URL}/emailpay/wallets/resend-otp`;
      
      const response = await axios.post(endpoint, { email });
      
      if (response.data.success) {
        setError('');
        
        // Store methodId for Stytch verification
        if (response.data.methodId) {
          if (mode === 'login') {
            sessionStorage.setItem('login_methodId', response.data.methodId);
          } else {
            sessionStorage.setItem('wallet_methodId', response.data.methodId);
          }
        }
        
        // Show OTP in dev mode
        if (response.data.otpCode) {
          setError(`Dev mode: New OTP is ${response.data.otpCode}`);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2">
          <Mail className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">EmailPay</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <a
            href="/#/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              {mode === 'login' ? 'Login to Your Wallet' : 'Verify Your Wallet'}
            </h2>

            {success && mode === 'login' && walletInfo ? (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Login Successful!
                </h3>
                <p className="text-gray-600 mb-6">
                  Welcome back to your EmailPay wallet.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-1">Email</p>
                    <p className="font-mono text-sm text-gray-900 break-all">{walletInfo.email}</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-1">Wallet Address</p>
                    <p className="font-mono text-sm text-gray-900 break-all">{walletInfo.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">PYUSD Balance</p>
                      <p className="font-semibold text-gray-900">
                        {loadingBalances ? 'Loading...' : (balances?.pyusd || '0')} PYUSD
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">ETH Balance</p>
                      <p className="font-semibold text-gray-900">
                        {loadingBalances ? 'Loading...' : (balances?.eth || '0')} ETH
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => fetchBalances(email)}
                  disabled={loadingBalances}
                  className="w-full mb-4 px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {loadingBalances ? 'Refreshing...' : '🔄 Refresh Balance'}
                </button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Send Payments via Email</h4>
                  <p className="text-sm text-gray-700 mb-3">
                    Send an email to{' '}
                    <span className="font-mono text-blue-700">emailpay.demotest@gmail.com</span>{' '}
                    with commands like:
                  </p>
                  <div className="bg-white rounded p-3 mb-2">
                    <code className="text-sm text-gray-800">BALANCE</code>
                  </div>
                  <div className="bg-white rounded p-3">
                    <code className="text-sm text-gray-800">
                      SEND 10 PYUSD TO recipient@example.com
                    </code>
                  </div>
                </div>
              </div>
            ) : success && mode === 'verify' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Wallet Verified!
                </p>
                <p className="text-gray-600 mb-4">
                  Redirecting to login...
                </p>
              </div>
            ) : step === 'email' ? (
              <form onSubmit={handleSendOTP}>
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : mode === 'login' ? 'Send Login Code' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerify}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 p-3 rounded border">
                    {email}
                  </p>
                </div>

                <div className="mb-6">
                  <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700 mb-2">
                    {mode === 'login' ? 'Login Code' : 'Verification Code'}
                  </label>
                  <input
                    type="text"
                    id="otpCode"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 text-center text-2xl font-mono tracking-widest"
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
                >
                  {loading ? 'Verifying...' : (
                    <>
                      <Wallet className="w-5 h-5" />
                      {mode === 'login' ? 'Login' : 'Verify'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Resend Code
                </button>
              </form>
            )}

            {!success && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-gray-600 text-center">
                  {mode === 'login' ? (
                    <>
                      Need to verify?{' '}
                      <a href={`/#/verify?email=${email}`} className="text-blue-600 font-medium">
                        Verify here
                      </a>
                    </>
                  ) : (
                    <>
                      Already verified?{' '}
                      <a href={`/#/verify?email=${email}&mode=login`} className="text-blue-600 font-medium">
                        Login here
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
