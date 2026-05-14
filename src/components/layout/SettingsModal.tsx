import React, { useState } from 'react';
import { X, Settings, Building2, Type, Save } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTitle: string;
  currentCompanyName: string;
  onSave: (data: { appTitle: string; companyName: string }) => Promise<void>;
}

export default function SettingsModal({ isOpen, onClose, currentTitle, currentCompanyName, onSave }: SettingsModalProps) {
  const [appTitle, setAppTitle] = useState(currentTitle);
  const [companyName, setCompanyName] = useState(currentCompanyName);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({ appTitle, companyName });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                <Settings size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Personalize</h2>
                <p className="text-gray-500 text-sm font-medium">Make it your own</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                <Type size={14} className="text-purple-500" />
                Application Title
              </label>
              <input
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                placeholder="e.g. My Bills, Finance Dashboard"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                <Building2 size={14} className="text-purple-500" />
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all font-semibold"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-purple-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              Save Personalization
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
