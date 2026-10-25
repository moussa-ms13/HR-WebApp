import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * InstitutionalPageLoader — 60-30-10 Institutional Route Fallback Loader
 * 
 * Used with React.Suspense during route transitions and lazy chunk evaluation.
 * 60% Base: Clean slate-50 canvas
 * 30% Structure: Slate-700 / slate-500 typography & refined borders
 * 10% Accent: Algerian Institutional Emerald (#105b38 / emerald-700)
 */
export default function InstitutionalPageLoader() {
  return (
    <div 
      className="min-h-[60vh] w-full flex flex-col items-center justify-center p-8 bg-slate-50/50" 
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-label="جاري تحميل الصفحة"
    >
      <div className="flex flex-col items-center max-w-sm w-full text-center">
        {/* Institutional Emblem Badge */}
        <div className="relative mb-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border border-emerald-900/10" style={{ backgroundColor: '#105b38' }}>
            <span className="font-black text-xl tracking-tight" style={{ color: '#c7a43e' }}>
              HR
            </span>
          </div>
          {/* Pulsing glow ring */}
          <div className="absolute -inset-1 rounded-2xl bg-emerald-600/20 animate-ping -z-10 opacity-75" />
        </div>

        {/* Loading Spinner & Label */}
        <div className="flex items-center gap-2.5 mb-2">
          <Loader2 size={18} className="animate-spin text-emerald-700" />
          <h4 className="text-sm font-bold text-slate-800 tracking-normal">
            جاري تحميل البيانات...
          </h4>
        </div>
        
        <p className="text-xs text-slate-400 font-medium mb-6">
          الجمهورية الجزائرية الديمقراطية الشعبية — إدارة الموارد البشرية
        </p>

        {/* Subtle Skeleton Progress Bars */}
        <div className="w-48 space-y-2">
          <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full animate-indeterminate" />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
            <span>تحميل الوحدة</span>
            <span>انتظار الاستجابة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
