import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar } from 'lucide-react';
import EmployeeStatesService from '../../services/employeeStatesService';
import EmployeeService from '../../services/employeeService';

const LEAVE_TYPES = [
  "عطلة سنوية",
  "عطلة مرضية",
  "عطلة أمومة",
  "عطلة استثنائية",
  "عطلة بدون راتب"
];

const SPECIAL_CASE_TYPES = [
  "في استيداع",
  "تأدية الخدمة الوطنية",
  "توقيف بمقرر",
  "انتداب",
  "استقالة",
  "نقل",
  "تحويل",
  "تقاعد"
];

const PERMANENT_STATES = ["استقالة", "نقل", "تحويل", "تقاعد", "انتداب"];

const EmployeeStateModal = ({ isOpen, onClose, record, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('تسجيل عطلة');

  const [formData, setFormData] = useState({
    EmployeesId: '',
    RecordCategory: 'تسجيل عطلة',
    StateTypeOrReason: LEAVE_TYPES[0],
    DaysCount: 30,
    StartDate: new Date().toISOString().split('T')[0],
    EndDate: '',
    IsResumed: false,
    ActualReturnDate: ''
  });

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchEmployeesForSelect = async () => {
        try {
          const res = await EmployeeService.getAll(1, 2000, '', '');
          if (res.success) {
            setEmployees(res.data);
          }
        } catch (err) {
          console.error("Failed to load employees for dropdown", err);
        }
      };
      fetchEmployeesForSelect();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (record) {
        setActiveTab(record.RecordCategory);
        setFormData({
          EmployeesId: record.EmployeesId,
          RecordCategory: record.RecordCategory,
          StateTypeOrReason: record.StateTypeOrReason,
          DaysCount: record.DaysCount,
          StartDate: record.StartDate ? new Date(record.StartDate).toISOString().split('T')[0] : '',
          EndDate: record.EndDate ? new Date(record.EndDate).toISOString().split('T')[0] : '',
          IsResumed: record.IsResumed || false,
          ActualReturnDate: record.ActualReturnDate ? new Date(record.ActualReturnDate).toISOString().split('T')[0] : ''
        });
      } else {
        setFormData({
          EmployeesId: '',
          RecordCategory: 'تسجيل عطلة',
          StateTypeOrReason: LEAVE_TYPES[0],
          DaysCount: 30,
          StartDate: new Date().toISOString().split('T')[0],
          EndDate: '',
          IsResumed: false,
          ActualReturnDate: ''
        });
        setActiveTab('تسجيل عطلة');
      }
      setError('');
    }
  }, [isOpen, record]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFormData(prev => ({
      ...prev,
      RecordCategory: tab,
      StateTypeOrReason: tab === 'تسجيل عطلة' ? LEAVE_TYPES[0] : SPECIAL_CASE_TYPES[0],
      DaysCount: 30,
      IsResumed: false
    }));
  };

  useEffect(() => {
    if (formData.StartDate && formData.DaysCount > 0) {
      const start = new Date(formData.StartDate);
      start.setDate(start.getDate() + Number(formData.DaysCount) - 1);
      const calculatedEnd = start.toISOString().split('T')[0];

      setFormData(prev => {
        if (prev.EndDate !== calculatedEnd) {
          return { ...prev, EndDate: calculatedEnd };
        }
        return prev;
      });
    }
  }, [formData.StartDate, formData.DaysCount]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };

      if (name === 'StateTypeOrReason') {
        if (PERMANENT_STATES.includes(newValue)) {
          updated.DaysCount = 0;
          updated.IsResumed = true;
        } else if (prev.DaysCount === 0) {
          updated.DaysCount = 30;
          updated.IsResumed = false;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.EmployeesId) {
      setError('الرجاء اختيار الموظف المعني');
      return;
    }

    setLoading(true);

    try {
      const emp = employees.find(e => e.Id === Number(formData.EmployeesId));

      const payload = {
        EmployeesId: Number(formData.EmployeesId),
        RecordCategory: formData.RecordCategory,
        StateTypeOrReason: formData.StateTypeOrReason,
        DaysCount: Number(formData.DaysCount),
        StartDate: formData.StartDate,
        EndDate: formData.EndDate,
        IsResumed: formData.IsResumed,
        ActualReturnDate: formData.ActualReturnDate || null,
        CurrentJobTitle: emp?.JobTitle?.RankName || ""
      };

      if (record) {
        await EmployeeStatesService.update(record.Id, payload);
      } else {
        await EmployeeStatesService.create(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPermanent = PERMANENT_STATES.includes(formData.StateTypeOrReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-3 text-slate-800">
            <Calendar size={22} className="text-slate-500" />
            <h2 className="text-xl font-bold">
              {record ? 'تعديل السجل' : 'إضافة سجل جديد (عطلة / حالة خاصة)'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {!record && (
          <div className="flex border-b border-slate-200 px-6 pt-4 bg-slate-50">
            <button
              type="button"
              onClick={() => handleTabChange('تسجيل عطلة')}
              className={`px-6 py-3 font-medium text-sm border-b-2 outline-none transition-colors ${activeTab === 'تسجيل عطلة'
                  ? 'border-[#105b38] text-[#105b38]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              تسجيل عطلة
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('حالة خاصة')}
              className={`px-6 py-3 font-medium text-sm border-b-2 outline-none transition-colors ${activeTab === 'حالة خاصة'
                  ? 'border-[#105b38] text-[#105b38]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              حالة خاصة
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border-l-4 border-red-500 rounded text-sm">
              {error}
            </div>
          )}

          <form id="stateForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">الموظف المعني *</label>
                <select
                  required
                  name="EmployeesId"
                  value={formData.EmployeesId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 outline-none bg-slate-50 focus:bg-white"
                  disabled={!!record}
                >
                  <option value="">-- اختر الموظف --</option>
                  {employees.map(emp => (
                    <option key={emp.Id} value={emp.Id}>
                      {emp.Name} {emp.LastName} ({emp.Id}) - {emp.Province}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">النوع / السبب *</label>
                <select
                  required
                  name="StateTypeOrReason"
                  value={formData.StateTypeOrReason}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
                >
                  {activeTab === 'تسجيل عطلة'
                    ? LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                    : SPECIAL_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ البداية *</label>
                <input
                  required
                  type="date"
                  name="StartDate"
                  value={formData.StartDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">مدة العطلة/الحالة (أيام) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  name="DaysCount"
                  value={formData.DaysCount}
                  onChange={handleChange}
                  disabled={isPermanent}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white disabled:bg-slate-200 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ النهاية المتوقع</label>
                <input
                  type="date"
                  name="EndDate"
                  value={formData.EndDate}
                  readOnly
                  disabled={isPermanent}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-slate-200 text-slate-600 disabled:opacity-50"
                  dir="ltr"
                />
                <p className="text-xs text-slate-500 mt-1">يتم حسابه تلقائياً بناءً على المدة</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="flex items-center space-x-3 space-x-reverse cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    name="IsResumed"
                    checked={formData.IsResumed}
                    onChange={handleChange}
                    disabled={isPermanent}
                    className="w-5 h-5 rounded border-slate-300 disabled:opacity-50"
                    style={{ accentColor: '#105b38' }}
                  />
                  <span className="text-sm font-bold text-slate-800">
                    تم الاستئناف (عاد إلى العمل)
                  </span>
                </label>

                {formData.IsResumed && !isPermanent && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">تاريخ العودة الفعلي</label>
                    <input
                      required={formData.IsResumed}
                      type="date"
                      name="ActualReturnDate"
                      value={formData.ActualReturnDate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded outline-none text-sm"
                      dir="ltr"
                    />
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-100 rounded-b-xl gap-3 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white transition-colors font-medium text-sm bg-slate-50 shadow-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="stateForm"
            disabled={loading}
            className="flex items-center justify-center px-8 py-2 text-white rounded-lg transition-colors font-medium shadow-sm text-sm disabled:opacity-70"
            style={{ backgroundColor: '#105b38' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin ml-2" /> : 'حفظ السجل'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeStateModal;