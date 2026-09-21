import type {
  EventType,
  FaceBox,
  PhotoAnalysis,
  PhotoOrientation,
} from "./types";
import {
  EVENT_PROMPTS,
  chooseEventClassification,
} from "./event-classifier";

interface ImageInput {
  id: string;
  fileName?: string;
  data: string;
  faces?: FaceBox[];
}

interface ClassifierResult {
  label: string;
  score: number;
}

type ZeroShotClassifier = (
  image: string,
  candidateLabels: string[]
) => Promise<ClassifierResult[]>;

let classifierPromise: Promise<ZeroShotClassifier> | null = null;

async function getClassifier(): Promise<ZeroShotClassifier> {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");

      const classifier = await pipeline(
        "zero-shot-image-classification",
        "Xenova/clip-vit-large-patch14"
      );

      return classifier as unknown as ZeroShotClassifier;
    })();
  }

  return classifierPromise;
}

function getImageDimensions(
  data: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(new Error("Unable to read image dimensions."));
    };

    image.src = data;
  });
}

function getOrientation(
  width: number,
  height: number
): PhotoOrientation {
  const ratio = width / height;

  if (ratio >= 2.2) {
    return "panorama";
  }

  if (ratio > 1.1) {
    return "landscape";
  }

  if (ratio < 0.9) {
    return "portrait";
  }

  return "square";
}

function calculateQualityScore(
  width: number,
  height: number
): number {
  const pixels = width * height;

  if (pixels >= 12000000) {
    return 1;
  }

  if (pixels >= 8000000) {
    return 0.9;
  }

  if (pixels >= 5000000) {
    return 0.8;
  }

  if (pixels >= 3000000) {
    return 0.7;
  }

  if (pixels >= 1500000) {
    return 0.55;
  }

  return 0.4;
}

function getPeopleCount(faces: FaceBox[] = []): number {
  return faces.length;
}

function getEventLabels(): string[] {
  return Object.keys(EVENT_PROMPTS);
}

function createGenericLabels(
  event: EventType,
  orientation: PhotoOrientation,
  peopleCount: number
): string[] {
  const labels: string[] = [];

  labels.push(event);

  labels.push(orientation);

  if (peopleCount === 0) {
    labels.push("no people");
  } else if (peopleCount === 1) {
    labels.push("single person");
  } else if (peopleCount === 2) {
    labels.push("two people");
  } else {
    labels.push("group photo");
  }

  return labels;
}

export async function analyzePhoto(
  input: ImageInput
): Promise<PhotoAnalysis> {
  const { width, height } = await getImageDimensions(input.data);

  const orientation = getOrientation(width, height);

  const faces = input.faces ?? [];

  const peopleCount = getPeopleCount(faces);

  let event: EventType = "other";
  let eventConfidence = 0;

  let aiLabels: string[] = [];

  try {
    const classifier = await getClassifier();

    const results = await classifier(
      input.data,
      getEventLabels()
    );

    const classification = chooseEventClassification(results);

    event = classification.event;
    eventConfidence = classification.confidence;

    aiLabels = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((result) => result.label);
  } catch (error) {
    console.error(
      `AI analysis failed for ${input.fileName ?? input.id}:`,
      error
    );
  }

  const labels = [
    ...aiLabels,
    ...createGenericLabels(
      event,
      orientation,
      peopleCount
    ),
  ];

  return {
    id: input.id,
    fileName: input.fileName,

    event,
    eventConfidence,

    width,
    height,
    orientation,

    peopleCount,
    faces,

    labels,

    qualityScore: calculateQualityScore(
      width,
      height
    ),
  };
}

export async function analyzePhotos(
  inputs: ImageInput[]
): Promise<PhotoAnalysis[]> {
  const results: PhotoAnalysis[] = [];

  for (const input of inputs) {
    try {
      const analysis = await analyzePhoto(input);
      results.push(analysis);
    } catch (error) {
      console.error(
        `Failed to analyze ${input.fileName ?? input.id}:`,
        error
      );
    }
  }

  return results;
}