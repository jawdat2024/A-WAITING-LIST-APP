import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle } from '../lib/firebase';
import { Loader2 } from 'lucide-react';

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#1c1c1e] p-8 rounded-2xl border border-white/10 text-center max-w-sm w-full">
          <h1 className="font-cinzel text-2xl text-white mb-2">Cartel Staff Login</h1>
          <p className="text-white/50 text-sm mb-6">Service Sync Dashboard requires verified staff access.</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
