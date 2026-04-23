import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle } from '../lib/firebase';
import { Loader2 } from 'lucide-react';
import { EmailVerification } from './EmailVerification';

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [forceVerified, setForceVerified] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/50" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 selection:bg-white/20 selection:text-white transition-colors duration-500">
        <div className="absolute top-12 text-center w-full">
          <img 
            src="https://tse3.mm.bing.net/th/id/OIP.5qWSQBwWhh5pE5_5ZxeLFwAAAA?rs=1&pid=ImgDetMain&o=7&rm=3" 
            alt="Cartel Coffee Logo" 
            className="w-16 h-16 mx-auto object-contain filter invert opacity-90 mb-4"
            referrerPolicy="no-referrer"
          />
          <h1 className="font-cinzel tracking-[0.2em] text-white text-lg font-medium opacity-80 uppercase">Cartel Coffee</h1>
        </div>
        
        <div className="bg-white/5 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-white/10 text-center max-w-sm w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
          <h2 className="font-sans font-bold tracking-tight text-3xl text-white mb-2">Staff Login</h2>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">Secure access to the Cartel Service Sync Dashboard.</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-white text-black font-semibold py-4 rounded-xl hover:bg-neutral-200 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_14px_0_rgba(255,255,255,0.2)] flex justify-center items-center gap-3"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!user.emailVerified && !forceVerified) {
    return <EmailVerification user={user} onVerified={() => setForceVerified(true)} />;
  }

  return <>{children}</>;
};
