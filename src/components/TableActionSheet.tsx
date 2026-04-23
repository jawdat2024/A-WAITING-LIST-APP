import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Users, CreditCard, X, Check, ArrowLeftRight, Clock, MapPin } from 'lucide-react';
import { TableData, useFloorPlan } from '../context/FloorPlanContext';
import { cn } from '../lib/utils';

interface TableActionSheetProps {
  table: TableData | null;
  onClose: () => void;
  onInitiateSwap: (tableId: string) => void;
}

export function TableActionSheet({ table, onClose, onInitiateSwap }: TableActionSheetProps) {
  const { updateTable } = useFloorPlan();
  const [isAssigning, setIsAssigning] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [partySize, setPartySize] = useState(2);

  if (!table) return null;

  const handleAssignWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || partySize <= 0) return;

    updateTable(table.id, { 
      status: 'occupied', 
      currentGuest: {
        name: guestName.trim(),
        partySize: partySize,
        seatedAt: new Date().toISOString()
      }
    });
    setIsAssigning(false);
    onClose();
  };

  const elapsedMinutes = table.currentGuest?.seatedAt 
    ? Math.floor((Date.now() - new Date(table.currentGuest.seatedAt).getTime()) / 60000) 
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[200] max-w-2xl mx-auto pb-safe"
      >
        <div className="bg-[#141414] border-t border-white/10 rounded-t-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.8)] overflow-hidden">
          
          {/* Handle for drag (visual only for luxury feel) */}
          <div className="w-full h-8 flex justify-center items-center cursor-pointer" onClick={onClose}>
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="px-6 pb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-light text-[#e8e6e3] tracking-widest uppercase mb-1">
                  {table.label}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/40 font-mono tracking-wide">
                  <MapPin size={12} />
                  <span>{table.zone.toUpperCase()}</span>
                  <span className="mx-1">•</span>
                  <span>CAPACITY {table.capacity}</span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60">
                <X size={18} />
              </button>
            </div>

            {isAssigning ? (
              <form onSubmit={handleAssignWalkIn} className="space-y-4 animate-in fade-in slide-in-from-bottom-4" style={{ animationDuration: '800ms', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <div className="space-y-4">
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input 
                      type="text" 
                      placeholder="Guest Name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      autoFocus
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/30 outline-none focus:border-[#4ade80]/50 transition-colors"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between bg-[#0a0a0a] border border-white/10 rounded-xl p-2">
                    <span className="pl-2 text-white/50 text-sm">Party Size</span>
                    <div className="flex items-center gap-4 text-white">
                      <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">-</button>
                      <span className="w-4 text-center font-mono">{partySize}</span>
                      <button type="button" onClick={() => setPartySize(partySize + 1)} className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">+</button>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsAssigning(false)} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/70 font-medium hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-3.5 rounded-xl bg-[#4ade80] text-black font-semibold tracking-wide hover:bg-[#4ade80]/90 transition-colors flex items-center justify-center gap-2">
                    <Check size={18} /> Assign Walk-in
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                
                {/* Status Specific Metrics */}
                {table.currentGuest && (
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium text-lg mb-1">{table.currentGuest.name}</div>
                      <div className="flex items-center gap-4 text-xs text-white/50 font-mono">
                        <span className="flex items-center gap-1.5"><Users size={12} /> {table.currentGuest.partySize} Guests</span>
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {elapsedMinutes}m seated</span>
                      </div>
                    </div>
                    {table.assignedWaiter && (
                      <div className="text-right">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Waiter</div>
                        <div className="text-white/80 text-sm">{table.assignedWaiter}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Primary Actions Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {table.status === 'available' ? (
                    <button 
                      onClick={() => setIsAssigning(true)}
                      className="col-span-2 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium tracking-wide transition-colors flex items-center justify-center gap-2"
                    >
                      <User size={18} className="text-[#4ade80]" />
                      Seat Walk-in
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          if (table.status === 'paying') {
                            updateTable(table.id, { status: 'available', currentGuest: undefined, assignedWaiter: undefined });
                            onClose();
                          } else {
                            updateTable(table.id, { status: 'paying' });
                            onClose();
                          }
                        }}
                        className={cn(
                          "py-4 rounded-xl border font-medium tracking-wide transition-colors flex items-center justify-center gap-2",
                          table.status === 'paying' 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20"
                        )}
                      >
                        {table.status === 'paying' ? (
                          <><Check size={18} /> Clear Table</>
                        ) : (
                          <><CreditCard size={18} /> Mark Paying</>
                        )}
                      </button>

                      <button 
                        onClick={() => {
                          onInitiateSwap(table.id);
                          onClose();
                        }}
                        className="py-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 font-medium tracking-wide transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowLeftRight size={18} />
                        Transfer
                      </button>
                    </>
                  )}
                </div>

                {/* Destructive / Secondary Actions */}
                {table.status !== 'available' && table.status !== 'paying' && (
                  <button 
                    onClick={() => {
                      updateTable(table.id, { status: 'available', currentGuest: undefined, assignedWaiter: undefined });
                      onClose();
                    }}
                    className="w-full py-3 text-sm text-white/30 hover:text-red-400 transition-colors uppercase tracking-widest font-mono"
                  >
                    Force Clear (Cancel)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190]"
      />
    </AnimatePresence>
  );
}
