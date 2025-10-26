import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { useState, useEffect } from 'react';
import { JwtProvider, useJwtContext } from '@lit-protocol/vincent-app-sdk/react';

import { env } from '@/config/env';

import './App.css';

import { Home } from '@/pages/home';
import { Login } from '@/pages/login';
import EmailPay from '@/pages/emailpay';
import CreateWallet from '@/pages/create-wallet';
import EmailPayLogin from '@/pages/emailpay-login';
import VerifyPage from '@/pages/verify';
import { Header } from '@/components/ui/header';
import { Footer } from '@/components/ui/footer';
import { DottedBackground } from '@/components/ui/dotted-background';

const { VITE_APP_ID } = env;

function AppContent() {
  const { authInfo } = useJwtContext();
  const [currentPage, setCurrentPage] = useState('emailpay'); // Default to EmailPay

  useEffect(() => {
    // Simple hash-based routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash.startsWith('/dca')) {
        setCurrentPage('dca');
      } else if (hash.startsWith('/verify')) {
        setCurrentPage('verify');
      } else if (hash.startsWith('/create-wallet')) {
        setCurrentPage('create-wallet');
      } else if (hash.startsWith('/login')) {
        setCurrentPage('login');
      } else {
        setCurrentPage('emailpay'); // Default to EmailPay
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Render EmailPay pages without authentication
  if (currentPage === 'emailpay') {
    return <EmailPay />;
  }

  if (currentPage === 'create-wallet') {
    return <CreateWallet />;
  }

  if (currentPage === 'login') {
    return <EmailPayLogin />;
  }

  if (currentPage === 'verify') {
    return <VerifyPage />;
  }

  // DCA pages require authentication
  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen overflow-x-hidden">
      <DottedBackground />
      <Header title="Vincent DCA" />
      {authInfo ? <Home /> : <Login />}
      <Footer />
    </div>
  );
}

function App() {
  return (
    <JwtProvider appId={VITE_APP_ID}>
      <AppContent />
    </JwtProvider>
  );
}

export default App;
