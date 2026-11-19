import React from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';

export default function ExportPreviewTable({
  totalCount,
  isPreviewLoading,
  onRefresh,
  activeTableColumns,
  previewRows,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
      {/* Header Bar */}
      <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-700">
            معاينة القائمة ({totalCount})
          </h2>
          {isPreviewLoading && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin text-emerald-600" /> جاري التحديث...
            </span>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={isPreviewLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          title="تحديث المعاينة"
        >
          <RefreshCw size={13} className={isPreviewLoading ? 'animate-spin text-emerald-600' : ''} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Table with Native Styling (Slate Header) */}
      <div className="overflow-x-auto flex-1 max-h-[560px] custom-scrollbar">
        <table className="w-full text-right border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50/90 border-b border-slate-200">
            <tr>
              {activeTableColumns.map((col) => (
                <th
                  key={col.key}
                  className="py-3 px-3.5 font-semibold text-slate-600 text-xs whitespace-nowrap"
                  style={{ textAlign: col.align || 'right' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-xs">
            {isPreviewLoading ? (
              Array.from({ length: 6 }).map((_, rIdx) => (
                <tr key={`skel-${rIdx}`} className="animate-pulse">
                  {activeTableColumns.map((col, cIdx) => (
                    <td key={`skel-td-${cIdx}`} className="py-3 px-3.5">
                      <div className="h-3.5 bg-slate-200/70 rounded-sm w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : previewRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTableColumns.length || 1}
                  className="py-12 text-center text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Search size={20} className="text-slate-300" />
                    <span className="font-semibold text-slate-600 text-sm">
                      لا توجد سجلات مطابقة لمعايير التصفية المحددة
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              previewRows.map((row, rowIdx) => (
                <tr
                  key={row.id || `row-${rowIdx}`}
                  className="transition-colors hover:bg-slate-50/80"
                >
                  {activeTableColumns.map((col) => {
                    const val = row[col.key];
                    const isIndex = col.key === 'index';
                    const isFr = col.key === 'fullNameFr';
                    return (
                      <td
                        key={col.key}
                        className={`py-2.5 px-3.5 text-slate-700 whitespace-nowrap font-medium ${
                          isIndex ? 'text-slate-400 font-mono text-[11px]' : ''
                        } ${isFr ? 'font-sans text-[11px] text-slate-600' : ''}`}
                        style={{ textAlign: col.align || 'right' }}
                      >
                        {val !== undefined && val !== null && val !== '' ? (
                          String(val)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Standard Native Footer */}
      <div className="p-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>إجمالي السجلات: {totalCount}</span>
        <span>عرض {previewRows.length} سجل في المعاينة الحية</span>
      </div>
    </div>
  );
}
