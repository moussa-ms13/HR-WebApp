import apiClient from './apiClient';

let cachedFilterOptions = null;

class ExportService {
  /**
   * Clears client in-memory cache for filter options
   */
  static clearCache() {
    cachedFilterOptions = null;
  }

  /**
   * Fetch cascading filter options (provinces, directorates, categories, ranks, etc.)
   * Cached in client memory to prevent duplicate roundtrips on rapid navigation.
   */
  static async getFilterOptions(options = {}) {
    if (cachedFilterOptions && !options?.forceRefresh) {
      return cachedFilterOptions;
    }
    const response = await apiClient.get('/exports/filter-options', {
      signal: options?.signal,
    });
    cachedFilterOptions = response.data;
    return response.data;
  }

  /**
   * Fetch preview data (50 rows limit + total count + active columns)
   * Supports AbortSignal to cancel stale preview requests on filter change or unmount.
   */
  static async getPreview(reportType, filters = {}, columns = [], options = {}) {
    const params = {
      reportType,
      ...filters,
    };
    if (columns && columns.length > 0) {
      params.columns = columns.join(',');
    }

    const response = await apiClient.get('/exports/preview', {
      params,
      signal: options?.signal,
    });
    return response.data;
  }

  /**
   * Download custom formatted official RTL Excel workbook
   */
  static async downloadExcel(reportType, filters = {}, columns = [], customTitle = '') {
    const params = {
      reportType,
      ...filters,
      customTitle,
    };
    if (columns && columns.length > 0) {
      params.columns = columns.join(',');
    }

    const response = await apiClient.get('/exports/excel', {
      params,
      responseType: 'blob',
    });

    // Extract filename from Content-Disposition header if available
    let filename = `تقرير_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
      }
    }

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return true;
  }
}

export default ExportService;
