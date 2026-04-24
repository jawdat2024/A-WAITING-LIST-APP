import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CreditCard } from 'lucide-react';
import { TableData, useFloorPlan } from '../context/FloorPlanContext';
import { cn } from '../lib/utils';

interface TableNodeProps {
  table: TableData;
  isActive: boolean;
  isDragTarget?: boolean;
  onTap: (e: React.MouseEvent, table: TableData) => void;
  onDragStart?: () => void;
  index?: number;
  isWaitlistTarget?: boolean;
}

export const TableNode: React.FC<TableNodeProps> = ({ table, isActive, isDragTarget, onTap, index = 0, isWaitlistTarget }) => {
  const { status = 'available', shape = 'square', label = '?', capacity = 2, currentGuest, zone = 'Main' } = table;

  const [justCleared, setJustCleared] = useState(false);
  const prevStatus = useRef(status);

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
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
          border: 'border-emerald-500/20',
          text: 'text-emerald-500',
        };
      case 'reserved':
      case 'pending': // Alias for pending
        return {
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-pulse',
          border: 'border-amber-500/30',
          text: 'text-amber-500',
        };
      case 'occupied':
        return {
          glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
          border: 'border-rose-500/30',
          text: 'text-rose-500',
        };
      case 'paying':
        return {
          glow: '',
          border: 'border-yellow-500/50 animate-[pulse-gold_0.8s_ease-in-out_infinite]',
          text: 'text-yellow-500',
        };
      default:
        return {
          glow: 'shadow-none',
          border: 'border-white/5',
          text: 'text-white/50',
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
        return 'w-24 h-24 rounded-full flex-col bg-gradient-to-tr from-[#141414] to-[#1c1c1e]';
      case 'bench':
        return 'w-36 h-20 rounded-xl flex-row';
      case 'couch':
        return 'w-32 h-32 rounded-3xl flex-col shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]';
      case 'square':
      default:
        return 'w-24 h-24 rounded-2xl flex-col';
    }
  };

  const isOutdoor = zone === 'Outdoor';
  const isRooftop = zone === 'Rooftop';

  const baseClasses = cn(
    'relative flex items-center justify-center p-3 cursor-pointer transition-all duration-[600ms] ease-out etched-border',
    'bg-white/[0.03] backdrop-blur-[12px] border border-transparent shadow-[0_0_40px_-10px_rgba(255,255,255,0.03)]',
    getStatusStyles().border,
    getStatusStyles().glow,
    getShapeStyles(),
    isActive && 'ring-2 ring-[#e8e6e3]/50 z-50',
    isWaitlistTarget && 'ring-2 ring-[#e8e6e3] animate-pulse z-40',
    isDragTarget && 'border-dashed border-2 border-[#e8e6e3] scale-105 opacity-80',
    isOutdoor && 'shadow-[inset_0_0_20px_rgba(245,158,11,0.05),_0_0_20px_rgba(245,158,11,0.1)] border-amber-500/10',
    justCleared && 'animate-table-clear',
    isRooftop && 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjMiPkNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=")] bg-repeat'
  );

  const { updateTable } = useFloorPlan();

  return (
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
      onClick={(e) => onTap(e, table)}
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
      <div className={cn('absolute -top-2 px-1.5 py-0.5 rounded bg-black border border-white/10 text-[9px] font-light tracking-[0.2em] uppercase text-white/90 whitespace-nowrap z-10', shape === 'bench' && '-top-2.5')}>
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
            className="flex flex-col items-center justify-center"
          >
            <span className="text-white/90 font-medium text-sm truncate max-w-[80px] text-center">
              {currentGuest.name.split(' ')[0]}
            </span>
            <div className="flex items-center gap-1 mt-1 opacity-60">
              <Users size={10} className="text-white" />
              <span className="text-[10px] text-white font-mono">{currentGuest.partySize}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="available"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center opacity-30 group-hover:opacity-60 transition-opacity"
          >
            <span className="text-[10px] font-mono tracking-widest text-[#e8e6e3]">CAP {capacity}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
