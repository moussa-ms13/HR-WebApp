import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowRight, User, Upload, FileText, Trash2, Download, Loader2, Edit3, Briefcase, Calendar, Clock, CheckCircle2, Search, X, CheckSquare, Plus, Save, XCircle, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmployeeService from '../../services/employeeService';
import SpecialCasesService from '../../services/specialCasesService';
import apiClient from '../../services/apiClient';
import { DateText } from '../../utils/formatDate';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  // --- Generic Confirm Modal State ---
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null });

  // --- Profile Summary (SWR) ---
  const { data: summaryData, error: summaryError, isLoading: isSummaryLoading, mutate: mutateSummary } = useSWR(
    id ? `/employees/${id}/summary` : null,
    fetcher
  );
  const employee = summaryData?.data || null;

  // --- Inline Edit State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const enterEditMode = () => {
    if (!employee) return;
    setEditData({
      Name: employee.Name || '',
      LastName: employee.LastName || '',
      Gender: employee.Gender || '',
      PhoneNumber: employee.PhoneNumber || '',
      Email: employee.Email || '',
      DateOfBirth: employee.DateOfBirth ? new Date(employee.DateOfBirth).toISOString().split('T')[0] : '',
      MaritalStatus: employee.MaritalStatus || '',
      Address: employee.Address || '',
      EmployeeStatus: employee.EmployeeStatus || '',
      InstallationDate: employee.InstallationDate ? new Date(employee.InstallationDate).toISOString().split('T')[0] : '',
      Degree: employee.Degree || 0,
      NIN: employee.NIN || '',
      SIS: employee.SIS || '',
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await EmployeeService.update(id, editData);
      await mutateSummary();
      toast.success('تم حفظ التعديلات بنجاح');
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حفظ التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  const editField = (key, value) => setEditData(prev => ({ ...prev, [key]: value }));

  // --- Leaves State (Conditional SWR — lazy loaded on tab switch) ---
  const { data: leavesData, isLoading: isLeavesLoading } = useSWR(
    id && activeTab === 'leaves' ? `/employee-states?employeeId=${id}` : null,
    fetcher
  );
  const leaves = leavesData?.data || [];

  // --- Special Cases State (lazy loaded on tab switch) ---
  const { data: specialCasesData, isLoading: isSpecialCasesLoading, mutate: mutateSpecialCases } = useSWR(
    id && activeTab === 'special-cases' ? [`special-cases-${id}`] : null,
    async () => {
      const res = await SpecialCasesService.getByEmployee(id);
      return res;
    }
  );
  const specialCases = specialCasesData?.data || [];
  // Active case for top banner: instantly available from lightweight profile summary, or refreshed from tab
  const activeSpecialCase = employee?.SpecialCases?.[0] || (specialCases.length > 0 ? specialCases.find(c => c.IsActive) : null);

  // Special Cases form state
  const [showSpecialCaseModal, setShowSpecialCaseModal] = useState(false);
  const [editingSpecialCaseId, setEditingSpecialCaseId] = useState(null);
  const [isSubmittingSpecialCase, setIsSubmittingSpecialCase] = useState(false);
  const initialSpecialCaseForm = { CaseType: 'انتداب', StartDate: '', EndDate: '', Destination: '', ReferenceDoc: '' };
  const [specialCaseForm, setSpecialCaseForm] = useState(initialSpecialCaseForm);

  const CASE_TYPE_COLORS = {
    'استقالة': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', icon: 'text-red-600', banner: 'from-red-500 to-red-700' },
    'استيداع': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', icon: 'text-amber-600', banner: 'from-amber-500 to-amber-700' },
    'انتداب': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', icon: 'text-blue-600', banner: 'from-blue-500 to-blue-700' },
    'تحويل': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800', icon: 'text-purple-600', banner: 'from-purple-500 to-purple-700' },
  };

  const handleSpecialCaseSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingSpecialCase(true);
      if (editingSpecialCaseId) {
        await SpecialCasesService.update(id, editingSpecialCaseId, specialCaseForm);
      } else {
        await SpecialCasesService.create(id, specialCaseForm);
      }
      mutateSpecialCases();
      mutateSummary();
      setShowSpecialCaseModal(false);
      setEditingSpecialCaseId(null);
      setSpecialCaseForm(initialSpecialCaseForm);
      toast.success(editingSpecialCaseId ? 'تم تعديل الحالة الخاصة بنجاح' : 'تمت إضافة الحالة الخاصة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الحالة الخاصة');
    } finally {
      setIsSubmittingSpecialCase(false);
    }
  };

  const handleEditSpecialCase = (record) => {
    setSpecialCaseForm({
      CaseType: record.CaseType || 'انتداب',
      StartDate: record.StartDate ? new Date(record.StartDate).toISOString().split('T')[0] : '',
      EndDate: record.EndDate ? new Date(record.EndDate).toISOString().split('T')[0] : '',
      Destination: record.Destination || '',
      ReferenceDoc: record.ReferenceDoc || '',
    });
    setEditingSpecialCaseId(record.Id);
    setShowSpecialCaseModal(true);
  };

  const handleDeleteSpecialCase = (caseId) => {
    showConfirm('حذف الحالة الخاصة', 'هل أنت متأكد من حذف هذه الحالة الخاصة؟', async () => {
      closeConfirm();
      try {
        await SpecialCasesService.delete(id, caseId);
        mutateSpecialCases();
        mutateSummary();
        toast.success('تم حذف الحالة الخاصة بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  // --- Career History State (Conditional SWR — lazy loaded on tab switch) ---
  const { data: careerData, isLoading: isCareerLoading, mutate: mutateCareer } = useSWR(
    id && activeTab === 'career' ? `/employees/${id}/career-history` : null,
    fetcher
  );
  const rankHistory = careerData?.data?.ranks || [];
  const positionHistory = careerData?.data?.positions || [];

  // Career Modals State
  const [showRankModal, setShowRankModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);

  // Lazy-load job titles only when user opens rank modal
  const { data: jobTitlesData } = useSWR(showRankModal ? '/job-titles' : null, fetcher);
  const jobTitles = jobTitlesData?.data || [];
  const [isSubmittingCareer, setIsSubmittingCareer] = useState(false);

  const [editingRankId, setEditingRankId] = useState(null);
  const [editingPositionId, setEditingPositionId] = useState(null);

  const initialRankForm = { RankId: '', RankName: '', InstallDate: '', Reference: '', Notes: '' };
  const [rankForm, setRankForm] = useState(initialRankForm);

  const initialPositionForm = { PositionName: '', InstallDate: '', EndDate: '', Reference: '' };
  const [positionForm, setPositionForm] = useState(initialPositionForm);

  // --- Degree History State (lazy loaded with career tab) ---
  const { data: degreeData, isLoading: isDegreeLoading, mutate: mutateDegrees } = useSWR(
    id && activeTab === 'career' ? `/employees/${id}/degrees` : null,
    fetcher
  );
  const degreeHistory = degreeData?.data || [];

  const [showDegreeModal, setShowDegreeModal] = useState(false);
  const [isSubmittingDegree, setIsSubmittingDegree] = useState(false);
  const initialDegreeForm = { DegreeLevel: '', PromotionDuration: 'دنيا', EffectiveDate: '', ReferenceDoc: '', Notes: '' };
  const [degreeForm, setDegreeForm] = useState(initialDegreeForm);

  const handleDegreeSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingDegree(true);
      await apiClient.post(`/employees/${id}/degrees`, degreeForm);
      mutateDegrees();
      mutateSummary();
      setShowDegreeModal(false);
      setDegreeForm(initialDegreeForm);
      toast.success('تمت إضافة الدرجة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الدرجة');
    } finally {
      setIsSubmittingDegree(false);
    }
  };

  const handleDeleteDegree = (degreeId) => {
    showConfirm('حذف الدرجة', 'هل أنت متأكد من حذف هذه الدرجة؟', async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/degrees/${degreeId}`);
        mutateDegrees();
        mutateSummary();
        toast.success('تم حذف الدرجة بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  const PROMOTION_DURATIONS = [
    { value: 'دنيا', label: 'دنيا (2.5 سنة)' },
    { value: 'متوسطة', label: 'متوسطة (3 سنوات)' },
    { value: 'قصوى', label: 'قصوى (3.5 سنة)' },
  ];

  const handleRankSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingCareer(true);
      if (editingRankId) {
        await apiClient.put(`/employees/${id}/rank-history/${editingRankId}`, rankForm);
      } else {
        await apiClient.post(`/employees/${id}/rank-history`, rankForm);
      }
      mutateCareer();
      setShowRankModal(false);
      setEditingRankId(null);
      setRankForm(initialRankForm);
      toast.success(editingRankId ? "تم تعديل الترقية بنجاح" : "تمت إضافة الترقية بنجاح");
    } catch (err) {
      console.error("Failed to add/edit rank", err);
      toast.error("حدث خطأ أثناء حفظ الترقية");
    } finally {
      setIsSubmittingCareer(false);
    }
  };

  const handlePositionSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingCareer(true);
      if (editingPositionId) {
        await apiClient.put(`/employees/${id}/position-history/${editingPositionId}`, positionForm);
      } else {
        await apiClient.post(`/employees/${id}/position-history`, positionForm);
      }
      mutateCareer();
      setShowPositionModal(false);
      setEditingPositionId(null);
      setPositionForm(initialPositionForm);
      toast.success(editingPositionId ? "تم تعديل المنصب بنجاح" : "تمت إضافة المنصب بنجاح");
    } catch (err) {
      console.error("Failed to add/edit position", err);
      toast.error("حدث خطأ أثناء حفظ المنصب");
    } finally {
      setIsSubmittingCareer(false);
    }
  };

  const handleEditRank = (record) => {
    setRankForm({
      RankId: record.RankId || '',
      RankName: record.RankName || '',
      InstallDate: record.InstallDate ? new Date(record.InstallDate).toISOString().split('T')[0] : '',
      Reference: record.Reference || '',
      Notes: record.Notes || ''
    });
    setEditingRankId(record.Id);
    setShowRankModal(true);
  };

  const handleEditPosition = (record) => {
    setPositionForm({
      PositionName: record.PositionName || '',
      InstallDate: record.InstallDate ? new Date(record.InstallDate).toISOString().split('T')[0] : '',
      EndDate: record.EndDate ? new Date(record.EndDate).toISOString().split('T')[0] : '',
      Reference: record.Reference || ''
    });
    setEditingPositionId(record.Id);
    setShowPositionModal(true);
  };

  const handleDeleteRank = (recordId) => {
    showConfirm('حذف الترقية', 'هل أنت متأكد من حذف هذه الترقية؟', async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/rank-history/${recordId}`);
        mutateCareer();
      } catch (err) {
        console.error("Failed to delete rank", err);
        toast.error("حدث خطأ أثناء الحذف");
      }
    });
  };

  const handleDeletePosition = (recordId) => {
    showConfirm('حذف المنصب', 'هل أنت متأكد من حذف هذا المنصب؟', async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/position-history/${recordId}`);
        mutateCareer();
      } catch (err) {
        console.error("Failed to delete position", err);
        toast.error("حدث خطأ أثناء الحذف");
      }
    });
  };

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

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
      toast.warning(`الملفات التالية تتجاوز الحد المسموح (50 ميغابايت لكل ملف):\n${oversized.map(f => f.name).join('\n')}`);
    }

    const validFiles = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);

    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
      const newUnique = validFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
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
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) { toast.warning('يرجى اختيار ملف واحد على الأقل للرفع'); return; }
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
        mutateFiles();
      } catch (err) {
        toast.error('فشل في حذف الملف');
      }
    });
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
    { id: 'special-cases', label: 'الحالات الخاصة' },
    { id: 'career', label: 'المسار المهني' },
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
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap relative ${activeTab === tab.id
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
            <img src={`${import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'}${employee.ProfileImagePath}`} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <User size={32} className="text-gray-400" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-800">{employee.Name} {employee.LastName}</h2>
        <p className="text-sm font-medium text-gray-500 mt-1">{employee.JobTitle?.RankName || 'موظف'} • {employee.Department || 'الإدارة العامة'}</p>
      </div>

      {/* Special Case Banner */}
      {activeSpecialCase && (() => {
        const colors = CASE_TYPE_COLORS[activeSpecialCase.CaseType] || CASE_TYPE_COLORS['انتداب'];
        return (
          <div className={`mb-6 rounded-xl overflow-hidden shadow-md border ${colors.border}`}>
            <div className={`bg-gradient-to-l ${colors.banner} px-6 py-4 flex items-center gap-4`}>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0">
                <AlertTriangle size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-base">⚠️ الحالة الحالية: {activeSpecialCase.CaseType}</p>
                <p className="text-white/80 text-sm mt-0.5">
                  منذ <DateText value={activeSpecialCase.StartDate} />
                  {activeSpecialCase.Destination && ` — الوجهة: ${activeSpecialCase.Destination}`}
                </p>
              </div>
              <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/30">
                حالة نشطة
              </span>
            </div>
          </div>
        );
      })()}

      {/* Tab Contents */}
      {activeTab === 'profile' && (
        <div className="space-y-6">

          {/* Edit Mode Action Bar */}
          {hasPermission('checkBoxEdit') && (
            <div className="flex justify-end gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <XCircle size={16} />
                    إلغاء
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    حفظ التعديلات
                  </button>
                </>
              ) : (
                <button
                  onClick={enterEditMode}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <Edit3 size={16} />
                  تعديل البيانات
                </button>
              )}
            </div>
          )}

          {/* Personal Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 relative shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800">
              <User size={20} className="text-emerald-600" />
              البيانات الشخصية
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الاسم</span>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input value={editData.Name} onChange={e => editField('Name', e.target.value)} className="w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" placeholder="الاسم" />
                    <input value={editData.LastName} onChange={e => editField('LastName', e.target.value)} className="w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" placeholder="اللقب" />
                  </div>
                ) : (
                  <span className="block font-semibold text-slate-800">{employee.Name} {employee.LastName}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الجنس</span>
                {isEditing ? (
                  <select value={editData.Gender} onChange={e => editField('Gender', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white">
                    <option value="">—</option>
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                ) : (
                  <span className="block font-semibold text-slate-800">{employee.Gender || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">رقم التواصل</span>
                {isEditing ? (
                  <input value={editData.PhoneNumber} onChange={e => editField('PhoneNumber', e.target.value)} dir="ltr" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800" dir="ltr">{employee.PhoneNumber || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">البريد الإلكتروني</span>
                {isEditing ? (
                  <input value={editData.Email} onChange={e => editField('Email', e.target.value)} dir="ltr" type="email" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800" dir="ltr">{employee.Email || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ الميلاد</span>
                {isEditing ? (
                  <input value={editData.DateOfBirth} onChange={e => editField('DateOfBirth', e.target.value)} type="date" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800"><DateText value={employee.DateOfBirth} /></span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">العنوان</span>
                {isEditing ? (
                  <input value={editData.Address} onChange={e => editField('Address', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800">{employee.Address || employee.Province}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الحالة العائلية</span>
                {isEditing ? (
                  <select value={editData.MaritalStatus} onChange={e => editField('MaritalStatus', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white">
                    <option value="">—</option>
                    <option value="أعزب">أعزب</option>
                    <option value="متزوج">متزوج</option>
                    <option value="مطلق">مطلق</option>
                    <option value="أرمل">أرمل</option>
                  </select>
                ) : (
                  <span className="block font-semibold text-slate-800">{employee.MaritalStatus || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">رقم التعريف الوطني</span>
                {isEditing ? (
                  <input value={editData.NIN} onChange={e => editField('NIN', e.target.value)} dir="ltr" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800" dir="ltr">{employee.NIN || '—'}</span>
                )}
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
                {isEditing ? (
                  <input value={editData.InstallationDate} onChange={e => editField('InstallationDate', e.target.value)} type="date" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800"><DateText value={employee.InstallationDate} /></span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الحالة الوظيفية</span>
                {isEditing ? (
                  <select value={editData.EmployeeStatus} onChange={e => editField('EmployeeStatus', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white">
                    <option value="">—</option>
                    <option value="نشط">نشط</option>
                    <option value="مثبت">مثبت</option>
                    <option value="متربص">متربص</option>
                    <option value="معلق">معلق</option>
                    <option value="مفصول">مفصول</option>
                    <option value="متقاعد">متقاعد</option>
                  </select>
                ) : (
                  <span className="block font-semibold text-emerald-600">{employee.EmployeeStatus || 'نشط'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">الدرجة</span>
                {isEditing ? (
                  <input value={editData.Degree} onChange={e => editField('Degree', parseInt(e.target.value) || 0)} type="number" min="0" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800">{employee.Degree || '—'}</span>
                )}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">رقم الضمان الاجتماعي</span>
                {isEditing ? (
                  <input value={editData.SIS} onChange={e => editField('SIS', e.target.value)} dir="ltr" className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                ) : (
                  <span className="block font-semibold text-slate-800" dir="ltr">{employee.SIS || '—'}</span>
                )}
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

      {activeTab === 'career' && (
        <div className="space-y-6">
          {/* Rank History */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Briefcase size={20} className="text-emerald-600" />
                حركة في الرتب
              </h3>
              <button
                onClick={() => {
                  setEditingRankId(null);
                  setRankForm(initialRankForm);
                  setShowRankModal(true);
                }}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                إضافة ترقية
              </button>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-right border-collapse whitespace-nowrap">
                <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-4 px-6 font-medium">الرتبة</th>
                    <th className="py-4 px-6 font-medium">تاريخ التعيين</th>
                    <th className="py-4 px-6 font-medium">المرجع</th>
                    <th className="py-4 px-6 font-medium">ملاحظات</th>
                    <th className="py-4 px-6 font-medium w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
                  {isCareerLoading ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-400">
                        <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                        جاري تحميل البيانات...
                      </td>
                    </tr>
                  ) : rankHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-400">
                        <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                        لا توجد حركة ترقيات لهذا الموظف
                      </td>
                    </tr>
                  ) : (
                    rankHistory.map((record) => (
                      <tr key={record.Id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-800">{record.RankName || '—'}</td>
                        <td className="py-4 px-6 text-gray-600"><DateText value={record.InstallDate} /></td>
                        <td className="py-4 px-6 text-gray-600">{record.Reference || '—'}</td>
                        <td className="py-4 px-6 text-gray-600">{record.Notes || '—'}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditRank(record)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteRank(record.Id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Position History */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock size={20} className="text-emerald-600" />
                حركة في المناصب و المناصب العليا
              </h3>
              <button
                onClick={() => {
                  setEditingPositionId(null);
                  setPositionForm(initialPositionForm);
                  setShowPositionModal(true);
                }}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                إضافة منصب
              </button>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-right border-collapse whitespace-nowrap">
                <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-4 px-6 font-medium">المنصب</th>
                    <th className="py-4 px-6 font-medium">تاريخ التعيين</th>
                    <th className="py-4 px-6 font-medium">تاريخ الانتهاء</th>
                    <th className="py-4 px-6 font-medium">المرجع</th>
                    <th className="py-4 px-6 font-medium w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
                  {isCareerLoading ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-400">
                        <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                        جاري تحميل البيانات...
                      </td>
                    </tr>
                  ) : positionHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-400">
                        <Clock size={32} className="mx-auto text-gray-300 mb-2" />
                        لا توجد حركة مناصب عليا لهذا الموظف
                      </td>
                    </tr>
                  ) : (
                    positionHistory.map((record) => (
                      <tr key={record.Id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-800">{record.PositionName || '—'}</td>
                        <td className="py-4 px-6 text-gray-600"><DateText value={record.InstallDate} /></td>
                        <td className="py-4 px-6 text-gray-600">{record.EndDate ? <DateText value={record.EndDate} /> : <span className="text-emerald-600 font-medium">ساري</span>}</td>
                        <td className="py-4 px-6 text-gray-600">{record.Reference || '—'}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditPosition(record)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePosition(record.Id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Degree History */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                حركة في الدرجات
              </h3>
              <button
                onClick={() => {
                  setDegreeForm(initialDegreeForm);
                  setShowDegreeModal(true);
                }}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                إضافة درجة
              </button>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-right border-collapse whitespace-nowrap">
                <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-4 px-6 font-medium">الدرجة</th>
                    <th className="py-4 px-6 font-medium">الوتيرة</th>
                    <th className="py-4 px-6 font-medium">تاريخ السريان</th>
                    <th className="py-4 px-6 font-medium">المرجع</th>
                    <th className="py-4 px-6 font-medium">ملاحظات</th>
                    <th className="py-4 px-6 font-medium w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
                  {isDegreeLoading ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-gray-400">
                        <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                        جاري تحميل البيانات...
                      </td>
                    </tr>
                  ) : degreeHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-gray-400">
                        <CheckCircle2 size={32} className="mx-auto text-gray-300 mb-2" />
                        لا توجد حركة درجات لهذا الموظف
                      </td>
                    </tr>
                  ) : (
                    degreeHistory.map((record) => (
                      <tr key={record.Id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-800">{record.DegreeLevel}</td>
                        <td className="py-4 px-6 text-gray-600">{record.PromotionDuration || '—'}</td>
                        <td className="py-4 px-6 text-gray-600"><DateText value={record.EffectiveDate} /></td>
                        <td className="py-4 px-6 text-gray-600">{record.ReferenceDoc || '—'}</td>
                        <td className="py-4 px-6 text-gray-600">{record.Notes || '—'}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDeleteDegree(record.Id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'special-cases' && (
        <div className="space-y-6">
          {/* Special Cases Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Shield size={20} className="text-emerald-600" />
                الحالات الخاصة (انتداب، تحويل، استيداع، استقالة)
              </h3>
              {hasPermission('checkBoxAdd') && (
                <button
                  onClick={() => {
                    setEditingSpecialCaseId(null);
                    setSpecialCaseForm(initialSpecialCaseForm);
                    setShowSpecialCaseModal(true);
                  }}
                  className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} />
                  إضافة حالة خاصة
                </button>
              )}
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-right border-collapse whitespace-nowrap">
                <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-4 px-6 font-medium">النوع</th>
                    <th className="py-4 px-6 font-medium">تاريخ البداية</th>
                    <th className="py-4 px-6 font-medium">تاريخ النهاية</th>
                    <th className="py-4 px-6 font-medium">الوجهة</th>
                    <th className="py-4 px-6 font-medium">المرجع</th>
                    <th className="py-4 px-6 font-medium">الحالة</th>
                    <th className="py-4 px-6 font-medium w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
                  {isSpecialCasesLoading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                        جاري تحميل البيانات...
                      </td>
                    </tr>
                  ) : specialCases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        <Shield size={32} className="mx-auto text-gray-300 mb-2" />
                        لا توجد حالات خاصة لهذا الموظف
                      </td>
                    </tr>
                  ) : (
                    specialCases.map((sc) => {
                      const colors = CASE_TYPE_COLORS[sc.CaseType] || CASE_TYPE_COLORS['انتداب'];
                      return (
                        <tr key={sc.Id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                              {sc.CaseType}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600"><DateText value={sc.StartDate} /></td>
                          <td className="py-4 px-6 text-gray-600">{sc.EndDate ? <DateText value={sc.EndDate} /> : <span className="text-emerald-600 font-medium">مفتوح</span>}</td>
                          <td className="py-4 px-6 text-gray-600">{sc.Destination || '—'}</td>
                          <td className="py-4 px-6 text-gray-600 max-w-[180px] truncate" title={sc.ReferenceDoc}>{sc.ReferenceDoc || '—'}</td>
                          <td className="py-4 px-6">
                            {sc.IsActive ? (
                              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">نشط</span>
                            ) : (
                              <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">منتهي</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              {hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={() => handleEditSpecialCase(sc)}
                                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                  title="تعديل"
                                >
                                  <Edit3 size={16} />
                                </button>
                              )}
                              {hasPermission('checkBoxDelete') && (
                                <button
                                  onClick={() => handleDeleteSpecialCase(sc.Id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                  title="حذف"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Special Case Modal */}
      {showSpecialCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-slate-800">{editingSpecialCaseId ? 'تعديل الحالة الخاصة' : 'إضافة حالة خاصة'}</h3>
            </div>
            <form onSubmit={handleSpecialCaseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحالة</label>
                <select
                  required
                  value={specialCaseForm.CaseType}
                  onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, CaseType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="انتداب">انتداب</option>
                  <option value="تحويل">تحويل</option>
                  <option value="استيداع">استيداع</option>
                  <option value="استقالة">استقالة</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    required
                    value={specialCaseForm.StartDate}
                    onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, StartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ النهاية <span className="text-slate-400 font-normal text-xs">(اختياري)</span></label>
                  <input
                    type="date"
                    value={specialCaseForm.EndDate}
                    onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, EndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوجهة <span className="text-slate-400 font-normal text-xs">(اختياري)</span></label>
                <input
                  type="text"
                  value={specialCaseForm.Destination}
                  onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, Destination: e.target.value })}
                  placeholder="مثال: وزارة المالية"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المرجع / الوثيقة</label>
                <input
                  type="text"
                  required
                  value={specialCaseForm.ReferenceDoc}
                  onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, ReferenceDoc: e.target.value })}
                  placeholder="مثال: مقرر رقم 123/2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowSpecialCaseModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmittingSpecialCase} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px]">
                  {isSubmittingSpecialCase ? <Loader2 className="animate-spin" size={20} /> : (editingSpecialCaseId ? 'تعديل' : 'إضافة')}
                </button>
              </div>
            </form>
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${selectedDocIds.length === filteredFiles.length && filteredFiles.length > 0
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
                    className={`border rounded-md p-3 relative bg-white overflow-hidden flex flex-col h-full w-full transition-all hover:shadow-sm cursor-default ${selectedDocIds.includes(file.Id)
                      ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200'
                      : 'border-gray-200 bg-gray-50/50 hover:bg-white'
                      }`}
                  >
                    {/* Header Row (Icon + Text + Checkbox) */}
                    <div className="flex items-start justify-between gap-2 w-full overflow-hidden">

                      {/* Left Side: Icon + Text Container */}
                      <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                        {/* Icon - MUST NOT SHRINK */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <FileText size={20} />
                        </div>

                        {/* Text Wrapper - MUST HAVE min-w-0 and flex-1 */}
                        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                          {/* File Name - STRICT TRUNCATE */}
                          <h4 className="truncate w-full text-sm font-bold text-slate-800" title={file.DocumentName}>
                            {file.DocumentName}
                          </h4>
                          {/* Category - STRICT TRUNCATE */}
                          <p className="truncate w-full text-xs text-gray-500" title={file.Category}>
                            {file.Category}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Checkbox - MUST NOT SHRINK */}
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

      {/* Rank Modal */}
      {showRankModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Briefcase className="text-emerald-500" /> {editingRankId ? 'تعديل' : 'إضافة ترقية جديدة'}
              </h2>
              <button onClick={() => setShowRankModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleRankSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الرتبة</label>
                <select
                  required
                  value={rankForm.RankId}
                  onChange={(e) => {
                    const selected = jobTitles.find(j => j.Id === parseInt(e.target.value));
                    setRankForm({ ...rankForm, RankId: e.target.value, RankName: selected ? selected.RankName : '' });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="">-- اختر الرتبة --</option>
                  {jobTitles.map(job => (
                    <option key={job.Id} value={job.Id}>{job.RankName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التعيين</label>
                <input
                  type="date"
                  required
                  value={rankForm.InstallDate}
                  onChange={(e) => setRankForm({ ...rankForm, InstallDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المرجع</label>
                <input
                  type="text"
                  value={rankForm.Reference}
                  onChange={(e) => setRankForm({ ...rankForm, Reference: e.target.value })}
                  placeholder="مثال: قرار رقم 123"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  value={rankForm.Notes}
                  onChange={(e) => setRankForm({ ...rankForm, Notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50">
                <button type="button" onClick={() => setShowRankModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmittingCareer} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px]">
                  {isSubmittingCareer ? <Loader2 className="animate-spin" size={20} /> : (editingRankId ? 'تعديل' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Position Modal */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="text-emerald-500" /> {editingPositionId ? 'تعديل' : 'إضافة منصب جديد'}
              </h2>
              <button onClick={() => setShowPositionModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePositionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المنصب</label>
                <input
                  type="text"
                  required
                  value={positionForm.PositionName}
                  onChange={(e) => setPositionForm({ ...positionForm, PositionName: e.target.value })}
                  placeholder="مثال: رئيس مصلحة"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التعيين</label>
                <input
                  type="date"
                  required
                  value={positionForm.InstallDate}
                  onChange={(e) => setPositionForm({ ...positionForm, InstallDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الانتهاء <span className="text-slate-400 font-normal text-xs">(اختياري)</span></label>
                <input
                  type="date"
                  value={positionForm.EndDate}
                  onChange={(e) => setPositionForm({ ...positionForm, EndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المرجع</label>
                <input
                  type="text"
                  value={positionForm.Reference}
                  onChange={(e) => setPositionForm({ ...positionForm, Reference: e.target.value })}
                  placeholder="مثال: مقرر رقم 456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50">
                <button type="button" onClick={() => setShowPositionModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmittingCareer} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px]">
                  {isSubmittingCareer ? <Loader2 className="animate-spin" size={20} /> : (editingPositionId ? 'تعديل' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Degree Modal */}
      {showDegreeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500" /> إضافة درجة جديدة
              </h2>
              <button onClick={() => setShowDegreeModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleDegreeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الدرجة (0 إلى 12)</label>
                <select
                  required
                  value={degreeForm.DegreeLevel}
                  onChange={(e) => setDegreeForm({ ...degreeForm, DegreeLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="">-- اختر الدرجة --</option>
                  {[...Array(13).keys()].map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوتيرة / المدة</label>
                <select
                  required
                  value={degreeForm.PromotionDuration}
                  onChange={(e) => setDegreeForm({ ...degreeForm, PromotionDuration: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  {PROMOTION_DURATIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ السريان</label>
                <input
                  type="date"
                  required
                  value={degreeForm.EffectiveDate}
                  onChange={(e) => setDegreeForm({ ...degreeForm, EffectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">رقم وتاريخ المقرر / المرجع</label>
                <input
                  type="text"
                  value={degreeForm.ReferenceDoc}
                  onChange={(e) => setDegreeForm({ ...degreeForm, ReferenceDoc: e.target.value })}
                  placeholder="مثال: مقرر رقم 789 بتاريخ 01/01/2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات <span className="text-slate-400 font-normal text-xs">(اختياري)</span></label>
                <textarea
                  value={degreeForm.Notes}
                  onChange={(e) => setDegreeForm({ ...degreeForm, Notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50">
                <button type="button" onClick={() => setShowDegreeModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmittingDegree} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px]">
                  {isSubmittingDegree ? <Loader2 className="animate-spin" size={20} /> : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generic Confirm Modal */}
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

export default EmployeeProfile;
