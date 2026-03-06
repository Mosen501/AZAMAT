import { Activity, AlertTriangle, Building2, HeartPulse, Radio, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ScenarioSummary, SectorId, SimulationLevel } from "@shared/schema";

export interface LocalizedCopy {
  en: string;
  ar: string;
}

export interface LevelOption {
  id: SimulationLevel;
  label: LocalizedCopy;
  description: LocalizedCopy;
}

export interface SectorOption {
  id: SectorId;
  label: LocalizedCopy;
  description: LocalizedCopy;
}

export interface RoleOption {
  id: string;
  icon: LucideIcon;
  sectors: SectorId[];
  title: LocalizedCopy;
  description: LocalizedCopy;
}

export const LEVEL_OPTIONS: LevelOption[] = [
  {
    id: "beginner",
    label: { en: "Beginner", ar: "مبتدئ" },
    description: {
      en: "Structured step-by-step crisis simulation using multiple-choice decisions.",
      ar: "محاكاة منظمة خطوة بخطوة عبر قرارات متعددة الخيارات.",
    },
  },
  {
    id: "advanced",
    label: { en: "Advanced", ar: "متقدم" },
    description: {
      en: "Interactive AI-led simulation through live conversation and dynamic pressure updates.",
      ar: "محاكاة تفاعلية عبر محادثة مباشرة مع الذكاء الاصطناعي وتحديثات ضغط ديناميكية.",
    },
  },
];

export const SECTOR_OPTIONS: SectorOption[] = [
  {
    id: "crowdEvents",
    label: { en: "Mass Gatherings and Public Safety", ar: "الحشود والفعاليات والسلامة العامة" },
    description: {
      en: "Hajj operations, major events, and high-density mobility pressure.",
      ar: "عمليات الحج والفعاليات الكبرى وضغط الحركة والكثافة المرتفعة.",
    },
  },
  {
    id: "healthSurge",
    label: { en: "Health Surge and Emergency Care", ar: "الضغط الصحي والرعاية الطارئة" },
    description: {
      en: "Emergency department overload, triage pressure, and coordinated clinical response.",
      ar: "ضغط أقسام الطوارئ والفرز الطبي والاستجابة السريرية المشتركة.",
    },
  },
  {
    id: "infrastructure",
    label: { en: "Critical Infrastructure and Utilities", ar: "البنية التحتية والخدمات الحرجة" },
    description: {
      en: "Water, energy, transport, and continuity of essential urban services.",
      ar: "المياه والطاقة والنقل واستمرارية الخدمات الحضرية الأساسية.",
    },
  },
  {
    id: "cyber",
    label: { en: "Cyber and Digital Continuity", ar: "الأمن السيبراني واستمرارية الأنظمة الرقمية" },
    description: {
      en: "Cyber incidents affecting national platforms, service access, and trust.",
      ar: "حوادث سيبرانية تؤثر على المنصات الوطنية وإتاحة الخدمة والثقة العامة.",
    },
  },
];

