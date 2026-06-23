import React, { useState, useMemo } from 'react';
import { Transaction, deleteTransactionRow, updateTransactionRow, getSheetId } from '../lib/sheets';
import { RefreshCw, Edit2, Trash2, Search, X, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import TransactionHistory from './TransactionHistory';

interface Props {
  transactions: Transaction[];
  loading: boolean;
  onRefresh: () => void;
  token: string;
  spreadsheetId: string;
}

export default function StockList({ transactions, loading, onRefresh, token, spreadsheetId }: Props) {
  const [searchHistory, setSearchHistory] = useState('');
  const [filterType, setFilterType] = useState<'Semua' | 'Masuk' | 'Keluar'>('Semua');
  const [searchStock, setSearchStock] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(10);
  const [currentPage, setCurrentPage] = useState(1);

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

  const filteredStocks = useMemo(() => {
    if (!searchStock) return currentStocks;
    const query = searchStock.toLowerCase();
    return currentStocks.filter(stock => stock.name.toLowerCase().includes(query));
  }, [currentStocks, searchStock]);

  const displayedStocks = useMemo(() => {
    if (rowsPerPage === 'all') return filteredStocks;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredStocks.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredStocks, rowsPerPage, currentPage]);

  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filteredStocks.length / (rowsPerPage as number));

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
        'Tanggal Transaksi': tx.date && new Date(tx.date).toString() !== 'Invalid Date' ? new Date(tx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-',
        'Jam': tx.date && new Date(tx.date).toString() !== 'Invalid Date' ? new Date(tx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-',
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

        {/* Dynamic Stock Search Box & Row Restrictor */}
        {!loading && currentStocks.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input 
                type="text" 
                placeholder="Cari nama barang..." 
                value={searchStock}
                onChange={(e) => {
                  setSearchStock(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-sm font-semibold pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 text-slate-700"
              />
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-bold text-slate-500 uppercase">Tampil:</label>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  const val = e.target.value;
                  setRowsPerPage(val === 'all' ? 'all' : parseInt(val, 10));
                  setCurrentPage(1);
                }}
                className="px-3 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none cursor-pointer"
              >
                <option value={10}>10 Baris</option>
                <option value={20}>20 Baris</option>
                <option value={50}>50 Baris</option>
                <option value="all">Semua</option>
              </select>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-x-auto min-h-0 bg-white">
          {loading ? (
             <div className="flex h-full items-center justify-center text-slate-500 font-medium py-12">Memuat data stok...</div>
          ) : currentStocks.length === 0 ? (
             <div className="flex h-full items-center justify-center text-slate-500 font-medium py-12">Data kosong.</div>
          ) : filteredStocks.length === 0 ? (
             <div className="flex h-full items-center justify-center text-slate-500 font-medium py-12">Pencarian tidak ditemukan.</div>
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
                    {displayedStocks.map(stock => (
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
                {displayedStocks.map(stock => (
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
        
        {/* Pagination Controls */}
        {!loading && filteredStocks.length > 0 && rowsPerPage !== 'all' && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 shrink-0">
            <p className="text-xs font-medium text-slate-500 hidden sm:block">
              Menampilkan {((currentPage - 1) * (rowsPerPage as number)) + 1} - {Math.min(currentPage * (rowsPerPage as number), filteredStocks.length)} dari {filteredStocks.length} barang
            </p>
            <div className="flex items-center gap-1.5 sm:ml-auto w-full sm:w-auto justify-between sm:justify-start">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Sebelumnya
              </button>
              <div className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                Hal {currentPage} / {totalPages}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
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

        {/* Transaction History Section */}
        <div className="flex-1 min-h-0 flex flex-col">
          <TransactionHistory 
            transactions={transactions}
            loading={loading}
            onRefresh={onRefresh}
            token={token}
            spreadsheetId={spreadsheetId}
          />
        </div>
      </div>

    </div>
  );
}
