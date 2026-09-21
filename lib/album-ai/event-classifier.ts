// lib/album-ai/event-classifier.ts

import type { EventType } from "./types";

/**
 * Broad event categories used by FEAG.
 *
 * These descriptions are deliberately written as natural-language
 * prompts because they will eventually be passed to the vision model.
 */
export const EVENT_PROMPTS: Record<EventType, string> = {
  wedding:
    "a wedding or marriage event with ceremonies, bride, groom, family or wedding decorations",

  birthday:
    "a birthday celebration with cake, decorations, guests or a birthday party",

  travel:
    "a travel journey or trip with destinations, sightseeing, landscapes or tourists",

  college:
    "a college or university event with students, campus activities, performances or ceremonies",

  corporate:
    "a corporate or business event with employees, conferences, presentations, meetings or networking",

  sports:
    "a sports event with athletes, players, teams, competition or a sporting venue",

  fashion:
    "a fashion event, fashion shoot, runway, model photography or fashion presentation",

  concert:
    "a concert or live music event with performers, musicians, stage lights or an audience",

  festival:
    "a cultural, religious or public festival with celebrations, decorations or crowds",

  party:
    "a general party or social celebration with guests, decorations, food or dancing",

  family:
    "a family gathering with relatives, family portraits or family activities",

  vacation:
    "a vacation or leisure trip with people relaxing, sightseeing, hotels, beaches or destinations",

  product:
    "a product photography session or commercial product shoot",

  nature:
    "nature, wildlife, landscape or outdoor photography without a specific event",

  other:
    "a photograph that does not clearly belong to the other event categories",
};

/**
 * Result returned by the event classifier.
 */
export interface EventClassification {
  event: EventType;
  confidence: number;
}

/**
 * Get the candidate event labels that should be sent to the AI model.
 */
export function getEventCandidates(): EventType[] {
  return Object.keys(EVENT_PROMPTS) as EventType[];
}

/**
 * Convert an AI label into our internal EventType.
 *
 * This gives us one central place to normalize model output.
 */
export function normalizeEventLabel(label: string): EventType {
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, " ");

  const match = getEventCandidates().find((event) => {
    return (
      event === normalized ||
      EVENT_PROMPTS[event].toLowerCase().includes(normalized)
    );
  });

  return match ?? "other";
}

/**
 * Create the text labels that will eventually be passed
 * to the CLIP / vision model.
 */
export function getEventPromptLabels(): string[] {
  return getEventCandidates().map((event) => EVENT_PROMPTS[event]);
}

/**
 * Select the strongest event classification from model results.
 *
 * This function intentionally does not call an AI model itself.
 * Keeping model execution separate makes the system easier to test
 * and allows us to change AI providers later.
 */
export function chooseEventClassification(
  results: Array<{
    label: string;
    score: number;
  }>
): EventClassification {
  if (!results.length) {
    return {
      event: "other",
      confidence: 0,
    };
  }

  const best = [...results].sort((a, b) => b.score - a.score)[0];

  return {
    event: normalizeEventLabel(best.label),
    confidence: best.score,
  };
}