import React from 'react';

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
  const corpsDecree = emp.CorpsType === 'سلك_خاص'
    ? 'وبمقتضى المرسوم التنفيذي رقم 10-300 المؤرخ في 23 ذي الحجة عام 1431 الموافق 29 نوفمبر سنة 2010 المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك الخاصة بالإدارة المكلفة بأملاك الدولة والحفظ العقاري ومسح الأراضي،'
    : 'وبمقتضى المرسوم التنفيذي الخاص بالأسلاك المشتركة،';

  const formattedStartDate = new Date(data.StartDate).toLocaleDateString('en-GB');
  const formattedEndDate = data.EndDate ? new Date(data.EndDate).toLocaleDateString('en-GB') : '';
  const formattedResumptionDate = data.ResumptionDate ? new Date(data.ResumptionDate).toLocaleDateString('en-GB') : '';
  const currentYear = new Date(data.StartDate).getFullYear();

  return (
    <div ref={ref} className="hidden print:block print-container bg-white text-black p-8 text-right font-arabic" dir="rtl" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', lineHeight: '1.6' }}>
      <div className="flex justify-between items-start mb-6">
        <div></div>
        <div className="text-center font-bold">
          <p>الجمهورية الجزائرية الديمقراطية الشعبية</p>
        </div>
        <div></div>
      </div>

      <div className="mb-8">
        <p>وزارة المالية</p>
        <p>المديرية العامة للأملاك الوطنية</p>
        <p>المديرية الجهوية للأملاك الوطنية بالشلف</p>
        <p>المديرية الفرعية للإدارة العامة</p>
        <p>رقم: .................</p>
      </div>

      <h1 className="text-center font-bold text-2xl mb-8">سند عطلة سنوية</h1>

      <div className="mb-6">
        <p className="font-bold mb-4">إن وزير المالية، (المدير الجهوي)</p>
        <ul className="list-disc list-inside space-y-2">
          <li>بمقتضى القانون رقم 81-08 المؤرخ في 27 جوان سنة 1981 المتعلق بالعطل السنوية،</li>
          <li>{corpsDecree}</li>
          <li>وبمقتضى المرسوم التنفيذي رقم 21-393 المؤرخ في 18 أكتوبر سنة 2021، يحدد تنظيم المصالح الخارجية للمديرية العامة للأملاك الوطنية وصلاحياتها،</li>
          <li>وبناءا على المقرر المتضمن تعيين {title} <span className="font-bold">{emp.Name} {emp.LastName}</span> {positionTense} <span className="font-bold">{emp.JobTitle?.RankName || data.CurrentJobTitle}</span> لدى المديرية الجهوية للأملاك الوطنية ناحية الشلف،</li>
          <li>وبعد الإطلاع على الطلب المحرر من طرف {requestedBy} المتضمن طلب العطلة السنوية بعنوان سنة {currentYear}</li>
          <li>وبإقتراح من السيد المدير الفرعي للإدارة العامة.</li>
        </ul>
      </div>

      <div className="text-center font-bold text-xl mb-6">
        *** يـقـــــرر ***
      </div>

      <div className="mb-6">
        <p><span className="font-bold">المادة الوحيدة:</span> تمنح عطلة سنوية مدفوعة الأجر مدتها.</p>
        <div className="mr-8 space-y-2 mt-2">
          <p><span className="font-bold">السنة:</span> {currentYear}</p>
          <p><span className="font-bold">للـسيد(ة):</span> {emp.Name} {emp.LastName}</p>
          <p><span className="font-bold">الرتبة:</span> {emp.JobTitle?.RankName || data.CurrentJobTitle}</p>
          <p><span className="font-bold">الوظيفة:</span> {emp.AssignedPosition || '-'}</p>
          <p><span className="font-bold">الفترة:</span> من {formattedStartDate} إلى {formattedEndDate}</p>
          <p>- العنوان الشخصي للمستفيد ولاية الشلف</p>
          <p>- {resumeVerb} {workTense} يوم {formattedResumptionDate}، لذا {uponTense} إبلاغنا بتاريخ الالتحاق {postTense} في نفس اليوم.</p>
        </div>
      </div>

      <div className="mb-8">
        <p className="font-bold underline mb-2">ملاحظة:</p>
        <p>تبقى {data.RemainingBalanceAfter !== undefined && data.RemainingBalanceAfter !== null ? data.RemainingBalanceAfter : '(رصيد غير متوفر)'} يوم من العطلة السنوية ({currentYear})</p>
      </div>

      <div className="flex justify-end mb-16">
        <div className="text-center">
          <p>حرر بالشلف في، ...................</p>
          <p className="font-bold mt-8">الـمـديــر</p>
        </div>
      </div>

      <div className="border-t border-black pt-2 text-sm text-center">
        <span>سنوية</span> - 
        <span className="line-through mx-1">مرضية</span> - 
        <span className="line-through mx-1">استثنائية</span> - 
        <span className="line-through mx-1">زواج</span> - 
        <span className="line-through mx-1">إزدياد</span> - 
        <span className="line-through mx-1">أمومة</span> - 
        <span className="line-through mx-1">ختان</span> - 
        <span className="line-through mx-1">تعويضية</span> - 
        <span className="line-through mx-1">وفاة</span>
      </div>
    </div>
  );
});

export default LeavePrintDocument;
