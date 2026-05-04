/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Users, MessageCircle, Check, Trash2, Plus, Minus, X, History as HistoryIcon, List, Loader2, CheckCircle2, Map as MapIcon, Maximize2, Minimize2, Lock, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFloorPlan } from './context/FloorPlanContext';
import { useKioskAuth } from './components/AuthWrapper';
import FloorPlanManager from './components/FloorPlanManager';
import VirtualWaitingRoom from './components/VirtualWaitingRoom';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './lib/firebase';
import { cn } from './lib/utils';

interface Customer {
  id: string;
  name: string;
  phone: string; // Formatted +971...
  originalPhone: string; // As entered 05...
  partySize: number;
  addedAt: number;
  status: 'WAITING' | 'NOTIFIED' | 'REMINDED' | 'SEATED' | 'EXPIRED' | 'NO-SHOW';
  assignedTable?: string;
  seatedAt?: number;
  syncStatus?: 'syncing' | 'confirmed';
  
  // Meta WhatsApp & Grace Period tracking
  notifiedAt?: number;
  gracePeriodEndsAt?: number;
  reminderSentAt?: number;
  whatsappLog?: {
    messageId: string;
    templateName: string;
    sentAt: number;
    deliveredAt?: number;
    readAt?: number;
    failedAt?: number;
    errorReason?: string;
  }[];
}

interface QueueState {
  timeLeft: number;
  status: 'counting' | 'ready';
}

type MatchType = 'perfect' | 'ideal' | 'spacious' | 'tight';

interface TableMatch {
  id: string;
  label: string;
  capacity: number;
  zone?: string;
  status: string;
  fitScore: number;
  matchType: MatchType;
}

function calculateFit(party: number, capacity: number): number {
  if (capacity === party) return 100;        // Perfect fit
  if (capacity === party + 1) return 90;     // One extra seat (ideal for comfort)
  if (capacity === party + 2) return 75;     // Slightly roomy
  if (capacity > party + 2) return 50;       // Too big, waste of space
  if (capacity < party) return 0;            // Doesn't fit
  return 0;
}

function getMatchType(party: number, capacity: number): MatchType {
  if (capacity === party) return 'perfect';
  if (capacity === party + 1) return 'ideal';
  if (capacity > party) return 'spacious';
  return 'tight';
}

function findBestTables(partySize: number, availableTables: any[]): TableMatch[] {
  return availableTables
    .filter(t => t.status === 'available')
    .map(t => ({
      ...t,
      fitScore: calculateFit(partySize, t.capacity),
      matchType: getMatchType(partySize, t.capacity)
    }))
    .filter(t => t.fitScore > 0)
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 5); // Top 5 suggestions
}

const TABLE_MAP = {
  'BAR': 7,
  'LOUNGE': 6,
  'COUCH': 7,
  'ROUND': 5,
  'BENCH': 7,
  'ROOFTOP': 10,
  'OUTDOOR': 10
};

