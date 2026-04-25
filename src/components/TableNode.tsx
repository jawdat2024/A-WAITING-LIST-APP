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
  index?: number;
  isWaitlistTarget?: boolean;
  isSyncing?: boolean;
}

export const TableNode: React.FC<TableNodeProps> = ({ table, isActive, isDragTarget, onTap, onDragStart, onInitiateSwap, index = 0, isWaitlistTarget, isSyncing }) => {
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
          glow: 'shadow-[0_0_25px_rgba(101,163,13,0.25)] animate-breathe',
          border: 'border-[var(--status-available-stroke)]',
          text: 'text-[var(--status-available-stroke)]',
          fill: 'bg-gradient-to-br from-[var(--status-available-gradient-from)] to-[var(--status-available-gradient-to)]',
        };
      case 'reserved':
      case 'pending': // Alias for pending
        return {
          glow: 'animate-pulse',
          border: 'border-[var(--status-reserved-stroke)]',
          text: 'text-[var(--status-reserved-stroke)]',
          fill: 'bg-[var(--status-reserved-fill)]',
        };
      case 'occupied':
        return {
          glow: '',
          border: 'border-[var(--status-occupied-stroke)]',
          text: 'text-[var(--status-occupied-text)]',
          fill: 'bg-[var(--status-occupied-fill)]',
        };
      case 'paying':
        return {
          glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)] animate-pulse',
          border: 'border-yellow-500/50',
          text: 'text-yellow-500',
          fill: 'bg-yellow-500/5',
        };
      default:
        return {
          glow: 'shadow-none',
          border: 'border-[var(--border-color)]',
          text: 'text-[var(--text-secondary)]',
          fill: 'bg-[var(--card-bg)]',
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
    'relative flex items-center justify-center p-3 cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] etched-border',
    'backdrop-blur-[12px] border',
    getStatusStyles().border,
    isActive ? 'bg-[var(--text-primary)]/10 border-[var(--text-primary)] shadow-[0_0_20px_rgba(255,255,255,0.1)]' : getStatusStyles().fill,
    !isActive && getStatusStyles().glow,
    getShapeStyles(),
    isActive && 'z-50',
    isSyncing && 'animate-pulse opacity-80',
    isWaitlistTarget && 'ring-2 ring-[var(--status-available-stroke)] animate-pulse z-40',
    isDragTarget && 'border-dashed border-2 border-[var(--text-primary)] scale-105 opacity-80',
    justCleared && 'animate-table-clear',
  );

  const { updateTable } = useFloorPlan();

  return (
    <div className="relative">
      <motion.div
        layoutId={`table-${table.id}`}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(e, info) => {
          if (info.offset.x < -60 && status === 'occupied') {
            // Swipe left to mark paying
            updateTable(table.id, { status: 'paying' });
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
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.97 }}
        initial={{ opacity: 0, scale: 0.95, x: -10 }}
        animate={{ opacity: 1, scale: isActive ? 1.04 : 1, x: 0 }}
        transition={{ 
          opacity: { duration: 0.8, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] },
          x: { duration: 0.8, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] },
          scale: { duration: 0.8, delay: index * 0.05, type: 'spring', stiffness: 200, damping: 40, mass: 1.5 },
          layout: { type: 'spring', stiffness: 200, damping: 40, mass: 1.5 }
        }}
      >
        {/* Table Label */}
      <div className={cn('absolute -top-2 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[9px] font-medium tracking-[0.2em] uppercase text-[var(--text-primary)] whitespace-nowrap z-10', shape === 'bench' && '-top-2.5')}>
        {label}
      </div>
      
      {/* Centered Content */}
      <AnimatePresence mode="popLayout">
        {status === 'paying' ? (
          <motion.div
            key="paying"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center justify-center gap-1"
          >
            <CreditCard size={20} className="text-yellow-500" />
            <span className="text-[10px] text-yellow-500 font-medium tracking-wide uppercase">Paying</span>
          </motion.div>
        ) : currentGuest ? (
          <motion.div
            key="occupied"
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
            className={`flex flex-col items-center justify-center ${getStatusStyles().text}`}
          >
            <span className="font-medium text-sm truncate max-w-[80px] text-center">
              {currentGuest.name.split(' ')[0]}
            </span>
            <div className="flex items-center gap-1 mt-1 opacity-60">
              <Users size={10} className="text-inherit" />
              <span className="text-[10px] font-mono text-inherit">{currentGuest.partySize}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="available"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity gap-1"
          >
            <Leaf size={14} className="text-[#65a30d]" />
            <span className="text-[10px] font-mono tracking-widest text-[#65a30d]">CAP {capacity}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Selection Overlay */}
      {isActive && (
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           className="absolute -top-3 -right-3 w-6 h-6 bg-[var(--text-primary)] rounded-full flex items-center justify-center shadow-lg z-20"
        >
          <Check size={14} className="text-[var(--bg-primary)] stroke-[3px]" />
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
               onPointerDown={(e) => { e.stopPropagation(); setShowRadialMenu(false); onTap(e as any, table); }}
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
