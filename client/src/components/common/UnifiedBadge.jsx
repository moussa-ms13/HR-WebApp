import React from 'react';
import {
  BadgeCheck,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Check,
  ShieldCheck,
  User,
  Eye,
} from 'lucide-react';

/**
 * UnifiedBadge — Centralized Calm Single-Surface Enterprise Badge System
 * Base surface: bg-slate-50 text-slate-700 border border-slate-200/90
 * Differentiated through distinct micro-icons, subtle indicator dots, and border styles.
 */
export default function UnifiedBadge({
  children,
  icon: Icon = null,
  iconColor = '',
  dotColor = null,
  isDashed = false,
  isMuted = false,
  className = '',
  ...props
}) {
  const surfaceClasses = isMuted
    ? 'bg-slate-50/50 text-slate-500 border border-dashed border-slate-200'
    : isDashed
    ? 'bg-slate-50/60 text-slate-600 border border-dashed border-slate-300'
    : 'bg-slate-50 text-slate-700 border border-slate-200/90';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium select-none transition-colors ${surfaceClasses} ${className}`}
      {...props}
    >
      {dotColor && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      )}
      {Icon && (
        <Icon size={13} className={`shrink-0 ${iconColor}`} />
      )}
      <span>{children}</span>
    </span>
  );
}

/**
 * StatutoryStatusBadge: Employee statutory status (الحالة)
 * - مرسم / مثبت / نشط: BadgeCheck (emerald)
 * - متربص: Clock (sky)
 * - متعاقد: FileText (indigo) — eliminates yellow collision with 'ناقص'
 */
export function StatutoryStatusBadge({ status, className = '' }) {
  const s = String(status || '').trim();

  if (s === 'مرسم' || s === 'مثبت' || s === 'نشط' || !s) {
    return (
      <UnifiedBadge
        icon={BadgeCheck}
        iconColor="text-emerald-600"
        className={className}
      >
        مرسم
      </UnifiedBadge>
    );
  }

  if (s === 'متربص') {
    return (
      <UnifiedBadge
        icon={Clock}
        iconColor="text-sky-600"
        className={className}
      >
        متربص
      </UnifiedBadge>
    );
  }

  if (s === 'متعاقد') {
    return (
      <UnifiedBadge
        icon={FileText}
        iconColor="text-indigo-600"
        className={className}
      >
        متعاقد
      </UnifiedBadge>
    );
  }

  return (
    <UnifiedBadge
      icon={User}
      iconColor="text-slate-400"
      className={className}
    >
      {s}
    </UnifiedBadge>
  );
}

/**
 * ProfileCompletenessBadge: Profile completeness (الملف)
 * - مكتمل: Solid border + CheckCircle2 (emerald)
 * - ناقص: Dashed border + AlertCircle (amber)
 */
export function ProfileCompletenessBadge({ isComplete, className = '' }) {
  const complete = Boolean(isComplete);

  if (complete) {
    return (
      <UnifiedBadge
        icon={CheckCircle2}
        iconColor="text-emerald-600"
        className={className}
      >
        مكتمل
      </UnifiedBadge>
    );
  }

  return (
    <UnifiedBadge
      icon={AlertCircle}
      iconColor="text-amber-500"
      isDashed={true}
      className={className}
    >
      ناقص
    </UnifiedBadge>
  );
}

/**
 * LeaveStatusBadge: Leave status (حالة الاستئناف / العطلة)
 * - ساري المفعول / active: Emerald indicator dot
 * - يستأنف قريباً / warning: Amber indicator dot
 * - لم يستأنف (متأخر) / overdue: Red AlertTriangle
 * - تم الاستئناف / resumed: Muted dashed pill + Check icon (slate-400)
 */
export function LeaveStatusBadge({ status, className = '' }) {
  const s = String(status || '').toLowerCase();

  if (s === 'resumed' || status === 'تم الاستئناف' || status === 'مستأنف') {
    return (
      <UnifiedBadge
        icon={Check}
        iconColor="text-slate-400"
        isMuted={true}
        className={className}
      >
        تم الاستئناف
      </UnifiedBadge>
    );
  }

  if (s === 'warning' || status === 'يستأنف قريباً') {
    return (
      <UnifiedBadge
        dotColor="bg-amber-500"
        className={className}
      >
        يستأنف قريباً
      </UnifiedBadge>
    );
  }

  if (s === 'overdue' || status === 'لم يستأنف (متأخر)' || status === 'لم يستأنف' || status === 'منتهي') {
    return (
      <UnifiedBadge
        icon={AlertTriangle}
        iconColor="text-red-500"
        className={`border-slate-300 text-slate-800 ${className}`}
      >
        لم يستأنف (متأخر)
      </UnifiedBadge>
    );
  }

  // Active or permanent default
  return (
    <UnifiedBadge
      dotColor="bg-emerald-500"
      className={className}
    >
      ساري المفعول
    </UnifiedBadge>
  );
}

/**
 * SpecialCaseStatusBadge: Special cases status (الحالة الإدارية)
 * - سارية المفعول / temporary_active: Emerald dot
 * - قرار نهائي / permanent_exit: Indigo dot
 * - منتهية (أرشيف) / archived: Muted dashed + Slate dot
 */
export function SpecialCaseStatusBadge({ status, statusKey, className = '' }) {
  const key = statusKey || (typeof status === 'object' ? status?.key : status);
  const label = typeof status === 'object' ? status?.badgeLabel : (status || '');

  if (key === 'permanent_exit' || label === 'قرار نهائي') {
    return (
      <UnifiedBadge
        dotColor="bg-indigo-500"
        className={className}
      >
        قرار نهائي
      </UnifiedBadge>
    );
  }

  if (key === 'archived' || label === 'منتهية (أرشيف)' || label === 'منتهية') {
    return (
      <UnifiedBadge
        dotColor="bg-slate-400"
        isMuted={true}
        className={className}
      >
        منتهية (أرشيف)
      </UnifiedBadge>
    );
  }

  return (
    <UnifiedBadge
      dotColor="bg-emerald-500"
      className={className}
    >
      سارية المفعول
    </UnifiedBadge>
  );
}

/**
 * UserRoleBadge: User role in UsersList
 * - Admin: ShieldCheck (emerald)
 * - User: User (slate-500)
 * - Read: Eye (slate-400)
 */
export function UserRoleBadge({ role, className = '' }) {
  const r = String(role || '').trim();

  if (r === 'Admin') {
    return (
      <UnifiedBadge
        icon={ShieldCheck}
        iconColor="text-emerald-600"
        className={className}
      >
        Admin
      </UnifiedBadge>
    );
  }

  if (r === 'Read') {
    return (
      <UnifiedBadge
        icon={Eye}
        iconColor="text-slate-400"
        className={className}
      >
        Read
      </UnifiedBadge>
    );
  }

  return (
    <UnifiedBadge
      icon={User}
      iconColor="text-slate-500"
      className={className}
    >
      User
    </UnifiedBadge>
  );
}
