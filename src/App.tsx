/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { findOrCreateSpreadsheet } from './lib/sheets';
import Dashboard from './components/Dashboard';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setToken(token);
        setUser(user);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!needsAuth && token && !spreadsheetId) {
      setIsInitializing(true);
      findOrCreateSpreadsheet(token)
        .then(id => {
          setSpreadsheetId(id);
          setIsInitializing(false);
        })
        .catch(err => {
          console.error("Failed to initialize spreadsheet", err);
          setIsInitializing(false);
          // If token expired or lacking permissions, force re-auth
          setNeedsAuth(true); 
          logout();
        });
    }
  }, [needsAuth, token, spreadsheetId]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      let errorMsg = err.message || String(err);
      if (errorMsg.includes('auth/network-request-failed')) {
        errorMsg = 'Gagal terhubung ke Google Auth (auth/network-request-failed). Ini adalah masalah pemblokiran keamanan iframe di browser Anda.';
      }
      setLoginError(errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logout();
    setNeedsAuth(true);
    setToken(null);
    setUser(null);
    setSpreadsheetId(null);
  };

  if (needsAuth) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-10 text-center">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-600/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">StokPintar</h1>
          <p className="text-slate-500 font-medium mb-8">Masuk untuk mengelola stok, mencatat transaksi, dan melihat laporan.</p>
          
          <button 
            disabled={isLoggingIn}
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 shadow-sm rounded-2xl px-4 py-4 text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            {isLoggingIn ? 'Memproses...' : (
              <>
                <svg viewBox="0 0 48 48" className="w-6 h-6">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {loginError && (
            <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
              <p className="text-xs font-bold text-rose-600 mb-1">Gagal Masuk</p>
              <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                {loginError}
              </p>
              <div className="border-t border-rose-100/50 pt-2.5">
                <p className="text-[11px] font-bold text-slate-700 mb-1">Cara Mengatasi:</p>
                <ol className="text-[11px] text-slate-500 font-medium pl-3.5 list-decimal flex flex-col gap-1 leading-relaxed">
                  <li>
                    <strong className="text-slate-700">Gunakan Tab Baru (Rekomendasi):</strong> Klik tombol <strong className="text-indigo-600">"Open in New Tab"</strong> di kanan atas preview AI Studio Anda agar berjalan bebas dari batasan iframe.
                  </li>
                  <li>
                    Nonaktifkan adblocker/ekstensi privasi (misal Brave Shields) yang memblokir domain auth Firebase.
                  </li>
                  <li>
                    Pastikan peramban Anda mengizinkan cookie pihak ketiga.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isInitializing || !spreadsheetId || !token) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[5px] border-indigo-600 border-t-transparent rounded-full animate-spin mb-6 shadow-sm"></div>
        <p className="text-slate-600 font-bold tracking-tight">Menyiapkan database (Google Sheets)...</p>
      </div>
    );
  }

  return <Dashboard token={token} spreadsheetId={spreadsheetId} user={user} onLogout={handleLogout} />;
}
