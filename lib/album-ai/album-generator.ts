import { pipeline } from "@huggingface/transformers";
import {
  getEventCandidates,
  normalizeEventLabel,
} from "./event-classifier";
import { chooseFrameStyle } from "./frame-engine";
import { createProfessionalLayout } from "./layout-engine";
import { getFocalPoint } from "./photo-fitting-engine";
import type {
  AlbumPage,
  EventType,
  GeneratedAlbum,
  PhotoAnalysis,
  PhotoGroup,
} from "./types";

export interface AlbumGeneratorInput {
  id: string;
  fileName?: string;
  data: string;
  width?: number;
  height?: number;
  faces?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    score?: number;
  }>;
  labels?: string[];
}

export interface GenerateAlbumOptions {
  title?: string;
}

type ZeroShotResult = Array<{ label: string; score: number }>;
type ClipClassifier = (
  image: string,
  candidateLabels: string[],
) => Promise<ZeroShotResult>;

let classifierPromise: Promise<ClipClassifier> | null = null;

async function getClassifier(): Promise<ClipClassifier> {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "zero-shot-image-classification",
      "Xenova/clip-vit-large-patch14",
    ) as unknown as Promise<ClipClassifier>;
  }

  return classifierPromise;
}

const SECTION_PROMPTS: Record<EventType, string[]> = {
  wedding: ["haldi", "mehendi", "sangeet", "wedding ceremony", "reception", "family portraits", "couple portraits"],
  birthday: ["decorations", "guests", "cake", "gifts", "celebration", "group photos"],
  travel: ["arrival", "sightseeing", "food", "activities", "people", "landscape"],
  college: ["campus", "classroom", "sports", "cultural event", "graduation", "friends"],
  corporate: ["conference", "presentation", "meeting", "networking", "team", "office"],
  sports: ["action", "team", "competition", "celebration", "crowd", "venue"],
  fashion: ["runway", "portrait", "backstage", "fashion shoot", "group", "details"],
  concert: ["performer", "stage", "audience", "backstage", "crowd", "music"],
  festival: ["ceremony", "decoration", "crowd", "food", "performance", "tradition"],
  party: ["decorations", "guests", "food", "dancing", "celebration", "group photos"],
  family: ["family portraits", "children", "group photos", "outdoor", "celebration", "activities"],
  vacation: ["destination", "sightseeing", "relaxing", "food", "activities", "people"],
  product: ["hero product", "detail shot", "lifestyle", "packaging", "product closeup", "product group"],
  nature: ["landscape", "wildlife", "plants", "mountains", "water", "sky"],
  other: ["people", "place", "activity", "detail", "portrait", "scene"],
};

