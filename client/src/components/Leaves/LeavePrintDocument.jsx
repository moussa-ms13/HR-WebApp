import React from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";

const LTR = ({ children }) => (
  <span dir="ltr" style={{ unicodeBidi: "embed" }}>
    {children}
  </span>
);

const CORPS_DECREES = {
  common: {
    text:
      "وبمقتضى المرسوم التنفيذي رقم 04-08 المؤرخ في 11 محرم عام 1429 الموافق 19 جانفي سنة 2008 " +
      "المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك المشتركة في المؤسسات والإدارات " +
      "العمومية، المعدل والمتمم،",
  },
  special: {
    text:
      "وبمقتضى المرسوم التنفيذي رقم 300-10 المؤرخ في 23 ذي الحجة عام 1431 الموافق 29 نوفمبر سنة 2010 " +
      "المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك الخاصة بالإدارة المكلفة بأملاك الدولة " +
      "والحفظ العقاري ومسح الأراضي،",
  },
};

const LEAVE_TYPES_LEGEND =
  "سنوية – مرضية – استثنائية – زواج – إرضاع – أبوة – حكومة/ختان – تعويضية/وفاة";

function genderWord(gender, female, male) {
  return gender === "female" ? female : male;
}

export default function LeavePrintDocument({
  corpsType = "common",
  header,
  employee,
  decision,
  leave,
  signature = {},
  verification = {},
}) {
  const decree = CORPS_DECREES[corpsType] ?? CORPS_DECREES.common;
  const sirSeed = genderWord(employee.gender, "السيدة", "السيد");
  const bisifat = genderWord(employee.gender, "بصفتها", "بصفته");
  const maani = genderWord(employee.gender, "المعنية", "المعني");
  const yastanif = genderWord(employee.gender, "تستأنف عملها", "يستأنف عمله");
  const alayha = genderWord(employee.gender, "عليها", "عليه");
  const bimansibiha = genderWord(employee.gender, "بمنصبها", "بمنصبه");

  return (
    <div className="leave-doc-page" dir="rtl">
      <style>{`
        @page {
          size: A4;
          margin: 15mm;
        }
        .leave-doc-page {
          width: 100%;
          box-sizing: border-box;
          font-family: 'Amiri', 'Traditional Arabic', 'Noto Naskh Arabic', 'Tahoma', sans-serif;
          color: #111;
          font-size: 12.5px;
          line-height: 1.45;
        }
        .leave-doc-page * {
          box-sizing: border-box;
        }
        @media screen {
          .leave-doc-page {
            max-width: 210mm;
            margin: 24px auto;
            padding: 15mm;
            background: #fff;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
          }
        }
        @media print {
          .leave-doc-page {
            box-shadow: none;
            margin: 0;
            padding: 0;
          }
        }
        .doc-header {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .doc-republic {
          text-align: center;
          font-weight: bold;
          margin-bottom: 6px;
        }
        .doc-header-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .doc-ministry-block {
          text-align: center;
        }
        .doc-ministry-block div {
          white-space: nowrap;
        }
        .doc-subdirectorate-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          min-width: 90px;
        }
        .doc-qr-wrap {
          flex-shrink: 0;
          min-width: 80px;
          min-height: 80px;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .doc-qr-fallback {
          font-size: 10px;
          text-align: center;
          margin-top: 4px;
        }
        .doc-refnum {
          text-align: right;
          margin: 8px 0;
        }
        .doc-title {
          text-align: center;
          font-weight: bold;
          font-size: 17px;
          text-decoration: underline;
          margin: 10px 0 14px;
        }
        .doc-intro {
          font-weight: bold;
          margin-bottom: 8px;
        }
        .doc-whereas {
          margin: 0 0 8px;
          padding-right: 18px;
          text-indent: -18px;
        }
        .doc-decides {
          text-align: center;
          font-weight: bold;
          margin: 14px 0;
          letter-spacing: 2px;
        }
        .doc-article {
          margin-bottom: 6px;
        }
        .doc-article-line {
          margin: 6px 0;
        }
        .doc-article-line strong {
          font-weight: bold;
        }
        .doc-note-line {
          margin: 4px 0 4px 0;
        }
        .doc-remark {
          margin-top: 12px;
        }
        .doc-remark-label {
          font-weight: bold;
          text-decoration: underline;
        }
        .doc-signature {
          margin-top: 26px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .doc-signature-place {
          margin-bottom: 20px;
        }
        .doc-signature-title {
          font-weight: bold;
          text-align: center;
        }
        .doc-legend {
          margin-top: 24px;
          text-align: left;
          font-style: italic;
          font-size: 12px;
          color: #333;
        }
      `}</style>

      <div className="doc-header">
        <div className="doc-republic">الجمهورية الجزائرية الديمقراطية الشعبية</div>

        <div className="doc-header-row">
          <div className="doc-ministry-block">
            <div>وزارة المالية</div>
            <div>المديرية العامة للأملاك الوطنية</div>
            <div>المديرية الجهوية للأملاك الوطنية بـ{header.wilaya}</div>
          </div>

          <div className="doc-subdirectorate-block">
            {verification.url && (
              <div className="doc-qr-wrap">
                <QRCode value={verification.url} size={72} />
              </div>
            )}
            {verification.code && !verification.url && (
              <div className="doc-qr-fallback">{verification.code}</div>
            )}
            <div>المديرية الفرعية لـ{header.subDirectorate}</div>
          </div>
        </div>

        <div className="doc-refnum">
          رقم: {header.referenceNumber ? <LTR>{header.referenceNumber}</LTR> : "................."}
        </div>
      </div>

      <div className="doc-title">سند عطلة سنوية</div>

      <div className="doc-intro">إن وزير المالية، (المدير الجهوي)</div>

      <p className="doc-whereas">
        - بمقتضى القانون رقم 08-81 المؤرخ في 27 جوان سنة 1981 المتعلق بالعطل السنوية،
      </p>
      <p className="doc-whereas">- و{decree.text}</p>
      <p className="doc-whereas">
        - وبمقتضى المرسوم التنفيذي رقم 393-21 المؤرخ في 18 أكتوبر سنة 2021، يحدد تنظيم المصالح
        الخارجية للمديرية العامة للأملاك الوطنية وصلاحياتها،
      </p>
      <p className="doc-whereas">
        - وبناءا على المقرر المتضمن تعيين {sirSeed} <strong>{employee.name}</strong> {bisifat}{" "}
        <strong>{employee.rank}</strong> لدى {decision.directorateName}،
      </p>
      <p className="doc-whereas">
        - وبعد الإطلاع على الطلب المحرر من طرف {maani} المتضمن طلب العطلة السنوية بعنوان سنة{" "}
        <LTR>{leave.year}</LTR>
      </p>
      <p className="doc-whereas">- وبإقتراح من السيد المدير الفرعي للإدارة العامة.</p>

      <div className="doc-decides">*** يـقـرر ***</div>

      <div className="doc-article">
        <div className="doc-article-line">
          <strong>المادة الوحيدة:</strong> تمنح عطلة سنوية مدفوعة الأجر مدتها{" "}
          <strong>{leave.daysInWords}</strong> (<LTR>{leave.days}</LTR>) يوم.
        </div>
        <div className="doc-article-line">
          <strong>السنة:</strong> <LTR>{leave.year}</LTR>
        </div>
        <div className="doc-article-line">
          <strong>للسيد(ة):</strong> {employee.name}
        </div>
        <div className="doc-article-line">
          <strong>الرتبة:</strong> {employee.rank}
        </div>
        <div className="doc-article-line">
          <strong>الوظيفة:</strong> {employee.jobTitle || "/"}
        </div>
        <div className="doc-article-line">
          <strong>الفترة:</strong> <LTR>{leave.startDate}</LTR> إلى <LTR>{leave.endDate}</LTR>
        </div>
        <div className="doc-note-line">- العنوان الشخصي للمستفيد(ة) ولاية {employee.province}</div>
        <div className="doc-note-line">
          - {yastanif} يوم <LTR>{leave.resumeDate}</LTR>، لذا {alayha} إبلاغنا بتاريخ الالتحاق{" "}
          {bimansibiha} في نفس اليوم.
        </div>
      </div>

      {leave.remaining?.length > 0 && (
        <div className="doc-remark">
          <span className="doc-remark-label">ملاحظة:</span> تبقى{" "}
          {leave.remaining.map((r, i) => (
            <React.Fragment key={r.year}>
              {i > 0 && " و "}
              <strong>{r.daysInWords}</strong> (<LTR>{r.days}</LTR>) يوم من{" "}
              {i === 0 ? "العطلة السنوية" : "سنة"} (<LTR>{r.year}</LTR>)
            </React.Fragment>
          ))}
          .
        </div>
      )}

      <div className="doc-signature">
        <div className="doc-signature-place">
          حرر بـ{signature.place || "الشلف"} في {signature.date ? <LTR>{signature.date}</LTR> : "............."}
        </div>
        <div className="doc-signature-title">المدير</div>
      </div>

      <div className="doc-legend">{LEAVE_TYPES_LEGEND}</div>
    </div>
  );
}
