import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import SystemRecordsService from '../../services/systemRecordsService';
import { 
  Search, Loader2, FileSpreadsheet, History, 
  ChevronDown, ChevronRight, ChevronLeft, ArrowUpDown 
} from 'lucide-react';
import { DateText, formatDateTime } from '../../utils/formatDate';
import { formatEmployeeName } from '../../utils/employeeUtils';
import * as XLSX from 'xlsx';

const fetcher = async ([url, page, limit, search, action, sortBy, sortOrder]) => {
  const result = await SystemRecordsService.getAll(page, limit, search, action, sortBy, sortOrder);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

const HeaderCell = ({ 
  label, 
  sortKey = null, 
  currentSort = '', 
  onSort = null, 
  align = 'right', 
  className = '' 
}) => {
  const isSorted = sortKey && currentSort === sortKey;
  return (
    <th 
      onClick={() => sortKey && onSort?.(sortKey)}
      className={`py-4 px-4 font-medium text-sm text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 select-none ${
        sortKey ? 'cursor-pointer hover:bg-slate-50/80 hover:text-slate-800 group transition-colors' : ''
      } ${align === 'center' ? 'text-center' : ''} ${className}`}
    >
      <div className={`flex items-center gap-1.5 transition-colors ${align === 'center' ? 'justify-center' : ''}`}>
        <span className={isSorted ? 'text-slate-900 font-semibold' : ''}>{label}</span>
        {sortKey && (
          <ArrowUpDown 
            size={12} 
            className={`transition-colors ${
              isSorted 
                ? 'text-[#10B981] font-bold' 
                : 'text-gray-300 group-hover:text-gray-500'
            }`} 
          />
        )}
      </div>
    </th>
  );
};

const SystemRecordsList = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('CreatedDate');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const { data, error, isLoading } = useSWR(
    ['/api/system-records', page, limit, search, actionFilter, sortBy, sortOrder],
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const rawData = data?.data;
  const records = Array.isArray(rawData) ? rawData : (rawData?.records || data?.records || []);
  const meta = data?.meta || { total: rawData?.total || data?.total || 0, totalPages: rawData?.totalPages || data?.totalPages || 0 };
  
  // Debounced search: 400ms timeout
  const debounceRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val.trim());
      setPage(1);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleActionChange = (e) => {
    setActionFilter(e.target.value);
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'CreatedDate' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleExportExcel = () => {
    const exportData = records.map((rec) => ({
      'المعرف': rec?.Id || '-',
      'عنوان الحركة': rec?.Title || '-',
      'الموظف المعني': formatEmployeeName(rec?.Employee, '-'),
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

  const totalPages = meta.totalPages || Math.ceil((meta.total || 0) / limit) || 1;

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      
      {/* Top Filter & Action Bar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Right side: Action Type Filter & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <select
              id="records-filter-action"
              aria-label="نوع الحركة"
              value={actionFilter}
              onChange={handleActionChange}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none pl-7"
            >
              <option value="">نوع الحركة: الكل</option>
              <option value="إضافة">إضافة</option>
              <option value="تعديل">تعديل</option>
              <option value="حذف">حذف</option>
              <option value="تسجيل">تسجيل دخول / خروج</option>
              <option value="إنهاء">إنهاء / تسوية</option>
              <option value="تصدير">تصدير / طباعة</option>
            </select>
            <ChevronDown size={14} className="absolute left-2 text-gray-500 pointer-events-none" />
          </div>

          <div className="h-4 w-px bg-gray-200 ml-2" />

          <div className="relative w-64 sm:w-80">
            <input
              type="text"
              id="records-search-input"
              placeholder="البحث بالاسم، الحركة، أو الجهاز..."
              value={searchInput}
              onChange={handleSearchChange}
              className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm text-slate-700 focus:ring-1 focus:ring-gray-200"
            />
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Left side: Export Excel Action */}
        <div className="flex items-center gap-3">
          <button
            id="records-export-button"
            type="button"
            onClick={handleExportExcel}
            disabled={records.length === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-xl transition-all font-semibold shadow-xs text-xs sm:text-sm hover:shadow-md active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-[#10B981] hover:bg-[#059669]"
          >
            <FileSpreadsheet size={16} />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Standalone Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col relative">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <HeaderCell label="المعرف" sortKey="Id" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="تاريخ الحركة" sortKey="CreatedDate" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="عنوان الحركة" sortKey="Title" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="الموظف المعني" sortKey="Employee" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="المنفذ" sortKey="UserFullName" currentSort={sortBy} onSort={handleSort} />
                <th className="py-4 px-4 font-medium text-sm text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 select-none">
                  الوصف
                </th>
                <HeaderCell label="اسم الجهاز" sortKey="DeviceName" currentSort={sortBy} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <History size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد سجلات مطابقة للعرض
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec?.Id || Math.random()} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{rec?.Id}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      <DateText value={rec?.CreatedDate} showTime />
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{rec?.Title}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {rec?.Employee ? (
                        <Link 
                          to={`/employees/${rec.Employee.Id}`} 
                          className="hover:text-emerald-600 font-bold transition-colors"
                        >
                          {formatEmployeeName(rec.Employee)}
                        </Link>
                      ) : (
                        <span className="text-gray-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{rec?.UserFullName || '—'}</td>
                    <td 
                      className="py-3 px-4 text-slate-600 max-w-[280px] truncate text-xs" 
                      title={rec?.Description}
                    >
                      {rec?.Description || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs font-mono" dir="ltr">
                      {rec?.DeviceName || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Unified Bottom Pagination Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {/* RTL order: السابق (right) → Page (middle) → التالي (left) */}
          <div className="flex gap-2">
            <button
              id="records-prev-page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <ChevronRight size={15} />
              السابق
            </button>
            <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm">
              {page}
            </button>
            <button
              id="records-next-page"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0 || isLoading}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              التالي
              <ChevronLeft size={15} />
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {records.length} من أصل {meta.total || 0} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select 
              id="records-limit-select"
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white text-slate-800 cursor-pointer text-xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            مدخلات
          </div>
        </div>
      </div>

    </div>
  );
};

export default SystemRecordsList;
