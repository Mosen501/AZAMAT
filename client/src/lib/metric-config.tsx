import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Gauge,
  Handshake,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ScoreKey, ScoreSet } from "@shared/schema";

export const DEFAULT_SCORES: ScoreSet = {
  operationalControl: 50,
  responseTempo: 50,
  stakeholderTrust: 50,
  teamAlignment: 50,
  executiveComms: 50,
};

export const EMPTY_SCORE_DELTAS: ScoreSet = {
  operationalControl: 0,
  responseTempo: 0,
  stakeholderTrust: 0,
  teamAlignment: 0,
  executiveComms: 0,
};

export const METRIC_CONFIG: Array<{
  key: ScoreKey;
  labelEn: string;
  labelAr: string;
  icon: LucideIcon;
}> = [
  {
    key: "operationalControl",
    labelEn: "Operational Control",
    labelAr: "التحكم التشغيلي",
    icon: ShieldCheck,
  },
  {
    key: "responseTempo",
    labelEn: "Response Tempo",
    labelAr: "سرعة الاستجابة",
    icon: Gauge,
  },
  {
    key: "stakeholderTrust",
    labelEn: "Public Trust",
    labelAr: "الثقة العامة",
    icon: Handshake,
  },
  {
    key: "teamAlignment",
    labelEn: "Interagency Coordination",
    labelAr: "التنسيق بين الجهات",
    icon: Users,
  },
  {
    key: "executiveComms",
    labelEn: "Leadership Briefing",
    labelAr: "إحاطة القيادة",
    icon: Building2,
  },
];
