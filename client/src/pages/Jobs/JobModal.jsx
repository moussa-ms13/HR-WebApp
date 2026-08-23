import React, { useState, useEffect } from 'react';
import JobTitlesService from '../../services/jobTitlesService';
import { X, Save, Loader2 } from 'lucide-react';

const JobModal = ({ isOpen, onClose, job, onSuccess }) => {
  const [formData, setFormData] = useState({
    EmploymentCategory: '',
    RankName: '',
    CategoryLevel: '',
    IndexNumber: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (job) {
        setFormData({
          EmploymentCategory: job.EmploymentCategory || '',
          RankName: job.RankName || '',
          CategoryLevel: job.CategoryLevel || '',
          IndexNumber: job.IndexNumber || ''
        });
      } else {
        setFormData({
          EmploymentCategory: '',
          RankName: '',
          CategoryLevel: '',
          IndexNumber: ''
        });
      }
      setError('');
    }
  }, [isOpen, job]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.RankName) {
      setError('يرجى إدخال اسم الرتبة');
      return;
    }

    setLoading(true);
    try {
      if (job) {
        await JobTitlesService.update(job.Id, formData);
      } else {
        await JobTitlesService.create(formData);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'فشل في حفظ البيانات. تأكد من عدم تكرار الرتبة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800">
            {job ? 'تعديل الرتبة' : 'إضافة رتبة جديدة'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border-r-4 border-red-500 rounded text-sm font-medium">
              {error}
            </div>
          )}

          <form id="jobForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">صنف التوظيف</label>
              <select
                name="EmploymentCategory"
                value={formData.EmploymentCategory}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
              >
                <option value="">اختر صنف التوظيف...</option>
                <option value="أسلاك تقنية (خاصة)">أسلاك تقنية (خاصة)</option>
                <option value="اسلاك مشتركة">اسلاك مشتركة</option>
                <option value="متعاقدون بدوام كلي">متعاقدون بدوام كلي</option>
                <option value="متعاقدون بدوام جزئي">متعاقدون بدوام جزئي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">اسم الرتبة *</label>
              <input
                type="text"
                name="RankName"
                value={formData.RankName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800"
                placeholder="مثال: متصرف محلل..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الصنف</label>
              <input
                type="text"
                name="CategoryLevel"
                value={formData.CategoryLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                placeholder="مثال: 12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الرقم الاستدلالي</label>
              <input
                type="number"
                name="IndexNumber"
                value={formData.IndexNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono text-slate-700"
                placeholder="مثال: 537"
              />
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
            form="jobForm"
            disabled={loading}
            className="flex items-center justify-center px-8 py-2 text-white rounded-lg transition-colors font-medium shadow-sm text-sm disabled:opacity-70"
            style={{ backgroundColor: '#105b38' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin ml-2" /> : <Save size={18} className="ml-2" />}
            {job ? 'حفظ التعديلات' : 'إضافة الرتبة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobModal;
