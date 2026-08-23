import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowRight, User, Upload, FileText, Trash2, Download, Loader2, Edit3, Briefcase, Calendar, Clock, CheckCircle2, Search, X, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmployeeService from '../../services/employeeService';
import apiClient from '../../services/apiClient';
import { DateText } from '../../utils/formatDate';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [activeTab, setActiveTab] = useState('profile');
  
  // --- Profile Summary (SWR) ---
  const { data: summaryData, error: summaryError, isLoading: isSummaryLoading } = useSWR(
    id ? `/employees/${id}/summary` : null,
    fetcher
  );
  const employee = summaryData?.data || null;
  
  // --- Leaves State (Conditional SWR — lazy loaded on tab switch) ---
  const { data: leavesData, isLoading: isLeavesLoading } = useSWR(
    id && activeTab === 'leaves' ? `/employee-states?employeeId=${id}` : null,
    fetcher
  );
  const leaves = leavesData?.data || [];
  
  // --- Files State (Conditional SWR — lazy loaded on tab switch) ---
  const { data: filesData, isLoading: isFilesLoading, mutate: mutateFiles } = useSWR(
    id && activeTab === 'documents' ? `/employees/${id}/files` : null,
    fetcher
  );
  const files = filesData?.data || [];
  
  // --- Upload State (Batch Upload) ---
  const [isUploading, setIsUploading] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const initialUploadForm = { DocumentName: '', Category: 'ملف التوظيف', DocumentDate: new Date().toISOString().split('T')[0] };
  const [uploadForm, setUploadForm] = useState(initialUploadForm);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // --- Bulk Delete State ---
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // --- Edit File State ---
  const [editingFile, setEditingFile] = useState(null);
  const [editFileSelected, setEditFileSelected] = useState(null);
  const [isEditUploading, setIsEditUploading] = useState(false);

  const handleUploadChange = (e) => {
    const { name, value } = e.target;
    setUploadForm(prev => ({ ...prev, [name]: value }));
  };

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const oversized = rawFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      alert(`الملفات التالية تتجاوز الحد المسموح (20 ميغابايت لكل ملف):\n${oversized.map(f => f.name).join('\n')}`);
    }

    const validFiles = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);

    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
      const newUnique = validFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
      const total = [...prev, ...newUnique];
      if (total.length > 15) {
        alert('الحد الأقصى لرفع الملفات دفعة واحدة هو 15 ملفاً.');
        return total.slice(0, 15);
      }
      return total;
    });

    e.target.value = '';
  };

  const handleRemoveStagedFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return alert('يرجى اختيار ملف واحد على الأقل للرفع');
    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('Category', uploadForm.Category);
      
      await EmployeeService.uploadFile(id, formData);
      
      setUploadForm(initialUploadForm);
      setSelectedFiles([]);
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';
      
      // Revalidate the files SWR cache
      mutateFiles();
    } catch (err) {
      alert(err.response?.data?.message || 'فشل رفع الملفات');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditFileClick = (file) => {
    setEditingFile({
      ...file,
      Id: file?.Id || file?.id,
      DocumentName: file?.DocumentName || file?.documentName || '',
      Category: file?.Category || file?.category || 'ملف التوظيف',
      DocumentDate: file?.DocumentDate || file?.documentDate ? new Date(file.DocumentDate || file.documentDate).toISOString().split('T')[0] : ''
    });
    setEditFileSelected(null);
  };

  const handleEditFileSubmit = async (e) => {
    e.preventDefault();
    setIsEditUploading(true);
    try {
      const formData = new FormData();
      if (editFileSelected) formData.append('file', editFileSelected);
      
      const docName = editingFile?.DocumentName || editingFile?.documentName || '';
      const docCategory = editingFile?.Category || editingFile?.category || '';
      const docDate = editingFile?.DocumentDate || editingFile?.documentDate || '';
      
      formData.append('DocumentName', docName);
      formData.append('Category', docCategory);
      formData.append('DocumentDate', docDate);
      
      await EmployeeService.updateFile(id, editingFile?.Id || editingFile?.id, formData);
      
      setEditingFile(null);
      setEditFileSelected(null);
      mutateFiles();
    } catch (err) {
      alert(err.response?.data?.message || 'فشل تعديل الملف');
    } finally {
      setIsEditUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) {
      try {
        await EmployeeService.deleteFile(id, fileId);
        mutateFiles();
      } catch (err) {
        alert('فشل في حذف الملف');
      }
    }
  };

  // --- Bulk Delete Handlers ---
  const toggleDocSelection = (docId) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(d => d !== docId) : [...prev, docId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.length === filteredFiles.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredFiles.map(f => f.Id));
    }
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setIsBulkDeleting(true);
    try {
      await EmployeeService.bulkDeleteFiles(id, selectedDocIds);
      setSelectedDocIds([]);
      mutateFiles();
    } catch (err) {
      alert(err.response?.data?.message || 'فشل في حذف الملفات المحددة');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDownloadFile = async (docId, fileName) => {
    try {
      const response = await EmployeeService.downloadFile(docId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('فشل في تحميل الملف');
    }
  };


  
  const getLeaveStatusPill = (leave) => {
    if (leave.IsResumed) {
      return <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">مستأنف</span>;
    }
    const end = new Date(leave.EndDate);
    if (end < new Date()) {
      return <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">منتهي</span>;
    }
    return <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">ساري</span>;
  };

  if (isSummaryLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={48} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (summaryError || !employee) {
    return (
      <div className="p-8">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-slate-900 mb-6 font-medium text-sm">
          <ArrowRight size={18} className="ml-2" /> العودة للقائمة
        </button>
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-medium">
          {summaryError?.message || 'الموظف غير موجود'}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'الملف التعريفي' },
    { id: 'leaves', label: 'الإجازات' },
    { id: 'documents', label: 'المستندات' }
  ];

  const filteredFiles = files.filter(f => 
    (f.DocumentName || '').toLowerCase().includes(fileSearchTerm.toLowerCase()) || 
    (f.Category || '').toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full font-sans max-w-[1000px] mx-auto text-slate-800" dir="rtl">
      
      {/* Top Navigation for Profile */}
      <div className="flex justify-between items-center mb-6 pt-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowRight size={20} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8 overflow-x-auto custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap relative ${
                activeTab === tab.id 
                  ? 'text-emerald-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Card — Single canonical name display */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center mb-6 shadow-sm">
        <div className="w-24 h-24 rounded-full border-4 border-emerald-50 bg-slate-50 overflow-hidden shadow-sm mb-4">
          {employee.ProfileImagePath ? (
            <img src={`http://localhost:5000${employee.ProfileImagePath}`} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <User size={32} className="text-gray-400" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-800">{employee.Name} {employee.LastName}</h2>
        <p className="text-sm font-medium text-gray-500 mt-1">{employee.JobTitle?.RankName || 'موظف'} • {employee.Department || 'الإدارة العامة'}</p>
      </div>

      {/* Tab Contents */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Personal Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 relative shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800">
              <User size={20} className="text-emerald-600" />
              البيانات الشخصية
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الاسم</span>
                <span className="block font-semibold text-slate-800">{employee.Name} {employee.LastName}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الجنس</span>
                <span className="block font-semibold text-slate-800">{employee.Gender || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">رقم التواصل</span>
                <span className="block font-semibold text-slate-800" dir="ltr">{employee.PhoneNumber || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">البريد الإلكتروني</span>
                <span className="block font-semibold text-slate-800" dir="ltr">{employee.Email || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ الميلاد</span>
                <span className="block font-semibold text-slate-800"><DateText value={employee.DateOfBirth} /></span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">العنوان</span>
                <span className="block font-semibold text-slate-800">{employee.Province}</span>
              </div>
            </div>
          </div>

          {/* Job Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 relative shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800">
              <Briefcase size={20} className="text-emerald-600" />
              البيانات الوظيفية
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الرقم الوظيفي</span>
                <span className="block font-semibold text-slate-800">{employee.Id}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">التعيين الوظيفي</span>
                <span className="block font-semibold text-slate-800">{employee.JobTitle?.RankName || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ التوظيف</span>
                <span className="block font-semibold text-slate-800"><DateText value={employee.InstallationDate} /></span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الحالة الوظيفية</span>
                <span className="block font-semibold text-emerald-600">{employee.EmployeeStatus || 'نشط'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
             <h3 className="text-lg font-bold text-slate-800">سجل الإجازات والحالات</h3>
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-right border-collapse whitespace-nowrap">
              <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="py-4 px-6 font-medium">النوع / السبب</th>
                  <th className="py-4 px-6 font-medium">تاريخ الخروج</th>
                  <th className="py-4 px-6 font-medium">تاريخ الاستئناف</th>
                  <th className="py-4 px-6 font-medium">المدة (أيام)</th>
                  <th className="py-4 px-6 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
                {isLeavesLoading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400">
                      <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                      جاري تحميل البيانات...
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400">
                      <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                      لا توجد سجلات إجازات لهذا الموظف
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.Id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-800">{leave.StateTypeOrReason}</td>
                      <td className="py-4 px-6 text-gray-600"><DateText value={leave.StartDate} /></td>
                      <td className="py-4 px-6 text-gray-600"><DateText value={leave.EndDate} /></td>
                      <td className="py-4 px-6 font-medium text-slate-700">{leave.DaysCount}</td>
                      <td className="py-4 px-6">{getLeaveStatusPill(leave)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6">
          
          {/* Top Info Stat for Documents */}
          <div className="flex justify-between items-center bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-slate-800">مستندات الموظف</h3>
              <p className="text-sm text-gray-500 mt-1">إدارة وتحميل المستندات الخاصة بالموظف</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-w-[120px] bg-slate-50">
              <div className="flex items-center gap-2 text-slate-800 mb-1">
                <span className="text-2xl font-bold">{files.length}</span>
                <FileText size={20} className="text-emerald-500" />
              </div>
              <span className="text-xs font-medium text-gray-500">عدد الملفات</span>
            </div>
          </div>
          
          {/* Upload Form */}
          {hasPermission('checkBoxEdit') && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                <Upload size={20} className="text-emerald-500" /> رفع مستند جديد
              </h3>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
                    <select
                      name="Category"
                      value={uploadForm.Category}
                      onChange={handleUploadChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white"
                    >
                      <option value="ملف التوظيف">ملف التوظيف</option>
                      <optgroup label="الحركة في المناصب المالية">
                        <option value="الترقية في الدرجة">الترقية في الدرجة</option>
                        <option value="الترقية في الرتب">الترقية في الرتب</option>
                      </optgroup>
                      <optgroup label="الحركة في المناصب المالية (المناصب العليا/الوظائف العليا)">
                        <option value="المناصب العليا">المناصب العليا</option>
                        <option value="الوظائف العليا">الوظائف العليا</option>
                      </optgroup>
                      <option value="الحركة الداخلية">الحركة الداخلية</option>
                      <option value="التنقلات الخارجية">التنقلات الخارجية</option>
                      <optgroup label="الوضعيات الخاصة">
                        <option value="الخدمة الوطنية">الخدمة الوطنية</option>
                        <option value="الاحالات على الاستيداع">الاحالات على الاستيداع</option>
                        <option value="الانتداب">الانتداب</option>
                        <option value="توقيف">توقيف</option>
                      </optgroup>
                      <option value="العطل">العطل</option>
                      <option value="العقوبات الادارية">العقوبات الادارية</option>
                      <option value="التقييم التكوين و الرسكلة">التقييم التكوين و الرسكلة</option>
                      <option value="السوابق المهنية">السوابق المهنية</option>
                      <option value="المنح و علاوات">المنح و علاوات</option>
                      <option value="مرسلات و منوعات">مرسلات و منوعات</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex-1">
                      <input
                        type="file"
                        id="fileInput"
                        multiple
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500 file:mr-0 file:ml-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-colors cursor-pointer border border-slate-200 rounded-lg p-1 bg-slate-50/50"
                      />
                      <p className="text-xs text-slate-400 mt-1">يمكنك اختيار عدة ملفات معاً (بحد أقصى 15 ملفاً، و20 ميغابايت لكل ملف).</p>
                    </div>
                    <button
                      type="submit"
                      disabled={isUploading || selectedFiles.length === 0}
                      className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:cursor-not-allowed shadow-2xs h-fit self-end sm:self-center"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جاري الرفع ({selectedFiles.length})...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span>{selectedFiles.length > 1 ? `رفع ${selectedFiles.length} ملفات` : 'رفع المستندات'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Selected Files Staging Area */}
                  {selectedFiles.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          الملفات المحددة للرفع ({selectedFiles.length} {selectedFiles.length === 1 ? 'ملف' : 'ملفات'}):
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles([])}
                          className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                        >
                          إلغاء تحديد الكل
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {selectedFiles.map((f, idx) => (
                          <div
                            key={`${f.name}-${idx}`}
                            className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText size={14} className="text-emerald-600 shrink-0" />
                              <span className="truncate font-medium text-slate-700" title={f.name}>{f.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{formatFileSize(f.size)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveStagedFile(idx)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                title="إزالة"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Files List */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6 gap-4">
              {/* Bulk Actions */}
              <div className="flex items-center gap-3">
                {hasPermission('checkBoxDelete') && filteredFiles.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      selectedDocIds.length === filteredFiles.length && filteredFiles.length > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <CheckSquare size={16} />
                    {selectedDocIds.length === filteredFiles.length && filteredFiles.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                  </button>
                )}
                {selectedDocIds.length > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={isBulkDeleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isBulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    حذف المحدد ({selectedDocIds.length})
                  </button>
                )}
              </div>

              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="بحث في المستندات..."
                  value={fileSearchTerm}
                  onChange={(e) => setFileSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none text-sm"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              </div>
            </div>

            {isFilesLoading ? (
              <div className="text-center py-12 text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                جاري تحميل المستندات...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                <p>لا توجد مستندات مسجلة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.Id}
                    className={`border rounded-xl p-4 flex flex-col transition-all hover:shadow-sm cursor-default ${
                      selectedDocIds.includes(file.Id)
                        ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        {hasPermission('checkBoxDelete') && (
                          <label className="flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={selectedDocIds.includes(file.Id)}
                              onChange={() => toggleDocSelection(file.Id)}
                              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                            />
                          </label>
                        )}
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-sm text-slate-800 truncate" title={file.DocumentName}>{file.DocumentName}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{file.Category}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200">
                      <DateText value={file.DocumentDate} className="text-xs font-mono text-gray-400" />
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleDownloadFile(file.Id, file.FileName || file.DocumentName)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="تحميل"
                        >
                          <Download size={16} />
                        </button>
                        {hasPermission('checkBoxEdit') && (
                          <button 
                            onClick={() => handleEditFileClick(file)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="تعديل"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                        {hasPermission('checkBoxDelete') && (
                          <button 
                            onClick={() => handleDeleteFile(file.Id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">تأكيد الحذف المتعدد</h3>
              <p className="text-sm text-gray-600 mb-6">
                هل أنت متأكد من حذف <span className="font-bold text-red-600">{selectedDocIds.length}</span> ملفات نهائيا؟
                <br />
                <span className="text-xs text-gray-400">لا يمكن التراجع عن هذا الإجراء</span>
              </p>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  حذف {selectedDocIds.length} ملفات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit File Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">تعديل المستند</h2>
              <button onClick={() => setEditingFile(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleEditFileSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستند</label>
                  <input
                    type="text"
                    value={editingFile?.DocumentName || editingFile?.documentName || ''}
                    onChange={(e) => setEditingFile({...editingFile, DocumentName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={editingFile?.Category || editingFile?.category || ''}
                    onChange={(e) => setEditingFile({...editingFile, Category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm bg-white"
                  >
                      <option value="ملف التوظيف">ملف التوظيف</option>
                      <optgroup label="الحركة في المناصب المالية">
                        <option value="الترقية في الدرجة">الترقية في الدرجة</option>
                        <option value="الترقية في الرتب">الترقية في الرتب</option>
                      </optgroup>
                      <optgroup label="الحركة في المناصب المالية (المناصب العليا/الوظائف العليا)">
                        <option value="المناصب العليا">المناصب العليا</option>
                        <option value="الوظائف العليا">الوظائف العليا</option>
                      </optgroup>
                      <option value="الحركة الداخلية">الحركة الداخلية</option>
                      <option value="التنقلات الخارجية">التنقلات الخارجية</option>
                      <optgroup label="الوضعيات الخاصة">
                        <option value="الخدمة الوطنية">الخدمة الوطنية</option>
                        <option value="الاحالات على الاستيداع">الاحالات على الاستيداع</option>
                        <option value="الانتداب">الانتداب</option>
                        <option value="توقيف">توقيف</option>
                      </optgroup>
                      <option value="العطل">العطل</option>
                      <option value="العقوبات الادارية">العقوبات الادارية</option>
                      <option value="التقييم التكوين و الرسكلة">التقييم التكوين و الرسكلة</option>
                      <option value="السوابق المهنية">السوابق المهنية</option>
                      <option value="المنح و علاوات">المنح و علاوات</option>
                      <option value="مرسلات و منوعات">مرسلات و منوعات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ المستند</label>
                  <input
                    type="date"
                    value={editingFile?.DocumentDate || editingFile?.documentDate || ''}
                    onChange={(e) => setEditingFile({...editingFile, DocumentDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">استبدال الملف (اختياري)</label>
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f && f.size > MAX_FILE_SIZE) {
                        alert('حجم الملف يتجاوز الحد المسموح (20 ميغابايت).');
                        e.target.value = '';
                        setEditFileSelected(null);
                        return;
                      }
                      setEditFileSelected(f);
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setEditingFile(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button type="submit" disabled={isEditUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                    {isEditUploading ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16} />}
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmployeeProfile;
