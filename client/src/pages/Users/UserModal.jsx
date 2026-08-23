import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import UsersService from '../../services/usersService';

const ALL_PERMISSIONS = [
  // CRUD
  { key: 'checkBoxAdd', label: 'إضافة' },
  { key: 'checkBoxEdit', label: 'تعديل' },
  { key: 'checkBoxDelete', label: 'حذف' },
  { key: 'checkBoxExport', label: 'تصدير' },
  { key: 'checkBoxPrint', label: 'طباعة' },
  { key: 'checkBoxSearch', label: 'بحث' },
  { key: 'checkBoxHomeSearch', label: 'بحث الواجهة' },
  
  // Modules
  { key: 'checkBoxHome', label: 'الرئيسية' },
  { key: 'checkBoxJobs', label: 'إدارة الوظائف' },
  { key: 'checkBoxEmployees', label: 'الموظفين' },
  { key: 'checkBoxUsers', label: 'المستخدمين' },
  { key: 'checkBoxReport', label: 'التقارير' },
  { key: 'checkBoxSettings', label: 'الإعدادات' },
  { key: 'checkBoxLeaves', label: 'العطل' },
  { key: 'checkBoxSystemRecords', label: 'سجل النظام' },

  // Provinces
  { key: 'checkBoxProvinceChlef', label: 'الشلف' },
  { key: 'checkBoxProvinceTiaret', label: 'تيارت' },
  { key: 'checkBoxProvinceTissemsilt', label: 'تيسمسيلت' },
  { key: 'checkBoxProvinceAinDefla', label: 'عين الدفلى' },
  { key: 'checkBoxProvinceRelizane', label: 'غليزان' },
  { key: 'checkBoxProvinceKsarChellala', label: 'قصر الشلالة' },
];

const UserModal = ({ isOpen, onClose, user, onSuccess }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    userName: '',
    password: '',
    role: 'User',
    isSecondaryUser: false,
    permissions: {}
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (user) {
        // Edit mode
        setFormData({
          fullName: user.FullName || '',
          userName: user.UserName || '',
          password: '', // Leave blank unless they want to change it
          role: user.Role || 'User',
          isSecondaryUser: user.IsSecondaryUser || false,
          permissions: user.Roles?.reduce((acc, curr) => {
            acc[curr.Key] = curr.Value;
            return acc;
          }, {}) || {}
        });
      } else {
        // Add mode
        setFormData({
          fullName: '',
          userName: '',
          password: '',
          role: 'User',
          isSecondaryUser: false,
          permissions: {}
        });
      }
      setError('');
    }
  }, [isOpen, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Dynamic UX Logic: If role changes to Admin, auto-check all permissions
    if (name === 'role') {
      if (value === 'Admin') {
        const allPerms = {};
        ALL_PERMISSIONS.forEach(p => allPerms[p.key] = true);
        setFormData(prev => ({ ...prev, role: value, permissions: allPerms }));
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (key) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user && !formData.password) {
        throw new Error('كلمة المرور مطلوبة للمستخدمين الجدد');
      }

      // Convert permissions object back to Roles array
      const rolesArray = ALL_PERMISSIONS.map(p => ({
        key: p.key,
        value: formData.permissions[p.key] || false
      }));

      const payload = {
        fullName: formData.fullName,
        userName: formData.userName,
        role: formData.role,
        isSecondaryUser: formData.isSecondaryUser,
        roles: rolesArray
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (user) {
        await UsersService.update(user.Id, payload);
      } else {
        await UsersService.create(payload);
      }
      
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800">
            {user ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border-r-4 border-red-500 rounded text-sm">
              {error}
            </div>
          )}

          <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل *</label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white transition-colors outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستخدم *</label>
                <input required type="text" name="userName" value={formData.userName} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white transition-colors outline-none" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  كلمة المرور {user ? '(اترك الحقل فارغاً للإبقاء على الحالية)' : '*'}
                </label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white transition-colors text-left outline-none" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الصلاحية *</label>
                <select name="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white transition-colors outline-none">
                  <option value="User">مستخدم (User)</option>
                  <option value="Admin">مدير (Admin)</option>
                  <option value="Read">قراءة فقط (Read)</option>
                </select>
              </div>
            </div>

            {/* Permissions Section */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">الصلاحيات التفصيلية</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {ALL_PERMISSIONS.map(perm => (
                  <label key={perm.key} className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions[perm.key] || false}
                      onChange={() => handleCheckboxChange(perm.key)}
                      disabled={formData.role === 'Admin'}
                      className="w-4 h-4 rounded border-slate-300 disabled:opacity-50"
                      style={{ accentColor: '#105b38' }}
                    />
                    <span className={`text-sm select-none ${formData.role === 'Admin' ? 'text-slate-400' : 'text-slate-700'}`}>
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
            form="userForm"
            disabled={loading}
            className="flex items-center justify-center px-8 py-2 text-white rounded-lg transition-colors font-medium shadow-sm text-sm disabled:opacity-70"
            style={{ backgroundColor: '#105b38' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin ml-2" /> : 'حفظ البيانات'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
