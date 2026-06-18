export interface Transaction {
  id: string; // cell A
  date: string; // cell B (ISO string format preferred for backend, formatted for frontend)
  itemName: string; // cell C
  type: 'Masuk' | 'Keluar'; // cell D
  quantity: number; // cell E
  notes: string; // cell F
  rowNumber?: number; // cell row number for edit/delete tracking
}

const LOCAL_STORAGE_KEY = 'stokpintar_transactions';

function getLocalTransactions(): Transaction[] {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveLocalTransactions(txs: Transaction[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(txs));
}

export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  // Mock spreadsheet creation by returning a fake ID
  return new Promise(resolve => setTimeout(() => resolve('local_db'), 500));
}

export async function getTransactions(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
  return new Promise(resolve => setTimeout(() => resolve(getLocalTransactions()), 200));
}

export async function appendTransaction(accessToken: string, spreadsheetId: string, tx: Transaction): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      const txs = getLocalTransactions();
      const newTx = { ...tx, rowNumber: txs.length > 0 ? (txs[txs.length - 1].rowNumber || 0) + 1 : 2 };
      txs.push(newTx);
      saveLocalTransactions(txs);
      resolve();
    }, 200);
  });
}

export async function appendTransactions(accessToken: string, spreadsheetId: string, txs: Transaction[]): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      const existing = getLocalTransactions();
      let lastRow = existing.length > 0 ? (existing[existing.length - 1].rowNumber || 0) : 1;
      const newTxs = txs.map(tx => {
        lastRow++;
        return { ...tx, rowNumber: lastRow };
      });
      saveLocalTransactions([...existing, ...newTxs]);
      resolve();
    }, 200);
  });
}

export async function getSheetId(accessToken: string, spreadsheetId: string, sheetTitle: string): Promise<number | null> {
  return Promise.resolve(0); // Mock sheet ID
}

export async function deleteTransactionRow(accessToken: string, spreadsheetId: string, sheetId: number, rowNumber: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      const txs = getLocalTransactions();
      const filtered = txs.filter(tx => tx.rowNumber !== rowNumber);
      saveLocalTransactions(filtered);
      resolve();
    }, 200);
  });
}

export async function updateTransactionRow(accessToken: string, spreadsheetId: string, rowNumber: number, updatedTx: Transaction): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      const txs = getLocalTransactions();
      const index = txs.findIndex(tx => tx.rowNumber === rowNumber);
      if (index !== -1) {
        txs[index] = { ...updatedTx, rowNumber };
        saveLocalTransactions(txs);
      }
      resolve();
    }, 200);
  });
}