export const ROLE_OPTIONS: RoleOption[] = [
  {
    id: "Regional Crisis Coordination Lead",
    icon: Shield,
    sectors: ["crowdEvents", "healthSurge", "infrastructure", "cyber"],
    title: {
      en: "Incident and Interagency Coordination",
      ar: "قائد إدارة الحدث والتنسيق بين الجهات",
    },
    description: {
      en: "Lead unified command across ministries and local authorities and align cross-agency priorities.",
      ar: "يقود القيادة الموحدة بين الوزارات والجهات المحلية ويوحّد أولويات الاستجابة المشتركة.",
    },
  },
  {
    id: "Government Communications Lead",
    icon: Radio,
    sectors: ["crowdEvents", "healthSurge", "infrastructure", "cyber"],
    title: {
      en: "Government Communications and Spokesperson",
      ar: "قائد الاتصال الحكومي والمتحدث الرسمي",
    },
    description: {
      en: "Run official messaging, media handling, and bilingual guidance to protect public trust.",
      ar: "يدير الرسائل الرسمية والتعامل الإعلامي والإرشاد ثنائي اللغة لحماية الثقة العامة.",
    },
  },
  {
    id: "Field Operations and Service Continuity Lead",
    icon: Activity,
    sectors: ["crowdEvents", "healthSurge", "infrastructure"],
    title: {
      en: "Field Operations and Continuity",
      ar: "قائد العمليات الميدانية واستمرارية الخدمة",
    },
    description: {
      en: "Coordinate frontline execution and preserve continuity in critical service corridors.",
      ar: "ينسّق التنفيذ الميداني ويحافظ على استمرارية مسارات الخدمة الحرجة.",
    },
  },
  {
    id: "Logistics and Resource Support Lead",
    icon: Building2,
    sectors: ["crowdEvents", "healthSurge", "infrastructure", "cyber"],
    title: {
      en: "Logistics and Resource Support",
      ar: "قائد إدارة الموارد والإسناد اللوجستي",
    },
    description: {
      en: "Manage surge staffing, transport, supply chains, and mutual aid requests.",
      ar: "يدير تعزيز القوى البشرية والنقل وسلاسل الإمداد وطلبات الإسناد المتبادل.",
    },
  },
  {
    id: "Early Warning and Risk Assessment Lead",
    icon: AlertTriangle,
    sectors: ["crowdEvents", "healthSurge", "infrastructure", "cyber"],
    title: {
      en: "Early Warning and Risk Assessment",
      ar: "قائد التقييم المبكر للمخاطر والإنذار",
    },
    description: {
      en: "Translate weak signals into escalation triggers and decision-grade alerts.",
      ar: "يحوّل الإشارات المبكرة إلى حدود تصعيد وتنبيهات تشغيلية لصنّاع القرار.",
    },
  },
  {
    id: "Health and Medical Surge Lead",
    icon: HeartPulse,
    sectors: ["healthSurge", "crowdEvents"],
    title: {
      en: "Health and Medical Surge",
      ar: "قائد التنسيق الصحي والاستجابة الطبية",
    },
    description: {
      en: "Coordinate hospitals, EMS, and public health response under care-capacity pressure.",
      ar: "ينسّق بين المستشفيات والإسعاف والصحة العامة تحت ضغط السعة العلاجية.",
    },
  },
  {
    id: "Critical Infrastructure and Utilities Lead",
    icon: Building2,
    sectors: ["infrastructure", "crowdEvents"],
    title: {
      en: "Infrastructure and Utilities Continuity",
      ar: "قائد حماية البنية التحتية والخدمات الحرجة",
    },
    description: {
      en: "Protect continuity of utilities while coordinating technical recovery across agencies.",
      ar: "يحمي استمرارية خدمات المرافق وينسّق الاستعادة الفنية عبر الجهات.",
    },
  },
  {
    id: "Recovery and Essential Services Restoration Lead",
    icon: Activity,
    sectors: ["crowdEvents", "healthSurge", "infrastructure", "cyber"],
    title: {
      en: "Recovery and Service Restoration",
      ar: "قائد التعافي واستعادة الخدمات الأساسية",
    },
    description: {
      en: "Lead phased recovery, verify stability, and close incidents with funded corrective actions.",
      ar: "يقود التعافي المرحلي ويتحقق من الاستقرار ويغلق الحوادث بإجراءات تصحيحية ممولة.",
    },
  },
  {
    id: "Cybersecurity and Digital Continuity Lead",
    icon: Shield,
    sectors: ["cyber", "infrastructure"],
    title: {
      en: "Cybersecurity and Digital Continuity",
      ar: "قائد أمن المعلومات واستمرارية الأنظمة",
    },
    description: {
      en: "Contain cyber incidents and maintain availability of critical public digital services.",
      ar: "يحتوي الحوادث السيبرانية ويحافظ على إتاحة الخدمات الرقمية العامة الحرجة.",
    },
  },
];

