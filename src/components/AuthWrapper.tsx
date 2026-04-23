import React, { useState, useLayoutEffect } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const URL_KEY = 'cartel_premium';
const STORAGE_KEY = 'cartel_authorized';

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [isGranted, setIsGranted] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // useLayoutEffect runs synchronously, preventing any layout flicker
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessParam = params.get('access');
    const storedAuth = localStorage.getItem(STORAGE_KEY);

    if (storedAuth === 'true') {
      setIsGranted(true);
      setInitialCheckDone(true);
    } else if (accessParam === URL_KEY) {
      // Keep showing restricted screen, but trigger the unlock validation sequence
      setIsValidating(true);
      localStorage.setItem(STORAGE_KEY, 'true');
      
      // Clean URL silently
      window.history.replaceState({}, '', window.location.pathname);
      
      setTimeout(() => {
        setIsGranted(true);
      }, 2000); // Wait for the lock->check success animation
      setInitialCheckDone(true);
    } else {
      setInitialCheckDone(true);
    }
  }, []);

  // Prevent flicker during initial layout check
  if (!initialCheckDone) return null;

  return (
    <AnimatePresence mode="wait">
      {!isGranted ? (
        <motion.div
          key="restricted-layer"
          className="fixed inset-0 min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans z-50 selection:bg-white/20 selection:text-white"
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute top-12 text-center w-full">
            <img 
              src="https://tse3.mm.bing.net/th/id/OIP.5qWSQBwWhh5pE5_5ZxeLFwAAAA?rs=1&pid=ImgDetMain&o=7&rm=3" 
              alt="Cartel Coffee Logo" 
              className="w-16 h-16 mx-auto object-contain filter invert opacity-90 mb-4"
              referrerPolicy="no-referrer"
            />
            <h1 className="font-cinzel tracking-[0.2em] text-white text-lg font-medium opacity-80 uppercase">Cartel Coffee</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-xl p-10 rounded-3xl border border-white/10 text-center max-w-sm w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            <div className="h-20 flex items-center justify-center relative mb-6">
              <AnimatePresence mode="wait">
                {!isValidating ? (
                  <motion.div
                    key="lock-icon"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0, rotate: -90 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"
                  >
                    <Lock size={28} className="text-white/60" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="check-icon"
                    initial={{ scale: 0, opacity: 0, rotate: 90 }}
                    animate={{ scale: 1.2, opacity: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.8 }}
                    className="absolute w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                  >
                    <CheckCircle2 size={32} className="text-black" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <h2 className="font-sans font-bold tracking-tight text-2xl text-white mb-3">
              {isValidating ? "Access Verified" : "Restricted Access"}
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8">
              {isValidating 
                ? "Initializing master key. Welcome to Cartel." 
                : "This terminal requires a secure access key to connect to the Service Sync Dashboard."}
            </p>
            
            <div className="pt-6 border-t border-white/5">
              <p className="text-[10px] tracking-widest text-white/30 uppercase font-mono">
                Cartel Internal System
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="dashboard-layer"
          initial={isValidating ? { opacity: 0, scale: 0.95, filter: 'blur(10px)' } : false}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, type: 'spring', bounce: 0, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen w-full bg-[#0a0a0a]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
