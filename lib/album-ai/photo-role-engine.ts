import type {
  PhotoAnalysis,
} from "./types";

export type PhotoRole =
  | "hero"
  | "portrait"
  | "group"
  | "detail"
  | "landscape"
  | "action"
  | "supporting";

export interface PhotoRoleAssignment {
  photoId: string;
  role: PhotoRole;
  score: number;
}

/**
 * Determine the most useful role for a photograph inside an album.
 *
 * This is intentionally heuristic for now.
 * Later we can feed richer AI signals into the same interface without
 * changing the layout engine.
 */
export function getPhotoRole(
  photo: PhotoAnalysis,
): PhotoRole {
  const labels = photo.labels
    .join(" ")
    .toLowerCase();

  const people = photo.peopleCount;
  const orientation = photo.orientation;

  // Explicit action-oriented photographs.
  if (
    /action|competition|sport|athlete|performer|performance|dance|stage/.test(
      labels,
    )
  ) {
    return "action";
  }

  // Detail photographs.
  if (
    /detail|ring|jewelry|jewellery|food|cake|gift|decoration|decoration|flower|hands|shoe|dress|product closeup/.test(
      labels,
    )
  ) {
    return "detail";
  }

  // Landscape / environment.
  if (
    orientation === "panorama" ||
    /landscape|mountain|beach|sky|nature|venue|scene|destination|architecture/.test(
      labels,
    )
  ) {
    return "landscape";
  }

  // Portrait-oriented photographs with people.
  if (
    orientation === "portrait" &&
    people > 0
  ) {
    return "portrait";
  }

  // Larger group photographs.
  if (people >= 3) {
    return "group";
  }

  // Strong photographs containing people can act as heroes.
  if (
    people > 0 &&
    (
      /hero|couple|bride|groom|family|celebration|ceremony|performer/.test(
        labels,
      ) ||
      photo.qualityScore >= 0.8
    )
  ) {
    return "hero";
  }

  return "supporting";
}

/**
 * Calculate how strongly a photograph fits its role.
 */
export function getPhotoRoleScore(
  photo: PhotoAnalysis,
  role: PhotoRole,
): number {
  const labels = photo.labels
    .join(" ")
    .toLowerCase();

  let score = photo.qualityScore || 0;

  if (photo.eventConfidence) {
    score += photo.eventConfidence * 0.2;
  }

  switch (role) {
    case "hero":
      if (photo.peopleCount > 0) {
        score += 0.25;
      }

      if (
        /couple|bride|groom|family|celebration|ceremony|hero/.test(
          labels,
        )
      ) {
        score += 0.35;
      }

      break;

    case "portrait":
      if (photo.orientation === "portrait") {
        score += 0.35;
      }

      if (photo.peopleCount > 0) {
        score += 0.25;
      }

      break;

    case "group":
      score += Math.min(
        photo.peopleCount,
        6,
      ) * 0.08;

      break;

    case "detail":
      if (
        /detail|ring|jewelry|jewellery|food|cake|gift|decoration|hands|product/.test(
          labels,
        )
      ) {
        score += 0.45;
      }

      break;

    case "landscape":
      if (
        photo.orientation === "landscape" ||
        photo.orientation === "panorama"
      ) {
        score += 0.35;
      }

      break;

    case "action":
      if (
        /action|sport|athlete|competition|performer|performance|dance/.test(
          labels,
        )
      ) {
        score += 0.45;
      }

      break;

    case "supporting":
      score += 0.05;
      break;
  }

  return score;
}

/**
 * Assign a primary role to every photograph.
 */
export function assignPhotoRoles(
  photos: PhotoAnalysis[],
): PhotoRoleAssignment[] {
  return photos.map((photo) => {
    const roles: PhotoRole[] = [
      "hero",
      "portrait",
      "group",
      "detail",
      "landscape",
      "action",
      "supporting",
    ];

    let bestRole: PhotoRole = "supporting";
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const role of roles) {
      const score = getPhotoRoleScore(
        photo,
        role,
      );

      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
      }
    }

    return {
      photoId: photo.id,
      role: bestRole,
      score: bestScore,
    };
  });
}

/**
 * Sort photographs so strong hero photographs are available first
 * while retaining deterministic ordering.
 */
export function sortPhotosByRole(
  photos: PhotoAnalysis[],
): PhotoAnalysis[] {
  const assignments = assignPhotoRoles(
    photos,
  );

  const rolePriority: Record<
    PhotoRole,
    number
  > = {
    hero: 7,
    portrait: 6,
    group: 5,
    action: 4,
    landscape: 3,
    detail: 2,
    supporting: 1,
  };

  const assignmentMap = new Map(
    assignments.map((assignment) => [
      assignment.photoId,
      assignment,
    ]),
  );

  return [...photos].sort((a, b) => {
    const aAssignment =
      assignmentMap.get(a.id);

    const bAssignment =
      assignmentMap.get(b.id);

    const aPriority =
      aAssignment
        ? rolePriority[aAssignment.role]
        : 0;

    const bPriority =
      bAssignment
        ? rolePriority[bAssignment.role]
        : 0;

    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }

    return (
      (bAssignment?.score ?? 0) -
      (aAssignment?.score ?? 0)
    );
  });
}