import React from 'react';
import { Download, RotateCcw, Loader2 } from 'lucide-react';

export default function ExportHeader({
  totalCount,
  isExporting,
  onResetFilters,
  onExportExcel,
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">التقارير والتصدير</h1>
        <p className="text-sm text-slate-500 mt-1">تخصيص وتصدير القوائم الاسمية</p>
      </div>

      <div className="flex w-full sm:w-auto items-center gap-3">
        <button
          onClick={onResetFilters}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
          title="إعادة ضبط الفلاتر"
        >
          <RotateCcw size={16} />
          <span>إعادة ضبط</span>
        </button>

        <button
          onClick={onExportExcel}
          disabled={isExporting || totalCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors hover:bg-[#0e3d29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          style={{ backgroundColor: '#124E35' }}
        >
          {isExporting ? (
            <>
              <Loader2 size={16} className="animate-spin text-emerald-200" />
              <span>جاري التصدير...</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>تصدير Excel ({totalCount})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
