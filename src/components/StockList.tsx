import React, { useState, useMemo } from 'react';
import { Transaction, deleteTransactionRow, updateTransactionRow, getSheetId } from '../lib/sheets';
import { RefreshCw, Edit2, Trash2, Search, X, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  transactions: Transaction[];
  loading: boolean;
  onRefresh: () => void;
  token: string;
  spreadsheetId: string;
}

export default function StockList({ transactions, loading, onRefresh, token, spreadsheetId }: Props) {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [searchHistory, setSearchHistory] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    if (!searchHistory) return transactions;
    const query = searchHistory.toLowerCase();
    return transactions.filter(tx => 
      tx.itemName.toLowerCase().includes(query) ||
      (tx.notes && tx.notes.toLowerCase().includes(query)) ||
      tx.type.toLowerCase().includes(query) ||
      tx.quantity.toString().includes(query)
    );
  }, [transactions, searchHistory]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editingTx.rowNumber) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await updateTransactionRow(token, spreadsheetId, editingTx.rowNumber, editingTx);
      setEditingTx(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengubah transaksi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTx || !deletingTx.rowNumber) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const sheetId = await getSheetId(token, spreadsheetId, 'Transactions');
      if (sheetId === null) {
        throw new Error('Gagal menemukan ID sheet "Transactions"');
      }
      await deleteTransactionRow(token, spreadsheetId, sheetId, deletingTx.rowNumber);
      setDeletingTx(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menghapus transaksi');
    } finally {
      setActionLoading(false);
    }
  };

  const currentStocks = useMemo(() => {
    const stockMap = new Map<string, { masuk: number, keluar: number }>();
    transactions.forEach(tx => {
      const current = stockMap.get(tx.itemName) || { masuk: 0, keluar: 0 };
      if (tx.type === 'Masuk') {
        current.masuk += tx.quantity;
      } else {
        current.keluar += tx.quantity;
      }
      stockMap.set(tx.itemName, current);
    });

    return Array.from(stockMap.entries())
      .map(([name, data]) => ({ name, masuk: data.masuk, keluar: data.keluar, qty: data.masuk - data.keluar }));
  }, [transactions]);

  const kritisCount = currentStocks.filter(s => s.qty > 0 && s.qty <= 10).length;
  const totalQty = currentStocks.reduce((sum, item) => sum + item.qty, 0);

  const handleExportToExcel = () => {
    try {
      // 1. Sheet for current stock status
      const stockData = currentStocks.map(stock => ({
        'Nama Barang': stock.name,
        'Jumlah Masuk': stock.masuk,
        'Jumlah Keluar': stock.keluar,
        'Stok Akhir': stock.qty,
        'Status': stock.qty <= 0 ? 'HABIS' : stock.qty <= 10 ? 'KRITIS' : 'AMAN'
      }));
      const wsStock = XLSX.utils.json_to_sheet(stockData);

      // Set nice column widths for sheet 1
      wsStock['!cols'] = [
        { wch: 30 }, // Nama Barang
        { wch: 15 }, // Jumlah Masuk
        { wch: 15 }, // Jumlah Keluar
        { wch: 15 }, // Stok Akhir
        { wch: 15 }  // Status
      ];

      // 2. Sheet for transaction history
      const txData = transactions.map(tx => ({
        'Tanggal Transaksi': new Date(tx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}),
        'Jam': new Date(tx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}),
        'Nama Barang': tx.itemName,
        'Tipe Transaksi': tx.type,
        'Kuantitas': tx.quantity,
        'Keterangan/Catatan': tx.notes || '-'
      }));
      const wsTx = XLSX.utils.json_to_sheet(txData);

      // Set nice column widths for sheet 2
      wsTx['!cols'] = [
        { wch: 20 }, // Tanggal
        { wch: 10 }, // Jam
        { wch: 30 }, // Nama Barang
        { wch: 15 }, // Tipe
        { wch: 12 }, // Kuantitas
        { wch: 35 }  // Catatan
      ];

      // 3. Combine both sheets into one workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsStock, 'Status Stok Saat Ini');
      XLSX.utils.book_append_sheet(wb, wsTx, 'Riwayat Transaksi Lengkap');

      // 4. Download file
      XLSX.writeFile(wb, `Laporan_StokPintar_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Failed to export to Excel:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-min md:h-[calc(100vh-160px)]">
      
      {/* Main Inventory List */}
      <div className="md:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
        <div className="flex justify-between items-center mb-6 shrink-0 flex-wrap gap-2">
          <h2 className="font-bold text-lg">Status Stok Real-Time</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportToExcel}
              disabled={loading || currentStocks.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/10 active:scale-95 duration-150"
              title="Ekspor Data Stok & Transaksi ke Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor Excel
            </button>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">TERKONEKSI</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-x-auto min-h-0 bg-white">
          {loading ? (
             <div className="flex h-full items-center justify-center text-slate-500 font-medium py-12">Memuat data stok...</div>
          ) : currentStocks.length === 0 ? (
             <div className="flex h-full items-center justify-center text-slate-500 font-medium py-12">Data kosong.</div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="text-xs text-slate-400 uppercase font-bold border-b border-slate-100 sticky top-0 bg-white shadow-[0_1px_0_#f1f5f9]">
                    <tr>
                      <th className="pb-3 text-slate-500 pl-1">Nama Barang</th>
                      <th className="pb-3 text-slate-500">Masuk</th>
                      <th className="pb-3 text-slate-500">Keluar</th>
                      <th className="pb-3 text-slate-500">Stok Akhir</th>
                      <th className="pb-3 text-right text-slate-500 pr-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {currentStocks.map(stock => (
                      <tr key={stock.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-semibold text-slate-800 pl-1">{stock.name}</td>
                        <td className="py-4 text-emerald-600 font-bold">+{stock.masuk}</td>
                        <td className="py-4 text-rose-600 font-bold">-{stock.keluar}</td>
                        <td className="py-4 font-medium text-slate-700">{stock.qty} Unit</td>
                        <td className="py-4 text-right pr-1">
                          {stock.qty <= 0 ? (
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">HABIS</span>
                          ) : stock.qty <= 10 ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">KRITIS</span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">AMAN</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD LIST VIEW */}
              <div className="block md:hidden space-y-3">
                {currentStocks.map(stock => (
                  <div key={stock.name} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 flex flex-col gap-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-slate-800 text-sm leading-snug break-words flex-1">{stock.name}</h4>
                      {stock.qty <= 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-lg text-[9px] font-extrabold tracking-wider shrink-0">HABIS</span>
                      ) : stock.qty <= 10 ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-extrabold tracking-wider shrink-0">KRITIS</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-extrabold tracking-wider shrink-0">AMAN</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2.5">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Masuk</p>
                          <p className="text-emerald-600 font-bold mt-0.5">+{stock.masuk}</p>
                        </div>
                        <div className="border-l border-slate-200"></div>
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Keluar</p>
                          <p className="text-rose-600 font-bold mt-0.5">-{stock.keluar}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stok Akhir</p>
                        <p className="text-sm font-extrabold text-slate-800 mt-0.5">{stock.qty} Unit</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Side Widgets */}
      <div className="md:col-span-4 flex flex-col gap-4">
        {/* Low Stock Alerts */}
        <div className="bg-indigo-900 text-white rounded-3xl p-6 shadow-lg">
          <h2 className="font-bold text-lg mb-4">Alert Stok Rendah</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-800 rounded-lg flex items-center justify-center font-bold">{kritisCount}</div>
              <div>
                <p className="text-sm font-semibold">Barang Perlu Restock</p>
                <p className="text-xs text-indigo-300">Stok kritis atau habis</p>
              </div>
            </div>
            <div className="h-[1px] bg-indigo-800"></div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-bold">{totalQty}</p>
                <p className="text-[10px] uppercase text-indigo-400 font-bold">Total Unit Tersedia</p>
              </div>
              <div className="flex gap-1 h-8 items-end">
                <div className="w-1 h-3 bg-indigo-500 rounded-t-sm"></div>
                <div className="w-1 h-5 bg-indigo-500 rounded-t-sm"></div>
                <div className="w-1 h-8 bg-indigo-300 rounded-t-sm"></div>
                <div className="w-1 h-4 bg-indigo-500 rounded-t-sm"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h2 className="font-bold text-lg">Riwayat Transaksi</h2>
          </div>
          
          {/* Dynamic Search Box */}
          {!loading && transactions.length > 0 && (
            <div className="relative mb-3 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Cari item, tipe, catatan..." 
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 text-slate-700"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2">
            {loading ? (
              <p className="text-sm text-slate-500 font-medium py-4 text-center">Memuat...</p>
            ) : filteredTransactions.length === 0 ? (
               <p className="text-sm text-slate-500 font-medium py-4 text-center">
                 {searchHistory ? 'Tidak ada hasil pencarian.' : 'Belum ada riwayat.'}
               </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {filteredTransactions.map(tx => (
                  <li key={tx.id} className="flex justify-between items-center group/item hover:bg-slate-50 p-2.5 -mx-2.5 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-800 truncate">{tx.itemName}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {new Date(tx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                        </span>
                        {tx.notes && (
                          <>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500 truncate font-medium max-w-[120px]" title={tx.notes}>
                              {tx.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      <span className={`text-sm font-bold ${tx.type === 'Masuk' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'Masuk' ? '+' : '-'}{tx.quantity}
                      </span>
                      
                      {/* Action buttons - on mobile always visible, on desktop shown on hover */}
                      <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover/item:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingTx(tx)}
                          title="Ubah Transaksi"
                          className="p-1 px-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeletingTx(tx)}
                          title="Hapus Transaksi"
                          className="p-1 px-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setEditingTx(null); setActionError(null); }}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-bold text-xl text-slate-800 mb-1">Edit Transaksi</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Ubah data transaksi log pada Google Sheets.</p>
            
            {actionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
                {actionError}
              </div>
            )}
            
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal</label>
                <input 
                  type="date" 
                  required
                  value={editingTx.date ? editingTx.date.split('T')[0] : ''}
                  onChange={(e) => setEditingTx({ ...editingTx, date: new Date(e.target.value).toISOString() })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-semibold text-slate-700 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Barang</label>
                <input 
                  type="text" 
                  required
                  value={editingTx.itemName}
                  onChange={(e) => setEditingTx({ ...editingTx, itemName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-semibold text-slate-700 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipe</label>
                  <select 
                    value={editingTx.type}
                    onChange={(e) => setEditingTx({ ...editingTx, type: e.target.value as 'Masuk' | 'Keluar' })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-semibold text-slate-700 text-sm"
                  >
                    <option value="Masuk">Masuk</option>
                    <option value="Keluar">Keluar</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kuantitas</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={editingTx.quantity}
                    onChange={(e) => setEditingTx({ ...editingTx, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-semibold text-slate-700 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Catatan</label>
                <textarea 
                  value={editingTx.notes || ''}
                  onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-semibold text-slate-700 text-sm resize-none"
                  placeholder="Contoh: Dari Supplier A"
                />
              </div>
              
              <div className="flex gap-3 mt-4">
                <button 
                  type="button"
                  disabled={actionLoading}
                  onClick={() => { setEditingTx(null); setActionError(null); }}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-100 disabled:bg-indigo-300"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setDeletingTx(null); setActionError(null); }}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="font-bold text-lg text-slate-800 mb-2">Hapus Transaksi?</h3>
            <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed">
              Apakah Anda yakin ingin menghapus transaksi <strong className="text-slate-700">"{deletingTx.itemName}"</strong> ({deletingTx.type} {deletingTx.quantity} unit)? Tindakan ini tidak dapat dibatalkan.
            </p>
            
            {actionError && (
              <div className="w-full mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
                {actionError}
              </div>
            )}
            
            <div className="flex gap-3 w-full mt-2">
              <button 
                type="button"
                disabled={actionLoading}
                onClick={() => { setDeletingTx(null); setActionError(null); }}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-rose-100 disabled:bg-rose-300"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {actionLoading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
