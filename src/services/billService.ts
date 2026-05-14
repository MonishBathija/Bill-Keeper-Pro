import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Bill, BillStatus } from '../types';
import { startOfYear, endOfYear } from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const billService = {
  deleteAllBills: async (userId: string) => {
    try {
      console.log("Searching for bills to purge for user", userId);
      // Purge Bills
      const billQuery = query(collection(db, 'bills'), where('userId', '==', userId));
      const billSnapshot = await getDocs(billQuery);
      console.log(`Found ${billSnapshot.docs.length} bills to purge`);
      
      const billChunks = [];
      for (let i = 0; i < billSnapshot.docs.length; i += 500) {
        billChunks.push(billSnapshot.docs.slice(i, i + 500));
      }

      for (const chunk of billChunks) {
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      console.log("Searching for parties to purge for user", userId);
      // Purge Parties
      const partyQuery = query(collection(db, 'parties'), where('userId', '==', userId));
      const partySnapshot = await getDocs(partyQuery);
      console.log(`Found ${partySnapshot.docs.length} parties to purge`);

      const partyChunks = [];
      for (let i = 0; i < partySnapshot.docs.length; i += 500) {
        partyChunks.push(partySnapshot.docs.slice(i, i + 500));
      }

      for (const chunk of partyChunks) {
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log("Purge comprehensive complete");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'purge/all');
    }
  },

  subscribeToBills: (userId: string, callback: (bills: Bill[]) => void) => {
    const q = query(
      collection(db, 'bills'), 
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const bills = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((bill: any) => bill.isDeleted !== true) as Bill[];
      callback(bills);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bills');
    });
  },

  subscribeToDeletedBills: (userId: string, callback: (bills: Bill[]) => void) => {
    const q = query(
      collection(db, 'bills'), 
      where('userId', '==', userId),
      where('isDeleted', '==', true)
    );
    return onSnapshot(q, (snapshot) => {
      const bills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Bill[];
      callback(bills);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bills/deleted');
    });
  },

  addBill: async (bill: Omit<Bill, 'id' | 'userId' | 'createdAt'>) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    try {
      // Uniqueness check: no bill number should be same in the current year for this user
      const billDate = bill.date instanceof Date ? bill.date : (bill.date.toDate ? bill.date.toDate() : new Date());
      const yearStart = startOfYear(billDate);
      const yearEnd = endOfYear(billDate);

      const q = query(
        collection(db, 'bills'),
        where('userId', '==', auth.currentUser.uid),
        where('billNumber', '==', bill.billNumber),
        where('partyName', '==', bill.partyName),
        where('amount', '==', bill.amount),
        where('date', '>=', Timestamp.fromDate(yearStart)),
        where('date', '<=', Timestamp.fromDate(yearEnd))
      );

      const existing = await getDocs(q);
      if (!existing.empty) {
        throw new Error(`An identical bill (No: ${bill.billNumber}, Amount: ${bill.amount}) already exists for "${bill.partyName}" in the year ${billDate.getFullYear()}.`);
      }

      await addDoc(collection(db, 'bills'), {
        ...bill,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error: any) {
      if (error.message.includes('already exists')) throw error;
      handleFirestoreError(error, OperationType.WRITE, 'bills');
    }
  },

  updateBillStatus: async (billId: string, status: BillStatus) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        status,
        updatedAt: serverTimestamp(), // Not in rules yet, but usually good. Fixed: rules check affectedKeys.
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${billId}`);
    }
  },

  updateBill: async (billId: string, data: Partial<Bill>) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${billId}`);
    }
  },

  deleteBill: async (billId: string) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bills/${billId}`);
    }
  },

  restoreBill: async (billId: string) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        isDeleted: false,
        deletedAt: null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${billId}`);
    }
  },

  permanentlyDeleteBill: async (billId: string) => {
    try {
      await deleteDoc(doc(db, 'bills', billId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bills/${billId}`);
    }
  },

  batchUpdateStatus: async (billIds: string[], status: BillStatus) => {
    const batch = writeBatch(db);
    billIds.forEach(id => {
      batch.update(doc(db, 'bills', id), { 
        status,
        updatedAt: serverTimestamp()
      });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bills/batch');
    }
  },

  batchDelete: async (billIds: string[]) => {
    try {
      const chunks = [];
      for (let i = 0; i < billIds.length; i += 500) {
        chunks.push(billIds.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.update(doc(db, 'bills', id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bills/batch-delete');
    }
  },

  batchPermanentlyDelete: async (billIds: string[]) => {
    try {
      const chunks = [];
      for (let i = 0; i < billIds.length; i += 500) {
        chunks.push(billIds.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'bills', id));
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bills/batch-purge');
    }
  },

  batchRestore: async (billIds: string[]) => {
    try {
      const chunks = [];
      for (let i = 0; i < billIds.length; i += 500) {
        chunks.push(billIds.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.update(doc(db, 'bills', id), {
            isDeleted: false,
            deletedAt: null,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bills/batch-restore');
    }
  },

  batchUpdateParty: async (billIds: string[], partyName: string) => {
    const batch = writeBatch(db);
    billIds.forEach(id => {
      batch.update(doc(db, 'bills', id), { 
        partyName,
        updatedAt: serverTimestamp()
      });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bills/batch');
    }
  },

  emptyTrash: async (userId: string) => {
    try {
      const q = query(
        collection(db, 'bills'), 
        where('userId', '==', userId),
        where('isDeleted', '==', true)
      );
      const snapshot = await getDocs(q);
      const chunks = [];
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        chunks.push(snapshot.docs.slice(i, i + 500));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bills/trash/purge');
    }
  },

  subscribeToParties: (userId: string, callback: (parties: string[]) => void) => {
    const q = query(collection(db, 'parties'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const parties = snapshot.docs.map(doc => doc.data().name as string);
      callback(parties);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'parties');
    });
  },

  saveParty: async (name: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    try {
      // Check if party already exists
      const q = query(collection(db, 'parties'), where('userId', '==', auth.currentUser.uid), where('name', '==', name));
      const existing = await getDocs(q);
      if (existing.empty) {
        await addDoc(collection(db, 'parties'), {
          name,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'parties');
    }
  },

  deletePartyByName: async (userId: string, name: string) => {
    try {
      const q = query(collection(db, 'parties'), where('userId', '==', userId), where('name', '==', name));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `parties/${name}`);
    }
  },

  // Settings
  getSettings: async (userId: string): Promise<any | null> => {
    try {
      const q = query(collection(db, 'settings'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings');
      return null;
    }
  },

  saveSettings: async (userId: string, data: { appTitle: string; companyName: string }) => {
    try {
      const q = query(collection(db, 'settings'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        await addDoc(collection(db, 'settings'), {
          ...data,
          userId,
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = doc(db, 'settings', snapshot.docs[0].id);
        await updateDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/save');
    }
  }
};
