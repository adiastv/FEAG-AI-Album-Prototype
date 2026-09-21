import type { AlbumLayout, EventType, LayoutType, PhotoAnalysis, PhotoSlot } from "./types";
import { getFocalPoint } from "./photo-fitting-engine";

interface Template {
  type: LayoutType;
  slots: Omit<PhotoSlot, "photoId" | "focalPoint">[];
}

const slot = (id: string, x: number, y: number, width: number, height: number): Omit<PhotoSlot, "photoId" | "focalPoint"> => ({
  id, x, y, width, height, objectFit: "cover",
});

/*
 * Coordinates are normalized to a portrait page. These use the reference's
 * visual grammar—not its wedding subject: a clear lead image, unequal support
 * frames, generous paper margins, and occasional detail strips.
 */
const TEMPLATES: Record<string, Template> = {
  fullBleed: { type: "fullBleed", slots: [slot("hero", 0.025, 0.025, 0.95, 0.95)] },
  portraitDuo: { type: "twoPortraits", slots: [
    slot("lead-left", 0.05, 0.05, 0.42, 0.90), slot("lead-right", 0.53, 0.05, 0.42, 0.90),
  ] },
  landscapeDuo: { type: "splitHorizontal", slots: [
    slot("top-story", 0.05, 0.07, 0.90, 0.40), slot("bottom-story", 0.05, 0.53, 0.90, 0.40),
  ] },
  offsetDuo: { type: "splitVertical", slots: [
    slot("hero", 0.05, 0.05, 0.56, 0.66), slot("support", 0.66, 0.29, 0.29, 0.48),
  ] },
  heroTwo: { type: "heroTwo", slots: [
    slot("hero", 0.04, 0.04, 0.92, 0.56), slot("support-left", 0.04, 0.64, 0.44, 0.30), slot("support-right", 0.52, 0.64, 0.44, 0.30),
  ] },
  editorialThree: { type: "asymmetric", slots: [
    slot("hero", 0.04, 0.05, 0.56, 0.90), slot("support-top", 0.64, 0.05, 0.32, 0.42), slot("support-bottom", 0.64, 0.53, 0.32, 0.42),
  ] },
  cinematicThree: { type: "cinematic", slots: [
    slot("hero", 0.035, 0.045, 0.93, 0.48), slot("support-left", 0.035, 0.565, 0.455, 0.39), slot("support-right", 0.51, 0.565, 0.455, 0.39),
  ] },
  editorialFour: { type: "asymmetric", slots: [
    slot("hero", 0.04, 0.04, 0.56, 0.56), slot("support-top", 0.64, 0.04, 0.32, 0.27), slot("support-middle", 0.64, 0.35, 0.32, 0.25), slot("story-strip", 0.04, 0.64, 0.92, 0.30),
  ] },
  cinematicFour: { type: "cinematic", slots: [
    slot("hero", 0.035, 0.04, 0.93, 0.46), slot("support-left", 0.035, 0.54, 0.30, 0.40), slot("support-middle", 0.35, 0.54, 0.30, 0.40), slot("support-right", 0.67, 0.54, 0.295, 0.40),
  ] },
  portraitShowcase: { type: "fourGrid", slots: [
    slot("portrait-1", 0.04, 0.04, 0.44, 0.44), slot("portrait-2", 0.52, 0.04, 0.44, 0.44), slot("portrait-3", 0.04, 0.52, 0.44, 0.44), slot("portrait-4", 0.52, 0.52, 0.44, 0.44),
  ] },
  editorialFive: { type: "asymmetric", slots: [
    slot("hero", 0.04, 0.05, 0.56, 0.48), slot("support-top", 0.64, 0.05, 0.32, 0.22), slot("support-middle", 0.64, 0.31, 0.32, 0.22), slot("detail-left", 0.04, 0.59, 0.32, 0.35), slot("story-bottom", 0.40, 0.59, 0.56, 0.35),
  ] },
  mosaicSix: { type: "collage", slots: [
    slot("hero", 0.06, 0.05, 0.47, 0.63), slot("story-top", 0.56, 0.05, 0.38, 0.27), slot("story-middle", 0.56, 0.35, 0.38, 0.33), slot("detail-left", 0.06, 0.72, 0.25, 0.22), slot("detail-middle", 0.34, 0.72, 0.25, 0.22), slot("detail-right", 0.62, 0.72, 0.32, 0.22),
  ] },
  mosaicSeven: { type: "collage", slots: [
    slot("hero", 0.04, 0.04, 0.58, 0.44), slot("detail-top", 0.66, 0.04, 0.30, 0.20), slot("detail-middle", 0.66, 0.28, 0.30, 0.20), slot("story-left", 0.04, 0.54, 0.28, 0.40), slot("story-middle", 0.36, 0.54, 0.28, 0.40), slot("detail-bottom", 0.68, 0.54, 0.28, 0.19), slot("detail-tail", 0.68, 0.75, 0.30, 0.19),
  ] },
  mosaicEight: { type: "collage", slots: [
    slot("story-top-left", 0.06, 0.06, 0.38, 0.20), slot("story-top-right", 0.48, 0.04, 0.38, 0.34), slot("detail-left", 0.10, 0.30, 0.20, 0.20), slot("hero", 0.33, 0.42, 0.31, 0.35), slot("detail-right-top", 0.67, 0.42, 0.26, 0.16), slot("detail-right-bottom", 0.67, 0.62, 0.26, 0.15), slot("detail-bottom-left", 0.06, 0.60, 0.23, 0.17), slot("story-bottom", 0.37, 0.82, 0.56, 0.12),
  ] },
  mosaicNine: { type: "collage", slots: [
    slot("story-top-left", 0.06, 0.06, 0.38, 0.20), slot("story-top-right", 0.48, 0.04, 0.38, 0.34), slot("detail-left", 0.10, 0.30, 0.20, 0.20), slot("hero", 0.33, 0.42, 0.31, 0.35), slot("detail-right-top", 0.67, 0.42, 0.26, 0.16), slot("detail-right-bottom", 0.67, 0.62, 0.26, 0.15), slot("detail-bottom-left", 0.06, 0.60, 0.23, 0.17), slot("detail-bottom-middle", 0.12, 0.82, 0.28, 0.12), slot("story-bottom-right", 0.45, 0.82, 0.48, 0.12),
  ] },
};

