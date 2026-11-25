import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import {
  getMofatishiyat,
  getMohafathat,
  PROVINCIAL_AMLAK_BASE,
  PROVINCIAL_MASH_BASE,
  CHLEF_MASH_DIRECTORATE,
  REGIONAL_DIRECTORATE,
} from '../../utils/constants';
import { useToast } from '../ui/Toast';

const TreeNode = ({ label, value, children, onSelect, isLeaf, dirTag }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleRowClick = (e) => {
    e.stopPropagation();
    if (isLeaf) {
      onSelect(value || label, dirTag);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div className="ml-4 rtl:ml-0 rtl:mr-4 select-none">
      <div
        onClick={handleRowClick}
        className={`flex items-center py-1.5 px-2 rounded transition-colors cursor-pointer ${
          isLeaf
            ? 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 font-normal'
            : 'font-bold text-slate-800 hover:bg-slate-100'
        }`}
      >
        {!isLeaf && (
          <div className="p-0.5 rounded text-slate-500">
            {isOpen ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
          </div>
        )}
        {isLeaf && <div className="w-4 h-4 inline-block mr-1 rtl:mr-0 rtl:ml-1" />}
        <div className="flex-1 mr-1 rtl:mr-0 rtl:ml-1">{label}</div>
      </div>
      {isOpen && children && (
        <div className="border-r-2 border-slate-100 pr-2 rtl:pr-4">{children}</div>
      )}
    </div>
  );
};

function WorkplaceTreePicker({
  province,
  value,
  onChange,
  disabled = false,
  inputClassName = 'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none text-sm cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed',
  placeholder = 'اضغط لاختيار مكان التعيين...',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const toast = useToast();

  const mofatishiyat = useMemo(() => (province ? getMofatishiyat(province) : []), [province]);
  const mohafathat = useMemo(() => (province ? getMohafathat(province) : []), [province]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!province) {
      toast.warning('يرجى اختيار الولاية أولاً.');
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (selectedPlace, dirTag) => {
    onChange?.(selectedPlace, dirTag);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={value || ''}
          placeholder={placeholder}
          onClick={handleToggle}
          disabled={disabled}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className="px-4 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          {isOpen ? 'إغلاق' : 'اختيار'}
        </button>
      </div>

      {isOpen && province && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-20 max-h-64 overflow-y-auto">
          <TreeNode label={REGIONAL_DIRECTORATE} onSelect={handleSelect} isLeaf={false}>
            {province === 'الشلف' && (
              <TreeNode
                label={REGIONAL_DIRECTORATE}
                value={REGIONAL_DIRECTORATE}
                onSelect={handleSelect}
                isLeaf={true}
                dirTag={REGIONAL_DIRECTORATE}
              />
            )}

            <TreeNode label={PROVINCIAL_AMLAK_BASE} onSelect={handleSelect} isLeaf={false}>
              <TreeNode
                label={`${PROVINCIAL_AMLAK_BASE} (${province})`}
                value={`${PROVINCIAL_AMLAK_BASE} (${province})`}
                onSelect={handleSelect}
                isLeaf={true}
                dirTag={PROVINCIAL_AMLAK_BASE}
              />
              <TreeNode label="مفتشيات أملاك الدولة" onSelect={handleSelect} isLeaf={false}>
                {mofatishiyat.map((m) => (
                  <TreeNode
                    key={m}
                    label={m}
                    value={m}
                    onSelect={handleSelect}
                    isLeaf={true}
                    dirTag={PROVINCIAL_AMLAK_BASE}
                  />
                ))}
              </TreeNode>
            </TreeNode>

            <TreeNode label={PROVINCIAL_MASH_BASE} onSelect={handleSelect} isLeaf={false}>
              <TreeNode
                label={province === 'الشلف' ? CHLEF_MASH_DIRECTORATE : `${PROVINCIAL_MASH_BASE} (${province})`}
                value={province === 'الشلف' ? CHLEF_MASH_DIRECTORATE : `${PROVINCIAL_MASH_BASE} (${province})`}
                onSelect={handleSelect}
                isLeaf={true}
                dirTag={PROVINCIAL_MASH_BASE}
              />
              <TreeNode label="المحافظات العقارية" onSelect={handleSelect} isLeaf={false}>
                {mohafathat.map((m) => (
                  <TreeNode
                    key={m}
                    label={m}
                    value={m}
                    onSelect={handleSelect}
                    isLeaf={true}
                    dirTag={PROVINCIAL_MASH_BASE}
                  />
                ))}
              </TreeNode>
            </TreeNode>
          </TreeNode>
        </div>
      )}
    </div>
  );
}

export default React.memo(WorkplaceTreePicker);
