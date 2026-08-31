import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES = {
  error: 'bg-red-50 border-red-200 text-red-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const TOAST_ICON_STYLES = {
  error: 'text-red-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const toast = {
    error: (msg) => addToast(msg, 'error'),
    success: (msg) => addToast(msg, 'success'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast Container — top-center, RTL */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none" dir="rtl">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-slide-down ${TOAST_STYLES[t.type]}`}
            >
              <Icon size={20} className={`shrink-0 mt-0.5 ${TOAST_ICON_STYLES[t.type]}`} />
              <p className="flex-1 text-sm font-medium leading-relaxed whitespace-pre-line">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-0.5 rounded-full hover:bg-black/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Animation keyframe */}
      <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slide-down 0.25s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
};
