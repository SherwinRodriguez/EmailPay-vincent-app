import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FormCardProps {
  children: ReactNode;
  className?: string;
}

export default function FormCard({ children, className = '' }: FormCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative ${className}`}
    >
      {/* Glassmorphism card */}
      <div className="relative backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl pointer-events-none" />
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
