import React, { useState, useEffect } from 'react';
import { sendEmailVerification, User } from 'firebase/auth';
import { Mail, RefreshCw, CheckCircle2, ChevronLeft } from 'lucide-react';
import { auth, logout } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface EmailVerificationProps {
  user: User;
  onVerified: () => void;
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({ user, onVerified }) => {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isVerified, setIsVerified] = useState(user.emailVerified);

  useEffect(() => {
    // Update path to match requirements
    window.history.pushState({}, '', '/verify-email');
    
    return () => {
      window.history.pushState({}, '', '/');
    };
  }, []);

  const handleSendVerification = async () => {
    try {
      setSending(true);
      setMessage(null);
      await sendEmailVerification(user);
      setMessage({ type: 'success', text: 'Verification link sent. Please check your inbox.' });
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests') {
        setMessage({ type: 'error', text: 'Too many requests. Please wait a few minutes and try again.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to send verification email. Try again later.' });
      }
    } finally {
      setSending(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setChecking(true);
      await user.reload(); // Re-fetch the user object from Firebase
      if (auth.currentUser?.emailVerified) {
        setIsVerified(true);
        setTimeout(() => {
          onVerified();
        }, 1500); // Allow animation to play
      } else {
        setMessage({ type: 'error', text: 'Email not verified yet. Try refreshing again after clicking the link.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Could not fetch status. Please check your connection.' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 selection:bg-white/20 selection:text-white transition-colors duration-500">
      <div className="absolute top-8 left-8">
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors font-medium text-sm"
        >
          <ChevronLeft size={16} /> Sign out and return
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!isVerified ? (
          <motion.div
            key="unverified"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              <Mail size={28} className="text-black" />
            </div>
            
            <h1 className="text-3xl font-bold tracking-tight text-white mb-3">Check your email</h1>
            <p className="text-white/60 mb-8 leading-relaxed font-sans text-sm">
              We’ve sent a verification link to <span className="text-white font-medium">{user.email}</span>. 
              Please verify your address to unlock access to the Cartel Sync Dashboard.
            </p>

            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mb-6 text-sm px-4 py-3 rounded-xl border ${
                  message.type === 'success' ? 'bg-white/10 border-white/20 text-white' : 'bg-red-500/10 border-red-500/20 text-red-100'
                }`}
              >
                {message.text}
              </motion.div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleSendVerification}
                disabled={sending}
                className="w-full relative flex items-center justify-center h-14 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <RefreshCw className="animate-spin text-black/50" size={20} />
                ) : (
                  <span>Resend Email</span>
                )}
              </button>

              <button
                onClick={handleCheckStatus}
                disabled={checking}
                className="w-full relative flex items-center justify-center h-14 bg-transparent border border-white/20 text-white font-medium rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {checking ? (
                  <RefreshCw className="animate-spin text-white/50" size={20} />
                ) : (
                  <span>I've verified my email</span>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(255,255,255,0.4)]"
            >
              <CheckCircle2 size={36} className="text-black" />
            </motion.div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Verified</h2>
            <p className="text-white/60">Redirecting to dashboard...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
