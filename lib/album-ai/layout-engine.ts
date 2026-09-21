import type {
  AlbumLayout,
  EventType,
  LayoutType,
  PhotoAnalysis,
  PhotoSlot,
} from "./types";
import { getFocalPoint } from "./photo-fitting-engine";

interface Template {
  type: LayoutType;
  slots: Omit<PhotoSlot, "photoId" | "focalPoint">[];
}

const slot = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  objectFit: "cover" | "contain" = "cover",
): Omit<PhotoSlot, "photoId" | "focalPoint"> => ({
  id,
  x,
  y,
  width,
  height,
  objectFit,
});

/*
 * All geometry is normalized to 0..1.  The templates deliberately use
 * consistent safe margins and gaps so photos cannot escape the page.
 * They are inspired by the supplied reference album: hero photographs,
 * asymmetric editorial compositions, cinematic strips and mosaics.
 */
const TEMPLATES: Record<string, Template> = {
  fullBleed: {
    type: "fullBleed",
    slots: [slot("hero", 0.025, 0.025, 0.95, 0.95)],
  },

  heroTwo: {
    type: "heroTwo",
    slots: [
      slot("hero", 0.04, 0.04, 0.92, 0.56),
      slot("support-1", 0.04, 0.64, 0.44, 0.30),
      slot("support-2", 0.52, 0.64, 0.44, 0.30),
    ],
  },

  editorialThree: {
    type: "asymmetric",
    slots: [
      slot("hero", 0.04, 0.05, 0.56, 0.90),
      slot("support-1", 0.64, 0.05, 0.32, 0.42),
      slot("support-2", 0.64, 0.53, 0.32, 0.42),
    ],
  },

  editorialFour: {
    type: "asymmetric",
    slots: [
      slot("hero", 0.04, 0.04, 0.56, 0.56),
      slot("support-1", 0.64, 0.04, 0.32, 0.27),
      slot("support-2", 0.64, 0.35, 0.32, 0.25),
      slot("support-3", 0.04, 0.64, 0.92, 0.30),
    ],
  },

  editorialFive: {
    type: "asymmetric",
    slots: [
      slot("hero", 0.04, 0.05, 0.56, 0.48),
      slot("support-1", 0.64, 0.05, 0.32, 0.22),
      slot("support-2", 0.64, 0.31, 0.32, 0.22),
      slot("support-3", 0.04, 0.59, 0.32, 0.35),
      slot("support-4", 0.40, 0.59, 0.56, 0.35),
    ],
  },

  mosaicSix: {
    type: "collage",
    slots: [
      slot("hero", 0.04, 0.04, 0.60, 0.46),
      slot("side-1", 0.68, 0.04, 0.28, 0.22),
      slot("side-2", 0.68, 0.30, 0.28, 0.20),
      slot("bottom-1", 0.04, 0.56, 0.28, 0.38),
      slot("bottom-2", 0.36, 0.56, 0.28, 0.38),
      slot("bottom-3", 0.68, 0.56, 0.28, 0.38),
    ],
  },

  mosaicSeven: {
    type: "collage",
    slots: [
      slot("hero", 0.04, 0.04, 0.58, 0.44),
      slot("top-right", 0.66, 0.04, 0.30, 0.20),
      slot("mid-right", 0.66, 0.28, 0.30, 0.20),
      slot("bottom-left", 0.04, 0.54, 0.28, 0.40),
      slot("bottom-mid", 0.36, 0.54, 0.28, 0.40),
      slot("bottom-right", 0.68, 0.54, 0.28, 0.19),
      slot("detail", 0.68, 0.75, 0.30, 0.19),
    ],
  },

  cinematicThree: {
    type: "cinematic",
    slots: [
      slot("hero", 0.035, 0.045, 0.93, 0.48),
      slot("support-1", 0.035, 0.565, 0.455, 0.39),
      slot("support-2", 0.51, 0.565, 0.455, 0.39),
    ],
  },

  cinematicFour: {
    type: "cinematic",
    slots: [
      slot("hero", 0.035, 0.04, 0.93, 0.46),
      slot("support-1", 0.035, 0.54, 0.30, 0.40),
      slot("support-2", 0.35, 0.54, 0.30, 0.40),
      slot("support-3", 0.67, 0.54, 0.295, 0.40),
    ],
  },

  portraitShowcase: {
    type: "fourGrid",
    slots: [
      slot("portrait-1", 0.04, 0.04, 0.44, 0.44),
      slot("portrait-2", 0.52, 0.04, 0.44, 0.44),
      slot("portrait-3", 0.04, 0.52, 0.44, 0.44),
      slot("portrait-4", 0.52, 0.52, 0.44, 0.44),
    ],
  },

  gridEight: {
    type: "fourGrid",
    slots: [
      slot("one", 0.04, 0.04, 0.29, 0.27),
      slot("two", 0.355, 0.04, 0.29, 0.27),
      slot("three", 0.67, 0.04, 0.29, 0.27),
      slot("four", 0.04, 0.345, 0.29, 0.27),
      slot("five", 0.355, 0.345, 0.29, 0.27),
      slot("six", 0.67, 0.345, 0.29, 0.27),
      slot("seven", 0.19, 0.65, 0.29, 0.30),
      slot("eight", 0.52, 0.65, 0.29, 0.30),
    ],
  },
};

