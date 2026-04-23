import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Radio } from 'lucide-react';
import { useFloorPlan, TableData } from '../context/FloorPlanContext';
import { TableNode } from './TableNode';
import { TableActionSheet } from './TableActionSheet';
import { cn } from '../lib/utils';

export default function FloorPlanManager() {
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
      if (!grouped[t.zone]) grouped[t.zone] = [];
      grouped[t.zone].push(t);
    });
    return grouped;
  }, [tables]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleTableTap = (e: React.MouseEvent, table: TableData) => {
    e.stopPropagation();

    if (swapSourceId) {
      if (swapSourceId === table.id) {
         setSwapSourceId(null);
         return;
      }
      if (table.status !== 'available') {
         showToast(`Table must be available to swap.`);
         return;
      }
      swapTables(swapSourceId, table.id);
      setSwapSourceId(null);
      showToast(`Guests moved to ${table.label}`);
      return;
    }
    
    setActiveTableId(table.id);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full bg-[#0a0a0a] relative overflow-hidden shadow-2xl flex flex-col transition-all duration-300",
        isFullscreen 
          ? "h-screen rounded-none border-none fixed inset-0 z-[100]" 
          : "rounded-3xl border border-[#1c1c1e] h-[calc(100vh-140px)] min-h-[600px]"
      )}
    >
      
      {/* Live Sync Status (Pulse) */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-[#141414]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 shadow-lg">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
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

      {/* Empty State Fallback */}
      {tables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center mb-6">
            <Maximize2 size={32} className="text-white/20" />
          </div>
          <h2 className="text-2xl font-light text-[#e8e6e3] tracking-widest uppercase mb-2">No Tables Configured</h2>
          <p className="text-sm text-white/40 max-w-sm leading-relaxed">
            Please configure the floor map zones in the Admin Settings to initialize the synchronization matrix.
          </p>
        </div>
      ) : (
        <TransformWrapper
          initialScale={1}
          minScale={0.4}
          maxScale={2}
          centerOnInit={true}
          wheel={{ step: 0.025 }}
          pinch={{ step: 2.5 }}
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
                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full min-w-[1240px] p-24">
                  <div className="w-full h-full grid grid-cols-12 gap-x-12 gap-y-24 auto-rows-min">
                    
                    {/* Zone Sections based on CSS Grid */}
                    {Object.entries(zones).map(([zoneName, zoneTables], index) => {
                      
                      // Assign structural grid spans based on zone intended size / layout manually
                      let colSpan = 'col-span-12 md:col-span-6 lg:col-span-4';
                      if (zoneName === 'Outdoor' || zoneName === 'Rooftop') {
                        colSpan = 'col-span-12 lg:col-span-6';
                      } else if (zoneName === 'Bar District') {
                        colSpan = 'col-span-12 lg:col-span-12';
                      }

                      return (
                        <div key={zoneName} className={cn("flex flex-col relative", colSpan)}>
                          
                          {/* Zone Structural Label */}
                          <div className="absolute -top-8 left-4 text-[10px] text-white/20 tracking-[0.3em] font-mono uppercase whitespace-nowrap">
                            {zoneName}
                          </div>
                          
                          {/* Dashed Zone Border Container */}
                          <div className="flex-1 border border-white/5 border-dashed rounded-3xl p-8 bg-[#141414]/20">
                            
                            {/* Inner flex layout wrapping the tables */}
                            <div className="flex flex-wrap gap-8 items-center justify-center">
                              {(zoneTables as TableData[]).map((table, tIndex) => (
                                <TableNode 
                                  key={table.id}
                                  table={table}
                                  isActive={activeTableId === table.id}
                                  isDragTarget={swapSourceId === table.id}
                                  onTap={handleTableTap}
                                  index={tIndex}
                                />
                              ))}
                            </div>
                            
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </TransformComponent>
              </div>
            </>
          )}
        </TransformWrapper>
      )}

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
