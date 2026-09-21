import type { EventType, FrameConfig, LayoutType } from "./types";

/**
 * Visual treatment is deliberately independent from page geometry.
 * This lets the same composition work for weddings, birthdays, travel,
 * sports, corporate events, concerts and ordinary memory albums.
 */
export function chooseFrameStyle(
  event: EventType,
  section: string,
  layout: LayoutType,
): FrameConfig {
  const s = section.toLowerCase();

  if (layout === "fullBleed") {
    return { style: "fullBleed", thickness: 0, padding: 0 };
  }

  if (layout === "cinematic") {
    return { style: "cinematic", thickness: 1, padding: 3, color: "rgba(255,255,255,0.92)" };
  }

  if (layout === "collage" || /haldi|mehendi|sangeet|festival|party|birthday|details|gifts/.test(s)) {
    return { style: "decorative", thickness: 2, padding: 7, color: "#ffffff" };
  }

  if (
    event === "wedding" ||
    event === "fashion" ||
    /portrait|bride|groom|couple|ceremony|reception/.test(s)
  ) {
    return { style: "editorial", thickness: 1, padding: 6, color: "#ffffff" };
  }

  if (event === "travel" || event === "vacation" || event === "nature") {
    return { style: "classic", thickness: 1, padding: 5, color: "#ffffff" };
  }

  return { style: "minimal", thickness: 1, padding: 5, color: "#ffffff" };
}

export function getFrameClass(style: FrameConfig["style"]): string {
  return `album-frame-style-${style}`;
}