export const RESPONSE_RULES_BY_SECTOR: Record<SectorId, LocalizedCopy[]> = {
  crowdEvents: [
    {
      en: "Escalate crowd-flow anomalies before density reaches unsafe thresholds.",
      ar: "صعّد إشارات تعثر تدفق الحشود قبل الوصول إلى كثافات غير آمنة.",
    },
    {
      en: "Issue one multilingual route advisory channel for all field agencies.",
      ar: "فعّل قناة توجيه متعددة اللغات موحدة لجميع الجهات الميدانية.",
    },
    {
      en: "Prioritize life safety, hydration, and medical access above schedule adherence.",
      ar: "قدّم سلامة الأرواح والترطيب والوصول الطبي على الالتزام الصارم بالجدول.",
    },
    {
      en: "Use phased movement controls instead of full-stop decisions without alternatives.",
      ar: "استخدم ضبط الحركة المرحلي بدل قرارات الإيقاف الكامل دون بدائل.",
    },
    {
      en: "Record route decisions and trigger points for post-event readiness updates.",
      ar: "وثّق قرارات المسارات ونقاط التفعيل لتحديث جاهزية ما بعد الحدث.",
    },
  ],
  healthSurge: [
    {
      en: "Redistribute patient load early across hospitals before bottlenecks become visible.",
      ar: "أعد توزيع الحمل على المستشفيات مبكرا قبل أن تتحول الاختناقات إلى أزمة ظاهرة.",
    },
    {
      en: "Publish clear public triage guidance on where and when to seek care.",
      ar: "انشر إرشادات فرز واضحة للجمهور حول متى وأين يطلب الرعاية.",
    },
    {
      en: "Protect critical services by scaling non-urgent activity in controlled phases.",
      ar: "احم الخدمات الحرجة عبر خفض الأنشطة غير العاجلة على مراحل منضبطة.",
    },
    {
      en: "Track ambulance turnaround and emergency bed occupancy as hard trigger metrics.",
      ar: "تابع زمن دوران الإسعاف وإشغال أسرّة الطوارئ كمؤشرات تفعيل حاسمة.",
    },
    {
      en: "Align health, event, and communication decisions under one command cadence.",
      ar: "وحّد قرارات الصحة والفعالية والاتصال ضمن إيقاع قيادة موحد.",
    },
  ],
  infrastructure: [
    {
      en: "Prioritize continuity of hospitals, transport, and other critical institutions first.",
      ar: "قدّم استمرارية المستشفيات والنقل وسائر المؤسسات الحرجة أولا.",
    },
    {
      en: "Move to staged restrictions early instead of waiting for total service degradation.",
      ar: "انتقل مبكرا إلى قيود مرحلية بدل انتظار تدهور الخدمة الكامل.",
    },
    {
      en: "Separate verified restoration timelines from assumptions in public briefings.",
      ar: "افصل بين جداول الاستعادة المؤكدة والافتراضات في الإحاطات العامة.",
    },
    {
      en: "Pre-position logistics support before public demand spikes.",
      ar: "جهّز الإسناد اللوجستي مسبقا قبل ارتفاع الطلب العام.",
    },
    {
      en: "Close incidents with funded resilience actions, not narrative-only closure.",
      ar: "اختم الحوادث بإجراءات مرونة ممولة لا بإغلاق إعلامي فقط.",
    },
  ],
  cyber: [
    {
      en: "Contain affected systems fast and isolate blast radius before service-wide impact.",
      ar: "احتوِ الأنظمة المتأثرة بسرعة واعزل نطاق الضرر قبل امتداده للخدمة الشاملة.",
    },
    {
      en: "Maintain one verified public status page for service availability updates.",
      ar: "حافظ على صفحة حالة عامة موثقة واحدة لتحديث إتاحة الخدمات.",
    },
    {
      en: "Coordinate legal, technical, and communication tracks under a single decision owner.",
      ar: "نسّق المسارات القانونية والفنية والاتصالية تحت مالك قرار واحد.",
    },
    {
      en: "Prioritize identity, payment, and access platforms serving critical populations.",
      ar: "أعط الأولوية لمنصات الهوية والدفع والوصول التي تخدم الفئات الحرجة.",
    },
    {
      en: "Run a timed post-incident review tied to concrete control improvements.",
      ar: "نفّذ مراجعة ما بعد الحادث ضمن إطار زمني وربطها بتحسينات رقابية ملموسة.",
    },
  ],
};

export const SCENARIO_SECTOR_MAP: Record<string, SectorId> = {
  "ksa-megaevent-01": "crowdEvents",
  "hajj-crowd-01": "crowdEvents",
  "jeddah-flood-evac-01": "crowdEvents",
  "health-surge-01": "healthSurge",
  "umrah-heatwave-01": "healthSurge",
  "desalination-01": "infrastructure",
  "grid-blackout-01": "infrastructure",
  "national-digital-id-01": "cyber",
  "port-ransomware-01": "cyber",
};

