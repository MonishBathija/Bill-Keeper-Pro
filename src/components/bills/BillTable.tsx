import React, { useState, useMemo } from 'react';
import { Bill, BillStatus } from '../../types';
import { format } from 'date-fns';
import { Trash2, CheckCircle, XCircle, Filter, Search, ChevronUp, ChevronDown, X, Edit2, Loader2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import Fuse from 'fuse.js';

type SortField = 'billNumber' | 'partyName' | 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

interface BillTableProps {
  bills: Bill[];
  onToggleStatus: (id: string, status: BillStatus) => Promise<void>;
  onEdit: (bill: Bill) => void;
  onDelete: (id: string) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onBatchStatusUpdate: (ids: string[], status: BillStatus) => Promise<void>;
  onBatchPartyUpdate: (ids: string[], partyName: string) => Promise<void>;
  parties: string[];
}

export default function BillTable({ 
  bills, 
  onToggleStatus, 
  onEdit,
  onDelete, 
  onBatchDelete, 
  onBatchStatusUpdate,
  onBatchPartyUpdate,
  parties
}: BillTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPartyModalOpen, setIsBulkPartyModalOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [showBulkSuggestions, setShowBulkSuggestions] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fuse = useMemo(() => new Fuse(parties, {
    threshold: 0.4,
    distance: 100,
  }), [parties]);

  const bulkSuggestions = useMemo(() => {
    if (!newPartyName.trim()) return [];
    return fuse.search(newPartyName).slice(0, 5).map(result => result.item);
  }, [fuse, newPartyName]);

  const filteredBills = useMemo(() => {
    return bills.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date': {
          const dateA = a.date?.toDate?.() || new Date(a.date);
          const dateB = b.date?.toDate?.() || new Date(b.date);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        }
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'billNumber':
          comparison = a.billNumber.localeCompare(b.billNumber);
          break;
        case 'partyName':
          comparison = (a.partyName || '').localeCompare(b.partyName || '');
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [bills, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBills.length && filteredBills.length > 0) {
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

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (window.confirm(`Move ${selectedIds.size} selected bills to Recycle Bin?`)) {
      setIsBatchOperating(true);
      try {
        await onBatchDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
      } catch (err: any) {
        console.error("Batch delete failed:", err);
        alert("Failed to batch delete: " + err.message);
      } finally {
        setIsBatchOperating(false);
      }
    }
  };

  const handleBatchStatus = async (status: BillStatus) => {
    setIsBatchOperating(true);
    try {
      await onBatchStatusUpdate(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error("Batch status update failed:", err);
      alert("Failed to update status: " + err.message);
    } finally {
      setIsBatchOperating(false);
    }
  };

  return (
    <div className="space-y-4">
      {filteredBills.length !== bills.length && (
        <div className="flex justify-end">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
            Filtered: {filteredBills.length} Result{filteredBills.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-blue-600 p-3 rounded-lg text-white flex items-center justify-between overflow-hidden shadow-lg shadow-blue-100"
          >
            <div className="flex items-center gap-4 ml-2 font-medium">
              <span>{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                disabled={isBatchOperating}
                onClick={() => setIsBulkPartyModalOpen(true)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-sm transition-all border border-white/20 active:scale-95 disabled:opacity-50"
              >
                Change Party
              </button>
              <button 
                type="button"
                disabled={isBatchOperating}
                onClick={() => handleBatchStatus(BillStatus.PAID)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-sm transition-all border border-white/20 active:scale-95 disabled:opacity-50"
              >
                Mark Paid
              </button>
              <button 
                type="button"
                disabled={isBatchOperating}
                onClick={() => handleBatchStatus(BillStatus.UNPAID)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-sm transition-all border border-white/20 active:scale-95 disabled:opacity-50"
              >
                Mark Unpaid
              </button>
              <button 
                type="button"
                disabled={isBatchOperating}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await handleBatchDelete();
                }}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-md text-sm transition-all flex items-center gap-1.5 ml-2 active:scale-95 disabled:opacity-50"
              >
                {isBatchOperating ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkPartyModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
              
              <button 
                onClick={() => setIsBulkPartyModalOpen(false)}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Bulk Party Update</h3>
                  <p className="text-sm text-gray-500 font-medium tracking-tight">Updating <span className="text-blue-600 font-bold">{selectedIds.size}</span> selected bills</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="relative">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">New Party Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      value={newPartyName}
                      onChange={(e) => {
                        setNewPartyName(e.target.value);
                        setShowBulkSuggestions(true);
                      }}
                      onFocus={() => setShowBulkSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowBulkSuggestions(false), 200)}
                      placeholder="Enter destination party..."
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-700"
                    />
                  </div>
                  
                  <AnimatePresence>
                    {showBulkSuggestions && bulkSuggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-48 overflow-y-auto py-2"
                      >
                        {bulkSuggestions.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setNewPartyName(p);
                              setShowBulkSuggestions(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-between group"
                          >
                            <span className="font-bold">{p}</span>
                            <Search size={14} className="text-gray-300 group-hover:text-blue-400" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!newPartyName.trim()) return;
                      await onBatchPartyUpdate(Array.from(selectedIds), newPartyName);
                      setSelectedIds(new Set());
                      setIsBulkPartyModalOpen(false);
                      setNewPartyName('');
                    }}
                    disabled={!newPartyName.trim()}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    Confirm Update
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsBulkPartyModalOpen(false);
                      setNewPartyName('');
                    }}
                    className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
              <tr>
                <th className="p-4 w-12">
                  <input 
                    type="checkbox"
                    checked={filteredBills.length > 0 && selectedIds.size === filteredBills.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th 
                  className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('billNumber')}
                >
                  <div className="flex items-center gap-1">
                    Bill Info
                    {renderSortIcon('billNumber')}
                  </div>
                </th>
                <th 
                  className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {renderSortIcon('date')}
                  </div>
                </th>
                <th 
                  className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    {renderSortIcon('amount')}
                  </div>
                </th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence mode="popLayout">
                {filteredBills.map((bill) => (
                  <motion.tr 
                    layout
                    key={bill.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -10 }}
                    className={cn(
                      "hover:bg-gray-50 transition-colors group",
                      selectedIds.has(bill.id) && "bg-blue-50/50"
                    )}
                  >
                  <td className="p-4">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(bill.id)}
                      onChange={() => toggleSelect(bill.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-900">{bill.billNumber}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">{bill.partyName}</div>
                  </td>
                  <td className="p-4 text-gray-600">
                    {bill.date?.toDate ? format(bill.date.toDate(), 'MMM dd, yyyy') : format(new Date(bill.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="p-4 text-gray-900 font-semibold">
                    ${bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={isToggling === bill.id}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isToggling === bill.id) return;
                          
                          setIsToggling(bill.id);
                          try {
                            await onToggleStatus(bill.id, bill.status === BillStatus.PAID ? BillStatus.UNPAID : BillStatus.PAID);
                          } catch (err: any) {
                            console.error("Toggle status failed:", err);
                          } finally {
                            setIsToggling(null);
                          }
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 min-w-20 justify-center",
                          bill.status === BillStatus.PAID 
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        )}
                      >
                        {isToggling === bill.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : bill.status === BillStatus.PAID ? (
                          <>
                            <CheckCircle size={12} />
                            Paid
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            Unpaid
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(bill);
                        }}
                        className="inline-flex items-center justify-center p-2.5 text-blue-600 hover:text-white hover:bg-blue-600 rounded-xl transition-all border border-blue-100 hover:border-blue-600 shadow-sm active:scale-95"
                        title="Edit bill info"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        type="button"
                        disabled={isDeleting === bill.id}
                        onClick={async (e) => {
                          e.stopPropagation();
                          console.log("Individual delete button clicked for bill ID:", bill.id);
                          if (isDeleting) {
                             console.log("Delete already in progress, ignoring click.");
                             return;
                          }
                          
                          setIsDeleting(bill.id);
                          try {
                            console.log("Calling onDelete for bill ID:", bill.id);
                            await onDelete(bill.id);
                            console.log("onDelete completed for bill ID:", bill.id);
                          } catch (err: any) {
                            console.error("Individual delete failed for ID", bill.id, ":", err);
                            alert("Delete failed: " + err.message);
                          } finally {
                            setIsDeleting(null);
                          }
                        }}
                        className={cn(
                          "inline-flex items-center justify-center p-2.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-xl transition-all border border-rose-100 hover:border-rose-600 shadow-sm active:scale-95",
                          isDeleting === bill.id && "bg-rose-100 opacity-50 cursor-not-allowed"
                        )}
                        title="Move to Recycle Bin"
                      >
                        {isDeleting === bill.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500">
                    <div className="max-w-xs mx-auto">
                      <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Filter className="text-gray-400" size={24} />
                      </div>
                      <p className="font-medium text-gray-900">No bills found</p>
                      <p className="text-sm mt-1">Try adjusting your search or filters, or add a new bill.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
