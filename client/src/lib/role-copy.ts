export function localizeRole(role: string | null | undefined, isArabic: boolean): string {
  if (!role) {
    return "";
  }

  if (!isArabic) {
    return role;
  }

  const labels: Record<string, string> = {
    "Regional Crisis Coordination Lead": "قائد إدارة الحدث والتنسيق بين الجهات",
    "Government Communications Lead": "قائد الاتصال الحكومي والمتحدث الرسمي",
    "Field Operations and Service Continuity Lead": "قائد العمليات الميدانية واستمرارية الخدمة",
    "Logistics and Resource Support Lead": "قائد إدارة الموارد والإسناد اللوجستي",
    "Early Warning and Risk Assessment Lead": "قائد التقييم المبكر للمخاطر والإنذار",
    "Health and Medical Surge Lead": "قائد التنسيق الصحي والاستجابة الطبية",
    "Critical Infrastructure and Utilities Lead": "قائد حماية البنية التحتية والخدمات الحرجة",
    "Recovery and Essential Services Restoration Lead": "قائد التعافي واستعادة الخدمات الأساسية",
    "Cybersecurity and Digital Continuity Lead": "قائد أمن المعلومات واستمرارية الأنظمة",
  };

  return labels[role] ?? role;
}