export const ROLE_SCENARIO_MAP: Record<string, string[]> = {
  "Regional Crisis Coordination Lead": [
    "ksa-megaevent-01",
    "hajj-crowd-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
    "desalination-01",
    "grid-blackout-01",
    "national-digital-id-01",
    "port-ransomware-01",
  ],
  "Government Communications Lead": [
    "ksa-megaevent-01",
    "hajj-crowd-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
    "desalination-01",
    "grid-blackout-01",
    "national-digital-id-01",
    "port-ransomware-01",
  ],
  "Field Operations and Service Continuity Lead": [
    "ksa-megaevent-01",
    "hajj-crowd-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
    "desalination-01",
    "grid-blackout-01",
  ],
  "Logistics and Resource Support Lead": [
    "ksa-megaevent-01",
    "hajj-crowd-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
    "desalination-01",
    "grid-blackout-01",
    "port-ransomware-01",
  ],
  "Early Warning and Risk Assessment Lead": [
    "ksa-megaevent-01",
    "hajj-crowd-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
    "desalination-01",
    "grid-blackout-01",
    "national-digital-id-01",
    "port-ransomware-01",
  ],
  "Health and Medical Surge Lead": [
    "hajj-crowd-01",
    "ksa-megaevent-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
  ],
  "Critical Infrastructure and Utilities Lead": [
    "ksa-megaevent-01",
    "jeddah-flood-evac-01",
    "desalination-01",
    "grid-blackout-01",
  ],
  "Recovery and Essential Services Restoration Lead": [
    "ksa-megaevent-01",
    "hajj-crowd-01",
    "jeddah-flood-evac-01",
    "health-surge-01",
    "umrah-heatwave-01",
    "desalination-01",
    "grid-blackout-01",
    "national-digital-id-01",
    "port-ransomware-01",
  ],
  "Cybersecurity and Digital Continuity Lead": [
    "national-digital-id-01",
    "port-ransomware-01",
    "grid-blackout-01",
  ],
};

export const ROLE_RULES: Record<string, LocalizedCopy[]> = {
  "Regional Crisis Coordination Lead": [
    {
      en: "Name one incident commander and define decision authority boundaries immediately.",
      ar: "سمِّ قائد حادثة واحدا وحدد حدود صلاحية القرار فورا.",
    },
    {
      en: "Force all agencies onto one shared operating picture with fixed update cadence.",
      ar: "ألزم جميع الجهات بصورة تشغيلية مشتركة واحدة مع وتيرة تحديث ثابتة.",
    },
  ],
  "Government Communications Lead": [
    {
      en: "Separate verified facts from assumptions in every public update.",
      ar: "افصل بين الحقائق المؤكدة والافتراضات في كل تحديث عام.",
    },
    {
      en: "Run one bilingual public channel and one spokesperson to reduce contradiction.",
      ar: "اعتمد قناة عامة ثنائية اللغة ومتحدثا واحدا لتقليل التناقض.",
    },
  ],
  "Field Operations and Service Continuity Lead": [
    {
      en: "Prioritize critical corridors and vulnerable populations before normal throughput.",
      ar: "قدّم المسارات الحرجة والفئات الهشة على استعادة التدفق الطبيعي.",
    },
    {
      en: "Use phased controls with clear trigger thresholds, not blanket switches.",
      ar: "استخدم ضوابط مرحلية بحدود تفعيل واضحة بدل قرارات شاملة مفاجئة.",
    },
  ],
  "Logistics and Resource Support Lead": [
    {
      en: "Request surge resources before queues expose capacity failure.",
      ar: "اطلب الموارد الإسنادية قبل أن تكشف الطوابير فشل السعة.",
    },
    {
      en: "Track stock, transport, and staffing as one integrated continuity board.",
      ar: "تابع المخزون والنقل والقوى البشرية ضمن لوحة استمرارية موحدة.",
    },
  ],
  "Early Warning and Risk Assessment Lead": [
    {
      en: "Escalate on trend signals, not only on confirmed damage outcomes.",
      ar: "صعّد بناء على اتجاه المؤشرات لا على الأضرار المؤكدة فقط.",
    },
    {
      en: "Publish threshold-based alerts tied to clear operational actions.",
      ar: "انشر تنبيهات مرتبطة بحدود تفعيل واضحة وإجراءات تشغيلية محددة.",
    },
  ],
  "Health and Medical Surge Lead": [
    {
      en: "Protect emergency capacity by redirecting noncritical demand early.",
      ar: "احم سعة الطوارئ بإعادة توجيه الطلب غير الحرج مبكرا.",
    },
    {
      en: "Coordinate triage, EMS transfer, and hospital load on one control cycle.",
      ar: "نسّق الفرز والتحويل الإسعافي وحمل المستشفيات ضمن دورة تحكم واحدة.",
    },
  ],
  "Critical Infrastructure and Utilities Lead": [
    {
      en: "Protect hospitals, water, and transport priority loads before broad restoration.",
      ar: "احمِ أحمال المستشفيات والمياه والنقل ذات الأولوية قبل الاستعادة الواسعة.",
    },
    {
      en: "Pair technical recovery with visible continuity guidance for the public.",
      ar: "اربط الاستعادة الفنية بإرشاد عام واضح لاستمرارية الخدمة.",
    },
  ],
  "Recovery and Essential Services Restoration Lead": [
    {
      en: "Do not declare full recovery without stability checks across all critical services.",
      ar: "لا تعلن التعافي الكامل دون فحوص استقرار عبر جميع الخدمات الحرجة.",
    },
    {
      en: "Close with accountable corrective actions, owners, and deadlines.",
      ar: "اختم الحادثة بإجراءات تصحيحية قابلة للمساءلة مع ملاك ومواعيد نهائية.",
    },
  ],
  "Cybersecurity and Digital Continuity Lead": [
    {
      en: "Contain first, recover second: isolate affected domains before broad reconnection.",
      ar: "الاحتواء أولا ثم الاستعادة: اعزل النطاقات المتأثرة قبل إعادة الربط الواسعة.",
    },
    {
      en: "Maintain service continuity alternatives for identity and critical transactions.",
      ar: "حافظ على بدائل استمرارية لخدمات الهوية والمعاملات الحرجة.",
    },
  ],
};

