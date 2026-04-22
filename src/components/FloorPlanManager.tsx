import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { useFloorPlan, TableData } from '../context/FloorPlanContext';
import { User, CheckCircle2, Ban, Maximize2, Minimize2, Users, AlertTriangle, Map as MapIcon } from 'lucide-react';

const VIEWS = {
  'Overview': { scale: 0.4, x: "2%", y: "2%" }, 
  'Bar District': { scale: 1, x: -10, y: -50 },
  'Lounge Area': { scale: 1, x: -10, y: -250 },
  'Rounds': { scale: 1, x: -10, y: -450 },
  'Benches': { scale: 1, x: -10, y: -650 },
  'Couches': { scale: 1, x: -10, y: -850 },
  'Rooftop': { scale: 1, x: -900, y: -50 },
  'Outdoor': { scale: 1, x: -1200, y: -50 },
};

export default function FloorPlanManager() {
  const { tables, updateTable, swapTables } = useFloorPlan();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<keyof typeof VIEWS>('Overview');
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shakingTableId, setShakingTableId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleTableClick = (e: React.MouseEvent, table: TableData) => {
    e.stopPropagation();
    
    if (swapSourceId) {
      if (swapSourceId === table.id) {
         setSwapSourceId(null);
         return;
      }
      // Make sure target is available 
      if (table.status !== 'available') {
         triggerShake(table.id, `Table must be available to swap.`);
         return;
      }
      
      swapTables(swapSourceId, table.id);
      setSwapSourceId(null);
      showToast(`Guests moved to ${table.label}`);
      return;
    }
    
    setActiveMenu(activeMenu === table.id ? null : table.id);
  };

  const handleBgClick = () => {
    setActiveMenu(null);
    setSwapSourceId(null);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const triggerShake = (id: string, msg: string) => {
    setShakingTableId(id);
    showToast(msg);
    setTimeout(() => setShakingTableId(null), 800);
  };

  const handleDragEnd = (event: any, info: any, sourceTable: TableData) => {
    const dropFinalX = sourceTable.x + info.offset.x;
    const dropFinalY = sourceTable.y + info.offset.y;

    let droppedOn: TableData | null = null;
    
    for (const t of tables) {
      if (t.id === sourceTable.id) continue;
      const dist = Math.sqrt(Math.pow(t.x - dropFinalX, 2) + Math.pow(t.y - dropFinalY, 2));
      if (dist < 80) { 
        droppedOn = t;
        break;
      }
    }

    if (droppedOn) {
      // Validate Source -> Drop Target Rule Constraints
      if (sourceTable.partySize) {
        if (droppedOn.minCapacity && sourceTable.partySize < droppedOn.minCapacity) {
          triggerShake(droppedOn.id, `Capacity Mismatch: ${droppedOn.label} requires at least ${droppedOn.minCapacity} guests.`);
          return;
        }
        if (droppedOn.maxCapacity && sourceTable.partySize > droppedOn.maxCapacity) {
          triggerShake(droppedOn.id, `Capacity Mismatch: ${droppedOn.label} allows a max of ${droppedOn.maxCapacity} guests.`);
          return;
        }
      }
      
      // Validate Drop Target -> Source Rule Constraints (if swapping two occupied tables)
      if (droppedOn.partySize) {
        if (sourceTable.minCapacity && droppedOn.partySize < sourceTable.minCapacity) {
          triggerShake(sourceTable.id, `Capacity Mismatch: ${sourceTable.label} requires at least ${sourceTable.minCapacity} guests.`);
          return;
        }
        if (sourceTable.maxCapacity && droppedOn.partySize > sourceTable.maxCapacity) {
          triggerShake(sourceTable.id, `Capacity Mismatch: ${sourceTable.label} allows a max of ${sourceTable.maxCapacity} guests.`);
          return;
        }
      }

      swapTables(sourceTable.id, droppedOn.id);
    }
  };

  const handleAssignWalkIn = (table: TableData) => {
    setActiveMenu(null);
    const name = window.prompt(`Assign ${table.label}\nEnter Guest Name:`);
    if (!name || !name.trim()) return;

    const sizeInput = window.prompt(`Enter Party Size (Number):`);
    const size = parseInt(sizeInput || '1', 10);
    
    if (isNaN(size) || size <= 0) {
      showToast("Invalid party size entered.");
      return;
    }

    if (table.minCapacity && size < table.minCapacity) {
      triggerShake(table.id, `Capacity Mismatch: ${table.label} strictly requires at least ${table.minCapacity} guests.`);
      return;
    }
    if (table.maxCapacity && size > table.maxCapacity) {
      triggerShake(table.id, `Capacity Mismatch: ${table.label} allows a max of ${table.maxCapacity} guests.`);
      return;
    }

    updateTable(table.id, { status: 'occupied', customerName: name.trim(), partySize: size });
  };

  const TableElement: React.FC<{ table: TableData }> = ({ table }) => {
    let glowClass = 'shadow-[0_0_20px_rgba(74,222,128,0.3)] border-[#4ade80]/40'; 
    let textStateClr = 'text-[#4ade80]';

    if (table.status === 'occupied') {
      glowClass = 'shadow-[0_0_20px_rgba(248,113,113,0.3)] border-[#f87171]/40';
      textStateClr = 'text-[#f87171]';
    } else if (table.status === 'paid') {
      glowClass = 'shadow-[0_0_20px_rgba(251,191,36,0.5)] border-[#fbbf24]/50 animate-pulse';
      textStateClr = 'text-[#fbbf24]';
    } else if (table.status === 'reserved') {
      glowClass = 'shadow-[0_0_20px_rgba(217,119,6,0.3)] border-[#d97706]/40';
      textStateClr = 'text-[#d97706]';
    }

    const shakeClass = shakingTableId === table.id ? 'animate-shake' : '';

    return (
      <motion.div
        drag
        dragSnapToOrigin={true}
        onDragEnd={(e, info) => handleDragEnd(e, info, table)}
        onClick={(e) => handleTableClick(e, table)}
        className={`absolute w-32 h-32 rounded-2xl cursor-pointer flex flex-col items-center justify-center p-3 backdrop-blur-xl ${swapSourceId === table.id ? 'bg-white/20 scale-110 shadow-2xl z-[150]' : 'bg-[#0a0a0a]/60'} border transition-all ${glowClass} ${shakeClass} active:cursor-grabbing hover:bg-[#1c1c1e]/80 tooltip-container ${activeMenu === table.id ? 'z-[100]' : 'z-20'}`}
        style={{ left: table.x, top: table.y }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Reservation Status Pill */}
        {table.status === 'reserved' && (
          <div className="absolute -top-3 right-0 bg-white border border-white/20 text-black text-[8px] font-bold px-2 flex items-center h-[18px] rounded-full shadow-lg tracking-wider uppercase z-10 font-sans">
            Pending
          </div>
        )}
        {/* Capacity Constraints Pills */}
        {(table.minCapacity || table.maxCapacity) && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1c1c1e] border border-white/20 text-[9px] text-white/70 px-2 py-0.5 rounded-full font-mono whitespace-nowrap opacity-80 shadow-lg">
            {table.minCapacity && `MIN ${table.minCapacity}`}
            {table.minCapacity && table.maxCapacity && ` | `}
            {table.maxCapacity && `MAX ${table.maxCapacity}`}
          </div>
        )}

        <span className={`text-xs font-bold tracking-widest ${textStateClr} font-mono mb-1`}>
          {table.label}
        </span>
        
        {table.customerName ? (
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium truncate w-24 text-center text-white font-sans mt-0.5">
              {table.status === 'reserved' ? table.customerName.split(' ')[0] : table.customerName}
            </span>
            <div className="flex items-center gap-1.5 mt-1.5 opacity-80">
              <Users size={12} className="text-white" />
              <span className="text-xs text-white font-mono">{table.partySize}</span>
            </div>
            {table.status !== 'reserved' && (
              <span className="text-[9px] uppercase text-white/50 tracking-wider mt-1.5 font-mono">
                {table.status}
              </span>
            )}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mt-2">
            <User size={18} className="text-white/30" />
          </div>
        )}

        {/* Minimalist Apple-Style Quick Action Menu */}
        {activeMenu === table.id && !swapSourceId && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-52 bg-[#1c1c1e]/90 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden z-[110] flex flex-col py-1.5 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {table.status !== 'available' && (
              <button 
                onClick={() => { updateTable(table.id, {status: 'paid'}); setActiveMenu(null); }} 
                className="px-4 py-3 text-sm text-left text-white hover:bg-[#fbbf24]/10 transition-colors flex items-center gap-3 font-sans font-medium"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] shadow-[0_0_8px_#fbbf24]" />
                Mark as Paid / Clearing
              </button>
            )}

            {table.status !== 'available' && (
              <button 
                onClick={() => {
                   setSwapSourceId(table.id); 
                   setActiveMenu(null); 
                }} 
                className="px-4 py-3 text-sm text-left text-white hover:bg-[#a855f7]/10 transition-colors flex items-center gap-3 font-sans font-medium"
              >
                <Users size={16} className="text-[#a855f7]" />
                Swap Table
              </button>
            )}
            
            {table.status !== 'available' && <div className="h-px w-full bg-white/10 my-1.5"/>}
            
            {table.status !== 'available' ? (() => {
              const isRecentlyReserved = table.status === 'reserved' && table.updatedAt && (Date.now() - table.updatedAt.toMillis()) < 5000;
              
              return (
                <button 
                  onClick={() => { 
                    if (isRecentlyReserved) return;
                    updateTable(table.id, {status: 'available', customerName: undefined, partySize: undefined}); 
                    setActiveMenu(null); 
                  }} 
                  disabled={isRecentlyReserved}
                  className={`px-4 py-3 text-sm text-left transition-colors flex items-center gap-3 font-sans font-medium ${isRecentlyReserved ? 'text-white/30 cursor-not-allowed bg-red-500/5' : 'text-red-400 hover:bg-red-500/10'}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${isRecentlyReserved ? 'bg-red-500/30' : 'bg-[#4ade80] shadow-[0_0_8px_#4ade80]'}`} />
                  {isRecentlyReserved ? 'Locked (Incoming)' : 'Mark as Available'}
                </button>
              );
            })() : (
              <button 
                onClick={() => handleAssignWalkIn(table)} 
                className="px-4 py-3 text-sm text-left text-white hover:bg-white/10 transition-colors flex items-center gap-3 font-sans font-medium"
              >
                <User size={16} className="text-[#4ade80]" />
                Assign Walk-in
              </button>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          border-color: #ef4444 !important;
          box-shadow: 0 0 40px rgba(239, 68, 68, 0.9) !important;
        }
      `}</style>
      
      {/* Dynamic Toast Notification for Constraints */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
        <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 text-white px-6 py-3.5 rounded-full flex flex-row items-center gap-3 shadow-2xl">
          <AlertTriangle size={18} className="text-red-400" />
          <span className="font-medium text-sm tracking-wide">{toastMessage}</span>
        </div>
      </div>

      <div className={isFullscreenMap ? "fixed inset-0 z-[120] bg-[#0a0a0a]/95 backdrop-blur-3xl overflow-x-auto overflow-y-auto no-scrollbar" : "w-full bg-[#0a0a0a] rounded-3xl border border-[#2c2c2e] relative overflow-hidden shadow-2xl pb-[70%]"}>
        
        {/* Top Header Legend */}
        <div className={`top-0 left-0 w-full z-[80] bg-[#1c1c1e]/70 backdrop-blur-2xl border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${isFullscreenMap ? 'fixed' : 'absolute'}`}>
          <div className="flex items-center gap-6">
            <h4 className="flex items-center gap-2 text-white text-sm font-semibold tracking-wide font-sans">
              <MapIcon size={16} className="text-white/50" />
              Floor Map
            </h4>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            
            <div className="hidden sm:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80] shadow-[0_0_10px_#4ade80]" />
                <span className="text-xs text-white/70 font-sans tracking-wide">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#d97706] shadow-[0_0_10px_#d97706]" />
                <span className="text-xs text-white/70 font-sans tracking-wide">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f87171] shadow-[0_0_10px_#f87171]" />
                <span className="text-xs text-white/70 font-sans tracking-wide">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] shadow-[0_0_10px_#fbbf24] animate-pulse" />
                <span className="text-xs text-white/70 font-sans tracking-wide">Paid</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsFullscreenMap(!isFullscreenMap)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-white/70 hover:text-white backdrop-blur-md flex items-center justify-center"
          >
            {isFullscreenMap ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Controls Overlay: Smart Scaling Menu */}
        <div className={`top-20 left-6 z-[60] bg-[#1c1c1e]/95 backdrop-blur-3xl border border-white/20 rounded-xl p-2 flex flex-col gap-1 shadow-2xl ${isFullscreenMap ? 'hidden' : 'absolute'}`}>
          <div className="px-3 py-2 text-xs text-white/50 font-mono tracking-widest uppercase mb-1 drop-shadow-md">View Toggles</div>
          {Object.keys(VIEWS).map((view) => (
            <button
              key={view}
              onClick={() => setCurrentView(view as keyof typeof VIEWS)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left flex items-center justify-between gap-4 ${
                currentView === view 
                  ? 'bg-white text-black shadow-lg' 
                  : 'text-white/70 hover:bg-white/10'
              }`}
            >
              {view}
              {view === 'Overview' && <Maximize2 size={14} className={currentView === view ? 'text-black' : 'text-white/40'} />}
            </button>
          ))}
        </div>

        {/* Swap Target Prompt Overlay */}
        {swapSourceId && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] bg-white text-black px-6 py-3.5 rounded-full flex items-center gap-3 shadow-[0_20px_40px_rgba(0,0,0,0.5)] font-medium font-sans animate-bounce border border-white/40">
            <AlertTriangle size={18} className="text-[#a855f7]" />
            Select an available table to swap with...
            <button 
              onClick={(e) => { e.stopPropagation(); setSwapSourceId(null); }} 
              className="ml-4 text-[11px] uppercase tracking-wider bg-black/10 px-3 py-1.5 rounded-full hover:bg-black/20 font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Scalable Vector Map Workspace */}
        <div className={isFullscreenMap ? 'relative min-w-[1700px] min-h-[1200px]' : 'absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing'}>
          <motion.div 
            ref={containerRef} 
            className="absolute top-0 left-0 w-[1700px] h-[1200px] bg-[#0a0a0a]" 
            onClick={handleBgClick}
            initial={VIEWS['Overview']}
            animate={isFullscreenMap ? { scale: 1, x: 0, y: 0 } : VIEWS[currentView]}
            transition={{ type: "spring", damping: 25, stiffness: 120 }}
            style={{ transformOrigin: "top left" }}
          >
             {/* Dark Mode Architectural SVG */}
             <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none opacity-30">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" />
                  </pattern>
                </defs>
                
                <rect width="100%" height="100%" fill="url(#grid)" />
                <rect width="100%" height="100%" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
                
                {/* Zoning Regions */}
                <rect x="50" y="80" width="1000" height="190" fill="none" stroke="white" strokeWidth="1" strokeDasharray="6,6" strokeOpacity="0.4" />
                <text x="60" y="105" fill="white" fillOpacity="0.5" fontSize="16" fontFamily="monospace" letterSpacing="4">BAR DISTRICT</text>

                <rect x="50" y="280" width="900" height="190" fill="none" stroke="white" strokeWidth="1" strokeDasharray="6,6" strokeOpacity="0.4" />
                <text x="60" y="305" fill="white" fillOpacity="0.5" fontSize="16" fontFamily="monospace" letterSpacing="4">LOUNGE RESERVATIONS</text>

                <rect x="50" y="480" width="800" height="190" fill="none" stroke="white" strokeWidth="1" strokeDasharray="6,6" strokeOpacity="0.4" />
                <text x="60" y="505" fill="white" fillOpacity="0.5" fontSize="16" fontFamily="monospace" letterSpacing="4">ROUND TABLES</text>

                <rect x="50" y="680" width="1000" height="190" fill="none" stroke="white" strokeWidth="1" strokeDasharray="6,6" strokeOpacity="0.4" />
                <text x="60" y="705" fill="white" fillOpacity="0.5" fontSize="16" fontFamily="monospace" letterSpacing="4">BENCH SEATING</text>

                <rect x="50" y="880" width="1100" height="190" fill="none" stroke="white" strokeWidth="1" strokeDasharray="6,6" strokeOpacity="0.4" />
                <text x="60" y="905" fill="white" fillOpacity="0.5" fontSize="16" fontFamily="monospace" letterSpacing="4">COUCHES / PRIVATE</text>

                <path d="M 1000 50 L 1650 50 L 1650 1150 L 1000 1150" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.2" />
                <text x="1020" y="80" fill="white" fillOpacity="0.4" fontSize="20" fontFamily="monospace" letterSpacing="6">OUTDOOR & ROOFTOP</text>
             </svg>

             {/* Interactive Dynamic Map State */}
             {tables.map(table => <TableElement key={table.id} table={table} />)}
          </motion.div>
        </div>
      </div>
    </>
  );
}
