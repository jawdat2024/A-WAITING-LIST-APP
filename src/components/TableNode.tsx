import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CreditCard, Check, Leaf, Edit3, ArrowLeftRight, FileText, Ban } from 'lucide-react';
import { TableData, useFloorPlan } from '../context/FloorPlanContext';
import { cn } from '../lib/utils';

interface TableNodeProps {
  table: TableData;
  isActive: boolean;
  isDragTarget?: boolean;
  onTap: (e: React.MouseEvent, table: TableData) => void;
  onDragStart?: () => void;
  onInitiateSwap?: (tableId: string) => void;
  onEditDetails?: (tableId: string) => void;
  index?: number;
  isWaitlistTarget?: boolean;
  isSyncing?: boolean;
}

export const TableNode: React.FC<TableNodeProps> = ({ table, isActive, isDragTarget, onTap, onDragStart, onInitiateSwap, onEditDetails, index = 0, isWaitlistTarget, isSyncing }) => {
  const { status = 'available', shape = 'square', label = '?', capacity = 2, currentGuest, zone = 'Main' } = table;

  const [justCleared, setJustCleared] = useState(false);
  const prevStatus = useRef(status);

  // Long press logic
  const pressTimerRef = useRef<NodeJS.Timeout>();
  const [showRadialMenu, setShowRadialMenu] = useState(false);

  const startPress = (e: React.PointerEvent) => {
    if (showRadialMenu) return;
    pressTimerRef.current = setTimeout(() => {
      setShowRadialMenu(true);
      if ("vibrate" in navigator) navigator.vibrate(50);
    }, 500); // 500ms long press
  };

  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = undefined;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (showRadialMenu) {
      e.stopPropagation();
      return;
    }
    startPress(e);
  };

  useEffect(() => {
    if (prevStatus.current !== 'available' && status === 'available') {
      setJustCleared(true);
      const t = setTimeout(() => setJustCleared(false), 600);
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]);

  // Aesthetic mapping based on status
  const getStatusStyles = () => {
    switch (status) {
      case 'available':
        return {
          glow: 'shadow-[0_0_15px_var(--status-available-glow)]',
          border: 'border-[var(--status-available-stroke)]',
          text: 'text-[#10b981]',
          fill: 'bg-[var(--status-available-glow)]',
        };
      case 'reserved':
      case 'pending':
        return {
          glow: '',
          border: 'border-[var(--status-reserved-stroke)] border-dashed border-[1.5px]',
          text: 'text-[var(--status-reserved-stroke)]',
          fill: 'bg-transparent',
        };
      case 'occupied':
        return {
          glow: 'shadow-[0_0_15px_var(--status-occupied-fill)]',
          border: 'border-[var(--status-occupied-stroke)]',
          text: 'text-[var(--status-occupied-text)]',
          fill: 'bg-[var(--status-occupied-fill)]',
          opacity: 'opacity-90',
        };
      case 'cleaning':
      case 'paying': // Alias paying as cleaning for UI simplicity or keep separate
        return {
          glow: 'animate-cleaning',
          border: 'border-[var(--status-cleaning-stroke)]',
          text: 'text-[var(--status-cleaning-stroke)] relative z-10',
          fill: 'bg-[var(--status-cleaning-glow)]',
        };
      default:
        return {
          glow: 'shadow-none',
          border: 'border-[var(--border-color)]',
          text: 'text-[var(--text-secondary)]',
          fill: 'bg-transparent',
        };
    }
  };

  const statusStyle = getStatusStyles();

  // Morphological mapping based on shape
  const getShapeStyles = () => {
    switch (shape) {
      case 'bar':
        return 'w-16 h-28 rounded-xl flex-col';
      case 'round':
        return 'w-24 h-24 rounded-full flex-col';
      case 'bench':
        return 'w-36 h-20 rounded-xl flex-row';
      case 'couch':
        return 'w-32 h-32 rounded-3xl flex-col';
      case 'square':
      default:
        return 'w-24 h-24 rounded-2xl flex-col';
    }
  };

  const isOutdoor = zone === 'Outdoor';
  const isRooftop = zone === 'Rooftop';

  const baseClasses = cn(
    'relative flex items-center justify-center p-3 cursor-pointer luxury-transition',
    'backdrop-blur-sm border hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:scale-[1.02]',
    statusStyle.border,
    isActive ? 'bg-white/5 border-white shadow-[0_0_25px_rgba(255,255,255,0.15)]' : statusStyle.fill,
    !isActive && statusStyle.glow,
    !isActive && (statusStyle as any).opacity,
    getShapeStyles(),
    isActive && 'z-50 scale-105',
    isSyncing && 'animate-pulse opacity-80',
    isWaitlistTarget && 'ring-1 ring-offset-2 ring-offset-black ring-white animate-pulse z-40',
    isDragTarget && 'border-dashed border-[1.5px] border-white scale-105 opacity-80',
    justCleared && 'animate-table-clear',
  );

  const { updateTable } = useFloorPlan();

  const [timeSeated, setTimeSeated] = useState<string>('');

  useEffect(() => {
    if (status === 'occupied' && currentGuest?.seatedAt) {
      const updateTimer = () => {
        const diffMs = Date.now() - currentGuest.seatedAt!;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) setTimeSeated(`${mins}m`);
        else setTimeSeated(`${Math.floor(mins/60)}h ${mins%60}m`);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 60000);
      return () => clearInterval(interval);
    } else {
       setTimeSeated('');
    }
  }, [status, currentGuest?.seatedAt]);

  return (
    <div className="relative">
      <motion.div
        layoutId={`table-${table.id}`}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(e, info) => {
          if (info.offset.x < -60 && status === 'occupied') {
            // Swipe left to mark cleaning
            updateTable(table.id, { status: 'cleaning' });
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => {
          cancelPress();
          if (!showRadialMenu) onTap(e as any, table);
        }}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        className={baseClasses}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: isActive ? 1.04 : 1, y: 0 }}
        transition={{ 
          opacity: { duration: 0.6, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] },
          y: { duration: 0.6, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] },
          scale: { duration: 0.6, type: 'spring', stiffness: 200, damping: 30 }
        }}
      >
        {/* Table Label */}
      <div className={cn('absolute -top-3 px-2 py-0.5 rounded-[4px] bg-[#0A0A0A] border border-[rgba(255,255,255,0.15)] text-[10px] font-medium tracking-[0.15em] uppercase text-[#EAEAEA] whitespace-nowrap z-10 shadow-sm', shape === 'bench' && '-top-3.5')}>
        {label}
      </div>
      
      {/* Centered Content */}
      <AnimatePresence mode="popLayout">
        {status === 'cleaning' || status === 'paying' ? (
          <motion.div
            key="cleaning"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center justify-center gap-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[9px] text-[var(--text-primary)] font-medium tracking-[0.2em] uppercase opacity-70">Cleaning</span>
          </motion.div>
        ) : currentGuest ? (
          <motion.div
            key="occupied"
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            className={`flex flex-col items-center justify-center ${statusStyle.text}`}
          >
            <span className="font-serif text-[15px] italic truncate max-w-[80px] text-center opacity-90">
              {currentGuest.name.split(' ')[0]}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 opacity-50">
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-inherit">{currentGuest.partySize} PAX</span>
              {timeSeated && (
                 <>
                   <span className="text-[10px]">•</span>
                   <span className="text-[10px] font-mono tracking-wider">{timeSeated}</span>
                 </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="available"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-80 transition-opacity gap-1"
          >
            <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-white">CAP {capacity}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Selection Overlay */}
      {isActive && (
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)] z-20"
        >
          <Check size={12} className="text-black stroke-[3px]" />
        </motion.div>
      )}
    </motion.div>

    {/* Radial Context Menu */}
    <AnimatePresence>
      {showRadialMenu && (
        <>
          <div 
            className="fixed inset-0 z-[150]" 
            onContextMenu={e => { e.preventDefault(); setShowRadialMenu(false); }}
            onPointerDown={() => setShowRadialMenu(false)} 
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 z-[200] pointer-events-none"
          >
            {/* Swap Button (Top) */}
            <motion.button
               whileHover={{ scale: 1.1 }}
               onPointerDown={(e) => { e.stopPropagation(); setShowRadialMenu(false); onInitiateSwap?.(table.id); }}
               className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 w-12 h-12 rounded-full bg-brand-card border border-brand-border text-brand-text flex flex-col items-center justify-center shadow-xl pointer-events-auto"
            >
              <ArrowLeftRight size={16} className="text-purple-400" />
            </motion.button>
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-10 text-[10px] text-white/70 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded pointer-events-none">Swap Table</span>

            {/* Edit Guests (Right) */}
            <motion.button
               whileHover={{ scale: 1.1 }}
               onPointerDown={(e) => { e.stopPropagation(); setShowRadialMenu(false); onEditDetails?.(table.id); }}
               className="absolute top-1/2 right-0 translate-x-4 -translate-y-1/2 w-12 h-12 rounded-full bg-brand-card border border-brand-border text-brand-text flex flex-col items-center justify-center shadow-xl pointer-events-auto"
            >
              <Edit3 size={16} className="text-brand-accent" />
            </motion.button>
            <span className="absolute top-1/2 right-0 translate-x-16 -translate-y-1/2 text-[10px] text-white/70 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded pointer-events-none">Details</span>

            {/* View Bill (Bottom) */}
            <motion.button
               whileHover={{ scale: 1.1 }}
               onPointerDown={(e) => { e.stopPropagation(); setShowRadialMenu(false); alert('Mock Bill Popup'); }}
               className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 w-12 h-12 rounded-full bg-brand-card border border-brand-border text-brand-text flex flex-col items-center justify-center shadow-xl pointer-events-auto"
            >
              <FileText size={16} className="text-emerald-400" />
            </motion.button>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-16 text-[10px] text-white/70 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded pointer-events-none">View Bill</span>
            
            {/* Cancel (Left) */}
            <motion.button
               whileHover={{ scale: 1.1 }}
               onPointerDown={(e) => { e.stopPropagation(); setShowRadialMenu(false); }}
               className="absolute top-1/2 left-0 -translate-x-4 -translate-y-1/2 w-12 h-12 rounded-full bg-brand-card border border-brand-border text-brand-text flex flex-col items-center justify-center shadow-xl pointer-events-auto"
            >
              <Ban size={16} className="text-red-400" />
            </motion.button>
            <span className="absolute top-1/2 left-0 -translate-x-16 -translate-y-1/2 text-[10px] text-white/70 whitespace-nowrap bg-black/60 px-2 py-0.5 rounded pointer-events-none">Cancel</span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
  );
}
