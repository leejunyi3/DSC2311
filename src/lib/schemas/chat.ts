import { z } from "zod";
import { demoScenarioIdSchema, appModeSchema } from "./common";

/** Validated chat request body (§6, §22). */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(6000),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
  mode: appModeSchema.optional(),
  scenario: demoScenarioIdSchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
