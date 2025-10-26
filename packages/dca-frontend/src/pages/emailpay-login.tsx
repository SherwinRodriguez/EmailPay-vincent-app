import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Loader2, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FormCard from '../components/FormCard';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function EmailPayLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [methodId, setMethodId] = useState('');

  const handleSendOTP = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/emailpay/wallets/login`, { email });

      if (response.data.success) {
        setOtpSent(true);
        
        // Store methodId for Stytch verification
        if (response.data.methodId) {
          setMethodId(response.data.methodId);
          // Store in sessionStorage to pass to verify page
          sessionStorage.setItem('login_methodId', response.data.methodId);
        }
        
        // Show OTP in dev mode
        if (response.data.otpCode) {
          setOtpCode(response.data.otpCode);
        }
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { needsVerification?: boolean; error?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to send login code';
      
      if (axiosError.response?.data?.needsVerification) {
        setError('Wallet not verified yet. Please verify first.');
      } else if (axiosError.response?.status === 404 || errorMessage.includes('not found')) {
        setError('No wallet found for this email. Please create a wallet first.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
      <Navbar />

      <main className="container mx-auto px-4 py-24">
        <div className="max-w-lg mx-auto">
          <motion.a
            href="/#/"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-8 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </motion.a>

          <FormCard>
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
                className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
              >
                <Mail className="w-8 h-8 text-white" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-white mb-2"
              >
                Login to Your Wallet
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-gray-300"
              >
                {otpSent ? 'Check your email for the login code' : 'Enter your email to receive a login code'}
              </motion.p>
            </div>

            {otpSent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="backdrop-blur-md bg-green-500/20 border border-green-400/30 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <p className="text-green-300 font-medium">
                      Login code sent to {email}
                    </p>
                  </div>
                  <p className="text-sm text-green-200/80">
                    Please check your inbox and spam folder
                  </p>
                </div>

                {otpCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="backdrop-blur-md bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-6 mb-6"
                  >
                    <p className="text-sm font-semibold text-yellow-300 mb-2">
                      🔧 Development Mode
                    </p>
                    <p className="text-xs text-yellow-200/80 mb-3">
                      Your login code:
                    </p>
                    <p className="text-3xl font-mono font-bold text-yellow-100 tracking-wider">
                      {otpCode}
                    </p>
                  </motion.div>
                )}

                <p className="text-sm text-gray-300 mb-6">
                  Continue to the verification page to enter your code
                </p>

                <motion.a
                  href={`/#/verify?email=${encodeURIComponent(email)}&mode=login`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all inline-flex items-center justify-center text-lg shadow-lg"
                >
                  Continue to Verification
                </motion.a>

                <button
                  onClick={() => setOtpSent(false)}
                  className="mt-4 text-blue-300 hover:text-blue-200 text-sm font-medium transition-colors"
                >
                  Use a different email
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSendOTP}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-6"
                >
                  <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-lg placeholder-gray-400 backdrop-blur-sm"
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                  />
                  <p className="text-sm text-gray-400 mt-2">
                    We'll send a one-time login code to this email
                  </p>
                </motion.div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-200">{error}</p>
                        {error.includes('create') && (
                          <a
                            href="/#/create-wallet"
                            className="text-sm text-red-300 underline font-medium mt-2 inline-block hover:text-red-200"
                          >
                            Create Wallet →
                          </a>
                        )}
                        {error.includes('verify') && (
                          <a
                            href={`/#/verify?email=${encodeURIComponent(email)}`}
                            className="text-sm text-red-300 underline font-medium mt-2 inline-block hover:text-red-200"
                          >
                            Verify Wallet →
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    'Send Login Code'
                  )}
                </motion.button>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 text-center"
                >
                  <p className="text-sm text-gray-400">
                    Don't have a wallet?{' '}
                    <a href="/#/create-wallet" className="text-blue-400 hover:text-blue-300 font-medium">
                      Create one
                    </a>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mt-6 backdrop-blur-md bg-blue-500/10 border border-blue-400/20 rounded-xl p-4"
                >
                  <p className="text-xs text-gray-300 text-center">
                    🔒 Your wallet is secured by Lit Protocol. We'll never ask for your private keys.
                  </p>
                </motion.div>
              </form>
            )}
          </FormCard>
        </div>
      </main>

      <Footer />
    </div>
  );
}
