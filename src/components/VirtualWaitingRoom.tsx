import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Clock, Coffee, Droplets, ChevronRight } from 'lucide-react';

export default function VirtualWaitingRoom() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [position, setPosition] = useState(3);
  const [estimatedWait, setEstimatedWait] = useState("12–15");
  const [isFlipped, setIsFlipped] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  const heroImages = [
    "https://iili.io/q2j9Vwu.png",
    "https://iili.io/qttz2I4.jpg",
    "https://iili.io/qxFnyvt.png",
    "https://iili.io/qLf9mXt.jpg",
    "https://iili.io/qqERigt.jpg",
    "https://iili.io/q2u8XqB.jpg"
  ];

  const messages = [
    "Next table is being prepared...",
    "Table 12 is being cleaned",
    "Your party is moving up the queue",
    "Preparing the brewing station",
  ];

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 4000);
    
    const heroInterval = setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(heroInterval);
    };
  }, []);

  // Placeholder for Firebase Realtime listener
  useEffect(() => {
    // const unsubscribe = onSnapshot(doc(db, "waitlist", "ID"), (doc) => {
    //    const data = doc.data();
    //    setPosition(data.position);
    //    setEstimatedWait(data.estimatedWait);
    // });
    // return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden flex flex-col font-serif selection:bg-white/20">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 w-full py-4 flex justify-center items-center z-50 shrink-0 bg-white border-b border-[#F5F5F5]">
        <img 
          src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0669796641.firebasestorage.app/o/WhatsApp%20Image%202026-02-16%20at%209.17.06%20PM.jpeg?alt=media&token=57adec1d-6546-4c4a-ad9a-2ecd30b4d5c5" 
          alt="Cartel Coffee Roasters" 
          className="h-[50px] w-auto object-contain"
        />
      </header>

      {/* 1. HERO SECTION */}
      <div className="relative h-[45vh] sm:h-[50vh] w-full shrink-0 overflow-hidden bg-black">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={heroImageIndex}
            src={heroImages[heroImageIndex]}
            alt="Cartel Coffee"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 0.8, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/60 via-[#0A0A0A]/20 to-[#0A0A0A] pointer-events-none z-10" />
      </div>

      {/* 2. LIVE WAIT STATUS */}
      <div className="relative z-30 -mt-20 sm:-mt-24 px-6 flex flex-col items-center shrink-0">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-xl mb-6 shadow-2xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/50 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white/80"></span>
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-white/80 font-medium font-serif">Live Waitlist</span>
          </div>

          <h2 className="font-serif italic text-4xl sm:text-5xl font-normal mb-8 tracking-wide drop-shadow-lg transition-all duration-500">
            You're #{position} in line
          </h2>

          <div className="flex items-center justify-center gap-8 text-white/60 mb-6 font-serif">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs uppercase tracking-[0.2em] opacity-60">Estimated</span>
              <span className="text-2xl font-light tracking-wider">{estimatedWait} <span className="text-sm uppercase tracking-wide opacity-60 ml-1">min</span></span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs uppercase tracking-[0.2em] opacity-60">Party</span>
              <span className="text-2xl font-light tracking-wider opacity-90">2 <span className="text-sm uppercase tracking-wide opacity-60 ml-1">pax</span></span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32 sm:pb-12 scrollbar-none scroll-smooth">
        {/* MICRO-UPDATES */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="flex justify-center mb-12"
        >
           <div className="font-serif text-xs uppercase tracking-[0.2em] text-white/60 flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl px-5 py-3 rounded-xl border border-white/10 shadow-lg">
             <Clock size={14} className="opacity-50 text-white" />
             <AnimatePresence mode="wait">
               <motion.span
                 key={`update-${messageIndex}`}
                 initial={{ opacity: 0, y: 5 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -5 }}
                 transition={{ duration: 0.8 }}
               >
                 {messages[messageIndex]}
               </motion.span>
             </AnimatePresence>
           </div>
        </motion.div>

        {/* 3. BEAN RECOMMENDATION (FLIP CARD) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 max-w-sm mx-auto w-full font-serif"
        >
          <div className="text-xs uppercase tracking-[0.3em] text-white/50 mb-5 text-center">Featured Roast</div>
          <div 
            className="relative w-full h-[220px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
            style={{ perspective: '1000px' }}
          >
            <motion.div 
              className="w-full h-full relative group"
              initial={false}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front */}
              <div 
                className="absolute inset-0 bg-white/[0.03] border border-white/10 shadow-2xl rounded-2xl p-6 backdrop-blur-xl flex flex-col items-center justify-center hover:bg-white/[0.06] transition-colors duration-500"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-5 bg-white-5 group-hover:scale-110 transition-transform duration-700 ease-out shadow-lg">
                  <Coffee size={18} className="text-white/80" />
                </div>
                <h3 className="tracking-wide text-3xl mb-2 text-white/90 font-medium italic">Ethiopia</h3>
                <p className="text-xs tracking-[0.2em] text-white/50 uppercase">Yirgacheffe</p>
                <div className="absolute bottom-5 right-5 opacity-40 group-hover:opacity-80 transition-opacity">
                  <ChevronRight size={18} />
                </div>
              </div>

              {/* Back */}
              <div 
                className="absolute inset-0 bg-[#0F0F0F] border border-white/10 shadow-2xl rounded-2xl p-6 backdrop-blur-xl flex flex-col items-center justify-center hover:bg-white/[0.06] transition-colors duration-500"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <h4 className="text-xs uppercase tracking-[0.3em] text-white/50 mb-7">Tasting Notes</h4>
                <div className="w-full space-y-5">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-white/60 text-sm tracking-widest">Aroma</span>
                    <span className="text-white/90 text-sm italic">Jasmine</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-white/60 text-sm tracking-widest">Flavor</span>
                    <span className="text-white/90 text-sm italic">Bergamot, Lemon</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-white/60 text-sm tracking-widest">Body</span>
                    <span className="text-white/90 text-sm italic">Light, Tea-like</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* 4. MENU HIGHLIGHTS */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 font-serif"
        >
          <div className="text-xs uppercase tracking-[0.3em] text-white/50 mb-8 text-center">Curated Selection</div>
          
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-8 -mx-6 px-6 hide-scrollbar">
            {[
              { name: "Spanish Latte", desc: "Sweet, condensed milk, rich espresso", price: "28" },
              { name: "V60 Pour Over", desc: "Clean, nuanced, rotating single origin", price: "32" },
              { name: "Cortado", desc: "Equal parts espresso and steamed milk", price: "24" },
            ].map((item, i) => (
              <div 
                key={i} 
                className="snap-center shrink-0 w-[260px] bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-lg rounded-3xl p-6 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-500 cursor-pointer group"
              >
                <div className="w-full h-28 bg-gradient-to-br from-white/[0.08] to-transparent rounded-2xl mb-5 relative overflow-hidden border border-white/5">
                   <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-80 transition-opacity duration-500 group-hover:scale-110 transform ease-out">
                     <Coffee size={28} className="text-white" strokeWidth={1} />
                   </div>
                </div>
                <div className="flex justify-between items-start mb-3 gap-4">
                  <h4 className="text-xl text-white/90 italic">{item.name}</h4>
                  <span className="text-sm tracking-wide text-white/60 pt-1">{item.price}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed tracking-wide">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 5. PRIMARY CTA (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-transparent z-40 pb-safe pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-sm mx-auto pointer-events-auto"
        >
          <a 
            href="https://digital-menu-flash-card.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white border border-white/10 active:scale-[0.98] transition-all duration-400 py-4 rounded-full flex items-center justify-center gap-3 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            <span className="text-xs uppercase tracking-[0.2em] font-medium relative z-10 font-serif">View Menu</span>
            <ChevronRight size={16} className="opacity-60 group-hover:translate-x-1 group-hover:opacity-100 transition-all relative z-10" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
