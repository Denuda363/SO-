import React, { useState, useMemo } from 'react';
import { Transaction, deleteTransactionRow, updateTransactionRow, getSheetId } from '../lib/sheets';
import { Edit2, Trash2, Search, X, Loader2 } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  loading: boolean;
  onRefresh: () => void;
  token: string;
  spreadsheetId: string;
}

export default function TransactionHistory({ transactions = [], loading, onRefresh, token, spreadsheetId }: Props) {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [searchHistory, setSearchHistory] = useState('');
  const [filterType, setFilterType] = useState<'Semua' | 'Masuk' | 'Keluar'>('Semua');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (filterType !== 'Semua') {
      result = result.filter(tx => tx.type === filterType);
    }

    if (filterStartDate) {
      const start = new Date(filterStartDate);
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      result = result.filter(tx => {
        if (!tx.date) return false;
        const txDate = new Date(tx.date).getTime();
        return txDate >= startMs;
      });
    }

    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      const endMs = end.getTime();
      result = result.filter(tx => {
        if (!tx.date) return false;
        const txDate = new Date(tx.date).getTime();
        return txDate <= endMs;
      });
    }

    if (searchHistory) {
      const query = searchHistory.toLowerCase();
      result = result.filter(tx => {
        const lowerName = String(tx.itemName || '').toLowerCase();
        const lowerNotes = String(tx.notes || '').toLowerCase();
        const lowerType = String(tx.type || '').toLowerCase();
        const strQty = String(tx.quantity || '');
        return lowerName.includes(query) || lowerNotes.includes(query) || lowerType.includes(query) || strQty.includes(query);
      });
    }
    return [...result].reverse();
  }, [transactions, searchHistory, filterType, filterStartDate, filterEndDate]);

  const groupedTransactions = useMemo(() => {
    const result: { date: string; transactions: Transaction[] }[] = [];
    filteredTransactions.forEach(tx => {
      const dateStr = tx.date && new Date(tx.date).toString() !== 'Invalid Date' 
        ? new Date(tx.date).toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})
        : 'Tanggal Tidak Diketahui';
      
      let group = result.find(g => g.date === dateStr);
      if (!group) {
        group = { date: dateStr, transactions: [] };
        result.push(group);
      }
      group.transactions.push(tx);
    });
    return result;
  }, [filteredTransactions]);

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

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex-1 flex flex-col min-h-[400px]">
        <div className="flex justify-between items-center mb-4 shrink-0 border-b border-slate-100 pb-3">
          <h2 className="font-bold text-lg text-slate-800">Riwayat Transaksi Terakhir</h2>
        </div>
        
        {/* Dynamic Search Box and Filter */}
        {!loading && transactions.length > 0 && (
          <div className="flex flex-col gap-3 mb-4 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Cari nama barang, catatan, atau kuantitas..." 
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 text-slate-700"
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex flex-col col-span-2 md:col-span-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <label className="text-[9px] font-bold text-slate-500 uppercase px-2 pt-1 pb-0 bg-slate-50">Dari Tanggal</label>
                <input 
                  type="date" 
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 focus:outline-none focus:bg-indigo-50/50 bg-transparent text-slate-700"
                />
              </div>
              <div className="flex flex-col col-span-2 md:col-span-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <label className="text-[9px] font-bold text-slate-500 uppercase px-2 pt-1 pb-0 bg-slate-50">Sampai Tanggal</label>
                <input 
                  type="date" 
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 focus:outline-none focus:bg-indigo-50/50 bg-transparent text-slate-700"
                />
              </div>
              
              <div className="flex gap-1 col-span-2 md:col-span-2 h-full">
                {(['Semua', 'Masuk', 'Keluar'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                      filterType === type 
                        ? type === 'Masuk' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' 
                          : type === 'Keluar' ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <p className="text-sm text-slate-500 font-medium py-8 text-center">Memuat riwayat transaksi...</p>
          ) : filteredTransactions.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                {searchHistory ? 'Tidak ada hasil pencarian.' : 'Belum ada riwayat transaksi.'}
              </p>
          ) : (
            <div className="flex flex-col gap-6">
              {groupedTransactions.map(group => (
                <div key={group.date} className="flex flex-col gap-3">
                  <h3 className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-2 text-sm font-bold text-slate-500 border-b border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                    {group.date}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {group.transactions.map(tx => (
                      <li key={tx.id} className="flex justify-between items-center group/item hover:bg-slate-50 p-3 rounded-2xl transition-all border border-slate-100 hover:border-slate-200 bg-white shadow-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-slate-800 truncate">{tx.itemName}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {tx.notes && (
                              <>
                                <span className="text-[11px] text-slate-500 truncate font-medium max-w-[250px]" title={tx.notes}>
                                  {tx.notes}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className={`text-base px-2 py-1 rounded-lg font-bold bg-opacity-10 ${tx.type === 'Masuk' ? 'text-emerald-700 bg-emerald-500' : 'text-rose-700 bg-rose-500'}`}>
                            {tx.type === 'Masuk' ? '+' : '-'}{tx.quantity}
                          </span>
                          
                          {/* Action buttons - on mobile always visible, on desktop shown on hover */}
                          <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover/item:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingTx(tx)}
                              title="Ubah Transaksi"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeletingTx(tx)}
                              title="Hapus Transaksi"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
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
                  value={editingTx.date && new Date(editingTx.date).toString() !== 'Invalid Date' ? editingTx.date.split('T')[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const isoDate = val && new Date(val).toString() !== 'Invalid Date' ? new Date(val).toISOString() : editingTx.date;
                    setEditingTx({ ...editingTx, date: isoDate });
                  }}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
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
    </>
  );
}
