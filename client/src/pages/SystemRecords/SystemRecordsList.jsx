import React, { useState, useRef, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import SystemRecordsService from '../../services/systemRecordsService';
import { Search, Loader2, FileSpreadsheet, History } from 'lucide-react';
import { DateText, formatDateTime } from '../../utils/formatDate';
import * as XLSX from 'xlsx';

const fetcher = async ([url, page, limit, search]) => {
  const result = await SystemRecordsService.getAll(page, limit, search);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

const SystemRecordsList = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  
  const { data, error, isLoading } = useSWR(
    ['/api/system-records', page, limit, search],
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const rawData = data?.data;
  const records = Array.isArray(rawData) ? rawData : (rawData?.records || data?.records || []);
  const meta = data?.meta || { total: rawData?.total || data?.total || 0, totalPages: rawData?.totalPages || data?.totalPages || 0 };
  
  // Debounced search: 500ms timeout
  const debounceRef = useRef(null);
  const debouncedSearch = useCallback((value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };



  const handleExportExcel = () => {
    const exportData = records.map((rec) => ({
      'المعرف': rec?.Id || '-',
      'عنوان الحركة': rec?.Title || '-',
      'الوصف': rec?.Description || '-',
      'المنفذ': rec?.UserFullName || '-',
      'تاريخ الحركة': formatDateTime(rec?.CreatedDate),
      'اسم الجهاز': rec?.DeviceName || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل النظام');
    XLSX.writeFile(wb, `system_records_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full font-sans" dir="rtl">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">سجل النظام</h1>
          <p className="text-sm text-slate-500 mt-1">سجل التدقيق والمراقبة لحركات المستخدمين (إجمالي: {meta.total})</p>
        </div>
        
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="بحث بالاسم أو الحركة..."
              defaultValue={search}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none text-sm"
              style={{ focusRingColor: '#0a7e50' }}
            />
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          </div>

          <button
            onClick={handleExportExcel}
            disabled={records.length === 0}
            className="flex items-center justify-center px-4 py-2 text-white rounded-lg transition shadow-sm text-sm font-medium shrink-0 disabled:opacity-50"
            style={{ backgroundColor: '#105b38' }}
          >
            <FileSpreadsheet size={18} className="ml-1" />
            تصدير Excel
          </button>
        </div>
      </div>



      {/* DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex-1 flex flex-col mt-4">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-6 font-medium">المعرف</th>
                <th className="py-4 px-6 font-medium">تاريخ الحركة</th>
                <th className="py-4 px-6 font-medium">عنوان الحركة</th>
                <th className="py-4 px-6 font-medium">المنفذ</th>
                <th className="py-4 px-6 font-medium">الوصف</th>
                <th className="py-4 px-6 font-medium">اسم الجهاز</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <History size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد سجلات للعرض
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec?.Id || Math.random()} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-gray-500">{rec?.Id}</td>
                    <td className="py-4 px-6 text-slate-600"><DateText value={rec?.CreatedDate} showTime /></td>
                    <td className="py-4 px-6 font-bold text-slate-800">{rec?.Title}</td>
                    <td className="py-4 px-6 font-medium text-slate-700">{rec?.UserFullName}</td>
                    <td className="py-4 px-6 text-slate-600 max-w-[300px] truncate" title={rec?.Description}>{rec?.Description}</td>
                    <td className="py-4 px-6 text-gray-400 text-xs font-mono">{rec?.DeviceName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            الصفحة <span className="font-medium text-slate-900">{meta.page}</span> من <span className="font-medium text-slate-900">{meta.totalPages || 1}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              السابق
            </button>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages || meta.totalPages === 0 || isLoading}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemRecordsList;
