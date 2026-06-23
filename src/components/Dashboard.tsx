import React, { useState, useEffect } from 'react';
import { PackageSearch, FileText, History, LogOut } from 'lucide-react';
import { getTransactions, Transaction } from '../lib/sheets';
import TransactionsForm from './TransactionsForm';
import StockList from './StockList';
import MonthlyReport from './MonthlyReport';

interface DashboardProps {
  token: string;
  spreadsheetId: string;
  user: any | null;
  onLogout: () => void;
}

type Tab = 'stock' | 'input' | 'report';

export default function Dashboard({ token, spreadsheetId, user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stock');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTransactions(token, spreadsheetId);
      // Sort by date descending
      data.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      setTransactions(data);
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, spreadsheetId]);

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-slate-900 md:border-8 md:border-slate-200">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
            <PackageSearch className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-base tracking-tight uppercase text-indigo-900">StokPintar</span>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 active:bg-rose-100 rounded-xl text-xs font-bold transition-all"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar
        </button>
      </header>

      {/* Sidebar Nav (Desktop) */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 hidden md:flex flex-col gap-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            <PackageSearch className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">StokPintar</span>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <button
            onClick={() => setActiveTab('stock')}
            className={`p-3 rounded-lg flex items-center gap-3 text-left transition-colors ${
              activeTab === 'stock' ? 'bg-slate-100 font-medium text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
             {activeTab === 'stock' ? <div className="w-2 h-2 rounded-full bg-indigo-600"></div> : <History className="w-5 h-5" />}
             Stok & Riwayat
          </button>
          
          <button
            onClick={() => setActiveTab('input')}
            className={`p-3 rounded-lg flex items-center gap-3 text-left transition-colors ${
              activeTab === 'input' ? 'bg-slate-100 font-medium text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
             {activeTab === 'input' ? <div className="w-2 h-2 rounded-full bg-indigo-600"></div> : <PackageSearch className="w-5 h-5" />}
             Input Barang
          </button>
          
          <button
            onClick={() => setActiveTab('report')}
            className={`p-3 rounded-lg flex items-center gap-3 text-left transition-colors ${
              activeTab === 'report' ? 'bg-slate-100 font-medium text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
             {activeTab === 'report' ? <div className="w-2 h-2 rounded-full bg-indigo-600"></div> : <FileText className="w-5 h-5" />}
             Laporan Bulanan
          </button>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
               A
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-indigo-400 font-bold uppercase mb-0.5">Admin Aktif</p>
              <p className="text-sm font-semibold text-slate-800 truncate">Administrator</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-2.5 bg-rose-50 hover:bg-rose-100/80 active:scale-95 text-rose-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-rose-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Aplikasi
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto flex flex-col">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 md:mb-8 shrink-0 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {activeTab === 'stock' && "Dashboard Inventaris"}
              {activeTab === 'input' && "Manajemen Transaksi"}
              {activeTab === 'report' && "Laporan Analitik"}
            </h1>
            <p className="text-slate-500 mt-1">
              {activeTab === 'stock' && "Pantau pergerakan barang secara real-time."}
              {activeTab === 'input' && "Catat penambahan atau pengurangan stok."}
              {activeTab === 'report' && "Analisis performa stok bulanan Anda."}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => loadData()} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
              Refresh Data
            </button>
            <button onClick={() => setActiveTab('input')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
              + Tambah SKU
            </button>
          </div>
        </header>

        {/* Dynamic Inner Content */}
        <div className="flex-1 min-h-0">
          {activeTab === 'stock' && (
            <StockList 
              transactions={transactions} 
              loading={loading} 
              onRefresh={loadData} 
              token={token}
              spreadsheetId={spreadsheetId}
            />
          )}
          {activeTab === 'input' && (
            <TransactionsForm 
              token={token} 
              spreadsheetId={spreadsheetId} 
              transactions={transactions}
              onSuccess={() => {
                loadData();
                setActiveTab('stock');
              }} 
            />
          )}
          {activeTab === 'report' && (
            <MonthlyReport transactions={transactions} loading={loading} />
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around p-2 pb-safe z-50">
        <button onClick={() => setActiveTab('stock')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'stock' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">Stok</span>
        </button>
        <button onClick={() => setActiveTab('input')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'input' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
          <PackageSearch className="w-5 h-5" />
          <span className="text-[10px] font-bold">Input</span>
        </button>
        <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'report' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold">Laporan</span>
        </button>
      </nav>
    </div>
  );
}
