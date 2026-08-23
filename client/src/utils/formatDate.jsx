/**
 * Central Date Formatting Utilities — RTL-safe
 * 
 * All date rendering in this RTL Arabic app MUST use these helpers.
 * They enforce DD/MM/YYYY (en-GB locale) to avoid Bidi algorithm mangling.
 * 
 * IMPORTANT: When rendering in JSX, always use the <DateText> component
 * or wrap the output in <span dir="ltr" className="inline-block text-right">
 * to prevent the browser's RTL engine from flipping slashes and numbers.
 */

/**
 * Format a date value to DD/MM/YYYY.
 * Returns '—' for null, undefined, or invalid dates.
 * @param {string|Date|null} d - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1) return '—';
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * Format a date value to DD/MM/YYYY HH:mm.
 * Returns '—' for null, undefined, or invalid dates.
 * @param {string|Date|null} d - The date to format
 * @returns {string} Formatted date-time string
 */
export const formatDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1) return '—';
  const datePart = date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timePart = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} ${timePart}`;
};

/**
 * RTL-safe date display component.
 * Wraps the date string in a dir="ltr" span to prevent Bidi distortion.
 * Use this anywhere dates are rendered inside RTL containers.
 * 
 * @param {object} props
 * @param {string} props.value - The raw date string/ISO
 * @param {boolean} [props.showTime=false] - Whether to include HH:mm
 * @param {string} [props.className] - Additional CSS classes
 */
export const DateText = ({ value, showTime = false, className = '' }) => {
  const formatted = showTime ? formatDateTime(value) : formatDate(value);
  return (
    <span dir="ltr" className={`inline-block text-right ${className}`}>
      {formatted}
    </span>
  );
};
