import { useMemo } from 'react';
import {
  invalidateResources,
  refreshEmployees,
  refreshLeaves,
  refreshSpecialCases,
  refreshJobTitles,
  refreshUsers,
  refreshDashboard,
  refreshEmployeeFiles,
  refreshEmployeeCareer,
  refreshAll,
  matchSWRKey,
} from '../utils/cacheManager';

/**
 * Custom hook providing access to centralized SWR cache invalidators.
 * Ideal for components that prefer hook-based patterns.
 */
export const useDataSync = () => {
  return useMemo(() => ({
    invalidateResources,
    refreshEmployees,
    refreshLeaves,
    refreshSpecialCases,
    refreshJobTitles,
    refreshUsers,
    refreshDashboard,
    refreshEmployeeFiles,
    refreshEmployeeCareer,
    refreshAll,
    matchSWRKey,
  }), []);
};

export default useDataSync;
