import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

const Login = () => {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The location state might contain the page they were trying to visit before being redirected
  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!userName.trim() || !password) {
      setError('الرجاء إدخال اسم المستخدم وكلمة المرور');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmitting(true);
    
    const result = await login(userName.trim(), password);
    
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.message || 'اسم المستخدم أو كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setIsSubmitting(false);
    }
  };

  const handleUserNameChange = (e) => {
    setUserName(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans" dir="rtl">
      <style>{`
        @keyframes shakeInput {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-animation {
          animation: shakeInput 0.4s ease-in-out;
        }
      `}</style>

      <div className="max-w-md w-full px-6 py-8 bg-white shadow-xl rounded-2xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#e8f5ee', color: '#105b38' }}>
            <LogIn size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">تسجيل الدخول</h1>
          <p className="text-sm text-slate-500 mt-2">نظام إدارة الموارد البشرية — المديرية الجهوية</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="font-medium leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">اسم المستخدم</label>
            <input
              type="text"
              value={userName}
              onChange={handleUserNameChange}
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors duration-200 ${
                error
                  ? 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white'
              }`}
              placeholder="أدخل اسم المستخدم"
              dir="rtl"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={handlePasswordChange}
              className={`w-full px-4 py-3 rounded-lg border outline-none transition-all duration-200 text-left ${
                error
                  ? 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white'
              } ${shake ? 'shake-animation' : ''}`}
              placeholder="••••••••"
              dir="ltr"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-colors duration-200 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-95 cursor-pointer'}`}
            style={{ backgroundColor: '#105b38' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                جاري التحقق...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
