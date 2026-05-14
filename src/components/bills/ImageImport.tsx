import React, { useState, useRef, useMemo } from 'react';
import { Camera, Image as ImageIcon, Loader2, X, Check, AlertCircle, FileText, User as UserIcon, Calendar, DollarSign, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../../services/geminiService';
import { BillFormData, BillStatus } from '../../types';
import Fuse from 'fuse.js';

interface ImageImportProps {
  onImport: (bills: BillFormData[]) => Promise<void>;
  parties: string[];
}

export default function ImageImport({ onImport, parties }: ImageImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedEntries, setExtractedEntries] = useState<BillFormData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<number | null>(null);

  const fuse = useMemo(() => new Fuse(parties, {
    threshold: 0.4,
    distance: 100,
  }), [parties]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setExtractedEntries([]);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);
    try {
      const mimeType = preview.split(';')[0].split(':')[1];
      const entries = await geminiService.extractBillData(preview, mimeType);
      setExtractedEntries(entries);
    } catch (err: any) {
      setError(err.message || "Failed to extract data from image");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (extractedEntries.length === 0) return;
    setLoading(true);
    try {
      await onImport(extractedEntries);
      reset();
    } catch (err: any) {
      setError(err.message || "Failed to save bills");
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (index: number, updates: Partial<BillFormData>) => {
    setExtractedEntries(prev => prev.map((entry, i) => i === index ? { ...entry, ...updates } : entry));
  };

  const removeEntry = (index: number) => {
    setExtractedEntries(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setIsOpen(false);
    setPreview(null);
    setExtractedEntries([]);
    setError(null);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-purple-600 bg-white hover:bg-purple-50 rounded-xl transition-all border border-gray-200 hover:border-purple-200 shadow-sm active:scale-95"
      >
        <Camera size={16} />
        Scan Bill
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative my-8"
            >
              <button 
                onClick={reset}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="bg-purple-100 p-2 rounded-xl text-purple-600">
                    <Camera size={20} />
                  </div>
                  {extractedEntries.length > 0 ? `Review Extracted Entries (${extractedEntries.length})` : 'Scan Bill Image'}
                </h3>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2 border border-red-100 mb-6 font-medium">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-6">
                {extractedEntries.length === 0 ? (
                  <>
                    {!preview ? (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-purple-200 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all group"
                      >
                        <ImageIcon className="mx-auto text-purple-200 group-hover:text-purple-500 mb-4 transition-colors" size={56} />
                        <p className="text-base font-semibold text-gray-700">Drop or Select Bill Image</p>
                        <p className="text-sm text-gray-400 mt-1">AI will extract all line items separately</p>
                      </div>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden border-4 border-gray-100 shadow-xl bg-gray-50 aspect-video group">
                        <img src={preview} alt="Bill Preview" className="w-full h-full object-contain" />
                        {!loading && (
                          <button 
                            onClick={() => setPreview(null)}
                            className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X size={16} />
                          </button>
                        )}
                        {loading && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
                            <p className="text-sm font-bold text-purple-900 text-center">
                              Analyzing Image...<br/>
                              <span className="text-xs font-normal">Extracting multiple line items</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {extractedEntries.map((entry, index) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={index}
                        className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group"
                      >
                        <button 
                          onClick={() => removeEntry(index)}
                          className="absolute -top-2 -right-2 p-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-gray-100"
                        >
                          <X size={14} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Bill No</label>
                              <input
                                type="text"
                                value={entry.billNumber}
                                onChange={(e) => updateEntry(index, { billNumber: e.target.value })}
                                className="w-full bg-white border-0 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-purple-500 shadow-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Date</label>
                              <input
                                type="date"
                                value={entry.date}
                                onChange={(e) => updateEntry(index, { date: e.target.value })}
                                className="w-full bg-white border-0 rounded-lg px-2 py-2 text-xs font-medium focus:ring-1 focus:ring-purple-500 shadow-sm"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 relative">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Party Name</label>
                            <input
                              type="text"
                              value={entry.partyName}
                              onChange={(e) => {
                                updateEntry(index, { partyName: e.target.value });
                                setActiveSuggestion(index);
                              }}
                              onFocus={() => setActiveSuggestion(index)}
                              onBlur={() => {
                                // Delay hide to allow clicks on suggestions
                                setTimeout(() => setActiveSuggestion(null), 200);
                              }}
                              className="w-full bg-white border-0 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-purple-500 shadow-sm"
                            />
                            <AnimatePresence>
                              {activeSuggestion === index && entry.partyName.trim() && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1"
                                >
                                  {fuse.search(entry.partyName).slice(0, 5).map((result, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        updateEntry(index, { partyName: result.item });
                                        setActiveSuggestion(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center justify-between group"
                                    >
                                      <span>{result.item}</span>
                                      <Search size={10} className="text-gray-300 opacity-0 group-hover:opacity-100" />
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Amount</label>
                            <div className="relative">
                              <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="number"
                                value={entry.amount}
                                onChange={(e) => updateEntry(index, { amount: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-white border-0 rounded-lg pl-8 pr-3 py-2 text-xs font-medium focus:ring-1 focus:ring-purple-500 shadow-sm"
                              />
                            </div>
                          </div>

                          <div className="flex items-end">
                            <div className="flex bg-white p-1 rounded-lg border border-gray-100 shadow-sm w-full">
                              <button
                                onClick={() => updateEntry(index, { status: BillStatus.PAID })}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                                  entry.status === BillStatus.PAID 
                                    ? 'bg-emerald-50 text-emerald-600' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                Paid
                              </button>
                              <button
                                onClick={() => updateEntry(index, { status: BillStatus.UNPAID })}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                                  entry.status === BillStatus.UNPAID 
                                    ? 'bg-rose-50 text-rose-600' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                Unpaid
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={reset}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 font-bold transition-all text-sm active:scale-95 uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  {preview && extractedEntries.length === 0 && (
                    <button 
                      onClick={handleExtract}
                      disabled={loading}
                      className="flex-[3] px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-95"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Camera size={18} />
                          Analyze Image
                        </>
                      )}
                    </button>
                  )}
                  {extractedEntries.length > 0 && (
                    <button 
                      onClick={handleConfirm}
                      disabled={loading}
                      className="flex-[3] px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm active:scale-95 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                      Save Bill Record
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
