/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { findOrCreateSpreadsheet } from './lib/sheets';
import Dashboard from './components/Dashboard';

export default function App() {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    findOrCreateSpreadsheet('local_token')
      .then(id => {
        setSpreadsheetId(id);
        setIsInitializing(false);
      })
      .catch(err => {
        console.error("Failed to initialize local spreadsheet", err);
        setIsInitializing(false);
      });
  }, []);

  if (isInitializing || !spreadsheetId) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[5px] border-indigo-600 border-t-transparent rounded-full animate-spin mb-6 shadow-sm"></div>
        <p className="text-slate-600 font-bold tracking-tight">Menyiapkan database (Firebase Firestore)...</p>
      </div>
    );
  }

  return <Dashboard token="local_token" spreadsheetId={spreadsheetId} user={null} onLogout={() => {}} />;
}
