import React, { useMemo, useState } from 'react';
import { Transaction } from '../lib/sheets';
import { format, parseISO, isSameMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  transactions: Transaction[];
  loading: boolean;
}

export default function MonthlyReport({ transactions, loading }: Props) {
  // Extract unique months from transactions for the selector
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(tx => {
      if (tx.date) {
        // use YYYY-MM format for set
        const dateObj = parseISO(tx.date);
        if (!isNaN(dateObj.getTime())) {
          months.add(format(dateObj, 'yyyy-MM'));
        }
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(
    availableMonths.length > 0 ? availableMonths[0] : format(new Date(), 'yyyy-MM')
  );

  const selectedMonthDate = parseISO(`${selectedMonthStr}-01`);

  const reportData = useMemo(() => {
    if (!selectedMonthStr) return [];

    const monthTransactions = transactions.filter(tx => {
      try {
        return isSameMonth(parseISO(tx.date), selectedMonthDate);
      } catch (e) { return false; }
    });

    const itemMap = new Map<string, { masuk: number; keluar: number }>();

    monthTransactions.forEach(tx => {
      const current = itemMap.get(tx.itemName) || { masuk: 0, keluar: 0 };
      if (tx.type === 'Masuk') {
        current.masuk += tx.quantity;
      } else {
        current.keluar += tx.quantity;
      }
      itemMap.set(tx.itemName, current);
    });

    return Array.from(itemMap.entries()).map(([name, data]) => ({
      name,
      Masuk: data.masuk,
      Keluar: data.keluar
    }));
  }, [transactions, selectedMonthStr, selectedMonthDate]);

  const handleExportMonthlyReport = () => {
    try {
      const monthTransactions = transactions.filter(tx => {
        try {
          return isSameMonth(parseISO(tx.date), selectedMonthDate);
        } catch (e) { return false; }
      });

      // 1. Sheet for Summary
      const summaryData = reportData.map(row => ({
        'Nama Barang': row.name,
        'Total Masuk': row.Masuk,
        'Total Keluar': row.Keluar,
        'Mutasi Bersih': row.Masuk - row.Keluar
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [
        { wch: 30 }, // Nama Barang
        { wch: 15 }, // Total Masuk
        { wch: 15 }, // Total Keluar
        { wch: 15 }  // Mutasi Bersih
      ];

      // 2. Sheet for Detailed Transactions in this specific month
      const detailedTxs = monthTransactions.map(tx => ({
        'Tanggal': new Date(tx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}),
        'Jam': new Date(tx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}),
        'Nama Barang': tx.itemName,
        'Tipe': tx.type,
        'Kuantitas': tx.quantity,
        'Catatan': tx.notes || '-'
      }));
      const wsDetails = XLSX.utils.json_to_sheet(detailedTxs);
      wsDetails['!cols'] = [
        { wch: 20 }, // Tanggal
        { wch: 10 }, // Jam
        { wch: 30 }, // Nama Barang
        { wch: 15 }, // Tipe
        { wch: 12 }, // Kuantitas
        { wch: 35 }  // Catatan
      ];

      const wb = XLSX.utils.book_new();
      const monthName = format(selectedMonthDate, 'MMMM_yyyy', { locale: localeId });
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Bulanan');
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Transaksi Detail');

      XLSX.writeFile(wb, `Laporan_Bulanan_${monthName}.xlsx`);
    } catch (e) {
      console.error('Failed to export monthly report to Excel:', e);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Memuat laporan...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
      <div className="md:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[450px]">
        <div className="flex justify-between items-center mb-6 shrink-0 flex-wrap gap-2">
          <h2 className="font-bold text-lg">Laporan Bulanan</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMonthlyReport}
              disabled={reportData.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/10 active:scale-95 duration-150"
              title="Ekspor Laporan Bulanan ke Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor Laporan
            </button>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-full uppercase tracking-widest">{format(selectedMonthDate, 'MMMM', { locale: localeId })}</span>
          </div>
        </div>

        <div className="flex-1 w-full relative min-h-0">
          {reportData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              Tidak ada data transaksi.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="Masuk" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="md:col-span-4 flex flex-col gap-4">
        {/* Controls Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm shrink-0">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pilih Periode</label>
          <select 
            value={selectedMonthStr}
            onChange={e => setSelectedMonthStr(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold text-slate-800"
          >
            {availableMonths.length === 0 && <option value={selectedMonthStr}>{format(selectedMonthDate, 'MMMM yyyy', { locale: localeId })}</option>}
            {availableMonths.map(m => {
              const d = parseISO(`${m}-01`);
              return (
                <option key={m} value={m}>
                  {format(d, 'MMMM yyyy', { locale: localeId })}
                </option>
              );
            })}
          </select>
        </div>

        {/* Detailed Table Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex-1 flex flex-col min-h-[300px] overflow-hidden">
          <h3 className="font-bold text-sm mb-4 shrink-0">Rincian Pergerakan</h3>
          <div className="flex-1 overflow-x-auto overflow-y-auto pr-2 pb-2">
            <table className="w-full text-left min-w-[250px]">
              <thead className="text-[10px] text-slate-400 uppercase font-bold sticky top-0 bg-white shadow-[0_1px_0_#f8fafc]">
                <tr>
                  <th className="pb-2">Barang</th>
                  <th className="pb-2 text-right">M</th>
                  <th className="pb-2 text-right">K</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {reportData.map(row => (
                  <tr key={row.name} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-800">{row.name}</td>
                    <td className="py-3 text-right text-emerald-600 font-bold">+{row.Masuk}</td>
                    <td className="py-3 text-right text-rose-600 font-bold">-{row.Keluar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
