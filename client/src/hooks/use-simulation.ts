import { useState, useEffect } from "react";
import { type RunHistoryItem } from "@shared/schema";

export interface SimulationState {
  role: string | null;
  scores: {
    riskControl: number;
    speed: number;
    comms: number;
  };
  history: RunHistoryItem[];
}

const STORAGE_KEY = "edgecase_sim_state";

const DEFAULT_STATE: SimulationState = {
  role: null,
  scores: {
    riskControl: 50,
    speed: 50,
    comms: 50
  },
  history: []
};

export function useSimulation() {
  const [state, setState] = useState<SimulationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_STATE;
    } catch (e) {
      console.error("Failed to parse simulation state from localStorage", e);
      return DEFAULT_STATE;
    }
  });

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setRole = (role: string) => {
    setState(prev => ({ ...prev, role }));
  };

  const initScores = (scores: { riskControl: number; speed: number; comms: number }) => {
    setState(prev => ({ ...prev, scores, history: [] }));
  };

  const recordChoice = (
    stepId: string, 
    choiceId: string, 
    deltas: { riskControl: number; speed: number; comms: number }
  ) => {
    setState(prev => {
      // Clamp scores between 0 and 100
      const newScores = {
        riskControl: Math.max(0, Math.min(100, prev.scores.riskControl + deltas.riskControl)),
        speed: Math.max(0, Math.min(100, prev.scores.speed + deltas.speed)),
        comms: Math.max(0, Math.min(100, prev.scores.comms + deltas.comms)),
      };

      const historyItem: RunHistoryItem = {
        stepId,
        choiceId,
        timestamp: Date.now(),
        scoresAfter: newScores
      };

      return {
        ...prev,
        scores: newScores,
        history: [...prev.history, historyItem]
      };
    });
  };

  const resetSimulation = () => {
    setState(DEFAULT_STATE);
  };

  return {
    state,
    setRole,
    initScores,
    recordChoice,
    resetSimulation
  };
}
