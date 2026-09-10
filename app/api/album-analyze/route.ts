import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

// =====================================================
// TYPES
// =====================================================

type Detection = {
  label: string;
  score: number;
};

type LandmarkApiResponse = {
  success: boolean;

  bestLabel?: string;

  bestConfidence?: number;

  detectionType?: string;

  labels?: Detection[];

  famousLabels?: Detection[];

  isMonumentLike?: boolean;

  error?: string;
};

type AlbumImage = {
  id: string;
  data: string;
};

// =====================================================
// HUGGING FACE CONFIGURATION
// =====================================================

const HF_TOKEN = process.env.HF_TOKEN;

const CLIP_MODEL =
  "openai/clip-vit-large-patch14-336";

// =====================================================
// IMPORTANT
//
// The Hugging Face token is kept on the server.
// It is NEVER exposed to the browser.
// =====================================================

if (!HF_TOKEN) {
  console.warn(
    "HF_TOKEN is not configured. Album AI analysis will fail until it is added to .env.local."
  );
}

// =====================================================
// HUGGING FACE CLIENT
// =====================================================

const hf = HF_TOKEN
  ? new InferenceClient(HF_TOKEN)
  : null;

// =====================================================
// LANDMARK CANDIDATES
//
// These are deliberately kept as recognizable locations
// rather than thousands of arbitrary labels.
//
// The "unknown" candidates prevent the model from being
// forced to choose a famous landmark when the photograph
// is actually a normal place/object.
// =====================================================

const FAMOUS_LANDMARKS = [
  "the Taj Mahal in Agra, India",
  "the Red Fort in Delhi, India",
  "India Gate in Delhi, India",
  "Qutub Minar in Delhi, India",
  "the Lotus Temple in Delhi, India",
  "Humayun's Tomb in Delhi, India",
  "Victoria Memorial in Kolkata, India",
  "Gateway of India in Mumbai, India",
  "Charminar in Hyderabad, India",
  "Mysore Palace in Mysore, India",
  "Hawa Mahal in Jaipur, India",
  "Amer Fort in Jaipur, India",
  "City Palace in Jaipur, India",
  "Konark Sun Temple in Odisha, India",
  "Sanchi Stupa in Madhya Pradesh, India",
  "Brihadeeswarar Temple in Tamil Nadu, India",
  "Golden Temple in Amritsar, India",
  "Meenakshi Temple in Madurai, India",
  "Howrah Bridge in Kolkata, India",
  "Bandra-Worli Sea Link in Mumbai, India",
  "Tower Bridge in London, England",
  "Big Ben in London, England",
  "the Eiffel Tower in Paris, France",
  "the Colosseum in Rome, Italy",
  "the Leaning Tower of Pisa in Italy",
  "the Statue of Liberty in New York, USA",
  "the Empire State Building in New York, USA",
  "the Burj Khalifa in Dubai, UAE",
  "the Sydney Opera House in Sydney, Australia",
  "Christ the Redeemer in Rio de Janeiro, Brazil",
  "the Great Wall of China",
  "Machu Picchu in Peru",
  "the Pyramids of Giza in Egypt",
  "Petra in Jordan",
  "Mount Fuji in Japan",
];

// =====================================================
// GENERAL SCENE CANDIDATES
// =====================================================

const GENERAL_SCENES = [
  "a historical monument",
  "a famous landmark",
  "a temple",
  "a mosque",
  "a church",
  "a palace",
  "a fort",
  "a tomb",
  "a museum",
  "a government building",
  "a modern skyscraper",
  "a bridge",
  "a city street",
  "a park",
  "a garden",
  "a beach",
  "a mountain",
  "a lake",
  "a river",
  "a forest",
  "an indoor room",
  "a wedding venue",
  "a family gathering",
  "a group of people",
  "a portrait",
  "a vehicle",
  "an ordinary outdoor location",
  "an ordinary indoor location",
  "an unknown location",
];

// =====================================================
// IMAGE → BLOB
// =====================================================

async function dataUrlToBlob(
  dataUrl: string
): Promise<Blob> {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(
      `Could not load image data: ${response.status}`
    );
  }

  return response.blob();
}

// =====================================================
// SORT DETECTIONS
// =====================================================

function sortDetections(
  detections: Detection[]
): Detection[] {
  return [...detections].sort(
    (a, b) => b.score - a.score
  );
}

// =====================================================
// NORMALIZE LABEL
// =====================================================

