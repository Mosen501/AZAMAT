import { useEffect, useState } from "react";
import {
  type AdvancedChatMessage,
  type DebriefResponse,
  type RunHistoryItem,
  type ScoreSet,
  type SectorId,
  type SimulationLevel,
} from "@shared/schema";
import { DEFAULT_SCORES } from "@/lib/metric-config";

export interface SimulationState {
  level: SimulationLevel | null;
  sectorId: SectorId | null;
  role: string | null;
  scenarioId: string | null;
  scores: ScoreSet;
  history: RunHistoryItem[];
  advancedChatHistory: AdvancedChatMessage[];
  preloadedDebrief: DebriefResponse | null;
}

const DEFAULT_STATE: SimulationState = {
  level: null,
  sectorId: null,
  role: null,
  scenarioId: null,
  scores: { ...DEFAULT_SCORES },
  history: [],
  advancedChatHistory: [],
  preloadedDebrief: null,
};

let simulationState: SimulationState = {
  ...DEFAULT_STATE,
  scores: { ...DEFAULT_SCORES },
  history: [],
  advancedChatHistory: [],
  preloadedDebrief: null,
};
const listeners = new Set<(state: SimulationState) => void>();

function emitState(nextState: SimulationState) {
  simulationState = nextState;
  listeners.forEach((listener) => listener(simulationState));
}

function subscribe(listener: (state: SimulationState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeScores(scores?: Partial<ScoreSet>): ScoreSet {
  return {
    operationalControl: scores?.operationalControl ?? DEFAULT_SCORES.operationalControl,
    responseTempo: scores?.responseTempo ?? DEFAULT_SCORES.responseTempo,
    stakeholderTrust: scores?.stakeholderTrust ?? DEFAULT_SCORES.stakeholderTrust,
    teamAlignment: scores?.teamAlignment ?? DEFAULT_SCORES.teamAlignment,
    executiveComms: scores?.executiveComms ?? DEFAULT_SCORES.executiveComms,
  };
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState>(simulationState);

  useEffect(() => subscribe(setState), []);

  const setLevel = (level: SimulationLevel | null) => {
    emitState({ ...simulationState, level });
  };

  const setSector = (sectorId: SectorId | null) => {
    emitState({ ...simulationState, sectorId });
  };

  const setRole = (role: string | null) => {
    emitState({ ...simulationState, role });
  };

  const setScenario = (scenarioId: string | null) => {
    emitState({ ...simulationState, scenarioId });
  };

  const initScores = (scores: ScoreSet) => {
    emitState({
      ...simulationState,
      scores: normalizeScores(scores),
      history: [],
      advancedChatHistory: [],
      preloadedDebrief: null,
    });
  };

  const recordChoice = (
    stepId: string, 
    choiceId: string, 
    deltas: ScoreSet
  ) => {
    // Clamp scores between 0 and 100
    const newScores = {
      operationalControl: Math.max(0, Math.min(100, simulationState.scores.operationalControl + deltas.operationalControl)),
      responseTempo: Math.max(0, Math.min(100, simulationState.scores.responseTempo + deltas.responseTempo)),
      stakeholderTrust: Math.max(0, Math.min(100, simulationState.scores.stakeholderTrust + deltas.stakeholderTrust)),
      teamAlignment: Math.max(0, Math.min(100, simulationState.scores.teamAlignment + deltas.teamAlignment)),
      executiveComms: Math.max(0, Math.min(100, simulationState.scores.executiveComms + deltas.executiveComms)),
    };

    const historyItem: RunHistoryItem = {
      stepId,
      choiceId,
      timestamp: Date.now(),
      scoresAfter: newScores
    };

    emitState({
      ...simulationState,
      scores: newScores,
      history: [...simulationState.history, historyItem],
      preloadedDebrief: null,
    });
  };

  const setAdvancedChatHistory = (advancedChatHistory: AdvancedChatMessage[]) => {
    emitState({
      ...simulationState,
      advancedChatHistory,
      preloadedDebrief: null,
    });
  };

  const setPreloadedDebrief = (preloadedDebrief: DebriefResponse | null) => {
    emitState({
      ...simulationState,
      preloadedDebrief,
    });
  };

  const resetSimulation = () => {
    emitState({
      ...DEFAULT_STATE,
      scores: { ...DEFAULT_SCORES },
      history: [],
      advancedChatHistory: [],
      preloadedDebrief: null,
    });
  };

  const restartRun = () => {
    emitState({
      ...simulationState,
      scores: { ...DEFAULT_SCORES },
      history: [],
      advancedChatHistory: [],
      preloadedDebrief: null,
    });
  };

  return {
    state,
    setLevel,
    setSector,
    setRole,
    setScenario,
    initScores,
    recordChoice,
    setAdvancedChatHistory,
    setPreloadedDebrief,
    restartRun,
    resetSimulation
  };
}
