import { db, auth } from './firebase';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy, 
  writeBatch 
} from 'firebase/firestore';

export interface Transaction {
  id: string; // cell A
  date: string; // cell B (ISO string format preferred for backend, formatted for frontend)
  itemName: string; // cell C
  type: 'Masuk' | 'Keluar'; // cell D
  quantity: number; // cell E
  notes: string; // cell F
  rowNumber?: number; // cell row number for edit/delete tracking
}

// Collection reference in Firestore
const COLLECTION_NAME = 'transactions';

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
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  // Return a dummy spreadsheetId as it's no longer used for Google Sheets but is expected by components
  return 'firebase_firestore_db';
}

export async function getTransactions(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'asc'));
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    
    let index = 0;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      let safeDate = new Date().toISOString();
      if (data.date && new Date(data.date).toString() !== 'Invalid Date') {
        safeDate = data.date;
      }

      transactions.push({
        id: data.id || docSnap.id,
        date: safeDate,
        itemName: String(data.itemName || ''),
        type: data.type === 'Masuk' ? 'Masuk' : 'Keluar',
        quantity: Number(data.quantity) || 0,
        notes: String(data.notes || ''),
        rowNumber: index + 2 // Assign dynamic sequential rowNumber consistent with old sheets logic
      });
      index++;
    });
    
    return transactions;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
  }
}

export async function appendTransaction(accessToken: string, spreadsheetId: string, tx: Transaction): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${tx.id}`;
  try {
    // Save document with the custom id (UUID) from tx.id to prevent duplicates
    const docRef = doc(db, COLLECTION_NAME, tx.id);
    await setDoc(docRef, {
      id: tx.id,
      date: tx.date,
      itemName: tx.itemName,
      type: tx.type,
      quantity: tx.quantity,
      notes: tx.notes
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function appendTransactions(accessToken: string, spreadsheetId: string, txs: Transaction[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    txs.forEach((tx) => {
      const docRef = doc(db, COLLECTION_NAME, tx.id);
      batch.set(docRef, {
        id: tx.id,
        date: tx.date,
        itemName: tx.itemName,
        type: tx.type,
        quantity: tx.quantity,
        notes: tx.notes
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
  }
}

export async function getSheetId(accessToken: string, spreadsheetId: string, sheetTitle: string): Promise<number | null> {
  // Return dummy sheet ID (for legacy compatibility)
  return 0;
}

export async function deleteTransactionRow(accessToken: string, spreadsheetId: string, sheetId: number, rowNumber: number): Promise<void> {
  let targetTx: Transaction | undefined;
  try {
    // 1. Get the list of transactions in sequence
    const txs = await getTransactions(accessToken, spreadsheetId);
    
    // 2. Find the transaction corresponding to the rowNumber
    targetTx = txs.find(tx => tx.rowNumber === rowNumber);
    if (!targetTx) {
      throw new Error(`Data transaksi pada nomor baris ${rowNumber} tidak ditemukan.`);
    }
  } catch (error) {
    console.error('Failed to locate transaction row for deletion:', error);
    throw error;
  }

  const docPath = `${COLLECTION_NAME}/${targetTx.id}`;
  try {
    // 3. Delete the document by targetTx.id
    const docRef = doc(db, COLLECTION_NAME, targetTx.id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function deleteMultipleTransactions(accessToken: string, spreadsheetId: string, sheetId: number, transactionsToDelete: Transaction[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    transactionsToDelete.forEach((tx) => {
      const docRef = doc(db, COLLECTION_NAME, tx.id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
  }
}

export async function updateTransactionRow(accessToken: string, spreadsheetId: string, rowNumber: number, updatedTx: Transaction): Promise<void> {
  let targetTx: Transaction | undefined;
  try {
    // 1. Get the list of transactions
    const txs = await getTransactions(accessToken, spreadsheetId);
    
    // 2. Find the transaction corresponding to the rowNumber
    targetTx = txs.find(tx => tx.rowNumber === rowNumber);
    if (!targetTx) {
      throw new Error(`Data transaksi pada nomor baris ${rowNumber} tidak ditemukan.`);
    }
  } catch (error) {
    console.error('Failed to locate transaction row for editing:', error);
    throw error;
  }

  const docPath = `${COLLECTION_NAME}/${targetTx.id}`;
  try {
    // 3. Update the document in Firestore
    const docRef = doc(db, COLLECTION_NAME, targetTx.id);
    await setDoc(docRef, {
      id: targetTx.id,
      date: updatedTx.date,
      itemName: updatedTx.itemName,
      type: updatedTx.type,
      quantity: updatedTx.quantity,
      notes: updatedTx.notes
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}
