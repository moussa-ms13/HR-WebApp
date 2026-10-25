import React from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

const ProtectedRoute = ({ permission, children }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          ليس لديك صلاحية للوصول إلى هذه الصفحة
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          عذراً، حسابك الحالي لا يمتلك الصلاحية الكافية لعرض هذه الصفحة أو تنفيذ هذا الإجراء. يرجى التواصل مع مسؤول النظام لمنحك الصلاحيات المطلوبة.
        </p>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-lg text-white font-medium text-sm transition-all shadow-sm hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#105b38' }}
        >
          العودة إلى الرئيسية
        </Link>
      </div>
    );
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
