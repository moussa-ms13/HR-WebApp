import React, { useState } from 'react';
import useSWR from 'swr';
import apiClient from '../../../../services/apiClient';
import EmployeeService from '../../../../services/employeeService';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../components/ui/Toast';
import { DateText } from '../../../../utils/formatDate';
import { refreshEmployeeFiles, refreshEmployees } from '../../../../utils/cacheManager';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
  Edit3,
  Search,
  X,
  CheckSquare,
  Eye,
} from 'lucide-react';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const DocumentsTab = ({ employee, onRefresh, showConfirm, closeConfirm }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const id = employee?.Id;

  // --- Files State ---
  const {
    data: filesData,
    isLoading: isFilesLoading,
    mutate: mutateFiles,
  } = useSWR(id ? `/employees/${id}/files?limit=100` : null, fetcher, { keepPreviousData: true });
  const files = filesData?.data || [];
  const filesTotalCount = filesData?.pagination?.total ?? files.length;

  // --- Upload State (Batch Upload) ---
  const [isUploading, setIsUploading] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const initialUploadForm = {
    DocumentName: '',
    Category: 'ملف التوظيف',
    DocumentDate: new Date().toISOString().split('T')[0],
  };
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
  const [viewingFileId, setViewingFileId] = useState(null);

  const handleUploadChange = (e) => {
    const { name, value } = e.target;
    setUploadForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const oversized = rawFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast.warning(
        `الملفات التالية تتجاوز الحد المسموح (50 ميغابايت لكل ملف):\n${oversized.map((f) => f.name).join('\n')}`
      );
    }

    const validFiles = rawFiles.filter((f) => f.size <= MAX_FILE_SIZE);

    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newUnique = validFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      const total = [...prev, ...newUnique];
      if (total.length > 15) {
        toast.warning('الحد الأقصى لرفع الملفات دفعة واحدة هو 15 ملفاً.');
        return total.slice(0, 15);
      }
      return total;
    });

    e.target.value = '';
  };

  const handleRemoveStagedFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      toast.warning('يرجى اختيار ملف واحد على الأقل للرفع');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('Category', uploadForm.Category);

      await EmployeeService.uploadFile(id, formData);

      setUploadForm(initialUploadForm);
      setSelectedFiles([]);
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';

      await refreshEmployeeFiles(id);
      await refreshEmployees(id);
      mutateFiles();
      if (onRefresh) onRefresh();
      toast.success('تم رفع الملفات بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل رفع الملفات');
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
      DocumentDate:
        file?.DocumentDate || file?.documentDate
          ? new Date(file.DocumentDate || file.documentDate).toISOString().split('T')[0]
          : '',
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
      await refreshEmployeeFiles(id);
      await refreshEmployees(id);
      mutateFiles();
      if (onRefresh) onRefresh();
      toast.success('تم تعديل الملف بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تعديل الملف');
    } finally {
      setIsEditUploading(false);
    }
  };

  const handleDeleteFile = (fileId) => {
    showConfirm('حذف الملف', 'هل أنت متأكد من حذف هذا الملف نهائياً؟', async () => {
      closeConfirm();
      try {
        await EmployeeService.deleteFile(id, fileId);
        await refreshEmployeeFiles(id);
        await refreshEmployees(id);
        mutateFiles();
        if (onRefresh) onRefresh();
        toast.success('تم حذف الملف بنجاح');
      } catch (err) {
        toast.error('فشل في حذف الملف');
      }
    });
  };

  // --- Bulk Delete Handlers ---
  const toggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((d) => d !== docId) : [...prev, docId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.length === filteredFiles.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredFiles.map((f) => f.Id));
    }
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setIsBulkDeleting(true);
    try {
      await EmployeeService.bulkDeleteFiles(id, selectedDocIds);
      setSelectedDocIds([]);
      await refreshEmployeeFiles(id);
      await refreshEmployees(id);
      mutateFiles();
      if (onRefresh) onRefresh();
      toast.success('تم حذف الملفات المحددة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في حذف الملفات المحددة');
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
      toast.error('فشل في تحميل الملف');
    }
  };

  const handleViewFile = async (docId) => {
    if (viewingFileId) return;
    setViewingFileId(docId);
    try {
      const response = await EmployeeService.viewFile(docId);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (err) {
      toast.error('فشل في فتح الملف للعرض');
    } finally {
      setViewingFileId(null);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      (f.DocumentName || '').toLowerCase().includes(fileSearchTerm.toLowerCase()) ||
      (f.Category || '').toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Info Stat for Documents */}
      <div className="flex justify-between items-center bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-slate-800">مستندات الموظف</h3>
          <p className="text-sm text-gray-500 mt-1">إدارة وتحميل المستندات الخاصة بالموظف</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-w-[120px] bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 mb-1">
            <span className="text-2xl font-bold">{filesTotalCount}</span>
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
                  <p className="text-xs text-slate-400 mt-1">
                    يمكنك اختيار عدة ملفات معاً (بحد أقصى 15 ملفاً، و50 ميغابايت لكل ملف).
                  </p>
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
                      <span>
                        {selectedFiles.length > 1 ? `رفع ${selectedFiles.length} ملفات` : 'رفع المستندات'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Selected Files Staging Area */}
              {selectedFiles.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      الملفات المحددة للرفع ({selectedFiles.length}{' '}
                      {selectedFiles.length === 1 ? 'ملف' : 'ملفات'}):
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
                          <span className="truncate font-medium text-slate-700" title={f.name}>
                            {f.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                            {formatFileSize(f.size)}
                          </span>
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
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border cursor-pointer ${
                  selectedDocIds.length === filteredFiles.length && filteredFiles.length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <CheckSquare size={16} />
                {selectedDocIds.length === filteredFiles.length && filteredFiles.length > 0
                  ? 'إلغاء تحديد الكل'
                  : 'تحديد الكل'}
              </button>
            )}
            {selectedDocIds.length > 0 && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
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
                className={`border rounded-md p-3 relative bg-white overflow-hidden flex flex-col h-full w-full transition-all hover:shadow-sm cursor-default ${
                  selectedDocIds.includes(file.Id)
                    ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200'
                    : 'border-gray-200 bg-gray-50/50 hover:bg-white'
                }`}
              >
                {/* Header Row (Icon + Text + Checkbox) */}
                <div className="flex items-start justify-between gap-2 w-full overflow-hidden">
                  <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                      <h4 className="truncate w-full text-sm font-bold text-slate-800" title={file.DocumentName}>
                        {file.DocumentName}
                      </h4>
                      <p className="truncate w-full text-xs text-gray-500" title={file.Category}>
                        {file.Category}
                      </p>
                    </div>
                  </div>

                  {hasPermission('checkBoxDelete') && (
                    <div className="flex-shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(file.Id)}
                        onChange={() => toggleDocSelection(file.Id)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Row (Date & Action buttons) */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200">
                  <DateText value={file.DocumentDate} className="text-xs font-mono text-gray-400" />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleViewFile(file.Id)}
                      disabled={viewingFileId === file.Id}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 cursor-pointer"
                      title="عرض"
                    >
                      {viewingFileId === file.Id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => handleDownloadFile(file.Id, file.FileName || file.DocumentName)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                      title="تحميل"
                    >
                      <Download size={16} />
                    </button>
                    {hasPermission('checkBoxEdit') && (
                      <button
                        onClick={() => handleEditFileClick(file)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        title="تعديل"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                    {hasPermission('checkBoxDelete') && (
                      <button
                        onClick={() => handleDeleteFile(file.Id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
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
                  className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
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
              <button
                onClick={() => setEditingFile(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
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
                    onChange={(e) => setEditingFile({ ...editingFile, DocumentName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={editingFile?.Category || editingFile?.category || ''}
                    onChange={(e) => setEditingFile({ ...editingFile, Category: e.target.value })}
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
                    onChange={(e) => setEditingFile({ ...editingFile, DocumentDate: e.target.value })}
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
                        toast.warning('حجم الملف يتجاوز الحد المسموح (50 ميغابايت).');
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
                  <button
                    type="button"
                    onClick={() => setEditingFile(null)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isEditUploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                  >
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

export default DocumentsTab;