function cleanLabel(label: string): string {
  return label
    .replace(/^a photo of\s+/i, "")
    .replace(/^a photograph of\s+/i, "")
    .replace(/^an image of\s+/i, "")
    .trim();
}

// =====================================================
// DETECT FAMOUS LANDMARK
// =====================================================

async function detectFamousLandmark(
  imageBlob: Blob
): Promise<Detection[]> {
  if (!hf) {
    throw new Error(
      "HF_TOKEN is missing."
    );
  }

  const result =
    await hf.zeroShotImageClassification({
      model: CLIP_MODEL,

      inputs: {
        image: imageBlob,
      },

      parameters: {
        candidate_labels:
          FAMOUS_LANDMARKS,
      },
    });

  return sortDetections(
    result.map((item) => ({
      label: cleanLabel(item.label),
      score: Number(item.score),
    }))
  );
}

// =====================================================
// DETECT GENERAL SCENE
// =====================================================

async function detectGeneralScene(
  imageBlob: Blob
): Promise<Detection[]> {
  if (!hf) {
    throw new Error(
      "HF_TOKEN is missing."
    );
  }

  const result =
    await hf.zeroShotImageClassification({
      model: CLIP_MODEL,

      inputs: {
        image: imageBlob,
      },

      parameters: {
        candidate_labels:
          GENERAL_SCENES,
      },
    });

  return sortDetections(
    result.map((item) => ({
      label: cleanLabel(item.label),
      score: Number(item.score),
    }))
  );
}

// =====================================================
// LANDMARK CONFIDENCE
//
// CLIP scores are relative to the candidate list.
// Therefore we do NOT blindly accept the top result.
//
// We also check the difference between the first and
// second candidates.
//
// This helps reduce forced incorrect landmark labels.
// =====================================================

function chooseLandmark(
  detections: Detection[]
): {
  label: string;
  confidence: number;
  accepted: boolean;
} {
  if (detections.length === 0) {
    return {
      label: "Unknown Location",
      confidence: 0,
      accepted: false,
    };
  }

  const best = detections[0];

  const second =
    detections.length > 1
      ? detections[1]
      : undefined;

  const margin =
    second
      ? best.score - second.score
      : best.score;

  /*
   * These thresholds are intentionally conservative.
   *
   * A landmark is accepted when:
   *
   * 1. CLIP gives it reasonable confidence
   * OR
   * 2. It clearly beats the next candidate.
   *
   * This is not a mathematically calibrated probability.
   */

  const accepted =
    best.score >= 0.35 &&
    margin >= 0.025;

  return {
    label: accepted
      ? best.label
      : "Unknown Location",

    confidence: accepted
      ? best.score
      : 0,

    accepted,
  };
}

// =====================================================
// DETERMINE MONUMENT-LIKE IMAGE
// =====================================================

function determineMonumentLike(
  sceneDetections: Detection[],
  landmarkAccepted: boolean
): boolean {
  if (landmarkAccepted) {
    return true;
  }

  const monumentLabels = [
    "a historical monument",
    "a famous landmark",
    "a temple",
    "a mosque",
    "a church",
    "a palace",
    "a fort",
    "a tomb",
    "a museum",
    "a government building",
  ];

  const monumentScore =
    sceneDetections
      .filter((item) =>
        monumentLabels.includes(item.label)
      )
      .reduce(
        (highest, item) =>
          Math.max(
            highest,
            item.score
          ),
        0
      );

  return monumentScore >= 0.30;
}

// =====================================================
// ANALYZE ONE IMAGE
// =====================================================

