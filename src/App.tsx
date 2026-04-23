/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Users, MessageCircle, Check, Trash2, Plus, Minus, X, History as HistoryIcon, List, Loader2, CheckCircle2, Map as MapIcon, Maximize2, Minimize2 } from 'lucide-react';
import { useFloorPlan } from './context/FloorPlanContext';
import FloorPlanManager from './components/FloorPlanManager';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from './lib/firebase';

interface Customer {
  id: string;
  name: string;
  phone: string; // Formatted +971...
  originalPhone: string; // As entered 05...
  partySize: number;
  addedAt: number;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED';
  assignedTable?: string;
  seatedAt?: number;
  syncStatus?: 'syncing' | 'confirmed';
}

interface QueueState {
  timeLeft: number;
  status: 'counting' | 'ready';
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
  const { tables, updateTable, resetFloorPlan } = useFloorPlan();

  const [customers, setCustomers] = useState<Customer[]>([]);

  // Remote Sync Hook
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const liveCustomers: Customer[] = [];
      snapshot.forEach(doc => liveCustomers.push(doc.data({ serverTimestamps: 'estimate' }) as Customer));
      setCustomers(liveCustomers);
    });
    return () => unsub();
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'waiting' | 'history' | 'map'>('waiting');
  const [customerToNotify, setCustomerToNotify] = useState<Customer | null>(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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
      updateTable(tableId, { status: 'reserved', customerName: customerToNotify.name, partySize: customerToNotify.partySize });
    }
    
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
          updateTable(tableId, { status: 'available', customerName: undefined, partySize: undefined });
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

  return (
    <>
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto pb-24 relative overflow-hidden">
      {/* Toast Notification */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-brand-text px-6 py-3 rounded-full flex flex-row items-center gap-3 shadow-2xl">
          <CheckCircle2 size={18} className="text-[#25D366]" />
          <span className="font-medium text-sm tracking-wide">{toastMessage}</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-40">
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
        <img 
          src="https://tse3.mm.bing.net/th/id/OIP.5qWSQBwWhh5pE5_5ZxeLFwAAAA?rs=1&pid=ImgDetMain&o=7&rm=3" 
          alt="Cartel Coffee Logo" 
          className="w-24 h-24 object-contain mb-4 filter invert opacity-90"
          referrerPolicy="no-referrer"
        />
        <h1 className="font-cinzel text-4xl md:text-5xl font-bold tracking-widest text-brand-text text-center">
          CARTEL
        </h1>
        <p className="font-inter tracking-[0.3em] text-brand-muted text-sm mt-2 uppercase">
          A NEW FREQUENCY.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Add Form */}
        <div className="lg:col-span-4">
          <form onSubmit={handleSubmit} className="bg-brand-card border border-brand-border p-6 rounded-2xl sticky top-8">
            <h2 className="font-cinzel text-xl font-semibold mb-6 text-brand-text flex items-center gap-2">
              <Plus size={20} className="text-brand-accent" />
              Add Guest
            </h2>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-5">
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
                <div className="flex items-center justify-between bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-1.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setPartySize(Math.max(1, partySize - 1))}
                    disabled={partySize <= 1}
                    className="w-12 h-12 flex items-center justify-center rounded-lg bg-black/40 border border-white/5 text-brand-text hover:bg-white/10 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
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
                    className="w-12 h-12 flex items-center justify-center rounded-lg bg-black/40 border border-white/5 text-brand-text hover:bg-white/10 active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Increase party size"
                  >
                    <Plus size={20} className="opacity-80" />
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-brand-text text-brand-bg font-semibold py-3.5 rounded-xl mt-2 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                ADD TO LIST
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Waiting List & History */}
        <div className="lg:col-span-8 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-brand-card border border-brand-border rounded-xl">
            <button
              onClick={() => setActiveTab('waiting')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'waiting' 
                  ? 'bg-brand-bg text-brand-text shadow-sm border border-brand-border' 
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <List size={18} />
              Waiting List
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === 'waiting' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-border text-brand-muted'}`}>
                {activeCustomers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'map' 
                  ? 'bg-brand-bg text-brand-text shadow-sm border border-brand-border' 
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <MapIcon size={18} />
              Floor Map
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'history' 
                  ? 'bg-brand-bg text-brand-text shadow-sm border border-brand-border' 
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <HistoryIcon size={18} />
              History
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === 'history' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-border text-brand-muted'}`}>
                {seatedCustomers.length}
              </span>
            </button>
          </div>

          {/* Tab Content: Waiting List */}
          {activeTab === 'waiting' && (
            <div className={`transition-all duration-300 relative ${isFullscreen ? 'fixed inset-0 z-[100] bg-[#0a0a0a]/95 backdrop-blur-3xl p-6 md:p-12 overflow-y-auto w-full h-full' : ''}`}>
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
                  {activeCustomers.map((customer, index) => (
                    <div 
                      key={customer.id} 
                      className="bg-brand-card border border-brand-border p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-border/80 transition-colors"
                    >
                      <div className="flex items-start gap-4 sm:gap-6">
                        <div className="font-cinzel text-3xl text-brand-muted/40 font-bold w-10 pt-1">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-brand-text flex items-center gap-2">
                            {customer.name}
                            {customer.syncStatus === 'syncing' ? (
                              <Loader2 size={16} className="text-brand-muted animate-spin" />
                            ) : customer.syncStatus === 'confirmed' ? (
                              <CheckCircle2 size={16} className="text-[#25D366]/70" />
                            ) : null}
                            {customer.assignedTable && (
                              <span className="text-xs font-normal bg-brand-accent/10 text-brand-accent border border-brand-accent/20 px-2 py-0.5 rounded">
                                {customer.assignedTable}
                              </span>
                            )}
                          </h3>
                          <div className="text-brand-muted text-sm flex flex-wrap items-center gap-x-4 gap-y-2 mt-1.5">
                            <span className="font-mono text-xs bg-brand-bg px-2 py-0.5 rounded border border-brand-border">
                              {maskPhone(customer.originalPhone)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Users size={14} className="text-brand-accent" /> 
                              {customer.partySize} {customer.partySize === 1 ? 'person' : 'persons'}
                            </span>
                            <span className="flex items-center gap-1.5 text-brand-accent">
                              <Clock size={14} /> 
                              {getWaitTime(customer.addedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-end gap-2 sm:gap-3 lg:w-auto w-full flex-wrap sm:flex-nowrap">
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
                          onClick={() => markSeated(customer.id)} 
                          className="bg-brand-bg border border-brand-border text-brand-text px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium hover:border-brand-text transition-colors flex-shrink-0"
                          title="Mark as Seated"
                        >
                          SEAT
                        </button>
                        
                        <button 
                          onClick={() => deleteCustomer(customer.id)} 
                          className="text-brand-muted hover:text-red-400 p-2.5 rounded-xl hover:bg-red-500/10 transition-colors ml-1 flex-shrink-0"
                          title="Remove from list"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Floor Map */}
          {activeTab === 'map' && (
            <div className="animate-in fade-in duration-300 relative z-10 w-full">
              <FloorPlanManager />
            </div>
          )}

          {/* Tab Content: History */}
          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-300">
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
            </div>
          )}
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
          <div className="bg-[#1c1c1e]/95 border border-white/20 rounded-3xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/30">
              <Trash2 size={28} className="text-red-400" />
            </div>
            <h3 className="font-cinzel text-xl font-bold text-white mb-2 tracking-wide">Clear All History?</h3>
            <p className="text-sm text-white/60 mb-8 text-center font-sans">
              This action cannot be undone. All active waiting list entries, seated history, and floor plan statuses will be completely reset.
            </p>
            
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setShowResetModal(false)}
                className="flex-1 bg-white/5 border border-white/10 text-white hover:bg-white/10 py-3.5 rounded-xl font-medium transition-colors font-sans"
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
