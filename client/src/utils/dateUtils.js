import React from 'react';

/**
 * Central Date Formatting Utilities — Strict YYYY/MM/DD (RTL Arabic UX)
 * 
 * In Arabic RTL reading flow, YYYY/MM/DD reads Day -> Month -> Year:
 * (e.g. 2021/08/12 is read 12 then 08 then 2021).
 */

/**
 * Format a date value to strictly YYYY/MM/DD (zero-padded 4-digit year, 2-digit month, 2-digit day).
 * Handles Date objects, ISO strings (YYYY-MM-DD...), and DD/MM/YYYY strings safely without timezone shifts.
 * 
 * @param {string|Date|null|undefined} value - Raw date input
 * @param {string} [fallback="—"] - Fallback string if value is null/invalid
 * @returns {string} Formatted date string (YYYY/MM/DD) or fallback
 */
export const formatDate = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (value === '—' || value === '-') return fallback;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-') return fallback;

    // 1. Direct YYYY-MM-DD or YYYY/MM/DD (prevents timezone drift from new Date("YYYY-MM-DD"))
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s].*)?$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      if (parseInt(year, 10) <= 1) return fallback;
      return `${year}/${month}/${day}`;
    }

    // 2. DD/MM/YYYY or DD-MM-YYYY format
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s].*)?$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      if (parseInt(year, 10) <= 1) return fallback;
      return `${year}/${month}/${day}`;
    }
  }

  // 3. Fallback to Date object parsing
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1) return fallback;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

/**
 * Format a date value to strictly YYYY/MM/DD HH:mm for audit logs and system records.
 * 
 * @param {string|Date|null|undefined} value - Raw date input
 * @param {string} [fallback="—"] - Fallback string if value is null/invalid
 * @returns {string} Formatted date-time string (YYYY/MM/DD HH:mm) or fallback
 */
export const formatDateTime = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (value === '—' || value === '-') return fallback;

  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1) return fallback;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

/**
 * Normalizes embedded DD/MM/YYYY or DD-MM-YYYY dates in free-text strings
 * (such as decision references: "مقرر رقم 822 بتاريخ 12/08/2022")
 * into YYYY/MM/DD ("مقرر رقم 822 بتاريخ 2022/08/12").
 * 
 * @param {string} text - Raw string possibly containing dates
 * @returns {string} Text with embedded dates converted to YYYY/MM/DD
 */
export const normalizeEmbeddedDates = (text) => {
  if (!text || typeof text !== 'string') return text;
  // Match DD/MM/YYYY or DD-MM-YYYY (not preceded or followed by digits)
  return text.replace(/(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?!\d)/g, (_match, d, m, y) => {
    return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
  });
};

/**
 * RTL-safe date display component.
 * Wraps the formatted YYYY/MM/DD date string in a dir="ltr" span to prevent
 * Bidi engine punctuation/slash flipping while respecting Arabic layout.
 * Pure JS (no JSX) so it is compatible in standard .js files.
 * 
 * @param {object} props
 * @param {string|Date} props.value - The raw date value
 * @param {boolean} [props.showTime=false] - Whether to include HH:mm
 * @param {string} [props.fallback="—"] - Fallback string if value is empty/null
 * @param {string} [props.className] - Additional CSS classes
 */
export const DateText = ({ value, showTime = false, fallback = '—', className = '' }) => {
  const formatted = showTime ? formatDateTime(value, fallback) : formatDate(value, fallback);
  return React.createElement(
    'span',
    {
      dir: 'ltr',
      className: `inline-block text-right ${className}`,
    },
    formatted
  );
};

/**
 * Safely adds 1 calendar day to a date (e.g. for leave resumption dates)
 * without timezone drift, returning strictly YYYY/MM/DD.
 * 
 * @param {string|Date|null|undefined} dateInput - The base date
 * @returns {string} The next calendar day formatted as YYYY/MM/DD
 */
export const addOneDay = (dateInput) => {
  if (!dateInput) return "";
  let year, month, day;
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const matchYMD = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (matchYMD) {
      year = parseInt(matchYMD[1], 10);
      month = parseInt(matchYMD[2], 10) - 1;
      day = parseInt(matchYMD[3], 10);
    } else {
      const matchDMY = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (matchDMY) {
        day = parseInt(matchDMY[1], 10);
        month = parseInt(matchDMY[2], 10) - 1;
        year = parseInt(matchDMY[3], 10);
      }
    }
  } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  }

  if (year === undefined) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  const nextDate = new Date(year, month, day + 1);
  const nextYear = nextDate.getFullYear();
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getDate()).padStart(2, "0");
  return `${nextYear}/${nextMonth}/${nextDay}`;
};

export default {
  formatDate,
  formatDateTime,
  normalizeEmbeddedDates,
  addOneDay,
  DateText,
};

