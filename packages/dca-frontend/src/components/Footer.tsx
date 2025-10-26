import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">EmailPay</span>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            <motion.a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Twitter className="w-5 h-5" />
            </motion.a>
            <motion.a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Github className="w-5 h-5" />
            </motion.a>
            <motion.a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Linkedin className="w-5 h-5" />
            </motion.a>
          </div>

          {/* Copyright */}
          <div className="text-gray-400 text-sm">
            © 2025 EmailPay. All rights reserved.
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
          <p>Powered by Lit Protocol • Sepolia Testnet</p>
        </div>
      </div>
    </footer>
  );
}
