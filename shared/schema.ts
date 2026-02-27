import { z } from "zod";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

// Define the core types for the simulation
export const choiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  scoreDeltas: z.object({
    riskControl: z.number(),
    speed: z.number(),
    comms: z.number()
  }),
  nextStepId: z.string().nullable()
});

export const stepSchema = z.object({
  id: z.string(),
  timeLabel: z.string(),
  description: z.string(),
  choices: z.array(choiceSchema)
});

export const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  initialScores: z.object({
    riskControl: z.number(),
    speed: z.number(),
    comms: z.number()
  }),
  steps: z.record(z.string(), stepSchema), // Map of step ID to Step
  startStepId: z.string()
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Choice = z.infer<typeof choiceSchema>;

// Types for tracking the user's run locally
export const runHistoryItemSchema = z.object({
  stepId: z.string(),
  choiceId: z.string(),
  timestamp: z.number(),
  scoresAfter: z.object({
    riskControl: z.number(),
    speed: z.number(),
    comms: z.number()
  })
});

export type RunHistoryItem = z.infer<typeof runHistoryItemSchema>;

export const debriefRequestSchema = z.object({
  role: z.string(),
  history: z.array(runHistoryItemSchema)
});

export type DebriefRequest = z.infer<typeof debriefRequestSchema>;

export const debriefResponseSchema = z.object({
  summary: z.array(z.string()),
  wentWell: z.array(z.string()),
  toImprove: z.array(z.string()),
  missedSignals: z.array(z.string()),
  checklist: z.array(z.string())
});

export type DebriefResponse = z.infer<typeof debriefResponseSchema>;

// Dummy table to ensure drizzle initialization doesn't break
export const dummy = pgTable("dummy", {
  id: serial("id").primaryKey(),
  name: text("name")
});
