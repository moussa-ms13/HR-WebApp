import React, { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import JobTitlesService from '../../services/jobTitlesService';
import JobModal from './JobModal';
import { Plus, Search, Edit2, Trash2, Loader2, Briefcase, MoreVertical } from 'lucide-react';

const fetcher = async ([url, page, limit, search]) => {
  const result = await JobTitlesService.getAll(page, limit, search);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

const JobsList = () => {
  const { hasPermission } = useAuth();
  
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  
  const { data, error, isLoading, mutate } = useSWR(
    ['/api/job-titles', page, limit, search],
    fetcher,
    { revalidateOnFocus: false }
  );

  const jobs = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 0 };
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const handleAdd = () => {
    setSelectedJob(null);
    setIsModalOpen(true);
  };

  const handleEdit = (job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الرتبة؟')) {
      try {
        await JobTitlesService.delete(id);
        mutate();
      } catch (err) {
        alert(err.response?.data?.message || 'فشل الحذف');
      }
    }
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    mutate();
  };

  return (
    <div className="flex flex-col h-full font-sans" dir="rtl">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة الوظائف والرتب</h1>
          <p className="text-sm text-slate-500 mt-1">تسيير وتصنيف الرتب في المؤسسة (إجمالي: {meta.total})</p>
        </div>
        
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="بحث باسم الرتبة..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none text-sm"
              style={{ focusRingColor: '#0a7e50' }}
            />
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          </div>
          
          {hasPermission('checkBoxAdd') && (
            <button
              onClick={handleAdd}
              className="flex items-center justify-center px-4 py-2 text-white rounded-lg transition shadow-sm text-sm font-medium shrink-0"
              style={{ backgroundColor: '#105b38' }}
            >
              <Plus size={18} className="ml-1" />
              رتبة جديدة
            </button>
          )}
        </div>
      </div>



      {/* DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex-1 flex flex-col mt-4">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-6 font-medium">المعرف</th>
                <th className="py-4 px-6 font-medium">صنف التوظيف</th>
                <th className="py-4 px-6 font-medium">اسم الرتبة</th>
                <th className="py-4 px-6 font-medium">الصنف</th>
                <th className="py-4 px-6 font-medium">الرقم الاستدلالي</th>
                <th className="py-4 px-6 font-medium text-center">الإجراء</th>
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
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد سجلات لعرضها
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-gray-500">{job.Id}</td>
                    <td className="py-4 px-6 font-medium text-slate-700">{job.EmploymentCategory}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{job.RankName}</td>
                    <td className="py-4 px-6">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                        {job.CategoryLevel || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-gray-500">{job.IndexNumber}</td>
                    <td className="py-4 px-6 text-center">
                      <div className="relative inline-block text-right">
                        <button 
                          onClick={() => setMenuOpenId(menuOpenId === job.Id ? null : job.Id)}
                          className="p-2 text-gray-400 hover:text-emerald-600 rounded-full transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {menuOpenId === job.Id && (
                          <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div className="py-1" role="menu">
                              {hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={() => { handleEdit(job); setMenuOpenId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit2 size={16} className="text-blue-500" /> تعديل الرتبة
                                </button>
                              )}
                              {hasPermission('checkBoxDelete') && (
                                <button
                                  onClick={() => { handleDelete(job.Id); setMenuOpenId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 size={16} className="text-red-500" /> حذف الرتبة
                                </button>
                              )}
                            </div>
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

      <JobModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        job={selectedJob}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default JobsList;
