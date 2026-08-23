import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CalendarOff,
  History,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  {
    title: 'الرئيسية',
    path: '/',
    icon: <LayoutDashboard size={20} />,
    permission: 'checkBoxHome',
  },
  {
    title: 'إدارة الوظائف',
    path: '/jobs',
    icon: <Briefcase size={20} />,
    permission: 'checkBoxJobs',
  },
  {
    title: 'إدارة الموظفين وملفاتهم',
    path: '/employees',
    icon: <Users size={20} />,
    permission: 'checkBoxEmployees',
  },
  {
    title: 'إدارة العطل والحالات الخاصة',
    path: '/leaves',
    icon: <CalendarOff size={20} />,
    permission: 'checkBoxLeaves',
  },
  {
    title: 'إدارة المستخدمين والصلاحيات',
    path: '/users',
    icon: <UserCog size={20} />,
    permission: 'checkBoxUsers',
  },
  {
    title: 'سجل النظام',
    path: '/system-records',
    icon: <History size={20} />,
    permission: 'checkBoxSystemRecords',
  },
  {
    title: 'الإعدادات العامة والشبكة',
    path: '/settings',
    icon: <Settings size={20} />,
    permission: 'checkBoxSettings',
  }
];

const Sidebar = ({ isOpen, onClose }) => {
  const { hasPermission, logout, user } = useAuth();

  return <>
    {/* Overlay */}
    {isOpen && (
      <div
        className="fixed inset-0 bg-slate-900/50 z-40 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />
    )}

    {/* Drawer */}
    <aside
      className={`fixed inset-y-0 right-0 z-50 flex flex-col h-screen w-64 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ backgroundColor: '#0b3d2b', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 overflow-hidden shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'linear-gradient(135deg, #105b38 0%, #0b3d2b 100%)' }}
      >
        <h1 className="text-lg font-bold tracking-tight whitespace-nowrap" style={{ color: '#c7a43e' }}>
          نظام الموارد البشرية
        </h1>
        <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors p-1">
          <X size={20} />
        </button>
      </div>

      {/* User Info */}
      <div className="p-4 flex items-center space-x-3 space-x-reverse shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg font-semibold text-white shadow-inner"
          style={{ backgroundColor: '#0a7e50' }}
        >
          {user?.fullName?.charAt(0) || 'م'}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm font-medium truncate text-white">{user?.fullName || 'مستخدم'}</span>
          <span className="text-xs" style={{ color: '#c7a43e' }}>{user?.role || 'User'}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 sidebar-scrollbar">
        {NAV_ITEMS.map((item) => {
          if (!hasPermission(item.permission)) {
            return null;
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center space-x-3 space-x-reverse px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${isActive
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <div className="shrink-0">{item.icon}</div>
              <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100">
                {item.title}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 flex justify-center" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={logout}
          className="flex items-center justify-center text-sm font-medium rounded-lg transition-colors duration-200 w-full px-4 py-2"
          style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
        >
          <LogOut size={18} className="ml-2" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  </>


};

export default Sidebar;
