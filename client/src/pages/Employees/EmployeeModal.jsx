import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Upload, Image as ImageIcon, ChevronDown, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import EmployeeService from '../../services/employeeService';
import apiClient from '../../services/apiClient';
import { useToast } from '../../components/ui/Toast';

// --- Tree View Data Helpers ---
// TreeNode Component for the Assignment Tree
const TreeNode = ({ label, children, onSelect, isLeaf, dirTag }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isLeaf) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect(label, dirTag);
  };

  return (
    <div className="ml-4 rtl:ml-0 rtl:mr-4 select-none">
      <div
        className={`flex items-center py-1 transition-colors hover:text-blue-600 hover:bg-blue-50 px-2 rounded ${isLeaf ? 'text-slate-600' : 'font-medium text-slate-800'}`}
      >
        {!isLeaf && (
          <div onClick={handleToggle} className="cursor-pointer p-0.5 hover:bg-blue-100 rounded">
            {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronLeft size={16} className="text-slate-500" />}
          </div>
        )}
        {isLeaf && <div className="w-4 h-4 inline-block mr-1 rtl:mr-0 rtl:ml-1" />}
        <div onClick={handleSelect} className="cursor-pointer flex-1 mr-1 rtl:mr-0 rtl:ml-1">
          {label}
        </div>
      </div>
      {isOpen && children && <div className="border-r-2 border-slate-100 pr-2 rtl:pr-4">{children}</div>}
    </div>
  );
};

