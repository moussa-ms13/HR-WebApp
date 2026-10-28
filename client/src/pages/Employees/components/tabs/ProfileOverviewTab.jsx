import React, { useState } from 'react';
import useSWR from 'swr';
import apiClient from '../../../../services/apiClient';
import EmployeeService from '../../../../services/employeeService';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../components/ui/Toast';
import { DateText } from '../../../../utils/formatDate';
import { formatEmployeeName } from '../../../../utils/employeeUtils';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../../../utils/constants';
import { refreshEmployees, refreshEmployeeCareer } from '../../../../utils/cacheManager';
import {
  User,
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  XCircle,
  Save,
  Loader2,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

// --- Tree View Node (for Assignment picker) ---
const TreeNode = ({ label, children, onSelect, isLeaf, dirTag }) => {
  const [isOpen, setIsOpen] = useState(true);
  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isLeaf) setIsOpen(!isOpen);
  };
  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect(label, dirTag);
  };
  return (
    <div className="ml-4 rtl:ml-0 rtl:mr-4 select-none">
      <div
        className={`flex items-center py-1 transition-colors hover:text-blue-600 hover:bg-blue-50 px-2 rounded ${
          isLeaf ? 'text-slate-600' : 'font-medium text-slate-800'
        }`}
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

const sanitizeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (trimmed.startsWith('1900') || trimmed.startsWith('0000') || trimmed.startsWith('0001')) return '';
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const year = parseInt(match[1].slice(0, 4), 10);
      if (year <= 1900) return '';
      return match[1];
    }
  }
  try {
    const date = new Date(d);
    if (isNaN(date.getTime()) || date.getFullYear() <= 1900) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const ProfileOverviewTab = ({ employee, onRefresh }) => {
  const { hasPermission, user } = useAuth();
  const toast = useToast();
  const id = employee?.Id;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showTree, setShowTree] = useState(false);

  const allowedProvinces = getAllowedProvinces(user);

  // Lazy-load job titles when user is editing profile
  const { data: jobTitlesData } = useSWR(isEditing ? '/job-titles' : null, fetcher, { keepPreviousData: true });
  const jobTitles = jobTitlesData?.data || [];

  const selectedJob = jobTitles.find(j => String(j.Id) === String(editData.JobTitleId || employee?.JobTitleId)) || employee?.JobTitle;
  const empCat = selectedJob?.EmploymentCategory || employee?.EmploymentCategory || '';
  const isContractual = empCat.includes('متعاقد') || ['متعاقدون بدوام كلي', 'متعاقدون بدوام جزئي', 'متعاقدين بدوام كلي', 'متعاقدين بدوام جزئي'].includes(empCat.trim()) || employee?.EmployeeStatus === 'متعاقد';

  const enterEditMode = () => {
    if (!employee) return;
    const initialIsContr = (employee.JobTitle?.EmploymentCategory && employee.JobTitle.EmploymentCategory.includes('متعاقد')) || employee.EmployeeStatus === 'متعاقد';
    setEditData({
      Name: employee.Name || '',
      LastName: employee.LastName || '',
      LastNameFr: employee.LastNameFr || '',
      NameFr: employee.NameFr || '',
      Gender: employee.Gender && employee.Gender !== 'غير محدد' ? employee.Gender : '',
      PhoneNumber: employee.PhoneNumber || '',
      Email: employee.Email || '',
      DateOfBirth: sanitizeDate(employee.DateOfBirth),
      PlaceOfBirth: employee.PlaceOfBirth || '',
      MaritalStatus:
        employee.MaritalStatus && employee.MaritalStatus !== 'غير محدد'
          ? employee.MaritalStatus
          : employee.FamilyStatus && employee.FamilyStatus !== 'غير محدد'
          ? employee.FamilyStatus
          : '',
      NumberOfChildren: employee.NumberOfChildren || 0,
      Address: employee.Address || '',
      NIN: employee.NIN || '',
      SIS: employee.SIS || '',
      Province: employee.Province || '',
      Directorate: employee.Directorate || '',
      JobTitleId: employee.JobTitleId ?? '',
      AssignedPosition: employee.AssignedPosition || '',
      EmployeeStatus: initialIsContr ? 'متعاقد' : (employee.EmployeeStatus || 'مرسم'),
      InstallationDate: sanitizeDate(employee.InstallationDate),
      Degree: employee.Degree ?? 0,
      LastDegreeDate: sanitizeDate(employee.LastDegreeDate),
      ConfirmationDate: initialIsContr ? '' : sanitizeDate(employee.ConfirmationDate),
      PositionDate: sanitizeDate(employee.PositionDate),
      IsProfileComplete: employee.IsProfileComplete || false,
    });
    setShowTree(false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData({});
    setShowTree(false);
  };

  const editField = (key, value) => setEditData((prev) => {
    const updated = { ...prev, [key]: value };
    if (key === 'JobTitleId') {
      const job = jobTitles.find(j => String(j.Id) === String(value));
      const isJobContr = job && (job.EmploymentCategory?.includes('متعاقد') || ['متعاقدون بدوام كلي', 'متعاقدون بدوام جزئي', 'متعاقدين بدوام كلي', 'متعاقدين بدوام جزئي'].includes(job.EmploymentCategory?.trim()));
      if (isJobContr) {
        updated.EmployeeStatus = 'متعاقد';
        updated.ConfirmationDate = '';
      } else if (updated.EmployeeStatus === 'متعاقد') {
        updated.EmployeeStatus = 'مرسم';
      }
    }
    return updated;
  });

  const handleTreeSelect = (selectedPlace) => {
    setEditData((prev) => ({
      ...prev,
      Directorate: selectedPlace,
    }));
    setShowTree(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...editData,
        Gender: editData.Gender || '',
        MaritalStatus: editData.MaritalStatus || '',
        FamilyStatus: editData.MaritalStatus || '',
        JobTitleId: Number(editData.JobTitleId) || 0,
        Degree: Number(editData.Degree) ?? 0,
        NumberOfChildren: Number(editData.NumberOfChildren) || 0,
        DateOfBirth: editData.DateOfBirth || null,
        InstallationDate: editData.InstallationDate || null,
        LastDegreeDate: editData.LastDegreeDate || null,
        ConfirmationDate: editData.ConfirmationDate || null,
        PositionDate: editData.PositionDate || null,
      };
      await EmployeeService.update(id, payload);
      await refreshEmployees(id);
      await refreshEmployeeCareer(id);
      if (onRefresh) await onRefresh();
      toast.success('تم تحديث بيانات الموظف بنجاح');
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حفظ التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  const dirAmlak = 'مديرية أملاك الدولة';
  const dirMash = 'مديرية مسح الأراضي والحفظ العقاري';

  return (
    <div className="space-y-6">
      {/* Edit Mode Action Bar */}
      {hasPermission('checkBoxEdit') && (
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle size={16} />
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                حفظ التعديلات
              </button>
            </>
          ) : (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
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
            <span className="block text-xs font-medium text-gray-400 mb-1">اللقب والاسم</span>
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editData.LastName}
                    onChange={(e) => {
                      const val = e.target.value;
                      editField('LastName', val);
                      if (!editData.LastNameFr || editData.LastNameFr === transliterateLastName(editData.LastName)) {
                        editField('LastNameFr', transliterateLastName(val));
                      }
                    }}
                    className="w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
                    placeholder="اللقب"
                  />
                  <input
                    value={editData.Name}
                    onChange={(e) => {
                      const val = e.target.value;
                      editField('Name', val);
                      if (!editData.NameFr || editData.NameFr === transliterateFirstName(editData.Name)) {
                        editField('NameFr', transliterateFirstName(val));
                      }
                    }}
                    className="w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
                    placeholder="الاسم"
                  />
                </div>
                <div className="flex gap-2" dir="ltr">
                  <input
                    value={editData.LastNameFr || ''}
                    onChange={(e) => editField('LastNameFr', e.target.value.toUpperCase())}
                    className="w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 uppercase font-medium"
                    placeholder="NOM (FR)"
                  />
                  <input
                    value={editData.NameFr || ''}
                    onChange={(e) => editField('NameFr', e.target.value)}
                    className="w-1/2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 font-medium"
                    placeholder="Prénom (FR)"
                  />
                </div>
              </div>
            ) : (
              <div>
                <span className="block font-semibold text-slate-800">
                  {formatEmployeeName(employee)}
                </span>
                {(employee.LastNameFr || employee.NameFr) && (
                  <span className="block text-xs font-semibold text-slate-500 tracking-wide mt-0.5" dir="ltr">
                    {[employee.LastNameFr, employee.NameFr].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">الجنس</span>
            {isEditing ? (
              <select
                value={editData.Gender}
                onChange={(e) => editField('Gender', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white"
              >
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
              <input
                value={editData.PhoneNumber}
                onChange={(e) => editField('PhoneNumber', e.target.value)}
                dir="ltr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800" dir="ltr">
                {employee.PhoneNumber || '—'}
              </span>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">البريد الإلكتروني</span>
            {isEditing ? (
              <input
                value={editData.Email}
                onChange={(e) => editField('Email', e.target.value)}
                dir="ltr"
                type="email"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800" dir="ltr">
                {employee.Email || '—'}
              </span>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ الميلاد</span>
            {isEditing ? (
              <input
                value={editData.DateOfBirth}
                onChange={(e) => editField('DateOfBirth', e.target.value)}
                type="date"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800">
                <DateText value={employee.DateOfBirth} />
              </span>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">مكان الميلاد</span>
            {isEditing ? (
              <input
                value={editData.PlaceOfBirth}
                onChange={(e) => editField('PlaceOfBirth', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800">{employee.PlaceOfBirth || '—'}</span>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">العنوان</span>
            {isEditing ? (
              <input
                value={editData.Address}
                onChange={(e) => editField('Address', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800">{employee.Address || employee.Province}</span>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">الحالة العائلية</span>
            {isEditing ? (
              <select
                value={editData.MaritalStatus}
                onChange={(e) => editField('MaritalStatus', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white"
              >
                <option value="">—</option>
                {(editData.Gender === 'أنثى'
                  ? ['عزباء', 'متزوجة', 'مطلقة', 'أرملة']
                  : ['أعزب', 'متزوج', 'مطلق', 'أرمل']
                ).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block font-semibold text-slate-800">{employee.MaritalStatus || '—'}</span>
            )}
          </div>
          {/* Number of Children — shown only if not single */}
          {isEditing ? (
            editData.MaritalStatus &&
            editData.MaritalStatus !== 'أعزب' &&
            editData.MaritalStatus !== 'عزباء' && (
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">عدد الأولاد</span>
                <input
                  value={editData.NumberOfChildren}
                  onChange={(e) => editField('NumberOfChildren', parseInt(e.target.value) || 0)}
                  type="number"
                  min="0"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
                />
              </div>
            )
          ) : (
            employee.MaritalStatus &&
            employee.MaritalStatus !== 'أعزب' &&
            employee.MaritalStatus !== 'عزباء' && (
              <div>
                <span className="block text-xs font-medium text-gray-400 mb-1">عدد الأولاد</span>
                <span className="block font-semibold text-slate-800">{employee.NumberOfChildren ?? '—'}</span>
              </div>
            )
          )}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">رقم التعريف الوطني</span>
            {isEditing ? (
              <input
                value={editData.NIN}
                onChange={(e) => editField('NIN', e.target.value)}
                dir="ltr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800" dir="ltr">
                {employee.NIN || '—'}
              </span>
            )}
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">رقم الضمان الاجتماعي</span>
            {isEditing ? (
              <input
                value={editData.SIS}
                onChange={(e) => editField('SIS', e.target.value)}
                dir="ltr"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800" dir="ltr">
                {employee.SIS || '—'}
              </span>
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

          {/* Province */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">الولاية</span>
            {isEditing ? (
              <select
                value={editData.Province}
                onChange={(e) => {
                  editField('Province', e.target.value);
                  editField('Directorate', '');
                }}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white"
              >
                <option value="" disabled>
                  اختر الولاية...
                </option>
                {allowedProvinces.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block font-semibold text-slate-800">{employee.Province || '—'}</span>
            )}
          </div>

          {/* Directorate — Tree Picker */}
          <div className="md:col-span-2 relative">
            <span className="block text-xs font-medium text-gray-400 mb-1">
              <MapPin size={14} className="inline ml-1 text-emerald-500" />
              مكان التعيين (المديرية / الدائرة)
            </span>
            {isEditing ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={editData.Directorate || ''}
                    placeholder="اضغط لاختيار مكان التعيين..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white outline-none text-sm cursor-pointer"
                    onClick={() => {
                      if (editData.Province) setShowTree(!showTree);
                      else toast.warning('يرجى اختيار الولاية أولاً.');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editData.Province) setShowTree(!showTree);
                      else toast.warning('يرجى اختيار الولاية أولاً.');
                    }}
                    className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    {showTree ? 'إغلاق' : 'اختيار'}
                  </button>
                </div>
                {showTree && editData.Province && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-10 max-h-64 overflow-y-auto">
                    <TreeNode label="المديرية الجهوية للأملاك الوطنية" onSelect={handleTreeSelect} isLeaf={false}>
                      {editData.Province === 'الشلف' && (
                        <TreeNode
                          label="المديرية الجهوية للأملاك الوطنية"
                          onSelect={handleTreeSelect}
                          isLeaf={true}
                          dirTag="المديرية الجهوية للأملاك الوطنية"
                        />
                      )}
                      <TreeNode label={dirAmlak} onSelect={handleTreeSelect} isLeaf={false}>
                        <TreeNode
                          label={`المديرية الولائية (${editData.Province})`}
                          onSelect={handleTreeSelect}
                          isLeaf={true}
                          dirTag={dirAmlak}
                        />
                        <TreeNode label="مفتشيات أملاك الدولة" onSelect={handleTreeSelect} isLeaf={false}>
                          {getMofatishiyat(editData.Province).map((m) => (
                            <TreeNode key={m} label={m} onSelect={handleTreeSelect} isLeaf={true} dirTag={dirAmlak} />
                          ))}
                        </TreeNode>
                      </TreeNode>
                      <TreeNode label={dirMash} onSelect={handleTreeSelect} isLeaf={false}>
                        <TreeNode
                          label={`المديرية الولائية (${editData.Province})`}
                          onSelect={handleTreeSelect}
                          isLeaf={true}
                          dirTag={dirMash}
                        />
                        <TreeNode label="المحافظات العقارية" onSelect={handleTreeSelect} isLeaf={false}>
                          {getMohafathat(editData.Province).map((m) => (
                            <TreeNode key={m} label={m} onSelect={handleTreeSelect} isLeaf={true} dirTag={dirMash} />
                          ))}
                        </TreeNode>
                      </TreeNode>
                    </TreeNode>
                  </div>
                )}
              </>
            ) : (
              <span className="block font-semibold text-slate-800">
                {employee.Directorate || '—'}
              </span>
            )}
          </div>

          {/* Rank (JobTitleId) */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">الرتبة</span>
            {isEditing ? (
              <select
                value={editData.JobTitleId}
                onChange={(e) => editField('JobTitleId', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white"
              >
                <option value="">بدون رتبة</option>
                {jobTitles.map((job) => (
                  <option key={job.Id} value={job.Id}>
                    {job.RankName}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block font-semibold text-slate-800">{employee.JobTitle?.RankName || '—'}</span>
            )}
          </div>

          {/* Assigned Position (High Post) */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">المنصب العالي</span>
            {isEditing ? (
              <input
                value={editData.AssignedPosition}
                onChange={(e) => editField('AssignedPosition', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800">{employee.AssignedPosition || '—'}</span>
            )}
          </div>

          {/* Position Date */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ المنصب العالي</span>
            {isEditing ? (
              <input
                value={editData.PositionDate}
                onChange={(e) => editField('PositionDate', e.target.value)}
                type="date"
                disabled={!editData.AssignedPosition || editData.AssignedPosition === 'لا شيء'}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 disabled:bg-slate-100"
              />
            ) : (
              <span className="block font-semibold text-slate-800">
                <DateText value={employee.PositionDate} />
              </span>
            )}
          </div>

          {/* Installation Date */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ التنصيب</span>
            {isEditing ? (
              <input
                value={editData.InstallationDate}
                onChange={(e) => editField('InstallationDate', e.target.value)}
                type="date"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800">
                <DateText value={employee.InstallationDate} />
              </span>
            )}
          </div>

          {/* Employee Status */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">الحالة الوظيفية</span>
            {isEditing ? (
              isContractual ? (
                <select
                  value="متعاقد"
                  disabled
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none bg-slate-100 text-slate-700 cursor-not-allowed font-medium"
                >
                  <option value="متعاقد">متعاقد</option>
                </select>
              ) : (
                <select
                  value={editData.EmployeeStatus || 'مرسم'}
                  onChange={(e) => editField('EmployeeStatus', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 bg-white"
                >
                  <option value="مرسم">مرسم</option>
                  <option value="متربص">متربص</option>
                </select>
              )
            ) : (
              <span className="block font-semibold text-emerald-600">{employee.EmployeeStatus || 'مرسم'}</span>
            )}
          </div>

          {/* Confirmation Date */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ التثبيت</span>
            {isEditing ? (
              <input
                value={editData.ConfirmationDate}
                onChange={(e) => editField('ConfirmationDate', e.target.value)}
                type="date"
                disabled={editData.EmployeeStatus === 'متربص' || isContractual}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            ) : (
              <span className="block font-semibold text-slate-800">
                <DateText value={employee.ConfirmationDate} />
              </span>
            )}
          </div>

          {/* Degree */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">الدرجة</span>
            {isEditing ? (
              <input
                value={editData.Degree}
                onChange={(e) => editField('Degree', parseInt(e.target.value) || 0)}
                type="number"
                min="0"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300"
              />
            ) : (
              <span className="block font-semibold text-slate-800">{employee.Degree || '—'}</span>
            )}
          </div>

          {/* Last Degree Date */}
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">تاريخ آخر درجة</span>
            {isEditing ? (
              <input
                value={editData.LastDegreeDate}
                onChange={(e) => editField('LastDegreeDate', e.target.value)}
                type="date"
                disabled={Number(editData.Degree) === 0}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300 disabled:bg-slate-100"
              />
            ) : (
              <span className="block font-semibold text-slate-800">
                <DateText value={employee.LastDegreeDate} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Profile Completion Toggle */}
      {isEditing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">تم استكمال جميع وثائق الملف</p>
              <p className="text-xs text-gray-500 mt-0.5">علّم هذا الخيار إذا كانت جميع الوثائق المطلوبة مرفقة ومكتملة</p>
            </div>
            <button
              type="button"
              onClick={() => editField('IsProfileComplete', !editData.IsProfileComplete)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 cursor-pointer ${
                editData.IsProfileComplete ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  editData.IsProfileComplete ? '-translate-x-5.5' : '-translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">حالة اكتمال الملف</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                employee.IsProfileComplete
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {employee.IsProfileComplete ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {employee.IsProfileComplete ? 'مكتمل' : 'غير مكتمل'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileOverviewTab;
