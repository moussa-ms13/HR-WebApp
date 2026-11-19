import React from 'react';
import { useCustomExport } from './hooks/useCustomExport';
import ExportHeader from './components/ExportHeader';
import ExportFilterPanel from './components/ExportFilterPanel';
import ExportPreviewTable from './components/ExportPreviewTable';

const CustomExportPage = () => {
  const {
    reportType,
    handleReportTypeChange,
    filterOptions,
    selectedProvince,
    setSelectedProvince,
    selectedDirectorate,
    setSelectedDirectorate,
    availableDirectorates,
    employmentCategory,
    setEmploymentCategory,
    rankId,
    setRankId,
    availableRanks,
    status,
    setStatus,
    gender,
    setGender,
    searchQuery,
    setSearchQuery,
    leaveType,
    setLeaveType,
    resumeStatus,
    setResumeStatus,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    caseType,
    setCaseType,
    activeStatus,
    setActiveStatus,
    categoryMode,
    setCategoryMode,
    customTitle,
    setCustomTitle,
    isTitleManuallyEdited,
    setIsTitleManuallyEdited,
    generateSmartTitle,
    availableColumns,
    selectedColumns,
    handleToggleColumn,
    handleSelectAllColumns,
    handleResetDefaultColumns,
    previewRows,
    totalCount,
    isPreviewLoading,
    isExporting,
    handleExportExcel,
    handleResetFilters,
    fetchPreview,
    activeTableColumns,
  } = useCustomExport();

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      {/* 1. Header with Export & Reset Actions */}
      <ExportHeader
        totalCount={totalCount}
        isExporting={isExporting}
        onResetFilters={handleResetFilters}
        onExportExcel={handleExportExcel}
      />

      {/* 2. Filter & Configuration Card */}
      <ExportFilterPanel
        reportType={reportType}
        onReportTypeChange={handleReportTypeChange}
        filterOptions={filterOptions}
        selectedProvince={selectedProvince}
        onProvinceChange={(p) => {
          setSelectedProvince(p);
          setSelectedDirectorate('');
        }}
        selectedDirectorate={selectedDirectorate}
        onDirectorateChange={setSelectedDirectorate}
        availableDirectorates={availableDirectorates}
        employmentCategory={employmentCategory}
        onEmploymentCategoryChange={(cat) => {
          setEmploymentCategory(cat);
          setRankId('');
        }}
        rankId={rankId}
        onRankIdChange={setRankId}
        availableRanks={availableRanks}
        status={status}
        onStatusChange={setStatus}
        gender={gender}
        onGenderChange={setGender}
        leaveType={leaveType}
        onLeaveTypeChange={setLeaveType}
        resumeStatus={resumeStatus}
        onResumeStatusChange={setResumeStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        caseType={caseType}
        onCaseTypeChange={setCaseType}
        activeStatus={activeStatus}
        onActiveStatusChange={setActiveStatus}
        categoryMode={categoryMode}
        onCategoryModeChange={setCategoryMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        customTitle={customTitle}
        onCustomTitleChange={(t) => {
          setCustomTitle(t);
          setIsTitleManuallyEdited(true);
        }}
        isTitleManuallyEdited={isTitleManuallyEdited}
        onRestoreSmartTitle={() => {
          setIsTitleManuallyEdited(false);
          setCustomTitle(generateSmartTitle());
        }}
        availableColumns={availableColumns}
        selectedColumns={selectedColumns}
        onToggleColumn={handleToggleColumn}
        onSelectAllColumns={handleSelectAllColumns}
        onResetDefaultColumns={handleResetDefaultColumns}
      />

      {/* 3. Data Preview Table */}
      <ExportPreviewTable
        totalCount={totalCount}
        isPreviewLoading={isPreviewLoading}
        onRefresh={() => fetchPreview()}
        activeTableColumns={activeTableColumns}
        previewRows={previewRows}
      />
    </div>
  );
};

export default CustomExportPage;