function photoAspect(photo: PhotoAnalysis): number {
  if (photo.width && photo.height && photo.height > 0) return photo.width / photo.height;
  switch (photo.orientation) {
    case "panorama": return 2.4;
    case "landscape": return 1.6;
    case "portrait": return 0.72;
    default: return 1;
  }
}

function heroScore(photo: PhotoAnalysis): number {
  const labels = photo.labels.join(" ").toLowerCase();
  let score = Math.max(photo.qualityScore || 0, 0);
  score += Math.min(photo.peopleCount, 5) * 0.08;
  score += Math.min(photo.eventConfidence || 0, 1) * 0.10;
  score += Math.min(photo.sectionConfidence || 0, 1) * 0.08;
  score += Math.min(photo.faces.length, 4) * 0.04;
  if (/hero|portrait|performer|athlete|product|landmark|group/.test(labels)) score += 0.28;
  if (/landscape|scene|venue|stage|decoration|detail/.test(labels)) score += 0.10;
  return score;
}

function cropLoss(sourceAspect: number, slotAspect: number): number {
  const visibleFraction = sourceAspect > slotAspect ? slotAspect / sourceAspect : sourceAspect / slotAspect;
  return 1 - Math.min(Math.max(visibleFraction, 0), 1);
}

function isHeroSlot(base: Template["slots"][number]): boolean {
  return base.id === "hero" || base.width * base.height >= 0.28;
}

function slotSuitability(base: Template["slots"][number], photo: PhotoAnalysis, sourceIndex: number): number {
  const slotAspect = base.width / Math.max(base.height, 0.0001);
  const loss = cropLoss(photoAspect(photo), slotAspect);
  const lead = isHeroSlot(base);
  const focal = getFocalPoint(photo);
  const focalOffset = Math.abs(focal.x - 0.5) + Math.abs(focal.y - 0.5);

  // Cover crops are fine when purposeful; severe crops, especially of an
  // off-centre face, should lose to a composition that protects the image.
  let score = -loss * (lead ? 2.3 : 2.9);
  if (loss > 0.46) score -= (loss - 0.46) * 3.8;
  if (loss > 0.32 && photo.faces.length > 0) score -= focalOffset * 0.45;
  if (lead) score += heroScore(photo) * 0.34;
  if (base.id.startsWith("detail") && heroScore(photo) < 1.12) score += 0.05;
  // The upload order is only a gentle storytelling signal, never a hard rule.
  if (lead) score += Math.max(0, 0.08 - sourceIndex * 0.012);
  return score;
}

