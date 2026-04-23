import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, doc, onSnapshot, writeBatch, serverTimestamp, getDocs, updateDoc, deleteField, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type TableStatus = "available" | "occupied" | "paying" | "reserved" | "out-of-order";

export type TableShape = "bar" | "round" | "bench" | "couch" | "square";

export interface TableData {
  id: string;
  floor: "ground" | "first" | "rooftop";
  zone: string;
  shape: TableShape;
  capacity: number;
  status: TableStatus;
  currentGuest?: {
    name: string;
    partySize: number;
    seatedAt: any;
    notes?: string;
  };
  assignedWaiter?: string;
  lastUpdated?: any;
  updatedBy?: string;
  label: string;
}

const RESTAURANT_ID = 'cartel_coffee';
const TABLES_COLLECTION = `restaurants/${RESTAURANT_ID}/tables_luxury`; // New collection for the luxury schema

const generateTables = (): TableData[] => {
  const tables: TableData[] = [];
  
  for(let i=1; i<=7; i++) tables.push({ id: `T-B${i}`, floor: 'ground', zone: 'Bar District', shape: 'bar', label: `BAR ${i}`, capacity: 1, status: 'available' });
  for(let i=1; i<=6; i++) tables.push({ id: `T-L${i}`, floor: 'ground', zone: 'Lounge Area', shape: 'square', label: `LOUNGE ${i}`, capacity: 4, status: 'available' });
  for(let i=1; i<=5; i++) tables.push({ id: `T-R${i}`, floor: 'first', zone: 'Rounds', shape: 'round', label: `ROUND ${i}`, capacity: 5, status: 'available' });
  for(let i=1; i<=7; i++) tables.push({ id: `T-BE${i}`, floor: 'first', zone: 'Benches', shape: 'bench', label: `BENCH ${i}`, capacity: 2, status: 'available' });
  for(let i=1; i<=7; i++) tables.push({ id: `T-C${i}`, floor: 'first', zone: 'Couches', shape: 'couch', label: `COUCH ${i}`, capacity: 6, status: 'available' });
  for(let i=1; i<=10; i++) tables.push({ id: `T-RT${i}`, floor: 'rooftop', zone: 'Rooftop', shape: 'square', label: `ROOFTOP ${i}`, capacity: 4, status: 'available' });
  for(let i=1; i<=10; i++) tables.push({ id: `T-O${i}`, floor: 'ground', zone: 'Outdoor', shape: 'square', label: `OUTDOOR ${i}`, capacity: 4, status: 'available' });

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
    let unsub = () => {};
    const initData = async () => {
      const snap = await getDocs(collection(db, TABLES_COLLECTION)).catch(e => {
        console.error("Error fetching tables_luxury:", e);
        throw e;
      });
      if (snap.empty) {
        const batch = writeBatch(db);
        INITIAL_TABLES.forEach(t => {
          const docRef = doc(db, TABLES_COLLECTION, t.id);
          const filteredT = Object.fromEntries(Object.entries(t).filter(([_, v]) => v !== undefined));
          batch.set(docRef, { ...filteredT, lastUpdated: serverTimestamp(), updatedBy: 'system_init' });
        });
        await batch.commit().catch(console.error);
      }

      unsub = onSnapshot(collection(db, TABLES_COLLECTION), (snapshot) => {
        const serverTables: TableData[] = [];
        snapshot.forEach(doc => {
          serverTables.push(doc.data({ serverTimestamps: 'estimate' }) as TableData);
        });
        setTables(serverTables);
      }, (error) => {
        console.error("Error listening to tables_luxury:", error);
      });
    };
    
    initData();
    return () => unsub();
  }, []);

  const getDeviceId = () => {
    // Simple way to identify which device made the change
    return localStorage.getItem('cartel_staff_pin') ? 'Staff_iPad' : 'Unknown_Device';
  };

  const updateTable = async (id: string, updates: Partial<TableData>) => {
    const previousTables = [...tables];
    const newTables = tables.map(t => t.id === id ? { ...t, ...updates } : t);
    setTables(newTables); // Optimistic UI

    try {
      const docRef = doc(db, TABLES_COLLECTION, id);
      const dbUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null) {
          dbUpdates[key] = deleteField();
        } else {
          dbUpdates[key] = value;
        }
      }
      dbUpdates.lastUpdated = serverTimestamp();
      dbUpdates.updatedBy = getDeviceId();
      await updateDoc(docRef, dbUpdates);
    } catch (err) {
      console.error("Failed to update table:", err);
      // Revert on failure
      setTables(previousTables);
    }
  };

  const swapTables = async (idA: string, idB: string) => {
    const tA = tables.find(t => t.id === idA);
    const tB = tables.find(t => t.id === idB);
    if (!tA || !tB) return;

    const previousTables = [...tables];
    const newTables = tables.map(t => {
      if (t.id === idA) {
        return { ...t, status: tB.status, currentGuest: tB.currentGuest, assignedWaiter: tB.assignedWaiter };
      }
      if (t.id === idB) {
        return { ...t, status: tA.status, currentGuest: tA.currentGuest, assignedWaiter: tA.assignedWaiter };
      }
      return t;
    });
    setTables(newTables); // Optimistic UI

    try {
      const batch = writeBatch(db);
      const refA = doc(db, TABLES_COLLECTION, idA);
      const refB = doc(db, TABLES_COLLECTION, idB);
      
      batch.update(refA, { 
        status: tB.status, 
        currentGuest: tB.currentGuest || deleteField(), 
        assignedWaiter: tB.assignedWaiter || deleteField(),
        lastUpdated: serverTimestamp(),
        updatedBy: getDeviceId()
      });
      batch.update(refB, { 
        status: tA.status, 
        currentGuest: tA.currentGuest || deleteField(), 
        assignedWaiter: tA.assignedWaiter || deleteField(),
        lastUpdated: serverTimestamp(),
        updatedBy: getDeviceId()
      });
      
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
      currentGuest: undefined,
      assignedWaiter: undefined
    }));
    setTables(newTables);

    try {
      const batch = writeBatch(db);
      tables.forEach(t => {
        batch.update(doc(db, TABLES_COLLECTION, t.id), { 
          status: 'available', 
          currentGuest: deleteField(), 
          assignedWaiter: deleteField(),
          lastUpdated: serverTimestamp(),
          updatedBy: getDeviceId()
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
