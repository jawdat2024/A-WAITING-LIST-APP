import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, doc, onSnapshot, writeBatch, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export type TableStatus = 'available' | 'reserved' | 'occupied' | 'paid';

export interface TableData {
  id: string;
  label: string;
  x: number;
  y: number;
  status: TableStatus;
  customerName?: string;
  partySize?: number;
  minCapacity?: number;
  maxCapacity?: number;
  updatedAt?: { toMillis: () => number };
}

const generateTables = (): TableData[] => {
  const tables: TableData[] = [];
  
  for(let i=1; i<=7; i++) tables.push({ id: `bar${i}`, label: `BAR ${i}`, x: 80 + (i-1)*130, y: 120, status: 'available', maxCapacity: 1 });
  for(let i=1; i<=6; i++) tables.push({ id: `lounge${i}`, label: `LOUNGE ${i}`, x: 80 + (i-1)*140, y: 320, status: 'available', minCapacity: (i===1 || i===2) ? 4 : undefined });
  for(let i=1; i<=5; i++) tables.push({ id: `round${i}`, label: `ROUND ${i}`, x: 80 + (i-1)*160, y: 520, status: 'available', minCapacity: (i===4 || i===5) ? 5 : undefined });
  for(let i=1; i<=7; i++) tables.push({ id: `bench${i}`, label: `BENCH ${i}`, x: 80 + (i-1)*130, y: 720, status: 'available', maxCapacity: [1,2,5,6,7].includes(i) ? 2 : undefined });
  for(let i=1; i<=7; i++) tables.push({ id: `couch${i}`, label: `COUCH ${i}`, x: 80 + (i-1)*150, y: 920, status: 'available', minCapacity: i===1 ? 5 : undefined });
  for(let i=1; i<=10; i++) tables.push({ id: `rooftop${i}`, label: `ROOFTOP ${i}`, x: 1050 + ((i-1)%2)*140, y: 120 + Math.floor((i-1)/2)*160, status: 'available' });
  for(let i=1; i<=10; i++) tables.push({ id: `outdoor${i}`, label: `OUTDOOR ${i}`, x: 1350 + ((i-1)%2)*140, y: 120 + Math.floor((i-1)/2)*160, status: 'available' });

  const setTable = (id: string, updates: Partial<TableData>) => {
    const t = tables.find(t => t.id === id);
    if (t) Object.assign(t, updates);
  };
  setTable('lounge1', { status: 'occupied', customerName: 'Jawdat G.', partySize: 5 });
  setTable('bar2', { status: 'paid', customerName: 'Sarah', partySize: 1 });
  setTable('couch1', { status: 'occupied', customerName: 'Khalid', partySize: 6 });

  return tables;
};

const INITIAL_TABLES = generateTables();

interface ContextProps {
  tables: TableData[];
  updateTable: (id: string, updates: Partial<TableData>) => void;
  swapTables: (idA: string, idB: string) => void;
  resetFloorPlan: () => void;
}

const FloorPlanContext = createContext<ContextProps | null>(null);

export const FloorPlanProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<TableData[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    let unsub = () => {};
    const initData = async () => {
      const snap = await getDocs(collection(db, 'tables'));
      if (snap.empty) {
        const batch = writeBatch(db);
        INITIAL_TABLES.forEach(t => {
          const docRef = doc(db, 'tables', t.id);
          const filteredT = Object.fromEntries(Object.entries(t).filter(([_, v]) => v !== undefined));
          batch.set(docRef, { ...filteredT, updatedAt: serverTimestamp() });
        });
        await batch.commit().catch(console.error);
      }

      unsub = onSnapshot(collection(db, 'tables'), (snapshot) => {
        const serverTables: TableData[] = [];
        snapshot.forEach(doc => {
          serverTables.push(doc.data({ serverTimestamps: 'estimate' }) as TableData);
        });
        setTables(serverTables);
      });
    };
    
    initData();
    return () => unsub();
  }, []);

  const updateTable = async (id: string, updates: Partial<TableData>) => {
    const previousTables = [...tables];
    const newTables = tables.map(t => t.id === id ? { ...t, ...updates } : t);
    setTables(newTables); // Optimistic UI

    try {
      const docRef = doc(db, 'tables', id);
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([v]) => v !== undefined)
      );
      await updateDoc(docRef, { ...filteredUpdates, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error("Failed to update table:", err);
      // Revert on failure
      setTables(previousTables);
      // Assuming a global error handling might be better, but this reverts gracefully
    }
  };

  const swapTables = async (idA: string, idB: string) => {
    const tA = tables.find(t => t.id === idA);
    const tB = tables.find(t => t.id === idB);
    if (!tA || !tB) return;

    const previousTables = [...tables];
    const newTables = tables.map(t => {
      if (t.id === idA) {
        return { ...t, status: tB.status, customerName: tB.customerName, partySize: tB.partySize };
      }
      if (t.id === idB) {
        return { ...t, status: tA.status, customerName: tA.customerName, partySize: tA.partySize };
      }
      return t;
    });
    setTables(newTables); // Optimistic UI

    try {
      const batch = writeBatch(db);
      const refA = doc(db, 'tables', idA);
      const refB = doc(db, 'tables', idB);
      
      batch.update(refA, { status: tB.status, customerName: tB.customerName || null, partySize: tB.partySize || null, updatedAt: serverTimestamp() });
      batch.update(refB, { status: tA.status, customerName: tA.customerName || null, partySize: tA.partySize || null, updatedAt: serverTimestamp() });
      
      await batch.commit();
    } catch (err) {
      console.error("Failed to swap tables:", err);
      setTables(previousTables);
    }
  };

  const resetFloorPlan = async () => {
    const previousTables = [...tables];
    const newTables = tables.map(t => ({
      ...t,
      status: 'available' as TableStatus,
      customerName: undefined,
      partySize: undefined
    }));
    setTables(newTables);

    try {
      const batch = writeBatch(db);
      tables.forEach(t => {
        batch.update(doc(db, 'tables', t.id), { 
          status: 'available', 
          customerName: null, 
          partySize: null, 
          updatedAt: serverTimestamp() 
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to reset tables:", err);
      setTables(previousTables);
    }
  };

  return (
    <FloorPlanContext.Provider value={{ tables, updateTable, swapTables, resetFloorPlan }}>
      {children}
    </FloorPlanContext.Provider>
  );
};

export const useFloorPlan = () => {
  const ctx = useContext(FloorPlanContext);
  if (!ctx) throw new Error('Missing FloorPlanProvider');
  return ctx;
};
