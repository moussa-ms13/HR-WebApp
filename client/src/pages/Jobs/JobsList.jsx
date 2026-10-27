import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import JobTitlesService from '../../services/jobTitlesService';
import JobModal from './JobModal';
import { 
  Plus, Search, Edit2, Trash2, Loader2, Briefcase, MoreVertical, 
  ChevronDown, ChevronRight, ChevronLeft, ArrowUpDown 
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { refreshJobTitles } from '../../utils/cacheManager';

const fetcher = async () => {
  const result = await JobTitlesService.getAll(1, 500, '', { forceRefresh: true });
  if (!result.success && !Array.isArray(result.data)) throw new Error("Failed to fetch");
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
      className={`py-4 px-5 font-semibold text-xs sm:text-sm text-slate-700 whitespace-nowrap bg-slate-50/70 border-b border-slate-100 select-none ${
        sortKey ? 'cursor-pointer hover:text-slate-900 group' : ''
      } ${align === 'center' ? 'text-center' : ''} ${className}`}
    >
      <div className={`flex items-center gap-1.5 transition-colors ${align === 'center' ? 'justify-center' : ''}`}>
        <span>{label}</span>
        {sortKey && (
          <ArrowUpDown 
            size={12} 
            className={`transition-colors ${
              isSorted 
                ? 'text-emerald-600 font-bold' 
                : 'text-gray-300 group-hover:text-gray-500'
            }`} 
          />
        )}
      </div>
    </th>
  );
};

const JobsList = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();

  // --- Confirm Modal State ---
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null });
  
  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('Id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Modal & Menu states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Close action menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const { data, error, isLoading, mutate } = useSWR(
    '/api/job-titles-all',
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const rawJobs = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.records)) return data.records;
    return [];
  }, [data]);

  // Distinct employment categories
  const categories = useMemo(() => {
    const defaults = ['اسلاك مشتركة', 'أسلاك تقنية (خاصة)', 'متعاقدون بدوام كلي', 'متعاقدون بدوام جزئي'];
    const fromData = rawJobs.map(j => j.EmploymentCategory).filter(Boolean);
    return Array.from(new Set([...defaults, ...fromData]));
  }, [rawJobs]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredJobs = useMemo(() => {
    return rawJobs.filter(job => {
      if (categoryFilter && job.EmploymentCategory !== categoryFilter) return false;
      if (!searchInput.trim()) return true;
      const tokens = searchInput.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const rankName = (job.RankName || '').toLowerCase();
      const category = (job.EmploymentCategory || '').toLowerCase();
      const level = String(job.CategoryLevel || '').toLowerCase();
      const indexNum = String(job.IndexNumber || '').toLowerCase();
      return tokens.every(t => 
        rankName.includes(t) || category.includes(t) || level.includes(t) || indexNum.includes(t)
      );
    });
  }, [rawJobs, categoryFilter, searchInput]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      
      if (sortField === 'Id' || sortField === 'IndexNumber' || sortField === 'CategoryLevel') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB, 'ar') 
        : valB.localeCompare(valA, 'ar');
    });
  }, [filteredJobs, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedJobs.length / limit) || 1;
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedJobs.slice(start, start + limit);
  }, [sortedJobs, page, limit]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleCategoryChange = (e) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };

  const handleAdd = () => {
    setSelectedJob(null);
    setIsModalOpen(true);
  };

  const handleEdit = (job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    showConfirm('حذف الرتبة', 'هل أنت متأكد من حذف هذه الرتبة؟', async () => {
      closeConfirm();
      try {
        await JobTitlesService.delete(id);
        await refreshJobTitles();
        mutate();
        toast.success('تم حذف الرتبة بنجاح');
      } catch (err) {
        toast.error(err.response?.data?.message || 'فشل الحذف');
      }
    });
  };

  const handleModalSuccess = async () => {
    setIsModalOpen(false);
    await refreshJobTitles();
    mutate();
  };

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      
      {/* Top Filter & Action Bar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Right side: Employment Category Filter & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <select
              id="jobs-filter-category"
              aria-label="صنف التوظيف"
              value={categoryFilter}
              onChange={handleCategoryChange}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none pl-7"
            >
              <option value="">صنف التوظيف: الكل</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute left-2 text-gray-500 pointer-events-none" />
          </div>

          <div className="h-4 w-px bg-gray-200 ml-2" />

          <div className="relative w-64 sm:w-72">
            <input
              type="text"
              id="jobs-search-input"
              placeholder="البحث باسم الرتبة أو الصنف..."
              value={searchInput}
              onChange={handleSearchChange}
              className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm text-slate-700 focus:ring-1 focus:ring-gray-200"
            />
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Left side: Add Job Action */}
        <div className="flex items-center gap-3">
          {hasPermission('checkBoxAdd') && (
            <button
              id="jobs-add-button"
              type="button"
              onClick={handleAdd}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-xl transition-all font-semibold shadow-xs text-xs sm:text-sm hover:shadow-md active:scale-[0.97] cursor-pointer bg-[#10B981] hover:bg-[#059669]"
            >
              <Plus size={16} />
              <span>رتبة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Standalone Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/70 border-b border-slate-100">
              <tr>
                <HeaderCell label="المعرف" sortKey="Id" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="صنف التوظيف" sortKey="EmploymentCategory" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="اسم الرتبة" sortKey="RankName" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="الصنف" sortKey="CategoryLevel" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="الرقم الاستدلالي" sortKey="IndexNumber" currentSort={sortField} onSort={handleSort} />
                <th className="py-4 px-5 font-semibold text-xs sm:text-sm text-slate-700 whitespace-nowrap bg-slate-50/70 border-b border-slate-100 text-center select-none">
                  الإجراء
                </th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد سجلات مطابقة للعرض
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr key={job.Id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3.5 px-5 text-gray-500 font-mono text-xs">{job.Id}</td>
                    <td className="py-3.5 px-5 font-medium text-slate-700">{job.EmploymentCategory}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-800">{job.RankName}</td>
                    <td className="py-3.5 px-5">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                        {job.CategoryLevel || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-gray-600 text-xs">{job.IndexNumber}</td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="relative inline-block text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setMenuOpenId(menuOpenId === job.Id ? null : job.Id)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all cursor-pointer"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {menuOpenId === job.Id && (
                          <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black/5 z-50 py-1 font-sans">
                            {hasPermission('checkBoxEdit') && (
                              <button
                                onClick={() => { handleEdit(job); setMenuOpenId(null); }}
                                className="w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Edit2 size={14} className="text-gray-400" /> تعديل الرتبة
                              </button>
                            )}
                            {hasPermission('checkBoxDelete') && (
                              <button
                                onClick={() => { handleDelete(job.Id); setMenuOpenId(null); }}
                                className="w-full text-right px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-gray-100"
                              >
                                <Trash2 size={14} className="text-red-500" /> حذف الرتبة
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
              id="jobs-prev-page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <ChevronRight size={15} />
              السابق
            </button>
            <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm">
              {page}
            </button>
            <button
              id="jobs-next-page"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              التالي
              <ChevronLeft size={15} />
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {paginatedJobs.length} من أصل {sortedJobs.length} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select 
              id="jobs-limit-select"
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

      <JobModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        job={selectedJob}
        onSuccess={handleModalSuccess}
      />

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="حذف"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default JobsList;
