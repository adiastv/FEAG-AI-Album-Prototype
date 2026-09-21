import type { FaceBox, FocalPoint, PhotoAnalysis, PhotoOrientation } from "./types";

export interface FitOptions {
  slotAspectRatio?: number;
  padding?: number;
}

// The editor collects face boxes after an image has been uploaded, so both
// face information and measured dimensions can legitimately be absent while
// an album is being assembled. Keep the fitting helpers usable for that
// intermediate state; they fall back to the image centre when needed.
type FittablePhoto = {
  width?: number;
  height?: number;
  faces?: FaceBox[];
  orientation?: PhotoOrientation;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function centerOfFace(face: FaceBox, photo: FittablePhoto): FocalPoint {
  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height / 2;
  const hasSourceDimensions = Boolean(
    photo.width && photo.height && photo.width > 0 && photo.height > 0,
  );
  const usesPixelCoordinates = hasSourceDimensions &&
    (face.x > 1 || face.y > 1 || face.width > 1 || face.height > 1);

  return {
    x: clamp(usesPixelCoordinates ? centerX / photo.width! : centerX),
    y: clamp(usesPixelCoordinates ? centerY / photo.height! : centerY),
  };
}

/**
 * Finds a stable focal point in normalized image coordinates.
 * Faces are weighted more heavily than the geometric centre so portrait
 * crops do not cut through people when the layout uses object-fit: cover.
 */
export function getFocalPoint(photo: FittablePhoto): FocalPoint {
  const faces = (photo.faces ?? []).filter(
    (face) => face.width > 0 && face.height > 0,
  );

  if (!faces.length) {
    return { x: 0.5, y: 0.5 };
  }

  const weighted = faces.reduce(
    (acc, face) => {
      const area = Math.max(face.width * face.height, 0.0001);
      const confidence = face.score ?? 1;
      const weight = area * Math.max(confidence, 0.25);
      const center = centerOfFace(face, photo);

      acc.x += center.x * weight;
      acc.y += center.y * weight;
      acc.weight += weight;
      return acc;
    },
    { x: 0, y: 0, weight: 0 },
  );

  if (!weighted.weight) return { x: 0.5, y: 0.5 };

  const focal = {
    x: clamp(weighted.x / weighted.weight),
    y: clamp(weighted.y / weighted.weight),
  };

  // Portraits usually need a little extra upward protection because faces
  // tend to sit above the geometric centre of the photograph.
  if (photo.orientation === "portrait") {
    focal.y = clamp(focal.y - 0.035);
  }

  return focal;
}

/**
 * Returns CSS object-position percentages that keep the focal point inside
 * the visible crop. The calculation accounts for the source and slot aspect
 * ratios instead of blindly using 50% 50%.
 */
export function getObjectPosition(
  photo: FittablePhoto,
  slotAspectRatio: number,
): string {
  const focal = getFocalPoint(photo);
  const sourceAspect =
    photo.width && photo.height && photo.height > 0
      ? photo.width / photo.height
      : photo.orientation === "portrait"
        ? 0.72
        : photo.orientation === "landscape"
          ? 1.6
          : 1;

  if (!Number.isFinite(slotAspectRatio) || slotAspectRatio <= 0) {
    return `${focal.x * 100}% ${focal.y * 100}%`;
  }

  // With cover, one axis is cropped. Approximate the usable source range and
  // map the focal point into that range so it remains visible.
  if (sourceAspect > slotAspectRatio) {
    const visibleWidth = slotAspectRatio / sourceAspect;
    const half = visibleWidth / 2;
    const normalized = clamp((focal.x - half) / Math.max(1 - visibleWidth, 0.0001), 0, 1);
    return `${normalized * 100}% ${focal.y * 100}%`;
  }

  if (sourceAspect < slotAspectRatio) {
    const visibleHeight = sourceAspect / slotAspectRatio;
    const half = visibleHeight / 2;
    const normalized = clamp((focal.y - half) / Math.max(1 - visibleHeight, 0.0001), 0, 1);
    return `${focal.x * 100}% ${normalized * 100}%`;
  }

  return `${focal.x * 100}% ${focal.y * 100}%`;
}

export function getPhotoAspect(photo: Pick<PhotoAnalysis, "width" | "height" | "orientation">): number {
  if (photo.width && photo.height && photo.height > 0) {
    return photo.width / photo.height;
  }

  switch (photo.orientation as PhotoOrientation) {
    case "panorama":
      return 2.4;
    case "landscape":
      return 1.6;
    case "portrait":
      return 0.72;
    default:
      return 1;
  }
}
