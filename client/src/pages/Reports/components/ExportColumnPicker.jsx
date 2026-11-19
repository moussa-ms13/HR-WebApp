import React from 'react';
import { Check } from 'lucide-react';

export default function ExportColumnPicker({
  availableColumns = [],
  selectedColumns = [],
  onToggleColumn,
  onSelectAll,
  onResetDefault,
}) {
  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">
          الأعمدة المعروضة في التقرير{' '}
          <span className="text-slate-400 font-normal">
            ({selectedColumns.length} من {availableColumns.length})
          </span>
        </span>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-emerald-700 hover:text-emerald-800 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            تحديد الكل
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={onResetDefault}
            className="text-slate-500 hover:text-slate-700 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            الأعمدة الافتراضية
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {availableColumns.map((col) => {
          const isSelected = selectedColumns.includes(col.key);
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => onToggleColumn(col.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50/90 text-[#124E35] border-emerald-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {isSelected && <Check size={12} className="text-emerald-700 shrink-0" />}
              <span>{col.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
