export interface Transaction {
  id: string; // cell A
  date: string; // cell B (ISO string format preferred for backend, formatted for frontend)
  itemName: string; // cell C
  type: 'Masuk' | 'Keluar'; // cell D
  quantity: number; // cell E
  notes: string; // cell F
  rowNumber?: number; // cell row number for edit/delete tracking
}

export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!searchRes.ok) throw new Error('Failed to search Drive');
  
  const searchData = await searchRes.json();
  const existingMatches = searchData.files?.filter((f: any) => f.name === 'Data Stok Gudang (Inventaris)');
  
  if (existingMatches && existingMatches.length > 0) {
    return existingMatches[0].id;
  }
  
  const createRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title: 'Data Stok Gudang (Inventaris)' },
      sheets: [{ properties: { title: 'Transactions' } }]
    })
  });
  
  if (!createRes.ok) throw new Error('Failed to create Spreadsheet');
  
  const createData = await createRes.json();
  const spreadsheetId = createData.spreadsheetId;
  
  // Initialize headers
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:F1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [["ID", "Tanggal", "Nama Barang", "Tipe", "Kuantitas", "Catatan"]]
    })
  });
  
  return spreadsheetId;
}

export async function getTransactions(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:F`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch transactions');
  const data = await res.json();
  
  if (!data.values) return [];
  
  return data.values.map((row: any[], index: number) => ({
    id: row[0] || '',
    date: row[1] || '',
    itemName: row[2] || '',
    type: row[3] === 'Masuk' ? 'Masuk' : 'Keluar',
    quantity: parseInt(row[4] || '0', 10),
    notes: row[5] || '',
    rowNumber: index + 2
  }));
}

export async function appendTransaction(accessToken: string, spreadsheetId: string, tx: Transaction): Promise<void> {
  const row = [tx.id, tx.date, tx.itemName, tx.type, tx.quantity.toString(), tx.notes];
  
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:F:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [row]
    })
  });
  
  if (!res.ok) throw new Error('Failed to append transaction');
}

export async function appendTransactions(accessToken: string, spreadsheetId: string, txs: Transaction[]): Promise<void> {
  const rows = txs.map(tx => [tx.id, tx.date, tx.itemName, tx.type, tx.quantity.toString(), tx.notes]);
  
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:F:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: rows
    })
  });
  
  if (!res.ok) throw new Error('Failed to append transactions');
}

export async function getSheetId(accessToken: string, spreadsheetId: string, sheetTitle: string): Promise<number | null> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetTitle);
  return sheet ? sheet.properties.sheetId : null;
}

export async function deleteTransactionRow(accessToken: string, spreadsheetId: string, sheetId: number, rowNumber: number): Promise<void> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }
      ]
    })
  });
  if (!res.ok) throw new Error('Failed to delete transaction row');
}

export async function updateTransactionRow(accessToken: string, spreadsheetId: string, rowNumber: number, tx: Transaction): Promise<void> {
  const row = [tx.id, tx.date, tx.itemName, tx.type, tx.quantity.toString(), tx.notes];
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A${rowNumber}:F${rowNumber}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [row]
    })
  });
  if (!res.ok) throw new Error('Failed to update transaction row');
}
