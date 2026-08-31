import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmModal — reusable confirmation dialog.
 *
 * Props:
 *   open       : boolean — show/hide
 *   title      : string  — heading text
 *   message    : string | ReactNode — body text
 *   confirmText: string  — confirm button label (default "تأكيد")
 *   cancelText : string  — cancel button label  (default "إلغاء")
 *   icon       : ReactNode — icon in the circle (default AlertTriangle)
 *   variant    : 'danger' | 'warning' — color scheme (default 'danger')
 *   onConfirm  : () => void
 *   onCancel   : () => void
 */
const VARIANTS = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    btn: 'bg-red-500 hover:bg-red-600 text-white',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    btn: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
};

const ConfirmModal = ({
  open,
  title = 'تأكيد العملية',
  message = 'هل أنت متأكد؟',
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  icon,
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const v = VARIANTS[variant] || VARIANTS.danger;
  const IconEl = icon || <AlertTriangle size={28} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in">
        <div className="p-6 text-center">
          <div className={`w-16 h-16 rounded-full ${v.iconBg} ${v.iconColor} flex items-center justify-center mx-auto mb-4`}>
            {IconEl}
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
          <div className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</div>
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${v.btn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
