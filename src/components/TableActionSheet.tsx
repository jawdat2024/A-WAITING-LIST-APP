import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const { updateTable, assignTableAtomic } = useFloorPlan();
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [isOverriding, setIsOverriding] = useState(false);

  // Cache the table data so the exit animation has content to render while sliding down
  const [cachedTable, setCachedTable] = useState<TableData | null>(table);
  useEffect(() => {
    if (table) setCachedTable(table);
  }, [table]);

  const activeTable = table || cachedTable;

  const handleAssignWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable) return;
    if (!guestName.trim() || partySize <= 0) return;
    
    if (partySize > activeTable.capacity && !isOverriding) {
      setIsOverriding(true);
      return;
    }

    setIsSyncing(true);
    try {
      const success = await assignTableAtomic(activeTable.id, { 
        status: 'occupied', 
        currentGuest: {
          name: guestName.trim(),
          partySize: partySize,
          seatedAt: new Date().toISOString()
        }
      });
      setIsSyncing(false);
      if (!success) {
        alert('Table was just occupied by another host. Please select another table.');
      } else {
        setIsAssigning(false);
        setIsOverriding(false);
        onClose();
      }
    } catch (err) {
      setIsSyncing(false);
      console.error(err);
      alert('Network error or table not found.');
    }
  };

  const elapsedMinutes = activeTable?.currentGuest?.seatedAt 
    ? Math.floor((Date.now() - new Date(activeTable.currentGuest.seatedAt).getTime()) / 60000) 
    : 0;

  const content = (
    <AnimatePresence>
      {table && activeTable && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[990]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[999] max-w-2xl mx-auto bg-[#141414] rounded-t-3xl shadow-[0_-20px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[85vh] flex flex-col"
          >
            {/* Handle for drag (visual only for luxury feel) */}
            <div className="w-full h-8 flex justify-center items-center cursor-pointer shrink-0" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            <div className="px-6 pb-6 flex-1">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-light text-[#e8e6e3] tracking-widest uppercase mb-1">
                    {activeTable.label}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/40 font-mono tracking-wide">
                    <MapPin size={12} />
                    <span>{(activeTable.zone || 'Unknown Zone').toUpperCase()}</span>
                    <span className="mx-1">•</span>
                    <span>CAPACITY {activeTable.capacity}</span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/60">
                  <X size={18} />
                </button>
              </div>

              {isAssigning ? (
                <form id="assignForm" onSubmit={handleAssignWalkIn} className="space-y-4 animate-in fade-in slide-in-from-bottom-4" style={{ animationDuration: '800ms', animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                  <div className="space-y-4">
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                      <input 
                        type="text" 
                        placeholder="Guest Name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        autoFocus
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl py-3 pl-10 pr-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 outline-none focus:border-[var(--accent)]/50 transition-colors"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-2">
                      <span className="pl-2 text-[var(--text-secondary)] text-sm">Party Size</span>
                      <div className="flex items-center gap-4 text-[var(--text-primary)]">
                        <button type="button" onClick={() => { setPartySize(Math.max(1, partySize - 1)); setIsOverriding(false); }} className="w-10 h-10 rounded-lg bg-[var(--card-bg)]/5 hover:bg-[var(--card-bg)]/10 flex items-center justify-center border border-[var(--border-color)]">-</button>
                        <span className="w-4 text-center font-mono">{partySize}</span>
                        <button type="button" onClick={() => { setPartySize(partySize + 1); setIsOverriding(false); }} className="w-10 h-10 rounded-lg bg-[var(--card-bg)]/5 hover:bg-[var(--card-bg)]/10 flex items-center justify-center border border-[var(--border-color)]">+</button>
                      </div>
                    </div>
                  </div>

                  {isOverriding && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl"
                    >
                      <p className="text-amber-500 text-sm">
                        ⚠️ Over capacity: Table seats {activeTable.capacity}, guest party is {partySize}.
                      </p>
                    </motion.div>
                  )}
                </form>
              ) : (
                <div className="space-y-6 pb-6">
                  {/* Status Specific Metrics */}
                  {activeTable.currentGuest && (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl p-5 flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium text-lg mb-1">{activeTable.currentGuest.name}</div>
                        <div className="flex items-center gap-4 text-xs text-white/50 font-mono">
                          <span className="flex items-center gap-1.5"><Users size={12} /> {activeTable.currentGuest.partySize} Guests</span>
                          <span className="flex items-center gap-1.5"><Clock size={12} /> {elapsedMinutes}m seated</span>
                        </div>
                      </div>
                      {activeTable.assignedWaiter && (
                        <div className="text-right">
                          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Waiter</div>
                          <div className="text-white/80 text-sm">{activeTable.assignedWaiter}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Destructive / Secondary Actions */}
                  {activeTable.status !== 'available' && activeTable.status !== 'paying' && (
                    <button 
                      onClick={() => {
                        updateTable(activeTable.id, { status: 'available', currentGuest: undefined, assignedWaiter: undefined });
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

            {/* Sticky Action Buttons at the Bottom */}
            <div className="sticky bottom-0 bg-[#141414]/95 backdrop-blur-xl p-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/5 flex gap-3 z-10 shrink-0">
              {isAssigning ? (
                <>
                  <button type="button" onClick={() => setIsAssigning(false)} className="flex-1 py-3.5 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-medium hover:bg-[var(--card-bg)] transition-colors text-sm">
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    form="assignForm"
                    disabled={isSyncing} 
                    className={cn(
                      "flex-1 py-3.5 rounded-xl font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 text-sm",
                      isSyncing ? 'opacity-50' : 'hover:opacity-90',
                      isOverriding 
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50' 
                        : 'bg-[var(--accent)] text-[var(--bg-primary)]'
                    )}
                  >
                    {isSyncing ? 'Assigning...' : (
                      isOverriding ? 'ASSIGN ANYWAY' : <><Check size={18} /> CONFIRM SEATING</>
                    )}
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 w-full">
                  {activeTable.status === 'available' ? (
                    <button 
                      onClick={() => setIsAssigning(true)}
                      className="col-span-2 py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-medium tracking-wide transition-colors flex items-center justify-center gap-2"
                    >
                      <User size={18} />
                      Seat Walk-in
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          if (activeTable.status === 'paying') {
                            updateTable(activeTable.id, { status: 'available', currentGuest: undefined, assignedWaiter: undefined });
                            onClose();
                          } else {
                            updateTable(activeTable.id, { status: 'paying' });
                            onClose();
                          }
                        }}
                        className={cn(
                          "py-4 rounded-xl border font-medium tracking-wide transition-colors flex items-center justify-center gap-2",
                          activeTable.status === 'paying' 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20"
                        )}
                      >
                        {activeTable.status === 'paying' ? (
                          <><Check size={18} /> Clear Table</>
                        ) : (
                          <><CreditCard size={18} /> Mark Paying</>
                        )}
                      </button>

                      <button 
                        onClick={() => {
                          onInitiateSwap(activeTable.id);
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
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
