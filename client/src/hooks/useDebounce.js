import { useState, useEffect } from 'react';

/**
 * Returns `value` after it has stopped changing for `delay` ms.
 * Bind API calls / SWR keys ONLY to the returned debounced value.
 */
const useDebounce = (value, delay = 500) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export default useDebounce;
