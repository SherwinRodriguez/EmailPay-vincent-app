import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Loader2, Check, AlertCircle, Sparkles, Shield, Zap } from 'lucide-react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FormCard from '../components/FormCard';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function CreateWallet() {
  const [step, setStep] = useState<'input' | 'creating' | 'success'>('input');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    // Get email from URL query params if provided
    const hash = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(hash);
    const emailParam = params.get('email');
    
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleCreateWallet = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStep('creating');

    try {
      const response = await axios.post(`${API_URL}/emailpay/wallets/create`, { email });

      if (response.data.success) {
        // Store methodId for Stytch verification
        if (response.data.methodId) {
          sessionStorage.setItem('wallet_methodId', response.data.methodId);
        }
        
        // Show OTP in dev mode
        if (response.data.otpCode) {
          setOtpCode(response.data.otpCode);
        }
        
        // Success animation
        setTimeout(() => {
          setStep('success');
        }, 1500);
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { alreadyVerified?: boolean; error?: string } } };
      setStep('input');
      
      if (axiosError.response?.data?.alreadyVerified) {
        setError('This email already has a verified wallet. Please login instead.');
      } else {
        setError(axiosError.response?.data?.error || 'Failed to create wallet');
      }
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: <Shield className="w-5 h-5" />,
      text: 'Secured by Lit Protocol PKP'
    },
    {
      icon: <Zap className="w-5 h-5" />,
      text: 'Instant PYUSD transfers'
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      text: 'No complex addresses needed'
    }
  ];

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
            <AnimatePresence mode="wait">
              {step === 'input' && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
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
                      Create Your Wallet
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-gray-300"
                    >
                      Start sending PYUSD with just your email
                    </motion.p>
                  </div>

                  <form onSubmit={handleCreateWallet}>
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
                        We'll send a verification code to this email
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
                            {error.includes('login') && (
                              <a
                                href="/#/login"
                                className="text-sm text-red-300 underline font-medium mt-2 inline-block hover:text-red-200"
                              >
                                Login instead →
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
                          Creating Wallet...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          Create Wallet
                        </>
                      )}
                    </motion.button>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-6 text-center"
                    >
                      <p className="text-sm text-gray-400">
                        Already have a wallet?{' '}
                        <a href="/#/login" className="text-blue-400 hover:text-blue-300 font-medium">
                          Login here
                        </a>
                      </p>
                    </motion.div>
                  </form>

                  {/* Benefits */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mt-8 space-y-3"
                  >
                    {benefits.map((benefit, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.1 }}
                        className="flex items-center gap-3 text-gray-300"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-lg flex items-center justify-center text-blue-300">
                          {benefit.icon}
                        </div>
                        <span className="text-sm">{benefit.text}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}

              {step === 'creating' && (
                <motion.div
                  key="creating"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center py-12"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-20 h-20 mx-auto mb-6"
                  >
                    <div className="w-full h-full rounded-full border-4 border-blue-500/30 border-t-blue-500" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">Creating Your Wallet</h3>
                  <p className="text-gray-300">Setting up your secure PKP wallet...</p>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.6, delay: 0.2 }}
                    className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Check className="w-10 h-10 text-white" />
                    </motion.div>
                  </motion.div>

                  <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-bold text-white mb-2"
                  >
                    Wallet Created! 🎉
                  </motion.h3>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-gray-300 mb-8"
                  >
                    Check your email to verify your wallet
                  </motion.p>

                  {otpCode && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="backdrop-blur-md bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-6 mb-6"
                    >
                      <p className="text-sm font-semibold text-yellow-300 mb-2">
                        🔧 Development Mode
                      </p>
                      <p className="text-xs text-yellow-200/80 mb-3">
                        Your verification code:
                      </p>
                      <p className="text-3xl font-mono font-bold text-yellow-100 tracking-wider">
                        {otpCode}
                      </p>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="backdrop-blur-md bg-blue-500/10 border border-blue-400/20 rounded-xl p-6 mb-6"
                  >
                    <h4 className="text-white font-semibold mb-3">What happens next?</h4>
                    <ul className="text-sm text-gray-300 space-y-2 text-left">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Check your email for the verification code</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Enter the code on the verification page</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <span>Start sending PYUSD instantly!</span>
                      </li>
                    </ul>
                  </motion.div>

                  <motion.a
                    href={`/#/verify?email=${encodeURIComponent(email)}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all inline-flex items-center justify-center text-lg shadow-lg"
                  >
                    Continue to Verification
                  </motion.a>
                </motion.div>
              )}
            </AnimatePresence>
          </FormCard>
        </div>
      </main>

      <Footer />
    </div>
  );
}
