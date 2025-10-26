import { motion } from 'framer-motion';
import { Mail, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/#/" className="flex items-center gap-2 group">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EmailPay
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="/#/about"
              className="text-gray-600 hover:text-blue-600 transition-colors font-medium"
            >
              About
            </a>
            <a
              href="/#/login"
              className="text-gray-600 hover:text-blue-600 transition-colors font-medium"
            >
              Login
            </a>
            <a
              href="/#/create-wallet"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg hover:scale-105 transition-all font-medium"
            >
              Get Started
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden py-4 space-y-4"
          >
            <a
              href="/#/about"
              className="block text-gray-600 hover:text-blue-600 transition-colors font-medium"
            >
              About
            </a>
            <a
              href="/#/login"
              className="block text-gray-600 hover:text-blue-600 transition-colors font-medium"
            >
              Login
            </a>
            <a
              href="/#/create-wallet"
              className="block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg text-center font-medium"
            >
              Get Started
            </a>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}
