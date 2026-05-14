import React, { useState, useMemo } from 'react';
import { Bill, BillStatus } from '../../types';
import { Folder, ChevronRight, ArrowLeft, Wallet, CheckCircle, Clock, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BillTable from './BillTable';
import { cn } from '../../lib/utils';

interface PartyFoldersProps {
  bills: Bill[];
  parties: string[];
  onToggleStatus: (id: string, status: BillStatus) => Promise<void>;
  onEdit: (bill: Bill) => void;
  onDelete: (id: string) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onBatchStatusUpdate: (ids: string[], status: BillStatus) => Promise<void>;
  onBatchPartyUpdate: (ids: string[], partyName: string) => Promise<void>;
  onDeleteParty: (partyName: string) => Promise<void>;
}

export default function PartyFolders({ 
  bills, 
  parties,
  onToggleStatus, 
  onEdit,
  onDelete, 
  onBatchDelete, 
  onBatchStatusUpdate,
  onBatchPartyUpdate,
  onDeleteParty
}: PartyFoldersProps) {
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const partyStats = useMemo(() => {
    const stats: Record<string, { count: number, total: number, unpaidCount: number, ids: string[] }> = {};
    
    // Initialize with known parties
    parties.forEach(p => {
      stats[p] = { count: 0, total: 0, unpaidCount: 0, ids: [] };
    });

    // Add 'Unknown' if not in parties but exists in bills
    bills.forEach(bill => {
      const party = bill.partyName || 'Unknown';
      if (!stats[party]) {
        stats[party] = { count: 0, total: 0, unpaidCount: 0, ids: [] };
      }
      stats[party].count++;
      stats[party].total += bill.amount;
      stats[party].ids.push(bill.id);
      if (bill.status === BillStatus.UNPAID) {
        stats[party].unpaidCount++;
      }
    });
    
    return stats;
  }, [bills, parties]);

  const filteredBills = useMemo(() => {
    if (!selectedParty) return [];
    return bills.filter(b => {
      const bParty = b.partyName || 'Unknown';
      return bParty === selectedParty;
    });
  }, [bills, selectedParty]);

  if (selectedParty) {
    const stats = partyStats[selectedParty] || { count: 0, total: 0, unpaidCount: 0, ids: [] };
    return (
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => {
                  setSelectedParty(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-600 active:scale-90"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedParty}</h2>
                <p className="text-gray-500 text-sm">Viewing {stats.count} bills for this party</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!!isDeleting}
              onClick={async () => {
                setIsDeleting(selectedParty);
                try {
                  await onDeleteParty(selectedParty);
                  setSelectedParty(null);
                } catch (err: any) {
                  console.error("Party delete failed:", err);
                  alert("Delete failed: " + err.message);
                } finally {
                  setIsDeleting(null);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-sm font-bold transition-all w-fit shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50",
                isDeleting === selectedParty && "bg-rose-100"
              )}
            >
              {isDeleting === selectedParty ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Remove Party & All Bills
            </button>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-1">
              <Wallet size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Total Amount</span>
            </div>
            <p className="text-xl font-bold text-gray-900">${stats.total.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-1">
              <Clock size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Unpaid Bills</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.unpaidCount}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 text-emerald-600 mb-1">
              <CheckCircle size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Paid Bills</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.count - stats.unpaidCount}</p>
          </div>
        </div>

        <BillTable 
          bills={filteredBills}
          parties={parties}
          onToggleStatus={onToggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
          onBatchDelete={onBatchDelete}
          onBatchStatusUpdate={onBatchStatusUpdate}
          onBatchPartyUpdate={onBatchPartyUpdate}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <AnimatePresence mode="popLayout">
        {(Object.entries(partyStats) as [string, { count: number, total: number, unpaidCount: number, ids: string[] }][])
          .sort((a, b) => b[1].count - a[1].count)
          .map(([party, stats]) => (
          <motion.div
            layout
            key={party}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -4 }}
            onClick={() => setSelectedParty(party)}
            className="group cursor-pointer bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 flex items-center gap-1">
              <button 
                type="button"
                disabled={!!isDeleting}
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsDeleting(party);
                  try {
                    await onDeleteParty(party);
                  } catch (err: any) {
                    console.error("Folder delete failed:", err);
                    alert("Delete failed: " + err.message);
                  } finally {
                    setIsDeleting(null);
                  }
                }}
                className={cn(
                  "p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95",
                  isDeleting === party && "opacity-50 cursor-not-allowed"
                )}
                title="Delete party folder"
              >
                {isDeleting === party ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              </button>
              <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={18} />
            </div>

            <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Folder size={24} />
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-1 truncate pr-6">{party}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span>{stats.count} Bill{stats.count !== 1 ? 's' : ''}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              {stats.unpaidCount > 0 ? (
                <span className="text-amber-600 font-medium">{stats.unpaidCount} pending</span>
              ) : (
                <span className="text-emerald-600 font-medium">All paid</span>
              )}
            </div>

            <div className="pt-4 border-t border-gray-50 flex items-baseline gap-1">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total:</span>
              <span className="text-lg font-bold text-gray-900">${stats.total.toLocaleString()}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {Object.keys(partyStats).length === 0 && (
        <div className="col-span-full py-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
           <Folder className="mx-auto text-gray-300 mb-4" size={48} />
           <p className="text-gray-500 font-medium">No parties found. Add your first bill to see them here.</p>
        </div>
      )}
    </div>
  );
}
