import { Timestamp } from 'firebase/firestore';

export interface WhatsAppMessageLog {
  messageId: string; // e.g., wamid.HBgL...
  templateName: 'cartel_table_ready' | 'cartel_gentle_reminder' | 'cartel_table_released';
  sentAt: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  failedAt?: Timestamp;
  errorReason?: string;
}

export interface WaitlistEntry {
  id: string;
  name: string;
  phone: string; // Normalized: +971501234567
  partySize: number;
  status:
    | 'waiting'
    | 'notified'
    | 'reminded'
    | 'checked-in'
    | 'expired'
    | 'no-show';
  tableReserved: string; // e.g., "BENCH 4"
  notifiedAt: Timestamp;
  gracePeriodEndsAt: Timestamp;
  reminderSentAt?: Timestamp;
  checkedInAt?: Timestamp;
  whatsappLog: WhatsAppMessageLog[];
}

export interface Table {
  id: string;
  name: string;
  floor: string;
  capacity: number;
  status: 'available' | 'occupied' | 'paying' | 'reserved' | 'out-of-order';
  currentGuest?: { 
    name: string; 
    partySize: number; 
    seatedAt: Timestamp 
  };
  reservedFor?: string; // Links to waitlistId
  lastUpdated: Timestamp;
}

export interface ActivityLog {
  id?: string;
  type: 'auto-release' | 'check-in' | 'seat-guest' | 'table-swap';
  table: string;
  guest: string; // Links to waitlistId or guest name
  performedBy: string; // ID of the host/system
  timestamp: Timestamp;
  details?: Record<string, any>;
}