const EmployeeModal = ({ isOpen, onClose, employee, onSuccess }) => {
  const { user } = useAuth();
  const toast = useToast();
  const allowedProvinces = getAllowedProvinces(user);
  const isEdit = !!employee;

  const [loading, setLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [jobTitles, setJobTitles] = useState([]);
  const [error, setError] = useState('');

  // Tabs State
  const [activeTab, setActiveTab] = useState('personal');

  // Tree View State
  const [showTree, setShowTree] = useState(false);

  // Profile Image State
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);

  const initialFormData = {
    Name: '', LastName: '', DateOfBirth: '', PlaceOfBirth: '',
    Gender: 'ذكر', MaritalStatus: 'أعزب',
    NumberOfChildren: 0, PhoneNumber: '', Address: '', Email: '',
    NIN: '', SIS: '',
    Province: allowedProvinces.length > 0 ? allowedProvinces[0] : '',
    Directorate: '', Department: '', AssignedPosition: '',
    JobTitleId: '', Degree: 0,
    InstallationDate: new Date().toISOString().split('T')[0],
    LastDegreeDate: new Date().toISOString().split('T')[0],
    PositionDate: '',
    EmployeeStatus: 'مثبت',
    ConfirmationDate: new Date().toISOString().split('T')[0],
    isProfileComplete: false
  };

  // Helper: build form state from employee data
  const buildFormDataFromEmployee = (emp) => ({
    ...initialFormData,
    ...emp,
    isProfileComplete: emp.IsProfileComplete || emp.isProfileComplete || false,
    JobTitleId: emp.JobTitleId ?? '',
    DateOfBirth: emp.DateOfBirth ? new Date(emp.DateOfBirth).toISOString().split('T')[0] : '',
    InstallationDate: emp.InstallationDate ? new Date(emp.InstallationDate).toISOString().split('T')[0] : '',
    LastDegreeDate: emp.LastDegreeDate ? new Date(emp.LastDegreeDate).toISOString().split('T')[0] : '',
    PositionDate: emp.PositionDate ? new Date(emp.PositionDate).toISOString().split('T')[0] : '',
    ConfirmationDate: emp.ConfirmationDate ? new Date(emp.ConfirmationDate).toISOString().split('T')[0] : '',
  });

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    let isMounted = true;

    const initializeModal = async () => {
      if (!isOpen) return;

      fetchJobTitles();
      setProfileImageFile(null);
      setError('');
      setShowTree(false);
      setActiveTab('personal'); // Reset tab on open

      const empId = employee?.Id || employee?.id;

      if (isEdit && empId) {
        // Fast initial populate from prop
        setFormData(buildFormDataFromEmployee(employee));
        setProfileImagePreview(employee.ProfileImagePath ? `${import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'}${employee.ProfileImagePath}` : null);

        // Fetch full employee database record
        setIsFetchingDetails(true);
        try {
          const res = await EmployeeService.getById(empId);
          const fullData = res?.data || res;
          if (isMounted && fullData) {
            setFormData(buildFormDataFromEmployee(fullData));
            if (fullData.ProfileImagePath) {
              setProfileImagePreview(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'}${fullData.ProfileImagePath}`);
            }
          }
        } catch (err) {
          console.error("Failed to fetch full employee details", err);
          if (isMounted) {
            setError(err.response?.data?.message || 'فشل تحميل بيانات الموظف الكاملة');
          }
        } finally {
          if (isMounted) {
            setIsFetchingDetails(false);
          }
        }
      } else {
        setFormData(initialFormData);
        setProfileImagePreview(null);
        setIsFetchingDetails(false);
      }
    };

    initializeModal();

    return () => {
      isMounted = false;
    };
  }, [isOpen, employee]);

  const fetchJobTitles = async () => {
    try {
      const res = await apiClient.get('/job-titles');
      if (res.data.success) {
        setJobTitles(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch job titles", err);
    }
  };

  const handleGenderChange = (e) => {
    const newGender = e.target.value;
    const newMaritalStatus = newGender === 'أنثى' ? 'عزباء' : 'أعزب';
    setFormData(prev => ({
      ...prev,
      Gender: newGender,
      MaritalStatus: newMaritalStatus,
      NumberOfChildren: 0
    }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: type === 'number' ? Number(value) : value };

      // Cascading Rules
      if (name === 'MaritalStatus' && (value === 'أعزب' || value === 'عزباء')) {
        updated.NumberOfChildren = 0;
      }
      if (name === 'Province') {
        updated.Directorate = '';
        updated.Department = '';
      }
      if (name === 'EmployeeStatus' && value === 'متربص') {
        updated.ConfirmationDate = '';
      }
      if (name === 'Degree' && Number(value) === 0) {
        updated.LastDegreeDate = updated.InstallationDate;
      }

      return updated;
    });
  };

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.warning('حجم الملف يتجاوز الحد المسموح (50 ميغابايت).');
        e.target.value = '';
        return;
      }
      setProfileImageFile(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleTreeSelect = (department, directorate) => {
    setFormData(prev => ({
      ...prev,
      Department: department,
      Directorate: directorate || department // If root node selected
    }));
    setShowTree(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.Name || !formData.LastName || !formData.Province) {
        throw new Error('يرجى ملء الحقول الإجبارية (الاسم، اللقب، الولاية)');
      }
      if (!formData.Department) {
        throw new Error('يرجى اختيار مكان التعيين من القائمة الشجرية');
      }

      const payload = {
        ...formData,
        JobTitleId: Number(formData.JobTitleId) || 0,
        Degree: Number(formData.Degree) || 0,
        IsProfileComplete: formData.isProfileComplete || false
      };

      let savedEmployeeId = null;

      // 1. Save Text Data
      if (isEdit) {
        const empId = employee.Id || employee.id;
        await EmployeeService.update(empId, payload);
        savedEmployeeId = empId;
      } else {
        const result = await EmployeeService.create(payload);
        savedEmployeeId = result.Id || result.data?.Id || result.id;
      }

      // 2. Upload Profile Image if selected
      if (profileImageFile && savedEmployeeId) {
        const imgData = new FormData();
        imgData.append('profileImage', profileImageFile);
        await EmployeeService.uploadProfileImage(savedEmployeeId, imgData);
      }

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getMaritalOptions = () => {
    return formData.Gender === 'أنثى'
      ? ['عزباء', 'متزوجة', 'مطلقة', 'أرملة']
      : ['أعزب', 'متزوج', 'مطلق', 'أرمل'];
  };

  const dirAmlak = "مديرية أملاك الدولة";
  const dirMash = "مديرية مسح الأراضي والحفظ العقاري";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">
              {isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
            </h2>
            {isFetchingDetails && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Loader2 size={12} className="animate-spin text-emerald-600" />
                جاري جلب البيانات...
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 relative">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border-r-4 border-red-500 rounded text-sm font-medium">
              {error}
            </div>
          )}

          {isFetchingDetails && (
            <div className="mb-6 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 animate-pulse">
              <Loader2 size={18} className="animate-spin text-emerald-600" />
              <span>جاري استرجاع تفاصيل الموظف الكاملة وتحديث الحقول...</span>
            </div>
          )}

          <form id="employeeForm" onSubmit={handleSubmit} className="space-y-8">
            <fieldset disabled={isFetchingDetails} className="space-y-8 contents">

              {/* Tab Headers */}
              <div className="flex border-b border-slate-200 mb-6">
                {[
                  { id: 'personal', label: 'المعلومات الشخصية' },
                  { id: 'professional', label: 'المعلومات المهنية' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Personal Info Tab */}
              {activeTab === 'personal' && (
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Image Upload Area */}
                  <div className="flex flex-col items-center shrink-0 w-full md:w-48 space-y-3">
                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-100 flex items-center justify-center">
                      {profileImagePreview ? (
                        <img src={profileImagePreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={40} className="text-slate-300" />
                      )}
                    </div>
                    <div className="w-full">
                      <label className="block text-xs font-semibold text-slate-600 mb-1 text-center">الصورة الشخصية</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageSelect}
                        className="w-full text-xs text-slate-500 file:mr-0 file:ml-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Personal Info */}
                  <div className="flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الاسم <span className="text-red-500">*</span></label>
                        <input type="text" name="Name" value={formData.Name} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">اللقب <span className="text-red-500">*</span></label>
                        <input type="text" name="LastName" value={formData.LastName} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الجنس</label>
                        <select name="Gender" value={formData.Gender} onChange={handleGenderChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                          <option value="ذكر">ذكر</option>
                          <option value="أنثى">أنثى</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">الحالة العائلية</label>
                        <select name="MaritalStatus" value={formData.MaritalStatus} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                          {getMaritalOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الميلاد</label>
                        <input type="date" name="DateOfBirth" value={formData.DateOfBirth} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">مكان الميلاد</label>
                        <input type="text" name="PlaceOfBirth" value={formData.PlaceOfBirth} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">رقم التعريف الوطني (NIN)</label>
                        <input type="text" name="NIN" value={formData.NIN} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">رقم الضمان الاجتماعي (SIS)</label>
                        <input type="text" name="SIS" value={formData.SIS} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                      {!(formData.MaritalStatus === 'أعزب' || formData.MaritalStatus === 'عزباء') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">عدد الأولاد</label>
                          <input type="number" name="NumberOfChildren" value={formData.NumberOfChildren} onChange={handleChange} min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                      )}
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
                        <input type="text" name="PhoneNumber" value={formData.PhoneNumber} onChange={handleChange} dir="ltr" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-right" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                        <input type="email" name="Email" value={formData.Email} onChange={handleChange} dir="ltr" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-right" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label>
                        <input type="text" name="Address" value={formData.Address} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Professional Info Tab */}
              {activeTab === 'professional' && (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">الولاية (مقر العمل) <span className="text-red-500">*</span></label>
                      <select name="Province" value={formData.Province} onChange={handleChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                        <option value="" disabled>اختر الولاية...</option>
                        {allowedProvinces.map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tree-View Assignment */}
                    <div className="lg:col-span-2 relative">
                      <label className="block text-sm font-medium text-slate-700 mb-1">مكان التعيين <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={formData.Department ? (formData.Directorate === formData.Department ? formData.Directorate : `${formData.Directorate} ➜ ${formData.Department}`) : ''}
                          placeholder="اضغط لاختيار مكان التعيين..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none text-sm cursor-pointer"
                          onClick={() => { if (formData.Province) setShowTree(!showTree); else toast.warning("يرجى اختيار الولاية أولاً."); }}
                        />
                        <button type="button" onClick={() => { if (formData.Province) setShowTree(!showTree); else toast.warning("يرجى اختيار الولاية أولاً."); }} className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                          {showTree ? 'إغلاق' : 'اختيار'}
                        </button>
                      </div>

                      {/* Tree Popup */}
                      {showTree && formData.Province && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-10 max-h-64 overflow-y-auto">
                          <TreeNode label="المديرية الجهوية للأملاك الوطنية" onSelect={handleTreeSelect} isLeaf={false}>

                            {formData.Province === 'الشلف' && (
                              <TreeNode label="المديرية الجهوية للأملاك الوطنية" onSelect={handleTreeSelect} isLeaf={true} dirTag="المديرية الجهوية للأملاك الوطنية" />
                            )}

                            <TreeNode label={dirAmlak} onSelect={handleTreeSelect} isLeaf={false}>
                              <TreeNode label={`المديرية الولائية (${formData.Province})`} onSelect={handleTreeSelect} isLeaf={true} dirTag={dirAmlak} />
                              <TreeNode label="مفتشيات أملاك الدولة" onSelect={handleTreeSelect} isLeaf={false}>
                                {getMofatishiyat(formData.Province).map(m => (
                                  <TreeNode key={m} label={m} onSelect={handleTreeSelect} isLeaf={true} dirTag={dirAmlak} />
                                ))}
                              </TreeNode>
                            </TreeNode>

                            <TreeNode label={dirMash} onSelect={handleTreeSelect} isLeaf={false}>
                              <TreeNode label={`المديرية الولائية (${formData.Province})`} onSelect={handleTreeSelect} isLeaf={true} dirTag={dirMash} />
                              <TreeNode label="المحافظات العقارية" onSelect={handleTreeSelect} isLeaf={false}>
                                {getMohafathat(formData.Province).map(m => (
                                  <TreeNode key={m} label={m} onSelect={handleTreeSelect} isLeaf={true} dirTag={dirMash} />
                                ))}
                              </TreeNode>
                            </TreeNode>

                          </TreeNode>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">الرتبة</label>
                      <select name="JobTitleId" value={formData.JobTitleId} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                        <option value="">بدون رتبة</option>
                        {jobTitles.map(job => (
                          <option key={job.Id} value={job.Id}>{job.RankName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">المنصب العالي </label>
                      <input type="text" name="AssignedPosition" value={formData.AssignedPosition} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ المنصب العالي</label>
                      <input type="date" name="PositionDate" value={formData.PositionDate} onChange={handleChange} disabled={!formData.AssignedPosition || formData.AssignedPosition === 'لا شيء'} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-100" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التنصيب</label>
                      <input type="date" name="InstallationDate" value={formData.InstallationDate} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">الدرجة</label>
                      <input type="number" name="Degree" value={formData.Degree} onChange={handleChange} min="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ آخر درجة</label>
                      <input type="date" name="LastDegreeDate" value={formData.LastDegreeDate} onChange={handleChange} disabled={Number(formData.Degree) === 0} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-100" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">الحالة</label>
                      <select name="EmployeeStatus" value={formData.EmployeeStatus} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                        <option value="مرسم">مرسم</option>
                        <option value="متربص">متربص</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1 lg:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التثبيت</label>
                      <input type="date" name="ConfirmationDate" value={formData.ConfirmationDate} onChange={handleChange} disabled={formData.EmployeeStatus === 'متربص'} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-slate-100" />
                    </div>
                  </div>
                </div>
              )}


              {/* Profile Completion Toggle */}
              <div className="mt-2">
                <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${formData.isProfileComplete
                  ? 'border-emerald-400 bg-emerald-50/70'
                  : 'border-slate-200 bg-slate-50/50'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{formData.isProfileComplete ? '🟢' : '🟠'}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">تم استكمال جميع وثائق الملف</p>
                      <p className="text-xs text-slate-500 mt-0.5">علّم هذا الخيار إذا كانت جميع الوثائق المطلوبة مرفقة ومكتملة</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isProfileComplete: !prev.isProfileComplete }))}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${formData.isProfileComplete ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${formData.isProfileComplete ? '-translate-x-6' : '-translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              </div>

            </fieldset>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-100 rounded-b-xl gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white transition-colors font-medium text-sm bg-slate-50 shadow-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="employeeForm"
            disabled={loading || isFetchingDetails}
            className="flex items-center px-8 py-2 text-white rounded-lg transition-colors font-medium shadow-sm text-sm disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: '#105b38' }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin ml-2" />
            ) : isFetchingDetails ? (
              <Loader2 size={18} className="animate-spin ml-2" />
            ) : (
              <Save size={18} className="ml-2" />
            )}
            {isEdit ? 'حفظ التعديلات' : 'إضافة الموظف'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
