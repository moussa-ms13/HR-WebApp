import React from 'react';
import QRCode from 'react-qr-code';

const arabicToLatin = (text) => {
  if (!text) return '';
  const map = {
    'أ':'A','ا':'A','إ':'E','آ':'A',
    'ب':'B','ت':'T','ث':'T',
    'ج':'J','ح':'H','خ':'K',
    'د':'D','ذ':'D','ر':'R','ز':'Z',
    'س':'S','ش':'S','ص':'S','ض':'D',
    'ط':'T','ظ':'Z','ع':'A','غ':'G',
    'ف':'F','ق':'K','ك':'K','ل':'L',
    'م':'M','ن':'N','ه':'H','و':'O',
    'ي':'Y','ى':'A','ة':'A','ئ':'E','ؤ':'O'
  };
  return text.split('').map(char => map[char] || char).join('');
};

const LeavePrintDocument = React.forwardRef(({ data }, ref) => {
  if (!data) return null;

  const emp = data.Employee;
  if (!emp) return null;

  // Dynamic Grammar (Gender)
  const isFemale = emp.Gender === 'أنثى';
  const title = isFemale ? 'السيدة' : 'السيد';
  const positionTense = isFemale ? 'بصفتها' : 'بصفته';
  const requestedBy = isFemale ? 'المعنية' : 'المعني';
  const resumeVerb = isFemale ? 'تستأنف' : 'يستأنف';
  const workTense = isFemale ? 'عملها' : 'عمله';
  const uponTense = isFemale ? 'عليها' : 'عليه';
  const postTense = isFemale ? 'بمنصبها' : 'بمنصبه';

  // Dynamic Corps Logic
  const isSpecialCorps = emp.CorpsType === 'سلك_خاص' || (emp.JobTitle && emp.JobTitle.EmploymentCategory && emp.JobTitle.EmploymentCategory.includes('خاص'));
  const corpsDecree = isSpecialCorps
    ? 'وبمقتضى المرسوم التنفيذي رقم 10-300 المؤرخ في 23 ذي الحجة عام 1431 الموافق 29 نوفمبر سنة 2010 المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك الخاصة بالإدارة المكلفة بأملاك الدولة والحفظ العقاري ومسح الأراضي،'
    : 'وبمقتضى المرسوم التنفيذي رقم 08-04 المؤرخ في 11 محرم عام 1429 الموافق 19 جانفي سنة 2008، المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك المشتركة في المؤسسات والإدارات العمومية، المعدل والمتمم،';

  const formattedStartDate = new Date(data.StartDate).toLocaleDateString('en-GB');
  const formattedEndDate = data.EndDate ? new Date(data.EndDate).toLocaleDateString('en-GB') : '';
  const formattedResumptionDate = data.ResumptionDate ? new Date(data.ResumptionDate).toLocaleDateString('en-GB') : '';
  const currentYear = new Date(data.StartDate).getFullYear();

  // Unique Code Logic
  const latinName = arabicToLatin(emp.Name).replace(/[^A-Z]/ig, '').toUpperCase();
  const latinLastName = arabicToLatin(emp.LastName).replace(/[^A-Z]/ig, '').toUpperCase();
  const namePrefix = (latinName + 'XX').substring(0, 2);
  const lastNamePrefix = (latinLastName + 'XX').substring(0, 2);

  const formatCodeDate = (dateString) => {
    if (!dateString) return '00000000';
    const d = new Date(dateString);
    if (isNaN(d)) return '00000000';
    return d.toISOString().split('T')[0].replace(/-/g, '');
  };

  const DOB = formatCodeDate(emp.DateOfBirth);
  const HireDate = formatCodeDate(emp.InstallationDate);
  const referenceCode = `${namePrefix}-${lastNamePrefix}-${DOB}-${HireDate}`;

  // QR Data payload
  const qrData = `الاسم: ${emp.Name} ${emp.LastName}\nالمدة: ${data.DaysCount || ''} يوم\nالرمز: ${referenceCode}`;

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm 20mm;
          }
          body * {
            visibility: hidden !important;
          }
          .leave-print-root,
          .leave-print-root * {
            visibility: visible !important;
          }
          .leave-print-root {
            display: block !important;
            position: absolute !important;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div
        ref={ref}
        className="leave-print-root"
        dir="rtl"
        style={{
          display: 'none',
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '13pt',
          lineHeight: '1.8',
          color: '#000',
          background: '#fff',
          padding: 0,
          margin: 0,
        }}
      >
        {/* ═══════ HEADER: Republic + QR ═══════ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '6mm',
        }}>
          {/* RIGHT side (RTL start): Republic title */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold', fontSize: '15pt', margin: 0 }}>الجمهورية الجزائرية الديمقراطية الشعبية</p>
          </div>

          {/* LEFT side (RTL end): QR Code — strict 64px container */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '72px',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              <QRCode value={qrData} size={64} level="M" />
            </div>
            <span style={{
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: '6pt',
              marginTop: '2px',
              direction: 'ltr',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.3px',
            }}>
              {referenceCode}
            </span>
          </div>
        </div>

        {/* ═══════ MINISTRY HIERARCHY ═══════ */}
        <div style={{
          textAlign: 'right',
          lineHeight: '1.5',
          fontSize: '12pt',
          marginBottom: '3mm',
        }}>
          <p style={{ margin: '0 0 1px' }}>وزارة المالية</p>
          <p style={{ margin: '0 0 1px' }}>المديرية العامة للأملاك الوطنية</p>
          <p style={{ margin: '0 0 1px' }}>المديرية الجهوية للأملاك الوطنية بالشلف</p>
          <p style={{ margin: '0 0 1px' }}>المديرية الفرعية للإدارة العامة</p>
          <p style={{ margin: '0 0 1px' }}>رقم: .................</p>
        </div>

        {/* ═══════ TITLE ═══════ */}
        <h1 style={{
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '20pt',
          margin: '8mm 0',
          textDecoration: 'underline',
          textUnderlineOffset: '4px',
        }}>
          سند عطلة سنوية
        </h1>

        {/* ═══════ LEGAL BODY ═══════ */}
        <div style={{ marginBottom: '4mm', textAlign: 'justify', lineHeight: '1.6' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '4mm' }}>إن وزير المالية، (المدير الجهوي)</p>

          <p style={{ margin: '0 0 2mm', paddingRight: '3mm' }}>
            - بمقتضى القانون رقم 81-08 المؤرخ في 27 جوان سنة 1981 المتعلق بالعطل السنوية،
          </p>
          <p style={{ margin: '0 0 2mm', paddingRight: '3mm' }}>
            - {corpsDecree}
          </p>
          <p style={{ margin: '0 0 2mm', paddingRight: '3mm' }}>
            - وبمقتضى المرسوم التنفيذي رقم 21-393 المؤرخ في 18 أكتوبر سنة 2021، يحدد تنظيم المصالح الخارجية للمديرية العامة للأملاك الوطنية وصلاحياتها،
          </p>
          <p style={{ margin: '0 0 2mm', paddingRight: '3mm' }}>
            - وبناءا على المقرر المتضمن تعيين {title}{' '}
            <span style={{ fontWeight: 'bold' }}>{emp.Name} {emp.LastName}</span>{' '}
            {positionTense}{' '}
            <span style={{ fontWeight: 'bold' }}>{emp.JobTitle?.RankName || data.CurrentJobTitle}</span>{' '}
            لدى المديرية الجهوية للأملاك الوطنية ناحية الشلف،
          </p>
          <p style={{ margin: '0 0 2mm', paddingRight: '3mm' }}>
            - وبعد الإطلاع على الطلب المحرر من طرف {requestedBy} المتضمن طلب العطلة السنوية بعنوان سنة {currentYear}
          </p>
          <p style={{ margin: '0 0 2mm', paddingRight: '3mm' }}>
            - وبإقتراح من السيد المدير الفرعي للإدارة العامة.
          </p>
        </div>

        {/* ═══════ DECISION ═══════ */}
        <div style={{
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '16pt',
          margin: '5mm 0',
        }}>
          *** يـقـــــرر ***
        </div>

        {/* ═══════ ARTICLE ═══════ */}
        <div style={{ marginBottom: '4mm', lineHeight: '1.8' }}>
          <p style={{ margin: '0 0 2mm' }}>
            <span style={{ fontWeight: 'bold' }}>المادة الوحيدة:</span>{' '}
            تمنح عطلة سنوية مدفوعة الأجر مدتها {data.DaysCount ? `${data.DaysCount} (${data.DaysCount}) يوم.` : '.'}
          </p>
          <div style={{ paddingRight: '10mm', lineHeight: '1.8' }}>
            <p style={{ margin: '0 0 1mm' }}>
              <span style={{ fontWeight: 'bold' }}>السنة:</span> {currentYear}
            </p>
            <p style={{ margin: '0 0 1mm' }}>
              <span style={{ fontWeight: 'bold' }}>للـسيد(ة):</span> {emp.Name} {emp.LastName}
            </p>
            <p style={{ margin: '0 0 1mm' }}>
              <span style={{ fontWeight: 'bold' }}>الرتبة:</span> {emp.JobTitle?.RankName || data.CurrentJobTitle}
            </p>
            <p style={{ margin: '0 0 1mm' }}>
              <span style={{ fontWeight: 'bold' }}>الوظيفة:</span> {emp.AssignedPosition || '-'}
            </p>
            <p style={{ margin: '0 0 1mm' }}>
              <span style={{ fontWeight: 'bold' }}>الفترة:</span> من {formattedStartDate} إلى {formattedEndDate}
            </p>
            <p style={{ margin: '0 0 1mm' }}>
              - العنوان الشخصي للمستفيد ولاية الشلف
            </p>
            <p style={{ margin: '0 0 1mm' }}>
              - {resumeVerb} {workTense} يوم {formattedResumptionDate}، لذا {uponTense} إبلاغنا بتاريخ الالتحاق {postTense} في نفس اليوم.
            </p>
          </div>
        </div>

        {/* ═══════ NOTE ═══════ */}
        <div style={{ marginBottom: '8mm' }}>
          <p style={{ margin: 0 }}>
            <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>ملاحظة:</span>{' '}
            تبقى {data.RemainingBalanceAfter !== undefined && data.RemainingBalanceAfter !== null ? data.RemainingBalanceAfter : '(رصيد غير متوفر)'} يوم من العطلة السنوية ({currentYear})
          </p>
        </div>

        {/* ═══════ SIGNATURE ═══════ */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '12mm',
          marginBottom: '10mm',
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0 }}>حرر بالشلف في، .....................</p>
            <p style={{ fontWeight: 'bold', marginTop: '18mm', margin: '18mm 0 0' }}>الـمـديــر</p>
          </div>
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <div style={{
          borderTop: '1px solid #000',
          paddingTop: '3mm',
          fontSize: '10pt',
          textAlign: 'center',
          marginTop: '10mm',
        }}>
          <span>سنوية</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>مرضية</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>استثنائية</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>زواج</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>إزدياد</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>أمومة</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>ختان</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>تعويضية</span>{' - '}
          <span style={{ textDecoration: 'line-through' }}>وفاة</span>
        </div>
      </div>
    </>
  );
});

export default LeavePrintDocument;
