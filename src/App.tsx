/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, Users, MessageCircle, Check, Trash2, Plus } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string; // Formatted +971...
  originalPhone: string; // As entered 05...
  partySize: number;
  addedAt: number;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED';
}

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('cartel_waiting_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Save to local storage whenever customers change
  useEffect(() => {
    localStorage.setItem('cartel_waiting_list', JSON.stringify(customers));
  }, [customers]);

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

  const handleSubmit = (e: React.FormEvent) => {
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

    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: formatPhoneForWhatsApp(phone),
      originalPhone: phone,
      partySize,
      addedAt: Date.now(),
      status: 'WAITING',
    };

    setCustomers((prev) => [...prev, newCustomer]);
    setName('');
    setPhone('');
    setPartySize(2);
  };

  const notifyCustomer = (customer: Customer) => {
    const message = `Hello ${customer.name}, your table for ${customer.partySize} is ready at CARTEL COFFEE ROASTERS. Please head to the host stand.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customer.phone.replace('+', '')}?text=${encodedMessage}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    // Update status
    setCustomers((prev) =>
      prev.map((c) => (c.id === customer.id ? { ...c, status: 'NOTIFIED' } : c))
    );
  };

  const markSeated = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'SEATED' } : c))
    );
  };

  const deleteCustomer = (id: string) => {
    if (window.confirm('Are you sure you want to remove this guest from the list?')) {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const activeCustomers = customers.filter((c) => c.status !== 'SEATED');
  const seatedCustomers = customers.filter((c) => c.status === 'SEATED');

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
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
        <p className="font-inter tracking-[0.3em] text-brand-muted text-sm mt-2">
          COFFEE ROASTERS
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
                <div className="flex items-center gap-4 bg-brand-bg border border-brand-border rounded-xl px-4 py-2">
                  <input 
                    type="range" 
                    min="1" 
                    max="12" 
                    value={partySize} 
                    onChange={(e) => setPartySize(parseInt(e.target.value))} 
                    className="flex-1 accent-brand-accent h-2 bg-brand-border rounded-lg appearance-none cursor-pointer" 
                  />
                  <div className="font-cinzel text-xl w-12 text-center text-brand-text font-semibold bg-brand-card py-1 rounded-lg border border-brand-border">
                    {partySize}
                  </div>
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

        {/* Right Column: Waiting List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="font-cinzel text-xl font-semibold text-brand-text">
              Waiting List
            </h2>
            <span className="bg-brand-card border border-brand-border text-brand-text px-3 py-1 rounded-full text-sm font-medium">
              {activeCustomers.length} Waiting
            </span>
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
                      <h3 className="font-semibold text-lg text-brand-text">{customer.name}</h3>
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
                  
                  <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                    {customer.status === 'WAITING' ? (
                      <button 
                        onClick={() => notifyCustomer(customer)} 
                        className="bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-[#25D366]/20 transition-colors"
                      >
                        <MessageCircle size={16} /> NOTIFY
                      </button>
                    ) : (
                      <span className="bg-brand-accent/10 text-brand-accent border border-brand-accent/20 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                        <Check size={16} /> NOTIFIED
                      </span>
                    )}
                    
                    <button 
                      onClick={() => markSeated(customer.id)} 
                      className="bg-brand-bg border border-brand-border text-brand-text px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium hover:border-brand-text transition-colors"
                      title="Mark as Seated"
                    >
                      SEAT
                    </button>
                    
                    <button 
                      onClick={() => deleteCustomer(customer.id)} 
                      className="text-brand-muted hover:text-red-400 p-2.5 rounded-xl hover:bg-red-500/10 transition-colors ml-1"
                      title="Remove from list"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recently Seated (Optional, just to show they aren't fully gone immediately if we wanted, but we'll just keep them hidden or in a small section) */}
          {seatedCustomers.length > 0 && (
            <div className="mt-12 pt-8 border-t border-brand-border">
              <h3 className="font-cinzel text-sm font-semibold text-brand-muted mb-4">Recently Seated</h3>
              <div className="flex flex-wrap gap-2">
                {seatedCustomers.slice(-5).map(c => (
                  <div key={c.id} className="bg-brand-bg border border-brand-border px-3 py-1.5 rounded-lg text-xs text-brand-muted flex items-center gap-2">
                    <span>{c.name}</span>
                    <span className="opacity-50">({c.partySize})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
