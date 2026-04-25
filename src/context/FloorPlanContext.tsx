import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, doc, onSnapshot, writeBatch, serverTimestamp, getDocs, updateDoc, deleteField, Timestamp, runTransaction } from 'firebase/firestore';
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
  x_pos: number;
  y_pos: number;
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

const DEFAULT_BRANCH_ID = 'main';
const ZONES_COLLECTION = `branches/${DEFAULT_BRANCH_ID}/floor_zones`;

const generateZones = () => {
  const barTables: TableData[] = Array.from({ length: 7 }, (_, i) => ({ id: `T-B${i+1}`, floor: 'ground', zone: 'Bar District', shape: 'bar', label: `BAR ${i+1}`, capacity: 1, status: 'available', x_pos: 0, y_pos: 0 }));
  const loungeTables: TableData[] = Array.from({ length: 6 }, (_, i) => ({ id: `T-L${i+1}`, floor: 'ground', zone: 'Lounge Area', shape: 'square', label: `LOUNGE ${i+1}`, capacity: 4, status: 'available', x_pos: 0, y_pos: 0 }));
  const roundTables: TableData[] = Array.from({ length: 5 }, (_, i) => ({ id: `T-R${i+1}`, floor: 'first', zone: 'Rounds', shape: 'round', label: `ROUND ${i+1}`, capacity: 5, status: 'available', x_pos: 0, y_pos: 0 }));
  const benchTables: TableData[] = Array.from({ length: 7 }, (_, i) => ({ id: `T-BE${i+1}`, floor: 'first', zone: 'Benches', shape: 'bench', label: `BENCH ${i+1}`, capacity: 2, status: 'available', x_pos: 0, y_pos: 0 }));
  const couchTables: TableData[] = Array.from({ length: 7 }, (_, i) => ({ id: `T-C${i+1}`, floor: 'first', zone: 'Couches', shape: 'couch', label: `COUCH ${i+1}`, capacity: 6, status: 'available', x_pos: 0, y_pos: 0 }));
  const rooftopTables: TableData[] = Array.from({ length: 10 }, (_, i) => ({ id: `T-RT${i+1}`, floor: 'rooftop', zone: 'Rooftop', shape: 'square', label: `ROOFTOP ${i+1}`, capacity: 4, status: 'available', x_pos: 0, y_pos: 0 }));
  const outdoorTables: TableData[] = Array.from({ length: 10 }, (_, i) => ({ id: `T-O${i+1}`, floor: 'ground', zone: 'Outdoor', shape: 'square', label: `OUTDOOR ${i+1}`, capacity: 4, status: 'available', x_pos: 0, y_pos: 0 }));

  return [
    { id: 'zone_bar', name: 'Bar District', tables: barTables },
    { id: 'zone_lounge', name: 'Lounge Area', tables: loungeTables },
    { id: 'zone_rounds', name: 'Rounds', tables: roundTables },
    { id: 'zone_benches', name: 'Benches', tables: benchTables },
    { id: 'zone_couches', name: 'Couches', tables: couchTables },
    { id: 'zone_rooftop', name: 'Rooftop', tables: rooftopTables },
    { id: 'zone_outdoor', name: 'Outdoor', tables: outdoorTables },
  ];
};

const INITIAL_ZONES = generateZones();

interface ContextProps {
  tables: TableData[];
  updateTable: (id: string, updates: Partial<TableData>) => void;
  swapTables: (idA: string, idB: string) => void;
  resetFloorPlan: () => void;
  refreshGrid: () => Promise<void>;
  assignTableAtomic: (id: string, updates: Partial<TableData>) => Promise<boolean>;
}

const FloorPlanContext = createContext<ContextProps | null>(null);