interface TemplateMatch { score: number; photoIndexes: number[]; }

/* With nine photos at most, a bit-mask DP can evaluate every one-to-one
 * assignment. This prevents an early greedy match from consuming the only
 * portrait that truly belongs in a tall frame. */
function matchTemplate(template: Template, photos: PhotoAnalysis[]): TemplateMatch {
  const slots = template.slots.slice(0, photos.length);
  const memo = new Map<string, TemplateMatch>();
  const visit = (slotIndex: number, usedMask: number): TemplateMatch => {
    if (slotIndex === slots.length) return { score: 0, photoIndexes: [] };
    const key = `${slotIndex}:${usedMask}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best: TemplateMatch = { score: Number.NEGATIVE_INFINITY, photoIndexes: [] };
    for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
      if (usedMask & (1 << photoIndex)) continue;
      const rest = visit(slotIndex + 1, usedMask | (1 << photoIndex));
      const score = slotSuitability(slots[slotIndex], photos[photoIndex], photoIndex) + rest.score;
      if (score > best.score) best = { score, photoIndexes: [photoIndex, ...rest.photoIndexes] };
    }
    memo.set(key, best);
    return best;
  };
  return visit(0, 0);
}

function candidatesFor(photos: PhotoAnalysis[]): Template[] {
  switch (photos.length) {
    case 1: return [TEMPLATES.fullBleed];
    case 2: return [TEMPLATES.portraitDuo, TEMPLATES.landscapeDuo, TEMPLATES.offsetDuo];
    case 3: return [TEMPLATES.heroTwo, TEMPLATES.editorialThree, TEMPLATES.cinematicThree];
    case 4: return [TEMPLATES.editorialFour, TEMPLATES.cinematicFour, TEMPLATES.portraitShowcase];
    case 5: return [TEMPLATES.editorialFive];
    case 6: return [TEMPLATES.mosaicSix];
    case 7: return [TEMPLATES.mosaicSeven];
    case 8: return [TEMPLATES.mosaicEight];
    default: return [TEMPLATES.mosaicNine];
  }
}

function chooseTemplate(photos: PhotoAnalysis[]): { template: Template; match: TemplateMatch } {
  return candidatesFor(photos).reduce<{ template: Template; match: TemplateMatch } | null>((best, template) => {
    const match = matchTemplate(template, photos);
    return !best || match.score > best.match.score ? { template, match } : best;
  }, null)!;
}

function bindSlots(template: Template, photos: PhotoAnalysis[], match: TemplateMatch): PhotoSlot[] {
  return template.slots.slice(0, photos.length).map((base, index) => {
    const photo = photos[match.photoIndexes[index]];
    return { ...base, photoId: photo.id, focalPoint: getFocalPoint(photo) };
  });
}

export function createProfessionalLayout(photos: PhotoAnalysis[], event: EventType, section: string): AlbumLayout {
  // Kept in the API because the generator owns that context. Geometry itself
  // is intentionally content-led, so every event receives the same design bar.
  void event;
  void section;
  const { template, match } = chooseTemplate(photos);
  return {
    id: `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: template.type,
    slots: bindSlots(template, photos, match),
    spacing: template.type === "collage" ? 1.5 : 2.5,
    borderRadius: template.type === "collage" ? 2 : 1,
  };
}

export function getTemplateName(type: LayoutType): string {
  switch (type) {
    case "fullBleed": return "Full Bleed Hero";
    case "heroTwo": return "Hero + Supporting Photos";
    case "asymmetric": return "Editorial Asymmetric";
    case "cinematic": return "Cinematic Story";
    case "collage": return "Editorial Mosaic";
    case "fourGrid": return "Portrait Showcase";
    default: return "Editorial Composition";
  }
}

export function getPhotoAspectForLayout(photo: PhotoAnalysis): number { return photoAspect(photo); }
