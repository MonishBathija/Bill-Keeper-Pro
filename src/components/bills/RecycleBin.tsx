import React, { useState, useMemo } from 'react';
import { Bill } from '../../types';
import { format } from 'date-fns';
import { Trash2, RotateCcw, Search, ChevronUp, ChevronDown, CheckSquare, Square, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface RecycleBinProps {
  bills: Bill[];
  onRestore: (id: string) => Promise<void>;
  onPermanentlyDelete: (id: string) => Promise<void>;
  onBatchRestore: (ids: string[]) => Promise<void>;
  onBatchPermanentlyDelete: (ids: string[]) => Promise<void>;
  onClose: () => void;
}

export default function RecycleBin({ 
  bills, 
  onRestore, 
  onPermanentlyDelete, 
  onBatchRestore, 
  onBatchPermanentlyDelete,
  onClose 
}: RecycleBinProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'deletedAt' | 'amount' | 'partyName'>('deletedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const searchLower = search.toLowerCase();
      const billNumber = bill.billNumber || '';
      const partyName = bill.partyName || 'Unknown';
      return billNumber.toLowerCase().includes(searchLower) || 
             partyName.toLowerCase().includes(searchLower);
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'deletedAt') {
        const dateA = a.deletedAt?.toDate?.() || new Date(0);
        const dateB = b.deletedAt?.toDate?.() || new Date(0);
        comparison = dateA.getTime() - dateB.getTime();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else {
        const partyA = a.partyName || 'Unknown';
        const partyB = b.partyName || 'Unknown';
        comparison = partyA.localeCompare(partyB);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [bills, search, sortField, sortOrder]);

  const [isOperating, setIsOperating] = useState<string | null>(null);
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBills.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBills.map(b => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchOperating(true);
    try {
      await onBatchRestore(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert("Restore failed: " + err.message);
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchOperating(true);
    try {
      await onBatchPermanentlyDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (bills.length === 0) return;
    setIsBatchOperating(true);
    try {
      await onBatchPermanentlyDelete(bills.map(b => b.id));
    } catch (err: any) {
      alert("Empty trash failed: " + err.message);
    } finally {
      setIsBatchOperating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="text-rose-500" size={24} />
              Recycle Bin
            </h2>
            <p className="text-sm text-gray-500 mt-1">Deleted bills are stored here before permanent deletion.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Filters & Actions */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center bg-white">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by bill number or party..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 w-full md:w-auto"
              >
                <button
                  type="button"
                  disabled={isBatchOperating}
                  onClick={handleBatchRestore}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isBatchOperating ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  Restore Selected
                </button>
                <button
                  type="button"
                  disabled={isBatchOperating}
                  onClick={handleBatchDelete}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isBatchOperating ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Clear Selected
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {bills.length > 0 && selectedIds.size === 0 && (
            <button
              type="button"
              disabled={isBatchOperating}
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-bold transition-all ml-auto active:scale-95 disabled:opacity-50"
            >
              {isBatchOperating ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Empty Trash
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-left border-b border-gray-50">
                <th className="p-4 w-12">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-500 transition-colors">
                    {selectedIds.size === filteredBills.length && filteredBills.length > 0 ? (
                      <CheckSquare className="text-blue-500" size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                </th>
                <th 
                  className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                  onClick={() => handleSort('partyName')}
                >
                  <div className="flex items-center gap-1">
                    Party Name
                    {sortField === 'partyName' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Bill Details</th>
                <th 
                  className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    {sortField === 'amount' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th 
                  className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600"
                  onClick={() => handleSort('deletedAt')}
                >
                  <div className="flex items-center gap-1">
                    Deleted On
                    {sortField === 'deletedAt' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => (
                <tr 
                  key={bill.id} 
                  className={cn(
                    "border-b border-gray-50 transition-all hover:bg-gray-50 group",
                    selectedIds.has(bill.id) && "bg-blue-50/30"
                  )}
                >
                  <td className="p-4">
                    <button onClick={() => toggleSelect(bill.id)} className="text-gray-300 group-hover:text-gray-400 transition-colors">
                      {selectedIds.has(bill.id) ? (
                        <CheckSquare className="text-blue-500" size={20} />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{bill.partyName}</p>
                    <p className="text-xs text-gray-400">Bill #{bill.billNumber}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-600">
                      {format(bill.date?.toDate?.() || new Date(bill.date), 'MMM dd, yyyy')}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-bold text-gray-900">${bill.amount.toLocaleString()}</p>
                  </td>
                  <td className="p-4 text-xs text-gray-500">
                    {bill.deletedAt ? format(bill.deletedAt.toDate(), 'MMM dd, HH:mm') : 'N/A'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2 text-right">
                      <button
                        type="button"
                        disabled={!!isOperating}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("Restore clicked for bill:", bill.id);
                          setIsOperating(bill.id);
                          try {
                            await onRestore(bill.id);
                            console.log("Restore success for bill:", bill.id);
                          } catch (err: any) {
                            console.error("Restore failed:", err);
                            alert("Restore failed: " + err.message);
                          } finally {
                            setIsOperating(null);
                          }
                        }}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all active:scale-90 disabled:opacity-50"
                        title="Restore"
                      >
                        {isOperating === bill.id ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                      </button>
                      <button
                        type="button"
                        disabled={!!isOperating}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsOperating(bill.id);
                          try {
                            await onPermanentlyDelete(bill.id);
                          } catch (err: any) {
                            console.error("Permanent delete failed:", err);
                            alert("Permanent delete failed: " + err.message);
                          } finally {
                            setIsOperating(null);
                          }
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90 disabled:opacity-50"
                        title="Delete permanently"
                      >
                        {isOperating === bill.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredBills.length === 0 && (
            <div className="py-20 text-center">
              <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-gray-300" size={32} />
              </div>
              <p className="text-gray-500 font-medium">Recycle bin is empty</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-medium">
          <div>{selectedIds.size} of {filteredBills.length} selected</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Restore to active
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              Permanent removal
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
