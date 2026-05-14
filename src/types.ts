export enum BillStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
}

export interface Bill {
  id: string;
  billNumber: string;
  partyName: string;
  date: any; // Firestore Timestamp
  amount: number;
  status: BillStatus;
  userId: string;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface BillFormData {
  billNumber: string;
  partyName: string;
  date: string;
  amount: number;
  status: BillStatus;
}

export interface Party {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}
