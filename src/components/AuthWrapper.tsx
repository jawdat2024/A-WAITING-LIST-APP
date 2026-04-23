import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lock, Delete, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'cartel_staff_pin';

interface KioskAuthContextType {
  lockTerminal: () => void;
}

export const KioskAuthContext = createContext<KioskAuthContextType>({ lockTerminal: () => {} });
export const useKioskAuth = () => useContext(KioskAuthContext);

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessGranted, setAccessGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [correctPin, setCorrectPin] = useState('0000');
  const [errorAnim, setErrorAnim] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  useEffect(() => {
    const fetchPinAndCheck = async () => {
      try {
        const pinDoc = await getDoc(doc(db, 'config', 'staffPin'));
        const activePin = pinDoc.exists() ? pinDoc.data().pin : '0000';
        setCorrectPin(activePin);

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === activePin) {
          setAccessGranted(true);
        }
      } catch (err) {
        console.error("Failed to fetch PIN", err);
        // Fallback for offline or unreachable Firestore
        if (localStorage.getItem(STORAGE_KEY) === '0000') {
           setAccessGranted(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPinAndCheck();
  }, []);

  useEffect(() => {
    if (pinInput.length === 4) {
      if (pinInput === correctPin) {
        localStorage.setItem(STORAGE_KEY, pinInput);
        setSuccessAnim(true);
        setTimeout(() => setAccessGranted(true), 1200);
      } else {
        setErrorAnim(true);
        setTimeout(() => {
          setPinInput('');
          setErrorAnim(false);
        }, 600);
      }
    }
  }, [pinInput, correctPin]);

  const lockTerminal = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAccessGranted(false);
    setPinInput('');
    setSuccessAnim(false);
  };

  const handleKeyPress = (num: number) => {
    if (pinInput.length < 4) setPinInput(prev => prev + num);
  };

  const handleDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/50" size={32} />
      </div>
    );
  }

  if (accessGranted) {
    return (
      <KioskAuthContext.Provider value={{ lockTerminal }}>
        {children}
      </KioskAuthContext.Provider>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 font-sans z-50 selection:bg-white/20 selection:text-white">
      <div className="absolute top-12 text-center w-full">
        <img 
          src="https://tse3.mm.bing.net/th/id/OIP.5qWSQBwWhh5pE5_5ZxeLFwAAAA?rs=1&pid=ImgDetMain&o=7&rm=3" 
          alt="Cartel Coffee Logo" 
          className="w-16 h-16 mx-auto object-contain filter invert opacity-90 mb-4"
          referrerPolicy="no-referrer"
        />
        <h1 className="font-cinzel tracking-[0.2em] text-white text-lg font-medium opacity-80 uppercase relative">Cartel Coffee</h1>
      </div>

      <motion.div 
        animate={errorAnim ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 text-center max-w-sm w-full shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        <AnimatePresence mode="wait">
          {!successAnim ? (
            <motion.div key="pin-entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <div className="mb-6">
                <h2 className="font-sans font-bold tracking-tight text-2xl text-white mb-2">Staff Access</h2>
                <p className="text-white/40 text-sm">Enter your 4-digit terminal PIN</p>
              </div>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3 mb-8 h-4">
                {[0, 1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                      i < pinInput.length ? 'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/10'
                    } ${errorAnim ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''}`}
                  />
                ))}
              </div>

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="h-16 rounded-2xl bg-white/5 hover:bg-white/15 text-2xl font-medium text-white transition-colors active:scale-95 flex items-center justify-center font-mono"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handleKeyPress(0)}
                  className="h-16 rounded-2xl bg-white/5 hover:bg-white/15 text-2xl font-medium text-white transition-colors active:scale-95 flex items-center justify-center font-mono"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  className="h-16 rounded-2xl bg-white/5 hover:bg-red-400/20 text-white/60 hover:text-red-400 transition-colors active:scale-95 flex items-center justify-center"
                >
                  <Delete size={24} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1.2 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] mb-6"
              >
                <CheckCircle2 size={40} className="text-black" />
              </motion.div>
              <h2 className="text-xl font-bold text-white tracking-wide">Terminal Unlocked</h2>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <div className="absolute bottom-6 text-center">
        <p className="text-[10px] tracking-widest text-white/30 uppercase font-mono flex items-center gap-2">
          <Lock size={10} />
          Cartel Secure Kiosk
        </p>
      </div>
    </div>
  );
};