export const FloorPlanProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<TableData[]>([]);

  const fetchZonesAndMapTables = async (): Promise<TableData[]> => {
    const snap = await getDocs(collection(db, ZONES_COLLECTION));
    let allTables: TableData[] = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (Array.isArray(data.tables)) {
        allTables = allTables.concat(data.tables);
      }
    });
    return allTables;
  };

  const refreshGrid = async () => {
    try {
      const serverTables = await fetchZonesAndMapTables();
      setTables(serverTables);
    } catch (err) {
      console.error("Manual refresh failed:", err);
    }
  };

  useEffect(() => {
    let unsub = () => {};
    
    // Initialize the sync matrix once tables are loaded
    const initializeSyncMatrix = (loadedTables: TableData[]) => {
      console.log(`[Service Sync] Synchronization matrix initialized with ${loadedTables.length} tables.`);
      // Add any further matrix initialization logic here if needed
      setTables(loadedTables);
    };

    const initData = async () => {
      try {
        console.log(`[Service Sync] Querying branch ID: ${DEFAULT_BRANCH_ID} at collection: ${ZONES_COLLECTION}`);
        const snap = await getDocs(collection(db, ZONES_COLLECTION));
        
        if (snap.empty) {
          console.warn(`[Service Sync] Data empty: No floor_map_zones found for branch ${DEFAULT_BRANCH_ID}. Initializing fallback sync matrix...`);
          const batch = writeBatch(db);
          INITIAL_ZONES.forEach(zone => {
            const docRef = doc(db, ZONES_COLLECTION, zone.id);
            // Clean up undefined values inside tables array
            const cleanTables = zone.tables.map(t => Object.fromEntries(Object.entries(t).filter(([_, v]) => v !== undefined)));
            batch.set(docRef, { name: zone.name, tables: cleanTables, lastUpdated: serverTimestamp(), updatedBy: 'system_init' });
          });
          await batch.commit();
          console.log(`[Service Sync] Fallback sync matrix created.`);
        }

        unsub = onSnapshot(collection(db, ZONES_COLLECTION), (snapshot) => {
          let serverTables: TableData[] = [];
          snapshot.forEach(doc => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            if (Array.isArray(data.tables)) {
              serverTables = serverTables.concat(data.tables as TableData[]);
            }
          });
          
          if (serverTables.length > 0) {
            initializeSyncMatrix(serverTables);
          } else {
             console.warn(`[Service Sync] onSnapshot returned empty tables for branch ${DEFAULT_BRANCH_ID}`);
             setTables([]);
          }
        }, (error) => {
          console.error("[Service Sync] Error listening to zones:", error);
        });
      } catch (e) {
        console.error("[Service Sync] Initialization error:", e);
      }
    };
    
    initData();
    return () => unsub();
  }, []);

  const getDeviceId = () => {
    // Return device identifier
    return localStorage.getItem('cartel_staff_pin') ? 'Staff_iPad' : 'Unknown_Device';
  };

  /**
   * Updates an individual table by finding its zone document and updating the array.
   */
  const updateTable = async (id: string, updates: Partial<TableData>) => {
    // 1. Optimistic update
    const previousTables = [...tables];
    const newTables = tables.map(t => t.id === id ? { ...t, ...updates } : t);
    setTables(newTables); 

    try {
      // 2. Find which zone contains this table
      const targetTable = previousTables.find(t => t.id === id);
      if (!targetTable) throw new Error("Table not found");

      const snap = await getDocs(collection(db, ZONES_COLLECTION));
      let zoneDocId = '';
      let zoneTables: TableData[] = [];
      
      snap.forEach(doc => {
        const data = doc.data();
        if (Array.isArray(data.tables) && data.tables.some((t: TableData) => t.id === id)) {
           zoneDocId = doc.id;
           zoneTables = data.tables;
        }
      });

      if (!zoneDocId) throw new Error("Zone for table not found in DB");

      const updatedZoneTables = zoneTables.map(t => {
        if (t.id === id) {
           const merged = { ...t, ...updates };
           // Firestore does not store undefined in arrays natively, clean undefined
           for (const k in merged) {
             if (merged[k as keyof TableData] === undefined) delete merged[k as keyof TableData];
           }
           return merged;
        }
        return t;
      });

      const docRef = doc(db, ZONES_COLLECTION, zoneDocId);
      await updateDoc(docRef, {
        tables: updatedZoneTables,
        lastUpdated: serverTimestamp(),
        updatedBy: getDeviceId()
      });
    } catch (err) {
      console.error("Failed to update table:", err);
      // Revert on failure
      setTables(previousTables);
    }
  };

  const assignTableAtomic = async (id: string, updates: Partial<TableData>): Promise<boolean> => {
    try {
      // Find the zone document for the table
      const snap = await getDocs(collection(db, ZONES_COLLECTION));
      let zoneDocId = '';
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (Array.isArray(data.tables) && data.tables.some((t: TableData) => t.id === id)) {
           zoneDocId = docSnap.id;
        }
      });
      
      if (!zoneDocId) throw new Error("Zone not found for table");
      
      const zoneRef = doc(db, ZONES_COLLECTION, zoneDocId);

      await runTransaction(db, async (transaction) => {
        const zoneDoc = await transaction.get(zoneRef);
        if (!zoneDoc.exists()) {
          throw new Error("Zone document does not exist!");
        }

        const data = zoneDoc.data();
        const tablesList: TableData[] = data.tables || [];
        
        const targetTable = tablesList.find(t => t.id === id);
        if (!targetTable) throw new Error("Table not found in zone");

        // The double booking guard
        if (updates.status === 'occupied' || updates.status === 'reserved') {
          if (targetTable.status === 'occupied' || targetTable.status === 'reserved') {
            throw new Error("TABLE_UNAVAILABLE");
          }
        }

        const updatedTablesList = tablesList.map(t => {
          if (t.id === id) {
            const merged = { ...t, ...updates };
            for (const k in merged) {
              if (merged[k as keyof TableData] === undefined) delete merged[k as keyof TableData];
               if (merged[k as keyof TableData] === null) delete merged[k as keyof TableData];
            }
            // Include a lastAssignedAt timestamp for the table mapping inside array if we wanted
            // but we'll stick to updating the entire doc
            return merged;
          }
          return t;
        });

        transaction.update(zoneRef, {
          tables: updatedTablesList,
          lastUpdated: serverTimestamp(),
          updatedBy: getDeviceId()
        });
      });

      return true;
    } catch (e: any) {
      if (e.message === "TABLE_UNAVAILABLE") {
        return false;
      }
      console.error("Atomic assignment failed:", e);
      throw e;
    }
  };

  const swapTables = async (idA: string, idB: string) => {
    const tA = tables.find(t => t.id === idA);
    const tB = tables.find(t => t.id === idB);
    if (!tA || !tB) return;

    // Optimistic UI updates
    const previousTables = [...tables];
    setTables(tables.map(t => {
      if (t.id === idA) return { ...t, status: tB.status, currentGuest: tB.currentGuest, assignedWaiter: tB.assignedWaiter };
      if (t.id === idB) return { ...t, status: tA.status, currentGuest: tA.currentGuest, assignedWaiter: tA.assignedWaiter };
      return t;
    }));

    try {
      // Fetch current zones to perform update
      const snap = await getDocs(collection(db, ZONES_COLLECTION));
      const batch = writeBatch(db);
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!Array.isArray(data.tables)) return;
        
        let modified = false;
        const newTables = data.tables.map((t: TableData) => {
          if (t.id === idA) {
            modified = true;
            return { ...t, status: tB.status, currentGuest: tB.currentGuest || null, assignedWaiter: tB.assignedWaiter || null };
          }
          if (t.id === idB) {
            modified = true;
            return { ...t, status: tA.status, currentGuest: tA.currentGuest || null, assignedWaiter: tA.assignedWaiter || null };
          }
          return t;
        });

        if (modified) {
          // Clean undefined mappings
          newTables.forEach((t: any) => {
             for (const k in t) {
               if (t[k] === undefined) delete t[k];
               if (t[k] === null) delete t[k]; // clean nulls to emulate deleteField
             }
          });
          batch.update(doc(db, ZONES_COLLECTION, docSnap.id), { 
            tables: newTables,
            lastUpdated: serverTimestamp(),
            updatedBy: getDeviceId()
          });
        }
      });

      await batch.commit();
    } catch (err) {
      console.error("Failed to swap tables:", err);
      setTables(previousTables);
    }
  };

  const resetFloorPlan = async () => {
    const previousTables = [...tables];
    setTables(tables.map(t => ({ ...t, status: 'available', currentGuest: undefined, assignedWaiter: undefined })));

    try {
      const snap = await getDocs(collection(db, ZONES_COLLECTION));
      const batch = writeBatch(db);
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (!Array.isArray(data.tables)) return;
        
        const newTables = data.tables.map((t: TableData) => {
          const nt = { ...t, status: 'available' };
          delete (nt as any).currentGuest;
          delete (nt as any).assignedWaiter;
          return nt;
        });

        batch.update(doc(db, ZONES_COLLECTION, docSnap.id), { 
          tables: newTables,
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
    <FloorPlanContext.Provider value={{ tables, updateTable, swapTables, resetFloorPlan, refreshGrid }}>
      {children}
    </FloorPlanContext.Provider>
  );
};

export const useFloorPlan = () => {
  const ctx = useContext(FloorPlanContext);
  if (!ctx) throw new Error('Missing FloorPlanProvider');
  return ctx;
};
