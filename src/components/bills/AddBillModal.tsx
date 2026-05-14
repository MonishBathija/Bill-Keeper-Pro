import React, { useState, useMemo } from 'react';
import { Plus, X, Loader2, Search } from 'lucide-react';
import { BillStatus, BillFormData, Bill } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import Fuse from 'fuse.js';

interface AddBillModalProps {
  onAdd: (data: BillFormData) => Promise<void>;
  onUpdate?: (id: string, data: BillFormData) => Promise<void>;
  parties: string[];
  bills: Bill[];
  initialData?: Bill | null;
  onClose?: () => void;
}

export default function AddBillModal({ onAdd, onUpdate, parties, bills, initialData, onClose }: AddBillModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BillFormData>(() => {
    if (initialData) {
      const date = initialData.date?.toDate ? initialData.date.toDate() : new Date(initialData.date);
      return {
        billNumber: initialData.billNumber,
        partyName: initialData.partyName,
        date: date.toISOString().split('T')[0],
        amount: initialData.amount,
        status: initialData.status
      };
    }
    return {
      billNumber: '',
      partyName: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      status: BillStatus.UNPAID
    };
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fuse = useMemo(() => new Fuse(parties, {
    threshold: 0.4,
    distance: 100,
  }), [parties]);

  const suggestions = useMemo(() => {
    if (!formData.partyName.trim()) return [];
    return fuse.search(formData.partyName).map(result => result.item);
  }, [fuse, formData.partyName]);

  const isActuallyOpen = isOpen || !!initialData;

  const handleModalClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  const isDuplicate = bills.some(b => 
    b.id !== initialData?.id && 
    b.billNumber.toLowerCase() === formData.billNumber.toLowerCase() && 
    b.partyName.toLowerCase() === formData.partyName.toLowerCase() &&
    b.amount === formData.amount
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.billNumber || !formData.partyName || formData.amount <= 0) return;

    setLoading(true);
    try {
      if (initialData && onUpdate) {
        await onUpdate(initialData.id, formData);
      } else {
        await onAdd(formData);
      }
      
      if (!initialData) {
        setFormData({
          billNumber: '',
          partyName: '',
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          status: BillStatus.UNPAID
        });
      }
      handleModalClose();
    } catch (err: any) {
      alert(err.message || "Failed to save bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!initialData && (
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
        >
          <Plus size={20} />
          Add New Bill
        </button>
      )}

      <AnimatePresence>
        {isActuallyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={handleModalClose}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>

              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {initialData ? 'Edit Bill Record' : 'Record New Bill'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number</label>
                    <input 
                      required
                      type="text" 
                      value={formData.billNumber}
                      onChange={(e) => setFormData({...formData, billNumber: e.target.value})}
                      placeholder="INV-001"
                      className={cn(
                        "w-full px-4 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none",
                        isDuplicate ? "border-amber-300 ring-2 ring-amber-100" : "border-gray-200"
                      )}
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.partyName}
                      onChange={(e) => {
                        setFormData({...formData, partyName: e.target.value});
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => {
                        // Delay hide to allow clicks on suggestions
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      placeholder="Customer Name"
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                    <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-2"
                        >
                          {suggestions.map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, partyName: p});
                                setShowSuggestions(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-between group"
                            >
                              <span className="font-medium">{p}</span>
                              <Search size={14} className="text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input 
                      required
                      type="date" 
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                      placeholder="0.00"
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none text-right font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Initial Status</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, status: BillStatus.UNPAID})}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.status === BillStatus.UNPAID ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, status: BillStatus.PAID})}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.status === BillStatus.PAID ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Paid
                    </button>
                  </div>
                </div>

                {isDuplicate && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-amber-800 text-xs font-medium"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Potential duplicate detected with existing records.
                  </motion.div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-all shadow-md shadow-blue-50 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Bill'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