export default function App() {
  const { tables, updateTable, resetFloorPlan, assignTableAtomic } = useFloorPlan();

  const [customers, setCustomers] = useState<Customer[]>([]);

  // Remote Sync Hook
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const liveCustomers: Customer[] = [];
      snapshot.forEach(doc => liveCustomers.push(doc.data({ serverTimestamps: 'estimate' }) as Customer));
      setCustomers(liveCustomers);
    }, (error) => {
      console.error("Error listening to customers:", error);
    });
    return () => unsub();
  }, []);

  const { lockTerminal } = useKioskAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'waiting' | 'history' | 'map'>('waiting');
  const [customerToNotify, setCustomerToNotify] = useState<Customer | null>(null);
  const [pendingSeatCustomer, setPendingSeatCustomer] = useState<Customer | null>(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved !== null) return saved === 'dark';
    return true; // default dark
  });
  
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  
  // Theme and Modes hook
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kiosk') === 'true') {
      setIsKioskMode(true);
      setActiveTab('map');
    }
    if (params.get('guest') === 'true') {
      setIsGuestMode(true);
    }
  }, []);

  // Apply dark mode theme
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  // Anti-Spam Human Mimicry States (Now localized to customer queue)
  const [globalCooldown, setGlobalCooldown] = useState(0);
  const [backgroundQueue, setBackgroundQueue] = useState<Record<string, QueueState>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Anti-Spam Global Cooldown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (globalCooldown > 0) {
      timer = setTimeout(() => setGlobalCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [globalCooldown]);

  // Background Queue Countdown
  useEffect(() => {
    const activeIds = Object.keys(backgroundQueue).filter(id => backgroundQueue[id].status === 'counting');
    if (activeIds.length === 0) return;

    const timer = setInterval(() => {
      setBackgroundQueue(prev => {
        const next = { ...prev };
        activeIds.forEach(id => {
          if (next[id].timeLeft > 1) {
            next[id] = { ...next[id], timeLeft: next[id].timeLeft - 1 };
          } else if (next[id].timeLeft === 1) {
            next[id] = { ...next[id], timeLeft: 0, status: 'ready' };
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [backgroundQueue]);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'f' && activeTab === 'waiting') {
        setIsFullscreen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const validatePhone = (p: string) => {
    const cleaned = p.replace(/\D/g, '');
    return cleaned.startsWith('05') && cleaned.length === 10;
  };

  const formatPhoneForWhatsApp = (p: string) => {
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.startsWith('05')) {
      return '+971' + cleaned.slice(1);
    }
    return cleaned;
  };

  const maskPhone = (p: string) => {
    const cleaned = p.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return cleaned.slice(0, 4) + '••••' + cleaned.slice(-2);
    }
    return p;
  };

  const getWaitTime = (addedAt: number) => {
    const diffMs = now - addedAt;
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins} min`;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const previous = [...customers];
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    try {
      const filtered = Object.fromEntries(Object.entries(updates).filter(([v]) => v !== undefined));
      await updateDoc(doc(db, 'customers', id), { ...filtered, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
      setCustomers(previous);
      showToast("Sync failed. Reverted state.");
    }
  };

  const removeCustomer = async (id: string) => {
    const previous = [...customers];
    setCustomers(prev => prev.filter(c => c.id !== id));
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (e) {
      console.error(e);
      setCustomers(previous);
      showToast("Sync failed. Reverted state.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!validatePhone(phone)) {
      setError('Please enter a valid UAE mobile number (e.g., 055 123 4567)');
      return;
    }

    const newId = crypto.randomUUID();
    const newCustomer: Customer = {
      id: newId,
      name: name.trim(),
      phone: formatPhoneForWhatsApp(phone),
      originalPhone: phone,
      partySize,
      addedAt: Date.now(),
      status: 'WAITING',
      syncStatus: 'syncing',
    };

    const previous = [...customers];
    setCustomers((prev) => [...prev, newCustomer]);
    setName('');
    setPhone('');
    setPartySize(2);
    setActiveTab('waiting');
    showToast('Guest booking added successfully.');

    try {
      await setDoc(doc(db, 'customers', newId), { ...newCustomer, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, 'customers', newId), { syncStatus: 'confirmed', updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
      setCustomers(previous);
      showToast("Failed to add guest to database.");
    }
  };

  const closeModal = () => {
    setCustomerToNotify(null);
    setSelectedTable('');
  };

  const handleNotifyClick = (customer: Customer) => {
    setCustomerToNotify(customer);
    setSelectedTable(customer.assignedTable || '');
  };

  const startAntiSpamTimer = () => {
    if (!customerToNotify) return;
    
    // Move customer to background queue
    setBackgroundQueue(prev => ({
      ...prev,
      [customerToNotify.id]: {
        timeLeft: Math.floor(Math.random() * (15 - 10 + 1)) + 10,
        status: 'counting'
      }
    }));
    
    // Save assigned table so it's ready for dispatch
    updateCustomer(customerToNotify.id, { assignedTable: selectedTable });
    
    // Instantly reserve the table on the floor map
    const tableId = tables.find(t => t.label === selectedTable)?.id;
    if (tableId) {
      assignTableAtomic(tableId, { status: 'reserved', currentGuest: {
        name: customerToNotify.name,
        partySize: customerToNotify.partySize,
        seatedAt: Date.now()
      } }).then((success) => {
        if (!success) {
           showToast(`Table ${selectedTable} was just assigned. Please select another.`);
           return;
        }
        updateCustomer(customerToNotify.id, { status: 'NOTIFIED', assignedTable: selectedTable });
        showToast('Guest Notified & Table Reserved');
        closeModal();
      });
      return; 
    }
    
    updateCustomer(customerToNotify.id, { status: 'NOTIFIED', assignedTable: selectedTable });
    showToast('Guest Notified');
    closeModal();
  };

  const triggerErrorCooldown = () => {
    setGlobalCooldown(60);
    showToast('System paused for 60s cooldown.');
  };

  const confirmNotify = (customer: Customer) => {
    if (!customer.assignedTable) return;

    const templates = [
      (name: string, count: number, table: string) => `Welcome back, *${name}*. Your table for *${count}* at *${table}* is all set and waiting for you at Cartel. Please head to the host stand when you arrive—we’ll take care of the rest. See you soon.\n\n*Cartel Coffee Roasters | The Art of Specialty.*`,
      (name: string, count: number, table: string) => `Hi *${name}*, we’re ready to host you. We've reserved *${table}* for your party of *${count}*. Please check in with our hostess to be seated. We look forward to seeing you.\n\n*Cartel Coffee Roasters | The Art of Specialty.*`,
      (name: string, count: number, table: string) => `Hello *${name}*, your wait is over. *${table}* is ready for your group of *${count}*. Please make your way to the entrance so we can get you settled.\n\n*Cartel Coffee Roasters | The Art of Specialty.*`
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const message = randomTemplate(customer.name, customer.partySize, customer.assignedTable);

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customer.phone.replace('+', '')}?text=${encodedMessage}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    // Update status 
    updateCustomer(customer.id, { status: 'NOTIFIED' });
    
    // Remove from queue
    setBackgroundQueue(prev => {
      const next = { ...prev };
      delete next[customer.id];
      return next;
    });
  };

  const markSeated = (id: string) => {
    // Find customer to see what table they were assigned to
    const customer = customers.find(c => c.id === id);
    if (customer?.assignedTable) {
      const tableId = tables.find(t => t.label === customer.assignedTable)?.id;
      if (tableId) {
        // Find existing table data to avoid clearing status if it was already updated from map
        const existingTable = tables.find(t => t.id === tableId);
        if (existingTable && existingTable.status === 'reserved') {
          updateTable(tableId, { status: 'occupied' });
        }
      }
    }

    updateCustomer(id, { status: 'SEATED', seatedAt: Date.now() });
  };

  const deleteCustomer = (id: string) => {
    if (window.confirm('Are you sure you want to remove this guest from the list?')) {
      const customer = customers.find(c => c.id === id);
      if (customer?.assignedTable && customer.status !== 'SEATED') {
        const tableId = tables.find(t => t.label === customer.assignedTable)?.id;
        if (tableId) {
          updateTable(tableId, { status: 'available', currentGuest: undefined, assignedWaiter: undefined });
        }
      }
      removeCustomer(id);
    }
  };

  const clearHistory = async () => {
    resetFloorPlan();
    
    const previous = [...customers];
    setCustomers([]);
    setShowResetModal(false);
    showToast('Floor plan and history have been cleared.');

    try {
      const batch = writeBatch(db);
      customers.forEach(c => {
        batch.delete(doc(db, 'customers', c.id));
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      setCustomers(previous);
      showToast("Failed to clear history.");
    }
  };

  const activeCustomers = customers.filter((c) => c.status !== 'SEATED');
  const seatedCustomers = customers.filter((c) => c.status === 'SEATED');
  const isSystemDirty = customers.length > 0 || tables.some(t => t.status !== 'available');
  
  const bestTables = findBestTables(partySize, tables);

  if (isGuestMode) {
    return <VirtualWaitingRoom />;
  }

  if (isKioskMode) {
    return (
      <div className="absolute inset-0 bg-brand-bg overflow-hidden flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-white/10 z-10 bg-black/50 backdrop-blur-md absolute top-0 w-full pointer-events-none">
          <h1 className="font-cinzel text-xl font-bold tracking-widest text-brand-text">CARTEL KIOSK</h1>
          <div className="flex items-center gap-4 text-xs font-mono text-brand-accent">
             <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" /> LIVE SYNC</span>
          </div>
        </div>
        <div className="flex-1 w-full h-full relative z-0">
          <FloorPlanManager 
            pendingSeatCustomer={null} 
            onSeatCompleted={() => {}}
            onSeatCancel={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto pb-24 relative overflow-hidden bg-brand-bg transition-colors">
      {/* Toast Notification */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-brand-text px-6 py-3 rounded-full flex flex-row items-center gap-3 shadow-2xl">
          <CheckCircle2 size={18} className="text-[var(--status-available-stroke)]" />
          <span className="font-medium text-sm tracking-wide">{toastMessage}</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <a
          href="/?guest=true"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand-bg/80 backdrop-blur-md border border-brand-border text-brand-muted hover:text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center justify-center text-xs font-medium"
        >
          Guest View
        </a>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="bg-brand-bg/80 backdrop-blur-md border border-brand-border text-brand-muted hover:text-brand-text px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center justify-center"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={lockTerminal}
          className="bg-brand-bg/80 backdrop-blur-md border border-brand-border text-brand-muted hover:text-brand-text px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <Lock size={12} />
          Lock iPad
        </button>
        <button
          onClick={triggerErrorCooldown}
          className="bg-brand-bg/80 backdrop-blur-md border border-brand-border text-brand-muted hover:text-red-400 text-xs px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          title="Force System Cooldown (60s)"
        >
          {globalCooldown > 0 ? `COOLDOWN (${globalCooldown}s)` : 'Report API Error'}
        </button>
      </div>

      {/* Header */}
      <header className="flex flex-col items-center justify-center mb-12 mt-4">
        <h1 className="font-serif text-3xl md:text-4xl italic tracking-wide text-white text-center opacity-90">
          Cartel Coffee Roasters
        </h1>
        <p className="font-inter tracking-[0.2em] text-white/40 text-[10px] mt-4 uppercase">
          Table Management
        </p>
      </header>
        {/* Add Guest Floating Button (Mobile) */}
        {!showAddGuest && (
          <button
            onClick={() => setShowAddGuest(true)}
            className="lg:hidden fixed bottom-24 right-4 z-50 w-14 h-14 bg-brand-text text-brand-bg rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          >
            <Plus size={24} />
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Add Form (Desktop Sidebar / Mobile Bottom Sheet) */}
          <div className="lg:col-span-4">
            {/* Modal Backdrop on Mobile */}
            <AnimatePresence>
              {showAddGuest && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAddGuest(false)}
                  className="lg:hidden fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm"
                />
              )}
            </AnimatePresence>

            {/* Form Container */}
            <AnimatePresence>
              {(showAddGuest || window.innerWidth >= 1024) && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className={cn(
                    "fixed lg:static inset-x-0 bottom-0 z-[100] lg:z-auto bg-brand-card lg:border border-brand-border p-6 rounded-t-3xl lg:rounded-2xl shadow-[0_-20px_40px_rgba(0,0,0,0.2)] lg:shadow-none w-full",
                    showAddGuest ? "block" : "hidden lg:block", "lg:sticky lg:top-8"
                  )}
                >
                  <div className="w-12 h-1.5 bg-brand-border rounded-full mx-auto mb-6 lg:hidden" />
                  <form onSubmit={handleSubmit} className="h-full flex flex-col pb-safe">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="font-cinzel text-xl font-semibold text-brand-text flex items-center gap-2">
                        <Plus size={20} className="text-brand-accent" />
                        Add Guest
                      </h2>
                      <button type="button" onClick={() => setShowAddGuest(false)} className="lg:hidden p-2 bg-brand-bg rounded-full text-brand-muted">
                        <X size={20} />
                      </button>
                    </div>
                    
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4">
                        {error}
                      </div>
                    )}

                    <div className="space-y-5 overflow-y-auto max-h-[60vh] lg:max-h-none pr-2 custom-scrollbar">
                      <div>
                        <label className="block text-sm text-brand-muted mb-1.5">Name</label>
                        <input 
                          type="text" 
                          required 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Guest Name"
                          className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors" 
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-brand-muted mb-1.5">Phone Number</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3 text-brand-muted select-none">🇦🇪</span>
                          <input 
                            type="tel" 
                            required 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="05X XXX XXXX" 
                            className="w-full bg-brand-bg border border-brand-border rounded-xl pl-12 pr-4 py-3 text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-brand-muted mb-1.5">Party Size</label>
                        <div className="flex items-center justify-between bg-black/10 backdrop-blur-md border border-brand-border rounded-xl p-1.5 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setPartySize(Math.max(1, partySize - 1))}
                            disabled={partySize <= 1}
                            className="w-12 h-12 flex items-center justify-center rounded-lg bg-black/40 border border-brand-border/50 text-brand-text hover:bg-white/10 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                            aria-label="Decrease party size"
                          >
                            <Minus size={20} className="opacity-80" />
                          </button>
                          
                          <div className="font-cinzel text-2xl w-16 text-center text-brand-text font-semibold tracking-wider">
                            {partySize}
                          </div>

                          <button
                            type="button"
                            onClick={() => setPartySize(Math.min(12, partySize + 1))}
                            disabled={partySize >= 12}
                            className="w-12 h-12 flex items-center justify-center rounded-lg bg-black/40 border border-brand-border/50 text-brand-text hover:bg-white/10 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                            aria-label="Increase party size"
                          >
                            <Plus size={20} className="opacity-80" />
                          </button>
                        </div>
                      </div>

                      {/* Smart Capacity Match visualizer */}
                      {bestTables.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-brand-border">
                          <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-brand-muted mb-3">
                            <span>Smart Matches</span>
                            <span className="bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                              <MapIcon size={10} /> Auto-suggest
                            </span>
                          </label>
                          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar hide-scrollbar snap-x">
                            {bestTables.map((table) => {
                              const getBadgeColor = (type: MatchType) => {
                                switch (type) {
                                  case 'perfect': return 'text-white bg-white/10 border-white/20';
                                  case 'ideal': return 'text-white/80 bg-white/5 border-white/10';
                                  case 'spacious': return 'text-white/60 bg-transparent border-white/5';
                                  case 'tight': return 'text-white/40 bg-transparent border-white/5 border-dashed';
                                  default: return 'text-white/30 bg-transparent border-white/5';
                                }
                              };
                              return (
                                <div key={table.id} className={cn("shrink-0 snap-center rounded-lg border p-2 min-w-[90px] flex flex-col items-center justify-center gap-1.5 transition-colors", getBadgeColor(table.matchType))}>
                                  <span className="font-cinzel font-bold text-lg">{table.label}</span>
                                  <span className="text-[10px] uppercase font-medium tracking-wide opacity-80">{table.matchType}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <button 
                        type="submit" 
                        className="w-full bg-brand-text text-brand-bg font-semibold py-4 rounded-xl mt-4 hover:opacity-90 transition-colors flex items-center justify-center gap-2 touch-manipulation"
                      >
                        ADD TO LIST
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Waiting List & History */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tabs (Floating dock style) */}
            <div className="fixed bottom-4 left-4 right-4 z-[45] p-1.5 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-full lg:static lg:bg-transparent lg:p-0 flex gap-2 lg:mb-0 lg:border-none shadow-[0_10px_40px_rgba(0,0,0,0.5)] lg:shadow-none mx-auto max-w-[320px] lg:max-w-none justify-center">
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-full w-full lg:w-fit">
                <button
                  onClick={() => setActiveTab('waiting')}
                  className={`flex-1 lg:flex-none px-6 py-2 rounded-full font-medium text-[11px] uppercase tracking-[0.1em] transition-all touch-manipulation flex items-center justify-center gap-2 ${
                    activeTab === 'waiting' 
                      ? 'bg-white text-black shadow-sm' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <List size={14} className={activeTab === 'waiting' ? 'text-black' : 'text-white/50'} />
                  Queue
                  {activeCustomers.length > 0 && <span className="opacity-60">{activeCustomers.length}</span>}
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  className={`flex-1 lg:flex-none px-6 py-2 rounded-full font-medium text-[11px] uppercase tracking-[0.1em] transition-all touch-manipulation flex items-center justify-center gap-2 ${
                    activeTab === 'map' 
                      ? 'bg-white text-black shadow-sm' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MapIcon size={14} className={activeTab === 'map' ? 'text-black' : 'text-white/50'} />
                  Map
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 lg:flex-none px-6 py-2 rounded-full font-medium text-[11px] uppercase tracking-[0.1em] transition-all touch-manipulation flex items-center justify-center gap-2 ${
                    activeTab === 'history' 
                      ? 'bg-white text-black shadow-sm' 
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <HistoryIcon size={14} className={activeTab === 'history' ? 'text-black' : 'text-white/50'} />
                  Done
                  {seatedCustomers.length > 0 && <span className="opacity-60">{seatedCustomers.length}</span>}
                </button>
              </div>
            </div>

          <AnimatePresence mode="wait">
            {/* Tab Content: Waiting List */}
            {activeTab === 'waiting' && (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={`transition-all duration-300 relative ${isFullscreen ? 'fixed inset-0 z-[100] bg-brand-bg/95 backdrop-blur-3xl p-6 md:p-12 overflow-y-auto w-full h-full' : ''}`}
              >
              <div className="flex justify-between items-center mb-4">
                <h2 className={`font-cinzel font-semibold text-brand-text ${isFullscreen ? 'text-3xl' : 'text-xl'}`}>Waiting List</h2>
                <div className="flex-1" />
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 backdrop-blur-md transition-colors group relative ml-auto"
                >
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg border border-white/10 backdrop-blur-md">
                    [F] Toggle
                  </span>
                </button>
              </div>

              {activeCustomers.length === 0 ? (
                <div className="bg-brand-card border border-brand-border border-dashed rounded-2xl p-12 text-center">
                  <Users size={48} className="mx-auto text-brand-muted/30 mb-4" />
                  <p className="text-brand-muted font-medium">The waiting list is currently empty.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCustomers.map((customer, index) => {
                    const waitMins = Math.floor((now - customer.addedAt) / 60000);
                    const isUrgent = waitMins >= 25;
                    const isWarning = waitMins >= 15 && waitMins < 25;
                    const borderClass = isUrgent 
                      ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] bg-red-500/5' 
                      : isWarning 
                        ? 'border-amber-500/50 bg-amber-500/5' 
                        : 'border-brand-border bg-brand-card hover:border-brand-border/80';
                    const timeColor = isUrgent ? 'text-red-400 font-bold' : isWarning ? 'text-amber-500' : 'text-brand-accent';
                    const custBestTables = findBestTables(customer.partySize, tables);
                    
                    return (
                    <div 
                      key={customer.id} 
                      className={cn("p-4 sm:p-5 rounded-2xl flex flex-col gap-4 transition-all relative overflow-hidden group border", borderClass)}
                    >
                      {isUrgent && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 sm:gap-6 w-full">
                          <div className={cn("font-cinzel text-3xl font-bold w-10 pt-1 transition-colors", isUrgent ? "text-red-500/40" : isWarning ? "text-amber-500/40" : "text-brand-muted/40")}>
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-brand-text flex items-center gap-2">
                              {customer.name}
                              {customer.syncStatus === 'syncing' ? (
                                <Loader2 size={16} className="text-brand-muted animate-spin" />
                              ) : customer.syncStatus === 'confirmed' ? (
                                <CheckCircle2 size={16} className="text-[#25D366]/70" />
                              ) : null}
                              {customer.assignedTable && (
                                <span className={cn("text-xs font-normal border px-2 py-0.5 rounded", isUrgent ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-brand-accent/10 text-brand-accent border-brand-accent/20")}>
                                  {customer.assignedTable}
                                </span>
                              )}
                            </h3>
                            <div className="text-brand-muted text-sm flex flex-wrap items-center gap-x-4 gap-y-2 mt-1.5">
                              <span className="font-mono text-xs bg-brand-bg px-2 py-0.5 rounded border border-brand-border">
                                {maskPhone(customer.originalPhone)}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Users size={14} className={isUrgent ? 'text-red-400' : isWarning ? 'text-amber-500' : 'text-brand-accent'} /> 
                                {customer.partySize} {customer.partySize === 1 ? 'person' : 'persons'}
                              </span>
                              <span className={cn("flex items-center gap-1.5", timeColor)}>
                                <Clock size={14} /> 
                                {getWaitTime(customer.addedAt)}
                              </span>
                            </div>

                            {/* Smart Auto-Suggest inside Waitlist item */}
                            {!customer.assignedTable && custBestTables.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-brand-border/30 w-full">
                                <div className="flex items-center gap-2 mb-2">
                                  <MapIcon size={12} className="text-brand-muted" />
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">Suggested Tables</span>
                                </div>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar hide-scrollbar pb-1">
                                  {custBestTables.map((t) => {
                                      const getBadgeColor = (type: MatchType) => {
                                        switch (type) {
                                          case 'perfect': return 'text-[#25D366] bg-[#25D366]/10 border-[#25D366]/30';
                                          case 'ideal': return 'text-brand-accent bg-brand-accent/10 border-brand-accent/30';
                                          case 'spacious': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
                                          case 'tight': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
                                          default: return 'text-brand-muted bg-white/5 border-white/10';
                                        }
                                      };
                                      return (
                                        <button 
                                          title={`Map seat ${t.label}`}
                                          onClick={() => {
                                             setPendingSeatCustomer(customer);
                                             setActiveTab('map');
                                          }}
                                          key={t.id} 
                                          className={cn("shrink-0 rounded flex items-center gap-1.5 px-2 py-1 text-xs border hover:opacity-80 transition-opacity whitespace-nowrap", getBadgeColor(t.matchType))}
                                        >
                                          <span className="font-semibold font-cinzel">{t.label}</span>
                                          <span className="opacity-70 text-[9px] uppercase tracking-wider">({t.matchType})</span>
                                        </button>
                                      );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      
                      <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-wrap sm:flex-nowrap border-t sm:border-t-0 p-2 sm:p-0 border-brand-border/30">
                        <div className="flex items-center justify-end gap-2">
                        {backgroundQueue[customer.id]?.status === 'counting' ? (
                          <button 
                            disabled
                            className="bg-brand-bg border border-brand-accent/30 text-brand-accent px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-mono opacity-80"
                          >
                            <Clock size={16} className="animate-pulse" />
                            {backgroundQueue[customer.id].timeLeft}s
                          </button>
                        ) : backgroundQueue[customer.id]?.status === 'ready' ? (
                          <button 
                            onClick={() => confirmNotify(customer)} 
                            className="bg-[#25D366] text-black px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-[0_0_12px_rgba(37,211,102,0.4)] hover:bg-[#20b858] transition-colors"
                          >
                            <MessageCircle size={16} /> DISPATCH NOW
                          </button>
                        ) : customer.status === 'WAITING' ? (
                          <button 
                            onClick={() => handleNotifyClick(customer)} 
                            disabled={globalCooldown > 0}
                            className={`bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors ${globalCooldown > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#25D366]/20'}`}
                          >
                            <MessageCircle size={16} /> 
                            {globalCooldown > 0 ? `WAIT (${globalCooldown}s)` : 'NOTIFY'}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleNotifyClick(customer)} 
                            disabled={globalCooldown > 0}
                            className={`bg-brand-accent/10 text-brand-accent border border-brand-accent/20 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${globalCooldown > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-accent/20'}`}
                            title="Notify Again"
                          >
                            <Check size={16} /> 
                            {globalCooldown > 0 ? `WAIT (${globalCooldown}s)` : 'NOTIFIED'}
                          </button>
                        )}
                        
                        <button 
                          onClick={() => {
                            setPendingSeatCustomer(customer);
                            setActiveTab('map');
                          }}
                          className={cn("bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-white/10 transition-colors flex-shrink-0", isUrgent ? "border-red-500/20 hover:bg-red-500/20" : "")}
                          title="Seat on Floor Map"
                        >
                          <MapIcon size={16} /> MAP SEAT
                        </button>
                        </div>

                        <div className="flex w-full sm:w-auto items-center justify-end gap-2">
                        <button 
                          onClick={() => markSeated(customer.id)} 
                          className="flex-1 sm:flex-none justify-center bg-brand-bg border border-brand-border text-brand-text px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium hover:border-brand-text transition-colors flex-shrink-0"
                          title="Mark as Seated Manually"
                        >
                          SEAT (Quick)
                        </button>
                        
                        <button 
                          onClick={() => deleteCustomer(customer.id)} 
                          className="text-brand-muted hover:text-red-400 p-2.5 rounded-xl hover:bg-red-500/10 transition-colors flex-shrink-0 bg-brand-bg/50 border border-brand-border"
                          title="Remove from list"
                        >
                          <Trash2 size={18} />
                        </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </motion.div>
          )}

            {/* Tab Content: Floor Map */}
            {activeTab === 'map' && (
              <motion.div 
                key="map"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full"
              >
                <FloorPlanManager 
                  pendingSeatCustomer={pendingSeatCustomer} 
                  onSeatCompleted={(id) => {
                    markSeated(id);
                    setPendingSeatCustomer(null);
                  }}
                  onSeatCancel={() => setPendingSeatCustomer(null)}
                />
              </motion.div>
            )}

            {/* Tab Content: History */}
            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-cinzel text-xl font-semibold text-brand-text">Seating History</h2>
                {isSystemDirty && (
                  <button 
                    onClick={() => setShowResetModal(true)}
                    className="flex items-center gap-2 text-xs font-medium text-brand-muted hover:text-red-400 bg-brand-bg px-3 py-1.5 rounded-lg border border-brand-border transition-colors hover:border-red-500/30 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                    Clear All History
                  </button>
                )}
              </div>

              {seatedCustomers.length === 0 ? (
                <div className="bg-brand-card border border-brand-border border-dashed rounded-2xl p-12 text-center">
                  <HistoryIcon size={48} className="mx-auto text-brand-muted/30 mb-4" />
                  <p className="text-brand-muted font-medium">No seating history yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {seatedCustomers
                    .sort((a, b) => (b.seatedAt || 0) - (a.seatedAt || 0))
                    .map(customer => (
                    <div 
                      key={customer.id} 
                      className="bg-brand-card border border-brand-border p-4 sm:p-5 rounded-2xl flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity"
                    >
                      <div>
                        <h3 className="font-semibold text-brand-text">{customer.name}</h3>
                        <div className="text-brand-muted text-sm flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1.5">
                            <Users size={14} className="text-brand-accent" /> 
                            {customer.partySize}
                          </span>
                          {customer.assignedTable && (
                            <span className="text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded text-xs">
                              {customer.assignedTable}
                            </span>
                          )}
                          <span className="font-mono text-xs bg-brand-bg px-2 py-0.5 rounded border border-brand-border">
                            {maskPhone(customer.originalPhone)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="bg-brand-bg border border-brand-border px-3 py-1 rounded-lg text-xs text-brand-muted font-medium">
                          SEATED
                        </span>
                        {customer.seatedAt && (
                          <div className="text-xs text-brand-muted mt-2 font-mono">
                            {new Date(customer.seatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* Notify Modal */}
      {customerToNotify && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-cinzel text-xl font-semibold text-brand-text">Assign Table</h3>
              <button 
                onClick={closeModal} 
                className="text-brand-muted hover:text-brand-text transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="bg-brand-bg border border-brand-border rounded-xl p-4 mb-6">
              <p className="text-sm text-brand-muted mb-1">Notifying Guest:</p>
              <p className="text-lg font-semibold text-brand-text">{customerToNotify.name}</p>
              <p className="text-sm text-brand-accent mt-1 flex items-center gap-1.5">
                <Users size={14} /> Party of {customerToNotify.partySize}
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm text-brand-muted mb-2">Select Table</label>
              <div className="relative">
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose a table...</option>
                  {Object.entries(TABLE_MAP).map(([category, count]) => (
                    <optgroup key={category} label={category} className="bg-brand-card text-brand-muted font-cinzel">
                      {Array.from({ length: count }).map((_, i) => (
                        <option key={`${category}-${i + 1}`} value={`${category} ${i + 1}`} className="text-brand-text font-inter">
                          {category} {i + 1}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted">
                  ▼
                </div>
              </div>
            </div>

            <button
              onClick={startAntiSpamTimer}
              disabled={!selectedTable}
              className="w-full bg-brand-text text-brand-bg font-semibold py-3.5 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Clock size={18} />
              PREPARE NOTIFICATION
            </button>
          </div>
        </div>
      )}

      {/* Reset Floor Plan Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-3xl flex items-center justify-center z-[110] p-4">
          <div className="bg-[var(--card-bg)]/95 border border-[var(--border-color)] rounded-3xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/30">
              <Trash2 size={28} className="text-red-400" />
            </div>
            <h3 className="font-cinzel text-xl font-bold text-brand-text mb-2 tracking-wide">Clear All History?</h3>
            <p className="text-sm text-brand-muted mb-8 text-center font-sans">
              This action cannot be undone. All active waiting list entries, seated history, and floor plan statuses will be completely reset.
            </p>
            
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setShowResetModal(false)}
                className="flex-1 bg-brand-bg border border-brand-border text-brand-text hover:bg-brand-bg/80 py-3.5 rounded-xl font-medium transition-colors font-sans"
              >
                Cancel
              </button>
              <button 
                onClick={clearHistory}
                className="flex-1 bg-red-500 text-white py-3.5 rounded-xl font-medium shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:bg-red-400 transition-colors font-sans"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