function getOrientation(width?: number, height?: number): PhotoAnalysis["orientation"] {
  if (!width || !height) return "square";
  const ratio = width / height;
  if (ratio > 2.1) return "panorama";
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

function fallbackSection(event: EventType): string {
  return SECTION_PROMPTS[event][0] ?? "Highlights";
}

async function classifyPhoto(input: AlbumGeneratorInput): Promise<PhotoAnalysis> {
  let event: EventType = "other";
  let eventConfidence = 0;
  let section = fallbackSection(event);
  let sectionConfidence = 0;
  let labels = input.labels ?? [];

  try {
    const classifier = await getClassifier();
    const candidates = getEventCandidates().filter((candidate) => candidate !== "other");
    const eventResults = await classifier(input.data, candidates);
    const bestEvent = [...eventResults].sort((a, b) => b.score - a.score)[0];

    if (bestEvent) {
      event = normalizeEventLabel(bestEvent.label);
      eventConfidence = bestEvent.score;
    }

    const sectionCandidates = SECTION_PROMPTS[event] ?? SECTION_PROMPTS.other;
    const sectionResults = await classifier(input.data, sectionCandidates);
    const bestSection = [...sectionResults].sort((a, b) => b.score - a.score)[0];

    if (bestSection) {
      section = bestSection.label;
      sectionConfidence = bestSection.score;
    }

    labels = [
      ...labels,
      ...eventResults.slice(0, 3).map((result) => result.label),
      ...sectionResults.slice(0, 3).map((result) => result.label),
    ];
  } catch (error) {
    console.warn(
      `AI classification failed for ${input.fileName ?? input.id}; using fallback classification.`,
      error,
    );
  }

  const width = input.width;
  const height = input.height;
  const faces = input.faces ?? [];

  return {
    id: input.id,
    fileName: input.fileName,
    event,
    eventConfidence,
    section,
    sectionConfidence,
    width,
    height,
    orientation: getOrientation(width, height),
    peopleCount: faces.length,
    faces,
    focalPoint: getFocalPoint({ faces, orientation: getOrientation(width, height) }),
    labels: Array.from(new Set(labels)).slice(0, 12),
    qualityScore: 1,
  };
}

function buildGroups(photos: PhotoAnalysis[]): PhotoGroup[] {
  if (photos.length === 0) return [];

  // Individual image labels are intentionally not used as page boundaries.
  // A classifier can call adjacent photos "sightseeing", "people", and
  // "food", but splitting those into one-photo pages destroys the visual
  // rhythm of a printed collage. Keep the upload order intact and let the
  // layout engine build full, balanced pages from the complete story.
  const eventScores = new Map<EventType, number>();
  for (const photo of photos) {
    eventScores.set(
      photo.event,
      (eventScores.get(photo.event) ?? 0) + Math.max(photo.eventConfidence, 0.1),
    );
  }

  const event =
    [...eventScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
  const confidence =
    photos.reduce((sum, photo) => sum + photo.eventConfidence, 0) /
    photos.length;

  return [{
    id: "group-1",
    name: "Highlights",
    event,
    photoIds: photos.map((photo) => photo.id),
    confidence,
    order: 0,
  }];
}

function buildPages(groups: PhotoGroup[], photos: PhotoAnalysis[]): AlbumPage[] {
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const pages: AlbumPage[] = [];

  for (const group of groups) {
    const groupPhotos = group.photoIds
      .map((id) => photoById.get(id))
      .filter((photo): photo is PhotoAnalysis => Boolean(photo));

    // Keep a varied but readable page density. Dividing long uploads into
    // near-even groups prevents a dense nine-photo mosaic followed by a weak
    // one- or two-photo leftover page (for example, 19 becomes 7 / 6 / 6).
    for (let index = 0; index < groupPhotos.length; ) {
      const remaining = groupPhotos.length - index;
      const pagesNeeded = remaining > 9 ? Math.ceil(remaining / 7) : 1;
      const pageCount = Math.min(9, Math.ceil(remaining / pagesNeeded));
      const pagePhotos = groupPhotos.slice(index, index + pageCount);

      const layout = createProfessionalLayout(pagePhotos, group.event, group.name);
      const frame = chooseFrameStyle(group.event, group.name, layout.type);

      pages.push({
        id: `ai-page-${pages.length + 1}`,
        sectionId: group.id,
        order: pages.length,
        layout,
        frame,
        photoIds: layout.slots
          .map((slot) => slot.photoId)
          .filter((id): id is string => Boolean(id)),
        // Text is deliberately opt-in in the editor; generated pages remain
        // image-first until the user adds their own copy.
        title: undefined,
      });

      index += pageCount;
    }
  }

  return pages;
}

export async function generateAlbum(
  inputs: AlbumGeneratorInput[],
  options: GenerateAlbumOptions = {},
): Promise<GeneratedAlbum> {
  const photos = await Promise.all(inputs.map(classifyPhoto));
  const groups = buildGroups(photos);
  const pages = buildPages(groups, photos);

  const eventScores = new Map<EventType, number>();
  for (const photo of photos) {
    eventScores.set(
      photo.event,
      (eventScores.get(photo.event) ?? 0) + photo.eventConfidence,
    );
  }

  const eventType =
    [...eventScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";

  return {
    id: `album-${Date.now()}`,
    title:
      options.title?.trim() ||
      `${eventType[0].toUpperCase()}${eventType.slice(1)} Album`,
    eventType,
    photos,
    groups,
    pages,
    createdAt: new Date().toISOString(),
  };
}
