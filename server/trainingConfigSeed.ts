import type { TrainingConfig } from "@shared/schema";
import {
  RESPONSE_RULES_BY_SECTOR,
  ROLE_OPTIONS,
  ROLE_RULES,
  ROLE_SCENARIO_MAP,
  SCENARIO_SECTOR_MAP,
  SECTOR_OPTIONS,
  type LocalizedCopy,
} from "../client/src/lib/training-config";

function toPlainLocalizedCopy(value: LocalizedCopy): { en: string; ar: string } {
  return { en: value.en, ar: value.ar };
}

function buildScenarioLinks(): TrainingConfig["scenarioLinks"] {
  const map = new Map<string, { scenarioId: string; sectorId: string; roleIds: string[] }>();

  for (const [roleId, scenarioIds] of Object.entries(ROLE_SCENARIO_MAP)) {
    for (const scenarioId of scenarioIds) {
      const current = map.get(scenarioId);
      if (current) {
        if (!current.roleIds.includes(roleId)) {
          current.roleIds.push(roleId);
        }
        continue;
      }

      const role = ROLE_OPTIONS.find((item) => item.id === roleId);
      map.set(scenarioId, {
        scenarioId,
        sectorId: SCENARIO_SECTOR_MAP[scenarioId] ?? role?.sectors[0] ?? "crowdEvents",
        roleIds: [roleId],
      });
    }
  }

  return Array.from(map.values()).sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
}

function buildRules(): TrainingConfig["rules"] {
  const sectorRules = Object.entries(RESPONSE_RULES_BY_SECTOR).flatMap(([sectorId, rules], index) =>
    rules.map((rule, ruleIndex) => ({
      id: `sector-${sectorId}-${index + 1}-${ruleIndex + 1}`,
      text: toPlainLocalizedCopy(rule),
      sectorId,
      roleId: undefined,
      isActive: true,
    })),
  );

  const roleRules = Object.entries(ROLE_RULES).flatMap(([roleId, rules], index) =>
    rules.map((rule, ruleIndex) => ({
      id: `role-${index + 1}-${ruleIndex + 1}`,
      text: toPlainLocalizedCopy(rule),
      sectorId: undefined,
      roleId,
      isActive: true,
    })),
  );

  return [...sectorRules, ...roleRules];
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  sectors: SECTOR_OPTIONS.map((sector) => ({
    id: sector.id,
    label: toPlainLocalizedCopy(sector.label),
    description: toPlainLocalizedCopy(sector.description),
    isActive: true,
  })),
  roles: ROLE_OPTIONS.map((role) => ({
    id: role.id,
    title: toPlainLocalizedCopy(role.title),
    description: toPlainLocalizedCopy(role.description),
    sectorIds: [...role.sectors],
    isActive: true,
  })),
  rules: buildRules(),
  scenarioLinks: buildScenarioLinks(),
};