export function getScenariosForSelection(
  scenarios: ScenarioSummary[],
  sectorId: SectorId | null,
  roleId: string | null,
): ScenarioSummary[] {
  if (!sectorId || !roleId) {
    return [];
  }

  const roleScenarioIds = new Set(ROLE_SCENARIO_MAP[roleId] ?? []);

  return scenarios.filter((scenario) => {
    const scenarioSector = inferScenarioSector(scenario);
    const roleMatched =
      scenario.roleIds && scenario.roleIds.length > 0
        ? scenario.roleIds.includes(roleId)
        : roleScenarioIds.has(scenario.id);

    return scenarioSector === sectorId && roleMatched;
  });
}

export function getRulesForSelection(
  sectorId: SectorId | null,
  roleId: string | null,
): LocalizedCopy[] {
  if (!sectorId) {
    return [];
  }

  const combined = [...RESPONSE_RULES_BY_SECTOR[sectorId], ...(roleId ? ROLE_RULES[roleId] ?? [] : [])];
  const seen = new Set<string>();

  return combined.filter((rule) => {
    if (seen.has(rule.en)) {
      return false;
    }

    seen.add(rule.en);
    return true;
  });
}

export function inferScenarioSector(scenario: ScenarioSummary): SectorId {
  if (scenario.sectorId) {
    return scenario.sectorId;
  }

  const mapped = SCENARIO_SECTOR_MAP[scenario.id];
  if (mapped) {
    return mapped;
  }

  const corpus = `${scenario.id} ${scenario.title} ${scenario.description}`.toLowerCase();

  if (/(hajj|crowd|mega-event|megaevent|pilgrim|mass)/.test(corpus)) {
    return "crowdEvents";
  }

  if (/(health|hospital|medical|respiratory|triage)/.test(corpus)) {
    return "healthSurge";
  }

  if (/(desal|water|utility|power|grid|infrastructure)/.test(corpus)) {
    return "infrastructure";
  }

  if (/(cyber|digital|ransom|network|data|system outage)/.test(corpus)) {
    return "cyber";
  }

  return "crowdEvents";
}
