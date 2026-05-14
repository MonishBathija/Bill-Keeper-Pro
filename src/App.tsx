import React, { useState, useEffect } from 'react';
import Auth from './components/auth/Auth';
import BillTable from './components/bills/BillTable';
import AddBillModal from './components/bills/AddBillModal';
import ImportExport from './components/bills/ImportExport';
import ImageImport from './components/bills/ImageImport';
import StatCard from './components/layout/StatCard';
import PartyFolders from './components/bills/PartyFolders';
import RecycleBin from './components/bills/RecycleBin';
import SettingsModal from './components/layout/SettingsModal';
import { billService } from './services/billService';
import { Bill, BillStatus, BillFormData, AppSettings } from './types';
import { Wallet, CheckCircle, Clock, LayoutGrid, Folder, Trash2, Search, Filter, X, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { cn } from './lib/utils';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  return (
    <Auth>
      {(user) => user ? <Dashboard user={user} /> : null}
    </Auth>
  );
}

function Dashboard({ user }: { user: User }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [deletedBills, setDeletedBills] = useState<Bill[]>([]);
  const [parties, setParties] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, unpaid: 0 });
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('list');
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await billService.getSettings(user.uid);
      if (settings) {
        setAppSettings(settings);
      }
    };
    loadSettings();
  }, [user.uid]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<BillStatus | 'all'>('all');

  useEffect(() => {
    if (confirmPurge) {
      const timer = setTimeout(() => setConfirmPurge(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmPurge]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'bills', 'connection-test'));
      } catch (error: any) {
        if (error?.code === 'permission-denied') return;
        if(error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable'))) {
          console.warn("Firestore connection check failed: Backend may be temporarily unreachable.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubBills = billService.subscribeToBills(user.uid, setBills);
    const unsubDeletedBills = billService.subscribeToDeletedBills(user.uid, setDeletedBills);
    const unsubParties = billService.subscribeToParties(user.uid, setParties);
    return () => {
      unsubBills();
      unsubDeletedBills();
      unsubParties();
    };
  }, [user.uid]);

  const filteredBills = React.useMemo(() => {
    return bills.filter(bill => {
      // Status Filter
      if (filterStatus !== 'all' && bill.status !== filterStatus) return false;

      // Search Filter
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        bill.billNumber.toLowerCase().includes(searchLower) || 
        bill.partyName?.toLowerCase().includes(searchLower) ||
        bill.amount.toString().includes(search);
      if (!matchesSearch) return false;
      
      // Date Range Filter
      const billDate = bill.date?.toDate?.() || new Date(bill.date);
      const matchesDateRange = (!startDate || billDate >= new Date(startDate)) && 
                             (!endDate || billDate <= new Date(endDate + 'T23:59:59'));
      if (!matchesDateRange) return false;

      return true;
    });
  }, [bills, search, startDate, endDate, filterStatus]);

  useEffect(() => {
    const total = filteredBills.reduce((acc, b) => acc + b.amount, 0);
    const paid = filteredBills.filter(b => b.status === BillStatus.PAID).reduce((acc, b) => acc + b.amount, 0);
    const unpaid = filteredBills.filter(b => b.status === BillStatus.UNPAID).reduce((acc, b) => acc + b.amount, 0);
    setStats({ total, paid, unpaid });
  }, [filteredBills]);

  const handleAddBill = async (data: BillFormData) => {
    await billService.addBill({
      ...data,
      date: new Date(data.date),
    });
    // Automatically save new party names
    if (!parties.includes(data.partyName)) {
      await billService.saveParty(data.partyName);
    }
  };

  const handleImport = async (importedBills: any[]) => {
    for (const b of importedBills) {
      try {
        const billData = {
          ...b,
          date: b.date instanceof Date ? b.date : new Date(b.date)
        };
        await billService.addBill(billData);
        // Automatically save new party names from import
        if (!parties.includes(billData.partyName)) {
          await billService.saveParty(billData.partyName);
        }
      } catch (err: any) {
        console.error(`Failed to import bill ${b.billNumber}:`, err.message);
      }
    }
  };

  const handleImageImport = async (newBills: BillFormData[]) => {
    await handleImport(newBills);
  };

  const handleToggleStatus = async (id: string, status: BillStatus) => {
    await billService.updateBillStatus(id, status);
  };

  const handleUpdateBill = async (id: string, data: BillFormData) => {
    await billService.updateBill(id, {
      ...data,
      date: new Date(data.date),
    });
    if (!parties.includes(data.partyName)) {
      await billService.saveParty(data.partyName);
    }
    setEditingBill(null);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    
    try {
      await billService.deleteBill(id);
      showNotification("Bill moved to recycle bin", "success");
    } catch (err: any) {
      console.error("Dashboard: Delete failed:", err);
      showNotification("Delete failed: " + err.message, "error");
    }
  };

  const handleBatchPartyUpdate = async (ids: string[], partyName: string) => {
    console.log("Batch party update for ids:", ids, "to:", partyName);
    await billService.batchUpdateParty(ids, partyName);
    if (!parties.includes(partyName)) {
      await billService.saveParty(partyName);
    }
  };

  const handleDeleteParty = async (partyName: string) => {
    const partyBills = bills.filter(b => (b.partyName || 'Unknown') === partyName).map(b => b.id);

    try {
      if (partyBills.length > 0) {
        await billService.batchDelete(partyBills);
      }
      await billService.deletePartyByName(user.uid, partyName);
      showNotification(`Party folder "${partyName}" and its bills removed`, "success");
    } catch (err: any) {
      console.error("handleDeleteParty error:", err);
      showNotification("Failed to delete party folder: " + err.message, "error");
    }
  };

  const handlePurgeAll = async () => {
    if (isPurging) return;
    
    try {
      setIsPurging(true);
      await billService.deleteAllBills(user.uid);
      showNotification("All records and system data cleared", "success");
      setConfirmPurge(false);
    } catch (err: any) {
      console.error("Purge error:", err);
      showNotification("Purge failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsPurging(false);
    }
  };

  const handleSaveSettings = async (data: { appTitle: string; companyName: string }) => {
    try {
      await billService.saveSettings(user.uid, data);
      setAppSettings({ ...data, userId: user.uid, updatedAt: new Date() });
      showNotification("Personalization saved!", "success");
    } catch (err: any) {
      showNotification("Failed to save settings", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Shared Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-bold min-w-[300px]",
              notification.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              notification.type === 'error' ? "bg-rose-50 border-rose-200 text-rose-700" :
              "bg-blue-50 border-blue-200 text-blue-700"
            )}
          >
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            {notification.message}
            <button onClick={() => setNotification(null)} className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Reset */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            {appSettings?.appTitle || "BillKeeper Pro"}
          </h1>
          <p className="text-gray-500 font-medium">
            {appSettings?.companyName ? `${appSettings.companyName} Management` : "Professional Bill Management System"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 bg-gray-50 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all"
            title="Settings"
          >
            <SettingsIcon size={20} />
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">System Active</span>
            <span className="text-xs text-gray-400 font-mono text-right">ID: {user.uid.slice(0, 8)}...</span>
          </div>
        </div>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Wallet />} 
          label="Total Amount" 
          value={`$${stats.total.toLocaleString()}`} 
          detail={`${filteredBills.length} bills in range`}
          color="blue"
        />
        <StatCard 
          icon={<CheckCircle />} 
          label="Paid Amount" 
          value={`$${stats.paid.toLocaleString()}`} 
          detail={`${filteredBills.filter(b => b.status === BillStatus.PAID).length} paid`}
          color="emerald"
        />
        <StatCard 
          icon={<Clock />} 
          label="Unpaid Amount" 
          value={`$${stats.unpaid.toLocaleString()}`} 
          detail={`${filteredBills.filter(b => b.status === BillStatus.UNPAID).length} pending`}
          color="amber"
        />
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Search & Filters</h2>
              <p className="text-gray-500 text-sm">Find specific bills across your records.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                await handlePurgeAll();
              }}
              disabled={isPurging}
              className={cn(
                "px-4 py-2 font-bold text-sm rounded-xl transition-all border flex items-center gap-2 shadow-sm active:scale-95",
                isPurging 
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "text-rose-600 bg-white hover:bg-rose-50 border-gray-200 hover:border-rose-200"
              )}
            >
              {isPurging ? <Clock className="animate-spin" size={16} /> : <Trash2 size={16} />}
              {isPurging ? 'Purging...' : 'Reset All'}
            </button>
            <ImageImport onImport={handleImageImport} parties={parties} />
            <ImportExport bills={bills} onImport={handleImport} />
            <AddBillModal onAdd={handleAddBill} parties={parties} bills={bills} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by bill number, party, or amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-gray-100 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 w-full sm:w-auto">
              <Filter size={16} className="text-gray-400" />
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">From</span>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none text-gray-700 font-medium cursor-pointer"
                  />
                </div>
                <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">To</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none text-gray-700 font-medium cursor-pointer"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-2 p-1 hover:bg-gray-200 rounded-lg text-gray-500">
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(['all', BillStatus.PAID, BillStatus.UNPAID] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all",
                    filterStatus === s ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {viewMode === 'list' ? 'Bill Records' : 'Party Folders'}
          </h2>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setViewMode('list');
              }}
              className={`p-1.5 rounded-md transition-all active:scale-90 ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setViewMode('folders');
              }}
              className={`p-1.5 rounded-md transition-all active:scale-90 ${viewMode === 'folders' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Folder size={20} />
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowRecycleBin(true);
              }}
              className="p-1.5 rounded-md transition-all text-gray-500 hover:text-rose-500 hover:bg-rose-50 relative active:scale-90"
            >
              <Trash2 size={20} />
              {deletedBills.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
                  {deletedBills.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
        <BillTable 
          bills={filteredBills} 
          onToggleStatus={handleToggleStatus}
          onEdit={(bill) => setEditingBill(bill)}
          onDelete={handleDelete}
          onBatchDelete={(ids) => billService.batchDelete(ids)}
          onBatchStatusUpdate={(ids, status) => billService.batchUpdateStatus(ids, status)}
          onBatchPartyUpdate={handleBatchPartyUpdate}
          parties={parties}
        />
      ) : (
        <PartyFolders 
          bills={filteredBills}
          parties={parties}
          onToggleStatus={handleToggleStatus}
          onEdit={(bill) => setEditingBill(bill)}
          onDelete={handleDelete}
          onBatchDelete={(ids) => billService.batchDelete(ids)}
          onBatchStatusUpdate={(ids, status) => billService.batchUpdateStatus(ids, status)}
          onBatchPartyUpdate={handleBatchPartyUpdate}
          onDeleteParty={handleDeleteParty}
        />
      )}

      {/* Edit Modal */}
      {editingBill && (
        <AddBillModal 
          onAdd={handleAddBill} 
          onUpdate={handleUpdateBill}
          parties={parties} 
          bills={bills} 
          initialData={editingBill}
          onClose={() => setEditingBill(null)}
        />
      )}

      <AnimatePresence>
        {showRecycleBin && (
          <RecycleBin 
            bills={deletedBills}
            onRestore={(id) => billService.restoreBill(id)}
            onPermanentlyDelete={(id) => billService.permanentlyDeleteBill(id)}
            onBatchRestore={(ids) => billService.batchRestore(ids)}
            onBatchPermanentlyDelete={(ids) => billService.batchPermanentlyDelete(ids)}
            onClose={() => setShowRecycleBin(false)}
          />
        )}
      </AnimatePresence>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTitle={appSettings?.appTitle || "BillKeeper Pro"}
        currentCompanyName={appSettings?.companyName || ""}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
