import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2, X, Filter, Calendar } from 'lucide-react';
import { Bill, BillStatus } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface ImportExportProps {
  bills: Bill[];
  onImport: (bills: any[]) => Promise<void>;
}

export default function ImportExport({ bills, onImport }: ImportExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'paste'>('import');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ row: number; error: string; data: any }[]>([]);
  const [pastedData, setPastedData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export options
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportStatuses, setExportStatuses] = useState<BillStatus[]>([BillStatus.PAID, BillStatus.UNPAID]);

  const toggleStatus = (status: BillStatus) => {
    if (exportStatuses.includes(status)) {
      setExportStatuses(exportStatuses.filter(s => s !== status));
    } else {
      setExportStatuses([...exportStatuses, status]);
    }
  };

  const processImportData = async (data: any[]) => {
    const errors: { row: number; error: string; data: any }[] = [];
    const transformed: any[] = [];

    data.forEach((row: any, index: number) => {
      try {
        // Flexible header mapping
        const billNumber = (row['Bill Number'] || row['bill_number'] || row['Number'] || row['ID'] || row['Bill No'] || row['bill_no'])?.toString().trim();
        const partyName = (row['Party Name'] || row['party_name'] || row['Party'] || row['Customer'])?.toString().trim();
        const dateStr = (row['Date'] || row['date'] || row['Bill Date'] || row['bill_date'])?.toString().trim();
        const rawAmount = row['Amount'] || row['amount'] || row['Bill Amount'] || row['bill_amount'];
        const amount = parseFloat(rawAmount?.toString().replace(/,/g, ''));
        const status = (row['Status'] || row['status'] || 'unpaid').toString().toLowerCase();

        // Skip total rows or empty rows
        if (!billNumber && !partyName && isNaN(amount)) return;
        if (partyName?.toLowerCase() === 'total' || billNumber?.toLowerCase() === 'total' || dateStr?.toLowerCase() === 'total') return;
        if (!dateStr || dateStr === ',,,') return;

        const rowErrors: string[] = [];
        if (!billNumber) rowErrors.push('Missing Bill Number');
        if (!partyName) rowErrors.push('Missing Party Name');
        if (!dateStr) rowErrors.push('Missing Date');
        if (isNaN(amount)) rowErrors.push('Invalid Amount');

        if (rowErrors.length > 0) {
          // Only record error if it's not a completely empty row
          if (billNumber || partyName || dateStr) {
            errors.push({ row: index + 2, error: rowErrors.join(', '), data: row });
          }
          return;
        }

        // Robust Date Parsing (DD/MM/YYYY support)
        let billDate: Date;
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[2]);
            billDate = new Date(year, month, day);
          } else {
            billDate = new Date(dateStr);
          }
        } else {
          billDate = new Date(dateStr);
        }

        if (isNaN(billDate.getTime())) {
          errors.push({ row: index + 2, error: 'Invalid Date Format', data: row });
          return;
        }

        transformed.push({
          billNumber: billNumber,
          partyName: partyName,
          date: billDate,
          amount,
          status: status === 'paid' ? BillStatus.PAID : BillStatus.UNPAID
        });
      } catch (err: any) {
        errors.push({ row: index + 2, error: err.message || 'Row processing failed', data: row });
      }
    });

    if (transformed.length > 0) {
      await onImport(transformed);
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      setError(`Import completed with ${errors.length} failed rows.`);
      if (transformed.length > 0) {
        setSuccess(`Successfully imported ${transformed.length} bills.`);
      }
    } else {
      setSuccess(`Successfully imported ${transformed.length} bills.`);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(null);
      }, 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setImportErrors([]);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        await processImportData(data);
      } catch (err: any) {
        setError(err instanceof Error ? err.message : 'Failed to parse Excel file.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setError('File reading failed');
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handlePasteImport = async () => {
    if (!pastedData.trim()) return;
    
    setError(null);
    setSuccess(null);
    setImportErrors([]);
    setLoading(true);

    try {
      const wb = XLSX.read(pastedData, { type: 'string' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      await processImportData(data);
      setPastedData('');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to parse pasted data.');
    } finally {
      setLoading(false);
    }
  };

  const downloadErrorReport = () => {
    if (importErrors.length === 0) return;

    const errorData = importErrors.map(err => ({
      'Row Number': err.row,
      'Error Message': err.error,
      ...err.data
    }));

    const ws = XLSX.utils.json_to_sheet(errorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Errors");

    XLSX.writeFile(wb, `Import_Errors_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
  };

  const handleExport = async (formatType: 'xlsx' | 'csv') => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Simulate small delay for tactile feedback if list is small
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter bills
      const filtered = bills.filter(bill => {
        // Status filter
        if (!exportStatuses.includes(bill.status)) return false;

        // Date range filter
        const billDate = bill.date?.toDate?.() || new Date(bill.date);
        if (exportStartDate && billDate < new Date(exportStartDate)) return false;
        if (exportEndDate && billDate > new Date(exportEndDate + 'T23:59:59')) return false;

        return true;
      });

      if (filtered.length === 0) {
        throw new Error('No bills found matching the selected filters.');
      }

      // Format for Export
      const exportData = filtered.map(bill => ({
        'Bill Number': bill.billNumber,
        'Party Name': bill.partyName,
        'Date': format(bill.date?.toDate?.() || new Date(bill.date), 'yyyy-MM-dd'),
        'Amount': bill.amount,
        'Status': bill.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bills");

      const fileName = `Bills_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.${formatType}`;
      XLSX.writeFile(wb, fileName, { bookType: formatType === 'csv' ? 'csv' : 'xlsx' });

      setSuccess(`Successfully exported ${filtered.length} bills.`);
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 bg-white hover:bg-blue-50 rounded-xl transition-all border border-gray-200 hover:border-blue-200 shadow-sm"
      >
        <Download size={16} />
        Manage Data
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              {/* Background gradient pattern */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500"></div>
              
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Data Management</h3>
                  <p className="text-sm text-gray-500 font-medium">Import or export your bill records</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => setActiveTab('import')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                    activeTab === 'import' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Upload size={16} />
                  Import
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                    activeTab === 'export' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Download size={16} />
                  Export
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
                    activeTab === 'paste' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <FileText size={16} />
                  Paste
                </button>
              </div>

              <div className="min-h-[400px] flex flex-col">
                {error && (
                  <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-sm flex flex-col gap-3 border border-rose-100 mb-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <span className="font-medium">{error}</span>
                    </div>
                    {importErrors.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="max-h-32 overflow-y-auto pr-2 space-y-1">
                          {importErrors.slice(0, 5).map((err, i) => (
                            <p key={i} className="text-xs text-rose-600 bg-white/50 px-2 py-1 rounded-md border border-rose-100 flex justify-between">
                              <span>Row {err.row}: {err.error}</span>
                            </p>
                          ))}
                          {importErrors.length > 5 && (
                            <p className="text-xs text-rose-500 italic px-2">...and {importErrors.length - 5} more errors.</p>
                          )}
                        </div>
                        <button
                          onClick={downloadErrorReport}
                          className="flex items-center gap-2 text-xs font-bold text-rose-700 hover:text-rose-800 bg-white border border-rose-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                        >
                          <Download size={14} />
                          Download Full Error Report
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm flex items-start gap-3 border border-emerald-100 mb-4 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    <span className="font-medium">{success}</span>
                  </div>
                )}

                {activeTab === 'import' ? (
                  <div className="flex-1 flex flex-col">
                    <p className="text-sm text-gray-500 mb-4 px-1">
                      Upload an <span className="font-bold text-gray-700">.xlsx</span> or <span className="font-bold text-gray-700">.csv</span> file with the following columns:
                      <span className="block mt-2 font-mono bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs font-bold border border-blue-100 italic">
                        Bill Number, Party Name, Date, Amount, [Status]
                      </span>
                    </p>

                    <div 
                      onClick={() => !loading && fileInputRef.current?.click()}
                      className={cn(
                        "flex-1 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4",
                        loading ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 group'
                      )}
                    >
                      {loading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-blue-600" size={40} />
                          <span className="text-sm font-bold text-gray-500">Processing file...</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-gray-50 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500 rounded-2xl flex items-center justify-center transition-all shadow-inner">
                            <Upload size={32} />
                          </div>
                          <div>
                            <p className="text-base font-black text-gray-700">Drop your file here</p>
                            <p className="text-sm text-gray-400 mt-1">or click to browse from computer</p>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded">XLSX</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded">CSV</span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                    />
                  </div>
                ) : activeTab === 'paste' ? (
                  <div className="flex-1 flex flex-col">
                    <p className="text-sm text-gray-500 mb-4 px-1">
                      Paste CSV data below. Make sure it includes headers:
                    </p>
                    <textarea
                      value={pastedData}
                      onChange={(e) => setPastedData(e.target.value)}
                      placeholder="Bill Date,Bill No,Party,Bill Amount&#10;02/05/2026,26-27/59,KAPLESHWAR FOOD PRODUCTS,21004"
                      className="flex-1 w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs resize-none"
                    />
                    <button
                      onClick={handlePasteImport}
                      disabled={loading || !pastedData.trim()}
                      className="mt-4 w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Import Pasted Data
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 space-y-6">
                    <div className="space-y-4">
                      <label className="text-sm font-black text-gray-700 flex items-center gap-2 uppercase tracking-tight">
                        <Calendar size={16} className="text-blue-500" />
                        Date Range Selection
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">From</span>
                          <input 
                            type="date" 
                            value={exportStartDate}
                            onChange={(e) => setExportStartDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border-gray-100 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm text-gray-700"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">To</span>
                          <input 
                            type="date" 
                            value={exportEndDate}
                            onChange={(e) => setExportEndDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border-gray-100 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-sm text-gray-700"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-black text-gray-700 flex items-center gap-2 uppercase tracking-tight">
                        <Filter size={16} className="text-emerald-500" />
                        Include Statuses
                      </label>
                      <div className="flex gap-3">
                        {[BillStatus.PAID, BillStatus.UNPAID].map((status) => (
                          <button
                            key={status}
                            onClick={() => toggleStatus(status)}
                            className={cn(
                              "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2",
                              exportStatuses.includes(status)
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm"
                                : "bg-white border-gray-100 text-gray-400 grayscale hover:grayscale-0"
                            )}
                          >
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              status === BillStatus.PAID ? "bg-emerald-500" : "bg-amber-500"
                            )} />
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <button
                        onClick={() => handleExport('xlsx')}
                        disabled={loading}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                        Export as Excel (XLSX)
                      </button>
                      <button
                        onClick={() => handleExport('csv')}
                        disabled={loading}
                        className="w-full py-4 bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                      >
                        <FileText size={20} />
                        Export as CSV
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 font-bold text-sm transition-all uppercase tracking-widest active:scale-95"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
