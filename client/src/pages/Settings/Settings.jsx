import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Globe, Save, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SettingsService from '../../services/settingsService';

const Settings = () => {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // General Form
  const [generalForm, setGeneralForm] = useState({
    institutionName: '',
    defaultPagination: '20',
    appTitle: ''
  });

  // Connection Form
  const [connectionForm, setConnectionForm] = useState({
    serverIp: 'localhost',
    apiPort: '5000',
    baseApiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    networkMode: 'local' // 'local' or 'network'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await SettingsService.getAllSettings();
      
      if (settings) {
        setGeneralForm(prev => ({
          ...prev,
          institutionName: settings.institutionName || prev.institutionName,
          defaultPagination: settings.defaultPagination || prev.defaultPagination,
          appTitle: settings.appTitle || prev.appTitle,
        }));
        
        setConnectionForm(prev => ({
          ...prev,
          serverIp: settings.serverIp || prev.serverIp,
          apiPort: settings.apiPort || prev.apiPort,
          baseApiUrl: settings.baseApiUrl || prev.baseApiUrl,
          networkMode: settings.networkMode || prev.networkMode,
        }));
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneralForm(prev => ({ ...prev, [name]: value }));
  };

  const handleConnectionChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setConnectionForm(prev => ({ ...prev, [name]: checked ? 'network' : 'local' }));
    } else {
      setConnectionForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const payload = {
        ...generalForm,
        ...connectionForm
      };
      await SettingsService.updateSettings(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("فشل في حفظ الإعدادات. تأكد من أنك تملك صلاحيات مسؤول.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={48} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full font-sans max-w-[1000px] mx-auto w-full p-6 text-slate-800" dir="rtl">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <SettingsIcon className="text-emerald-600" />
            إعدادات النظام
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة الإعدادات العامة والشبكية للنظام</p>
        </div>
        
        {hasPermission('checkBoxSettings') && (
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : (saveSuccess ? <CheckCircle size={18} /> : <Save size={18} />)}
            {saveSuccess ? 'تم الحفظ' : 'حفظ التغييرات'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-4 font-medium text-sm transition-colors relative flex items-center gap-2 ${
              activeTab === 'general' ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <SettingsIcon size={18} /> الإعدادات العامة
            {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></div>}
          </button>
          
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-4 font-medium text-sm transition-colors relative flex items-center gap-2 ${
              activeTab === 'connection' ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe size={18} /> إعدادات الاتصال
            {activeTab === 'connection' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></div>}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        
        {activeTab === 'general' && (
          <div className="space-y-6 max-w-xl">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">اسم المؤسسة</label>
              <input
                type="text"
                name="institutionName"
                value={generalForm.institutionName}
                onChange={handleGeneralChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                placeholder="أدخل اسم المؤسسة"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان النظام (Header)</label>
              <input
                type="text"
                name="appTitle"
                value={generalForm.appTitle}
                onChange={handleGeneralChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
                placeholder="مثال: نظام إدارة الموارد البشرية"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">عدد السجلات الافتراضي في الصفحة</label>
              <select
                name="defaultPagination"
                value={generalForm.defaultPagination}
                onChange={handleGeneralChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm"
              >
                <option value="10">10 سجلات</option>
                <option value="20">20 سجل</option>
                <option value="50">50 سجل</option>
                <option value="100">100 سجل</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'connection' && (
          <div className="space-y-6 max-w-xl">
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
              <div>
                <h4 className="font-bold text-emerald-800 text-sm">وضع الشبكة (الوصول الخارجي)</h4>
                <p className="text-xs text-emerald-600 mt-1">تفعيل هذا الخيار يسمح بالوصول للنظام عبر الشبكة المحلية أو الخارجية</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="networkMode"
                  checked={connectionForm.networkMode === 'network'}
                  onChange={handleConnectionChange}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان خادم النظام (IP / Hostname)</label>
              <input
                type="text"
                name="serverIp"
                value={connectionForm.serverIp}
                onChange={handleConnectionChange}
                dir="ltr"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm text-left font-mono"
                placeholder="192.168.1.100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">منفذ الاتصال (Port)</label>
              <input
                type="text"
                name="apiPort"
                value={connectionForm.apiPort}
                onChange={handleConnectionChange}
                dir="ltr"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm text-left font-mono"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">الرابط الأساسي للشبكة (Base API URL)</label>
              <input
                type="text"
                name="baseApiUrl"
                value={connectionForm.baseApiUrl}
                onChange={handleConnectionChange}
                dir="ltr"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm text-left font-mono"
                placeholder="http://192.168.1.100:5000/api"
              />
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default Settings;
