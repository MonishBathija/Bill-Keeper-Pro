import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  color: 'blue' | 'emerald' | 'amber';
}

export default function StatCard({ icon, label, value, detail, color }: StatCardProps) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600'
  };
  
  return (
    <div className={`p-6 rounded-2xl border ${colorMap[color]} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white rounded-xl shadow-sm border border-inherit">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black text-gray-900">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{detail}</p>
        </div>
      </div>
    </div>
  );
}
