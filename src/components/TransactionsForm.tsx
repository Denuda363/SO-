import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { appendTransaction, appendTransactions, Transaction } from '../lib/sheets';
import { ShoppingCart, Trash2, Plus, Loader2, Trash } from 'lucide-react';

interface Props {
  token: string;
  spreadsheetId: string;
  transactions: Transaction[];
  onSuccess: () => void;
}

export default function TransactionsForm({ token, spreadsheetId, transactions, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCartSaving, setIsCartSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<Transaction[]>([]);

  const [formData, setFormData] = useState({
    itemName: '',
    type: 'Masuk' as 'Masuk' | 'Keluar',
    quantity: '',
    notes: '',
    date: new Date().toISOString().split('T')[0] // Default today's date
  });

  const uniqueItems = useMemo(() => {
    const items = new Set<string>();
    transactions.forEach(t => items.add(t.itemName));
    return Array.from(items).sort();
  }, [transactions]);

  const filteredItems = useMemo(() => {
    if (!formData.itemName) return uniqueItems;
    return uniqueItems.filter(item => item.toLowerCase().includes(formData.itemName.toLowerCase()));
  }, [uniqueItems, formData.itemName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Tanggal: '2023-10-25', 'Nama Barang': 'Kertas HVS A4', 'Tipe (Masuk/Keluar)': 'Masuk', Kuantitas: 50, Catatan: 'Dari supplier A' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Barang.xlsx");
  };

  const downloadProductTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Nama Barang': 'Meja Kantor Kent', 'Stok Awal': 25, 'Catatan': 'Gudang Utama' },
      { 'Nama Barang': 'Kursi Ergonomis', 'Stok Awal': 10, 'Catatan': 'Lantai 2' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Produk.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (e.target.value) e.target.value = '';

    setIsImporting(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      const rows = XLSX.utils.sheet_to_json(worksheet);
      const txsToImport: Transaction[] = [];

      if (!rows || rows.length === 0) {
        throw new Error("File Excel kosong atau tidak terbaca.");
      }

      const firstRow = rows[0] as any;
      // If the excel sheet has 'Stok Awal' and doesn't have 'Tipe (Masuk/Keluar)', it is a product template
      const isProductTemplate = firstRow['Nama Barang'] !== undefined && 
                                (firstRow['Stok Awal'] !== undefined || firstRow['Stok Sedia'] !== undefined) &&
                                firstRow['Tipe (Masuk/Keluar)'] === undefined;
      
      for (const row of rows as any[]) {
        if (isProductTemplate) {
          const itemName = row['Nama Barang'];
          const stokAwal = row['Stok Awal'] ?? row['Stok Sedia'] ?? 0;
          const notes = row['Catatan'] || 'Stok Awal Produk';

          if (itemName) {
            const qty = parseInt(String(stokAwal), 10);
            const t: Transaction = {
              id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
              date: new Date().toISOString(),
              itemName: String(itemName).trim(),
              type: 'Masuk',
              quantity: isNaN(qty) ? 0 : qty,
              notes: String(notes).trim()
            };
            txsToImport.push(t);
          }
        } else {
          // Transaction Template 
          const dateStr = row['Tanggal'];
          const itemName = row['Nama Barang'];
          const typeStr = row['Tipe (Masuk/Keluar)'];
          const quantity = row['Kuantitas'];
          const notes = row['Catatan'] || '';

          if (itemName && typeStr && quantity) {
            const t: Transaction = {
              id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
              date: new Date(dateStr).toString() !== 'Invalid Date' ? new Date(dateStr).toISOString() : new Date().toISOString(),
              itemName: String(itemName).trim(),
              type: String(typeStr).trim().toLowerCase() === 'keluar' ? 'Keluar' : 'Masuk',
              quantity: parseInt(String(quantity), 10) || 1,
              notes: String(notes).trim()
            };
            txsToImport.push(t);
          }
        }
      }
      
      if (txsToImport.length > 0) {
        await appendTransactions(token, spreadsheetId, txsToImport);
        onSuccess();
      } else {
        setError("Tidak ada data produk/transaksi valid yang ditemukan dalam Excel");
      }
    } catch (err: any) {
      setError("Gagal impor Excel: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.quantity || parseInt(formData.quantity, 10) <= 0) {
      setError("Mohon isi nama barang dan kuantitas dengan benar (> 0) sebelum menambahkan ke keranjang");
      return;
    }
    setError(null);

    const newItem: Transaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      date: new Date(formData.date).toISOString(),
      itemName: formData.itemName.trim(),
      type: formData.type,
      quantity: parseInt(formData.quantity, 10),
      notes: formData.notes.trim()
    };

    setCart(prev => [newItem, ...prev]);
    setFormData(prev => ({
      ...prev,
      itemName: '',
      quantity: '',
      notes: ''
    }));
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleSaveCart = async () => {
    if (cart.length === 0) return;
    setIsCartSaving(true);
    setError(null);
    try {
      await appendTransactions(token, spreadsheetId, cart);
      setCart([]);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan item dari keranjang');
    } finally {
      setIsCartSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.quantity || parseInt(formData.quantity) <= 0) {
      setError("Mohon isi nama barang dan kuantitas dengan benar (> 0)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const tx: Transaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      date: new Date(formData.date).toISOString(), // full ISO
      itemName: formData.itemName.trim(),
      type: formData.type,
      quantity: parseInt(formData.quantity, 10),
      notes: formData.notes.trim()
    };

    try {
      await appendTransaction(token, spreadsheetId, tx);
      setFormData({
        itemName: '',
        type: 'Masuk',
        quantity: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      <div className="md:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 tracking-tight">Formulir Barang</h2>

        {error && (
          <div className="mb-6 bg-rose-50 text-rose-700 p-4 rounded-xl flex items-start gap-3 text-sm font-semibold border border-rose-100">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider text-[11px] opacity-80">Jenis Transaksi</label>
              <div className="flex gap-4 flex-col sm:flex-row">
                <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.type === 'Masuk' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="type" 
                    value="Masuk" 
                    checked={formData.type === 'Masuk'} 
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="hidden" 
                  />
                  <div className="font-bold text-lg">Barang Masuk</div>
                </label>
                
                <label className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.type === 'Keluar' ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <input 
                    type="radio" 
                    name="type" 
                    value="Keluar" 
                    checked={formData.type === 'Keluar'} 
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="hidden" 
                  />
                  <div className="font-bold text-lg">Barang Keluar</div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px] opacity-80">Tanggal Transaksi</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-medium"
              />
            </div>

            <div>
               <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px] opacity-80">Kuantitas</label>
              <input 
                type="number" 
                required
                min="1"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-bold"
              />
            </div>

            <div className="md:col-span-2 relative" ref={dropdownRef}>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px] opacity-80">Nama Barang</label>
              <input 
                type="text" 
                required
                placeholder="Ketik untuk mencari atau ketik barang baru..."
                value={formData.itemName}
                onChange={(e) => {
                  setFormData({...formData, itemName: e.target.value});
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow bg-slate-50 font-semibold"
              />
              {showDropdown && filteredItems.length > 0 && (
                <ul className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden">
                  {filteredItems.map(item => (
                    <li 
                      key={item} 
                      className="px-4 py-3 cursor-pointer hover:bg-slate-50 font-medium text-slate-700 border-b border-slate-50 last:border-b-0"
                      onClick={() => {
                        setFormData({...formData, itemName: item});
                        setShowDropdown(false);
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px] opacity-80">Catatan Keterangan (Opsional)</label>
              <textarea 
                rows={3}
                placeholder="Contoh: Restock dari supplier PT ABCD"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-shadow resize-none bg-slate-50 font-medium"
              ></textarea>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              type="button"
              disabled={isSubmitting || isCartSaving}
              onClick={handleAddToCart}
              className="flex-1 py-4 px-6 rounded-2xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Tambah ke Keranjang
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || isCartSaving}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold text-white transition-all shadow-lg ${isSubmitting ? 'bg-slate-400 cursor-not-allowed shadow-none' : formData.type === 'Masuk' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-700/20'}`}
            >
              {isSubmitting ? 'Menyimpan...' : `Simpan Langsung`}
            </button>
          </div>
        </form>
      </div>

      <div className="md:col-span-4 flex flex-col gap-4">
        {/* Dynamic Interactive Transaction Cart */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-4 shrink-0 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">Keranjang ({cart.length})</h3>
            </div>
            {cart.length > 0 && (
              <button 
                type="button" 
                onClick={handleClearCart} 
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Kosongkan
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 mb-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 px-2">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-700">Keranjang Masih Kosong</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Isi form di kiri lalu klik <strong>"Tambah ke Keranjang"</strong> untuk mengumpulkan barang belanjaan.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {cart.map(item => (
                  <li key={item.id} className="flex justify-between items-center group/cart p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-all">
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="font-bold text-xs text-slate-800 truncate" title={item.itemName}>
                        {item.itemName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${item.type === 'Masuk' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                          {item.type}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">
                          {new Date(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                        </span>
                        {item.notes && (
                          <span className="text-[9px] text-slate-500 truncate max-w-[80px]" title={item.notes}>
                            • {item.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-700">
                        x{item.quantity}
                      </span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus dari Keranjang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cart.length > 0 && (
            <div className="shrink-0 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isCartSaving}
                onClick={handleSaveCart}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isCartSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isCartSaving ? 'Menyimpan...' : `Simpan Semua ke Sheets (${cart.length} Item)`}
              </button>
              <p className="text-[9px] text-center text-slate-400 mt-2 font-medium">Semua item akan ditulis ke Google Sheets secara bersamaan.</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between shrink-0">
          <div>
            <p className="text-xs font-bold uppercase opacity-80 mb-1 text-slate-500">Impor Massal</p>
            <h3 className="text-xl font-bold leading-tight text-slate-800">Unggah Excel</h3>
            <p className="text-sm mt-3 text-slate-500 leading-relaxed font-medium mb-4">Tambahkan banyak produk (stok awal) atau riwayat transaksi sekaligus menggunakan template Excel.</p>
          </div>
          <div className="flex flex-col gap-3">
             <div className="flex flex-col gap-2">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unduh Template:</span>
               <button onClick={downloadProductTemplate} type="button" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2.5 rounded-xl text-center hover:bg-indigo-100 transition-colors">
                 1. Template Produk (Stok Awal)
               </button>
               <button onClick={downloadTemplate} type="button" className="text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl text-center hover:bg-slate-100 transition-colors">
                 2. Template Log Transaksi
               </button>
             </div>
             
             <div className="border-t border-dashed border-slate-200 my-2"></div>
             
             <label className="text-sm font-bold text-white bg-slate-800 px-4 py-3 rounded-xl text-center hover:bg-slate-700 transition-colors cursor-pointer relative overflow-hidden block">
                {isImporting ? 'Mengimpor Data...' : 'Pilih & Impor File Excel'}
                <input type="file" accept=".xlsx" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImportExcel} disabled={isImporting} />
             </label>
             <p className="text-[10px] text-center font-semibold text-slate-400">Format file akan dideteksi secara otomatis.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
