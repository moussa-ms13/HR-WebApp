import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import { FileText, Award, ChevronDown } from "lucide-react";

const WorkCertificateModal = lazy(() => import("./WorkCertificateModal"));
const ExperienceDecisionModal = lazy(() => import("./ExperienceDecisionModal"));

const OFFICIAL_DOCUMENT_ITEMS = [
  {
    id: "work-certificate",
    label: "شهادة عمل",
    description: "إصدار شهادة عمل رسمية مع رمز QR",
    icon: FileText,
    iconColor: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    id: "experience-decision",
    label: "مقرر تعويض الخبرة المهنية",
    description: "مقرر حساب تعويض الخبرة (1,4%) مع الحيثيات",
    icon: Award,
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50",
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-xs transition-colors hover:bg-[#0e3d29] active:scale-[0.98] cursor-pointer"
          style={{ backgroundColor: "#124E35" }}
        >
          <FileText size={16} />
          <span>إصدار وثيقة</span>
          <ChevronDown
            size={15}
            className={`transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {menuOpen && (
          <div className="absolute left-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200/90 py-1.5 z-50">
            <div className="px-3.5 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400">
              الوثائق الإدارية الرسمية
            </div>
            {OFFICIAL_DOCUMENT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenDoc(item.id)}
                  className="w-full text-right px-3.5 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <div
                    className={`w-8 h-8 rounded-lg ${item.bgColor} ${item.iconColor} flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
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
        {activeDoc === "experience-decision" && (
          <ExperienceDecisionModal
            isOpen={true}
            onClose={() => setActiveDoc(null)}
            employee={employee}
          />
        )}
      </Suspense>
    </>
  );
}