async function analyzeImage(
  image: AlbumImage
): Promise<{
  id: string;

  labels: Detection[];

  famousLandmarkLabels: Detection[];

  landmarkLabels: Detection[];

  lucknowLabels: Detection[];

  historicalLabels: Detection[];

  architectureLabels: Detection[];

  finalLabel: string;

  finalConfidence: number;

  detectionType: string;

  isMonumentLike: boolean;
}> {
  try {
    // =================================================
    // CONVERT DATA URL → BLOB
    // =================================================

    const imageBlob =
      await dataUrlToBlob(
        image.data
      );

    // =================================================
    // RUN BOTH ANALYSES
    //
    // They use the same image but different candidate
    // sets.
    // =================================================

    const [
      landmarkDetections,
      sceneDetections,
    ] = await Promise.all([
      detectFamousLandmark(
        imageBlob
      ),

      detectGeneralScene(
        imageBlob
      ),
    ]);

    // =================================================
    // CHOOSE LANDMARK
    // =================================================

    const landmarkDecision =
      chooseLandmark(
        landmarkDetections
      );

    // =================================================
    // GENERAL BEST RESULT
    // =================================================

    const bestScene =
      sceneDetections[0];

    // =================================================
    // DETERMINE WHETHER IMAGE LOOKS LIKE A MONUMENT
    // =================================================

    const isMonumentLike =
      determineMonumentLike(
        sceneDetections,
        landmarkDecision.accepted
      );

    // =================================================
    // FINAL DECISION
    // =================================================

    let finalLabel =
      "Unknown Location";

    let finalConfidence = 0;

    let detectionType =
      "unknown";

    // -------------------------------------------------
    // PRIORITY 1: ACCEPTED FAMOUS LANDMARK
    // -------------------------------------------------

    if (
      landmarkDecision.accepted
    ) {
      finalLabel =
        landmarkDecision.label;

      finalConfidence =
        landmarkDecision.confidence;

      detectionType =
        "famous_landmark";
    }

    // -------------------------------------------------
    // PRIORITY 2: GENERAL MONUMENT / SCENE
    // -------------------------------------------------

    else if (
      bestScene &&
      bestScene.score >= 0.30
    ) {
      finalLabel =
        bestScene.label;

      finalConfidence =
        bestScene.score;

      detectionType =
        isMonumentLike
          ? "monument_or_landmark"
          : "general_location";
    }

    // -------------------------------------------------
    // RETURN
    // -------------------------------------------------

    return {
      id: image.id,

      labels:
        sceneDetections,

      famousLandmarkLabels:
        landmarkDetections,

      landmarkLabels:
        landmarkDetections,

      lucknowLabels: [],

      historicalLabels:
        sceneDetections.filter(
          (item) =>
            item.label ===
              "a historical monument" ||
            item.label ===
              "a fort" ||
            item.label ===
              "a palace" ||
            item.label ===
              "a tomb"
        ),

      architectureLabels:
        sceneDetections.filter(
          (item) =>
            item.label ===
              "a historical monument" ||
            item.label ===
              "a famous landmark" ||
            item.label ===
              "a temple" ||
            item.label ===
              "a mosque" ||
            item.label ===
              "a church" ||
            item.label ===
              "a palace" ||
            item.label ===
              "a fort" ||
            item.label ===
              "a tomb" ||
            item.label ===
              "a modern skyscraper" ||
            item.label ===
              "a bridge"
        ),

      finalLabel,

      finalConfidence,

      detectionType,

      isMonumentLike,
    };
  } catch (error) {
    console.error(
      `Image analysis failed for ${image.id}:`,
      error
    );

    return {
      id: image.id,

      labels: [],

      famousLandmarkLabels: [],

      landmarkLabels: [],

      lucknowLabels: [],

      historicalLabels: [],

      architectureLabels: [],

      finalLabel:
        "Unknown Location",

      finalConfidence: 0,

      detectionType:
        "failed",

      isMonumentLike: false,
    };
  }
}

// =====================================================
// POST /api/album-analyze
// =====================================================

export async function POST(
  request: Request
) {
  try {
    // =================================================
    // CHECK HUGGING FACE TOKEN
    // =================================================

    if (!HF_TOKEN || !hf) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Hugging Face token is missing. Add HF_TOKEN to .env.local.",
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // READ REQUEST
    // =================================================

    const body =
      await request.json();

    const images =
      body?.images;

    // =================================================
    // VALIDATE
    // =================================================

    if (
      !Array.isArray(images) ||
      images.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No images provided.",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // MAXIMUM 10 IMAGES
    //
    // This matches the existing frontend upload limit.
    // =================================================

    const imagesToAnalyze =
      images.slice(0, 10);

    // =================================================
    // ANALYZE IMAGES
    //
    // Use a small concurrency limit rather than sending
    // every request simultaneously.
    // =================================================

    const results: Awaited<
      ReturnType<typeof analyzeImage>
    >[] = [];

    const batchSize = 2;

    for (
      let i = 0;
      i < imagesToAnalyze.length;
      i += batchSize
    ) {
      const batch =
        imagesToAnalyze.slice(
          i,
          i + batchSize
        );

      const batchResults =
        await Promise.all(
          batch.map(
            (image: AlbumImage) =>
              analyzeImage(image)
          )
        );

      results.push(
        ...batchResults
      );
    }

    // =================================================
    // RETURN
    // =================================================

    return NextResponse.json({
      success: true,

      results,
    });
  } catch (error) {
    console.error(
      "Album analysis error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "AI album analysis failed.",
      },
      {
        status: 500,
      }
    );
  }
}