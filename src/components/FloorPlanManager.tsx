import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Radio } from 'lucide-react';
import { useFloorPlan, TableData } from '../context/FloorPlanContext';
import { TableNode } from './TableNode';
import { TableActionSheet } from './TableActionSheet';
import { cn } from '../lib/utils';

interface FloorPlanManagerProps {
  pendingSeatCustomer?: any;
  onSeatCompleted?: (customerId: string) => void;
  onSeatCancel?: () => void;
}

export default function FloorPlanManager({ pendingSeatCustomer, onSeatCompleted, onSeatCancel }: FloorPlanManagerProps) {
  const { tables, updateTable, swapTables } = useFloorPlan();
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const activeTable = useMemo(() => tables.find(t => t.id === activeTableId) || null, [tables, activeTableId]);

  // Group tables by Zone
  const zones = useMemo(() => {
    const grouped: Record<string, TableData[]> = {};
    tables.forEach(t => {
      const z = t.zone || 'Main';
      if (!grouped[z]) grouped[z] = [];
      grouped[z].push(t);
    });
    return grouped;
  }, [tables]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handleMouse = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const xOffset = (x - 50) * 0.05;
      const yOffset = (y - 50) * 0.05;
      el.style.backgroundImage = `radial-gradient(circle at ${50 + xOffset}% ${50 + yOffset}%, #111111 0%, #000000 100%)`;
    };
    
    el.style.backgroundImage = `radial-gradient(circle at 50% 50%, #111111 0%, #000000 100%)`;
    el.style.backgroundColor = 'transparent'; // Let background image show
    el.addEventListener('mousemove', handleMouse);
    return () => el.removeEventListener('mousemove', handleMouse);
  }, []);

  const handleTableTap = (e: React.MouseEvent, table: TableData) => {
    e.stopPropagation();

    if (pendingSeatCustomer) {
      if (table.status !== 'available') {
        showToast(`Table ${table.label} is not available.`);
        return;
      }
      if (table.capacity < pendingSeatCustomer.partySize) {
        showToast(`Table ${table.label} capacity (${table.capacity}) is too small.`);
        // Let them tap again if they want, but don't clear the pending state
        return;
      }
      
      // Auto-seat
      updateTable(table.id, { 
        status: 'occupied', 
        currentGuest: {
          name: pendingSeatCustomer.name,
          partySize: pendingSeatCustomer.partySize,
          seatedAt: Date.now()
        }
      });
      showToast(`${pendingSeatCustomer.name} seated at ${table.label}`);
      onSeatCompleted?.(pendingSeatCustomer.id);
      return;
    }

    if (swapSourceId) {
      if (swapSourceId === table.id) {
         setSwapSourceId(null);
         return;
      }
      // Usually can swap occupied tables with each other or with available tables
      swapTables(swapSourceId, table.id);
      setSwapSourceId(null);
      showToast(`Tables swapped.`);
      return;
    }
    
    setActiveTableId(table.id);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full relative overflow-hidden shadow-2xl flex flex-col transition-all duration-300",
        isFullscreen 
          ? "h-screen rounded-none border-none fixed inset-0 z-[100]" 
          : "rounded-3xl border border-[#1c1c1e] h-[calc(100vh-140px)] min-h-[600px]"
      )}
    >
      
      {/* Live Sync Status (Pulse) */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-[#141414]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 shadow-lg">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" style={{ animationDuration: '3s' }} />
        <span className="text-[10px] text-white/50 font-mono uppercase tracking-widest">Live Sync</span>
      </div>

      {/* Dynamic Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-black/80 backdrop-blur-xl border border-white/10 text-[#e8e6e3] px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl"
          >
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="font-medium text-sm tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Mode Warning */}
      <AnimatePresence>
        {swapSourceId && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-[#141414]/90 backdrop-blur-xl border border-purple-500/30 text-[#e8e6e3] px-6 py-3.5 rounded-2xl flex items-center gap-4 shadow-2xl"
          >
            <Radio size={18} className="text-purple-400 animate-pulse" />
            <span className="font-medium text-sm tracking-wide">Select destination table to swap...</span>
            <button 
              onClick={() => setSwapSourceId(null)}
              className="ml-2 text-[10px] uppercase tracking-widest bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Overlay */}
      <div className="absolute top-6 left-6 z-[60] bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/50 font-mono tracking-widest pointer-events-none">
        TABLES: {tables.length}
      </div>

      {/* Empty State Fallback */}
      <AnimatePresence mode="wait">
        {tables.length === 0 ? (
          <motion.div 
            key="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="flex-1 flex flex-col items-center justify-center text-center p-8 z-10 relative"
          >
            {/* The Sonar */}
            <div className="relative w-48 h-48 flex items-center justify-center mb-12">
              <div className="absolute inset-0 rounded-full border-[0.5px] border-white blur-[1px] animate-sonar" />
              <div className="absolute inset-0 rounded-full border-[0.5px] border-white blur-[1px] animate-sonar animate-sonar-delay-1" />
              <div className="absolute inset-0 rounded-full border-[0.5px] border-white blur-[1px] animate-sonar animate-sonar-delay-2" />
              {/* Center dot/element */}
              <div className="w-2 h-2 bg-white/40 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </div>

            {/* The Matrix Reveal Text */}
            <motion.h2 
              initial={{ filter: 'blur(10px)', opacity: 0, y: 10 }}
              animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl font-light text-[#e8e6e3] uppercase mb-4 font-cinzel"
              style={{ letterSpacing: '6px' }}
            >
              No Tables Configured
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
              className="text-base max-w-md leading-relaxed font-inter text-white"
            >
              Please configure the floor map zones in the Admin Settings to initialize the synchronization matrix.
            </motion.p>

            {/* Refresh Grid Button */}
            <motion.button 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              onClick={() => window.location.reload()} 
              className="group relative mt-12 px-8 py-3.5 rounded-xl bg-white/[0.03] backdrop-blur-[20px] border border-white/10 text-white transition-all hover:border-white/30 tracking-widest text-xs uppercase flex items-center gap-3 overflow-hidden shadow-[0_0_20px_-10px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.2)]"
            >
              {/* Shimmer element */}
              <div className="pointer-events-none absolute inset-0 -translate-x-[200%] w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] transition-all group-hover:animate-[shimmer-sweep_2s_infinite]" />
              <RotateCcw size={14} className="text-white/50 group-hover:text-white transition-colors" /> 
              <span>Refresh Grid</span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="flex-1 w-full flex flex-col"
          >
            <TransformWrapper
              initialScale={1}
              minScale={0.4}
              maxScale={2}
              centerOnInit={true}
              wheel={{ step: 0.01 }}
              pinch={{ step: 1.0 }}
              panning={{ 
                velocityDisabled: false,
              }}
              velocityAnimation={{
                animationTime: 1200, 
                animationType: "easeOut"
              }}
              doubleClick={{ disabled: true }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Floating Map Controls */}
              <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2">
                <button onClick={toggleFullscreen} className="w-10 h-10 rounded-full bg-[#141414]/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors shadow-lg">
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <div className="w-10 h-[1px] bg-white/10 my-1" />
                <button onClick={() => zoomIn()} className="w-10 h-10 rounded-full bg-[#141414]/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors shadow-lg">
                  <ZoomIn size={18} />
                </button>
                <button onClick={() => zoomOut()} className="w-10 h-10 rounded-full bg-[#141414]/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors shadow-lg">
                  <ZoomOut size={18} />
                </button>
                <button onClick={() => resetTransform()} className="w-10 h-10 rounded-full bg-[#141414]/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors shadow-lg">
                  <RotateCcw size={18} />
                </button>
              </div>

              {/* The Map Canvas */}
              <div className="w-full h-full flex-1 touch-none">
                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full min-w-full md:min-w-[1240px] p-6 md:p-24">
                  <div className="w-full h-full flex flex-col pt-8">
                    
                    {/* Zone Sections based on Horizontal Rows */}
                    {Object.entries(zones).map(([zoneName, zoneTables], index) => {
                      if (!zoneTables || (zoneTables as TableData[]).length === 0) return null;

                      return (
                        <motion.div 
                          key={zoneName} 
                          className="flex flex-col mb-10 border-b border-white/5 pb-10"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                        >
                          
                          {/* Zone Header */}
                          <div className="mb-6 font-cinzel text-[10px] uppercase tracking-[0.3em] text-white opacity-40 pl-2">
                            {zoneName}
                          </div>
                          
                          {/* Horizontal Row or Scrollable Container */}
                          <div className="flex flex-nowrap md:flex-wrap gap-[20px] items-center overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 px-2 snap-x hide-scrollbar">
                            {(zoneTables as TableData[]).map((table, tIndex) => (
                              <div key={table.id} className="snap-start shrink-0">
                                <TableNode 
                                  table={table}
                                  isActive={activeTableId === table.id}
                                  isDragTarget={swapSourceId === table.id}
                                  onTap={handleTableTap}
                                  index={tIndex}
                                  isWaitlistTarget={!!pendingSeatCustomer && table.status === 'available' && table.capacity >= pendingSeatCustomer.partySize}
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}

                  </div>
                </TransformComponent>
              </div>
            </>
          )}
        </TransformWrapper>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Detail Bottom Sheet */}
      <TableActionSheet 
        table={activeTable} 
        onClose={() => setActiveTableId(null)} 
        onInitiateSwap={(id) => {
          setActiveTableId(null);
          setSwapSourceId(id);
        }}
      />
    </div>
  );
}
