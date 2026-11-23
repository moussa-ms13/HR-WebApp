import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import { ChevronDown } from "lucide-react";

const WorkCertificateModal = lazy(() => import("./WorkCertificateModal"));
const WorkCertificateFrModal = lazy(() => import("./WorkCertificateFrModal"));

// Universal administrative documents applicable to all employees
const OFFICIAL_DOCUMENT_ITEMS = [
  {
    id: "work-certificate",
    label: "شهادة عمل",
  },
  {
    id: "work-certificate-fr",
    label: "شهادة عمل (فرنسية)",
  },
];

/**
 * OfficialDocumentsMenu — Extensible dropdown button ("إصدار وثيقة")
 * mounted in EmployeeProfile top action bar.
 */
export default function OfficialDocumentsMenu({ employee }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const handleOpenDoc = (docId) => {
    setMenuOpen(false);
    setActiveDoc(docId);
  };

  return (
    <>
      <div ref={containerRef} className="relative inline-block text-right">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-sm transition-colors cursor-pointer"
        >
          <span>إصدار وثيقة</span>
          <ChevronDown
            size={15}
            className={`transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {menuOpen && (
          <div className="absolute left-0 mt-2 w-48 rounded-xl bg-white shadow-lg border border-slate-200/90 py-1 z-50">
            {OFFICIAL_DOCUMENT_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpenDoc(item.id)}
                className="w-full text-right px-4 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        {activeDoc === "work-certificate" && (
          <WorkCertificateModal
            isOpen={true}
            onClose={() => setActiveDoc(null)}
            employee={employee}
          />
        )}
        {activeDoc === "work-certificate-fr" && (
          <WorkCertificateFrModal
            isOpen={true}
            onClose={() => setActiveDoc(null)}
            employee={employee}
          />
        )}
      </Suspense>
    </>
  );
}