function photoAspect(photo: PhotoAnalysis): number {
  if (photo.width && photo.height && photo.height > 0) {
    return photo.width / photo.height;
  }

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
  score += Math.min(photo.eventConfidence || 0, 1) * 0.18;
  score += Math.min(photo.sectionConfidence || 0, 1) * 0.12;
  score += Math.min(photo.faces.length, 4) * 0.04;

  if (/hero|portrait|couple|bride|groom|performer|athlete|product/.test(labels)) {
    score += 0.35;
  }

  if (/landscape|scene|venue|stage|decoration|details/.test(labels)) {
    score += 0.12;
  }

  return score;
}

function chooseTemplate(
  photos: PhotoAnalysis[],
  event: EventType,
  section: string,
): Template {
  const count = photos.length;
  const s = section.toLowerCase();
  const portraits = photos.filter((photo) => photo.orientation === "portrait").length;
  const panoramas = photos.filter((photo) => photo.orientation === "panorama").length;
  const landscapes = photos.filter((photo) => photo.orientation === "landscape").length;
  const people = photos.filter((photo) => photo.peopleCount > 0).length;

  if (count === 1) return TEMPLATES.fullBleed;

  if (/portrait|bride|groom|couple|fashion|model/.test(s) && portraits >= 3) {
    return TEMPLATES.portraitShowcase;
  }

  if (/ceremony|reception|celebration|action|performance|concert|competition|sports/.test(s)) {
    if (count >= 4) return TEMPLATES.cinematicFour;
    if (count >= 3) return TEMPLATES.cinematicThree;
  }

  if (/haldi|mehendi|sangeet|decoration|decorations|details|food|gifts|ritual|tradition|festival/.test(s)) {
    if (count >= 7) return TEMPLATES.mosaicSeven;
    if (count >= 5) return TEMPLATES.mosaicSix;
  }

  if (panoramas >= 1 && landscapes >= 1 && count >= 3) {
    return TEMPLATES.cinematicThree;
  }

  if (count === 2) return TEMPLATES.heroTwo;
  if (count === 3) return TEMPLATES.editorialThree;
  if (count === 4) return TEMPLATES.editorialFour;
  if (count === 5) return TEMPLATES.editorialFive;
  if (count === 6) return TEMPLATES.mosaicSix;
  if (count === 7) return TEMPLATES.mosaicSeven;
  if (count >= 8) return TEMPLATES.gridEight;

  if ((event === "travel" || event === "vacation" || event === "nature") && landscapes >= 2) {
    return TEMPLATES.cinematicThree;
  }

  if (people >= 3 && portraits >= 2) {
    return TEMPLATES.portraitShowcase;
  }

  return TEMPLATES.editorialFour;
}

function bindSlots(template: Template, photos: PhotoAnalysis[]): PhotoSlot[] {
  const ordered = [...photos].sort((a, b) => heroScore(b) - heroScore(a));
  const usable = Math.min(template.slots.length, ordered.length);

  return template.slots.slice(0, usable).map((base, index) => {
    const photo = ordered[index];
    return {
      ...base,
      photoId: photo?.id,
      focalPoint: photo ? getFocalPoint(photo) : undefined,
    };
  });
}

export function createProfessionalLayout(
  photos: PhotoAnalysis[],
  event: EventType,
  section: string,
): AlbumLayout {
  const template = chooseTemplate(photos, event, section);

  return {
    id: `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: template.type,
    slots: bindSlots(template, photos),
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
    case "fourGrid": return "Balanced Mosaic";
    default: return "Editorial Composition";
  }
}

export function getPhotoAspectForLayout(photo: PhotoAnalysis): number {
  return photoAspect(photo);
}
