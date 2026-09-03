import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import EmployeeService from '../../services/employeeService';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import EmployeeModal from './EmployeeModal';
import { Search, MoreVertical, Loader2, Users, ArrowUpDown, ChevronDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';

const fetcher = async ([url, page, limit, search, province, directorate, fileStatus]) => {
  const result = await EmployeeService.getAll(page, limit, search, province, directorate, fileStatus);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

const HeaderCell = ({ label }) => (
  <th className="py-4 px-4 font-medium text-gray-500 whitespace-nowrap bg-white border-b border-gray-100">
    <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors">
      {label}
      <ArrowUpDown size={12} className="text-gray-300" />
    </div>
  </th>
);

const EmployeesList = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Generic Confirm Modal State ---
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null });
  
  // Pagination & Search state — initialized from URL
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [fileStatusFilter, setFileStatusFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  const allowedProvinces = getAllowedProvinces(useAuth().user);

  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  const { data, error, isLoading, mutate } = useSWR(
    ['/api/employees', page, limit, search, provinceFilter, directorateFilter, fileStatusFilter],
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const employees = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 0 };
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Debounced search — syncs with URL query params
  const debounceRef = useRef(null);
  const debouncedSearch = useCallback((value) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      setSearch(trimmed);
      setPage(1);
      // Sync search to URL for state retention
      if (trimmed) {
        setSearchParams({ search: trimmed }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 500);
  }, [setSearchParams]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // --- Handlers ---
  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await EmployeeService.exportToExcel();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Employees.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('فشل تصدير البيانات إلى Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAdd = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    mutate();
  };

  const handleDelete = (id) => {
    showConfirm('حذف الموظف', 'هل أنت متأكد من حذف هذا الموظف؟', async () => {
      closeConfirm();
      try {
        await EmployeeService.delete(id);
        mutate();
      } catch (err) {
        toast.error('فشل الحذف');
      }
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.action-dropdown-container')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-red-600 bg-red-50 rounded-xl m-6 border border-red-200">
        <div className="text-center">
          <p className="font-bold mb-2">حدث خطأ أثناء تحميل البيانات</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }




  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      
      {/* Secondary Toolbar (Matching Mockup) */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-3 rounded-xl border border-gray-200">
        
        {/* Right side: Dropdowns & Search */}
        <div className="flex items-center gap-3">
          <select 
            value={provinceFilter}
            onChange={(e) => { setProvinceFilter(e.target.value); setDirectorateFilter(''); setPage(1); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none"
          >
            <option value="">الولاية: الكل</option>
            {allowedProvinces.map(prov => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>
          <ChevronDown size={14} className="-mr-6 text-gray-500 pointer-events-none" />
          
          <div className="h-4 w-px bg-gray-200 ml-2"></div>

          <select 
            value={directorateFilter}
            onChange={(e) => { setDirectorateFilter(e.target.value); setPage(1); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none"
          >
            <option value="">الجهة: الكل</option>
            {provinceFilter === 'الشلف' && (
              <option value="المديرية الجهوية للأملاك الوطنية" className="font-bold text-emerald-700 bg-emerald-50">المديرية الجهوية للأملاك الوطنية</option>
            )}
            <option value="مديرية أملاك الدولة" className="font-bold">مديرية أملاك الدولة</option>
            {availableMofatishiyat.map(item => (
              <option key={item} value={item}>-- {item}</option>
            ))}
            <option value="مديرية مسح الأراضي والحفظ العقاري" className="font-bold">مديرية مسح الأراضي</option>
            {availableMohafathat.map(item => (
              <option key={item} value={item}>-- {item}</option>
            ))}
          </select>
          <ChevronDown size={14} className="-mr-6 text-gray-500 pointer-events-none" />
          
          <div className="h-4 w-px bg-gray-200 ml-2"></div>

          <select 
            value={fileStatusFilter}
            onChange={(e) => { setFileStatusFilter(e.target.value); setPage(1); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none"
          >
            <option value="">حالة الملف: الكل</option>
            <option value="complete">مكتمل</option>
            <option value="incomplete">ناقص</option>
          </select>
          <ChevronDown size={14} className="-mr-6 text-gray-500 pointer-events-none" />
          
          <div className="h-4 w-px bg-gray-200 ml-2"></div>

          <div className="relative w-64">
            <input
              type="text"
              placeholder="ابدأ الكتابة للبحث..."
              defaultValue={searchParams.get('search') || ''}
              onChange={handleSearchChange}
              className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm text-slate-700 focus:ring-1 focus:ring-gray-200"
            />
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Left side: Add Button & Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-emerald-600 transition-colors font-medium shadow-sm text-sm disabled:opacity-50"
          >
            {isExporting ? <span className="animate-spin text-emerald-600 px-1">⟳</span> : <Download size={16} />}
            تصدير إلى Excel
          </button>

          {hasPermission('checkBoxAdd') && (
            <button
              onClick={handleAdd}
              className="flex items-center justify-center gap-1.5 px-5 py-2 text-white rounded-lg transition-colors font-medium shadow-sm text-sm"
              style={{ backgroundColor: '#10b981' }} // Emerald-500
            >
              إضافة موظف
            </button>
          )}

          {/* Stats Badge */}
          {meta.total > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-medium text-emerald-800">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold">{meta.totalCompletedFiles || 0}</span>
              <span>ملف مكتمل من أصل <strong>{meta.total}</strong> موظفاً</span>
            </div>
          )}
        </div>
      </div>



      {/* DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <HeaderCell label="الرقم الوظيفي" />
                <HeaderCell label="الاسم" />
                <HeaderCell label="الولاية" />
                <HeaderCell label="الحالة" />
                <HeaderCell label="الملف" />
                <th className="py-4 px-4 font-medium text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 text-center">الإجراء</th>
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
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Users size={32} className="mx-auto text-gray-300 mb-2" />
                    لا يوجد موظفين لعرضهم
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.Id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{emp.Id}</td>
                    
                    {/* Name */}
                    <td className="py-3 px-4">
                      <Link to={`/employees/${emp.Id}`} className="font-bold text-slate-800 hover:text-emerald-600 transition-colors">
                        {emp.Name} {emp.LastName}
                      </Link>
                    </td>

                    <td className="py-3 px-4 text-slate-700">{emp.Province}</td>
                    
                    {/* Status */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${emp.EmployeeStatus === 'مثبت' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                        <span className="font-medium text-slate-700">{emp.EmployeeStatus || 'نشط'}</span>
                      </div>
                    </td>

                    {/* Profile Completion */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          emp.IsProfileComplete
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            emp.IsProfileComplete ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        ></span>
                        {emp.IsProfileComplete ? 'مكتمل' : 'ناقص'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <div className="relative inline-block text-right action-dropdown-container">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === emp.Id ? null : emp.Id); }}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {openDropdownId === emp.Id && (
                          <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div className="py-1" role="menu">
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.Id}`); setOpenDropdownId(null); }}
                                className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                عرض الملف الشخصي
                              </button>
                              {hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setIsModalOpen(true); setOpenDropdownId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  تعديل
                                </button>
                              )}
                              {hasPermission('checkBoxDelete') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(emp.Id); setOpenDropdownId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  حذف
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
        <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages || meta.totalPages === 0}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              التالي
            </button>
            <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm">
              {meta.page}
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              السابق
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {employees.length} من أصل {meta.total} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select 
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white text-slate-800"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            مدخلات
          </div>
        </div>
      </div>

      <EmployeeModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={selectedEmployee}
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

export default EmployeesList;
