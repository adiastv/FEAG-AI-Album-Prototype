"use client";

import "@openpageflip/core/styles.css";

import { useEffect, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  type Book,
  FlipBook,
  Page,
} from "@openpageflip/react";

// =====================================================
// TYPES
// =====================================================

interface StoredImage {
  id: string;
  name: string;
  data: string;

  // Added by the dynamic layout engine before the album is generated.
  width?: number;
  height?: number;
  aspectRatio?: number;
  orientation?: ImageOrientation;

  analysis?: {
    finalLabel: string;
    finalConfidence: number;
    detectionType: string;

    labels?: {
      label: string;
      score: number;
    }[];
  };
}

type ImageOrientation =
  | "portrait"
  | "landscape"
  | "square";

type AlbumDesign =
  | "classic"
  | "editorial"
  | "collage"
  | "story";

interface DynamicFrame {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AlbumPage {
  id: string;
  images: StoredImage[];
  frames: DynamicFrame[];
}

type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// =====================================================
// COMPONENT
// =====================================================

export default function Home() {
  const [images, setImages] =
    useState<StoredImage[]>([]);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [albumCreated, setAlbumCreated] =
    useState(false);

  const [albumPages, setAlbumPages] =
    useState<AlbumPage[]>([]);

  // The user can switch between genuinely different layout engines
  // without changing the uploaded photographs or album order.
  const [albumDesign, setAlbumDesign] =
    useState<AlbumDesign>("classic");

  // Used to re-create the book at the cover.
  const [bookKey, setBookKey] =
    useState(0);

  const [bookOpened, setBookOpened] =
    useState(false);

  const bookRef =
    useRef<Book>(null);


  // =====================================================
  // PHOTO EDITOR
  // =====================================================

  const [selectedImage, setSelectedImage] =
    useState<StoredImage | null>(null);

  const [editorCrop, setEditorCrop] =
    useState({ x: 0, y: 0 });

  const [editorZoom, setEditorZoom] =
    useState(1);

  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<Area | null>(null);

  const [brightness, setBrightness] =
    useState(100);

  const [contrast, setContrast] =
    useState(100);

  const [saturation, setSaturation] =
    useState(100);

  const [selectedFilter, setSelectedFilter] =
    useState("none");

  const [faceBoxes, setFaceBoxes] =
    useState<FaceBox[]>([]);

  const [isDetectingFaces, setIsDetectingFaces] =
    useState(false);

  // =====================================================
  // RESET ALBUM
  // =====================================================

  const resetAlbum = () => {
    setAlbumCreated(false);

    setAlbumPages([]);

    setBookOpened(false);

    setBookKey(
      (previous) =>
        previous + 1
    );
  };

  // =====================================================
  // FILE UPLOAD
  // =====================================================

  const handleFileChange = (
    event:
      React.ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      event.target.files;

    if (!files) return;

    const selectedFiles =
      Array.from(files);

    const remainingSlots =
      10 - images.length;

    if (
      remainingSlots <= 0
    ) {
      alert(
        "You can upload a maximum of 10 images."
      );

      return;
    }

    const filesToUpload =
      selectedFiles.slice(
        0,
        remainingSlots
      );

    if (
      selectedFiles.length >
      remainingSlots
    ) {
      alert(
        `Only ${remainingSlots} more image(s) can be uploaded. Maximum is 10 images.`
      );
    }

    filesToUpload.forEach(
      (file) => {
        const reader =
          new FileReader();

        reader.onload = () => {
          const newImage: StoredImage =
            {
              id: `${Date.now()}-${Math.random()}`,

              name:
                file.name,

              data:
                reader.result as string,
            };

          setImages(
            (
              previousImages
            ) => [
              ...previousImages,
              newImage,
            ]
          );
        };

        reader.readAsDataURL(
          file
        );
      }
    );

    resetAlbum();
  };

  // =====================================================
  // DELETE IMAGE
  // =====================================================

  const deleteImage = (
    id: string
  ) => {
    setImages(
      (previousImages) =>
        previousImages.filter(
          (image) =>
            image.id !== id
        )
    );

    resetAlbum();
  };

  // =====================================================
  // FORMAT LABEL
  // =====================================================

  const formatLabel = (
    label: string
  ) => {
    if (!label) {
      return "Unknown location";
    }

    return label
      .split(" ")
      .map(
        (word) =>
          word
            .charAt(0)
            .toUpperCase() +
          word.slice(1)
      )
      .join(" ");
  };

  // =====================================================
  // DYNAMIC IMAGE METADATA + ALBUM LAYOUT ENGINE
  //
  // No fixed hero/two/three/four templates are used.
  // Every photo is measured first, then the layout is
  // calculated from its real width, height and aspect ratio.
  // =====================================================

  const classifyOrientation = (
    width: number,
    height: number
  ): ImageOrientation => {
    const ratio = width / height;

    if (ratio > 1.12) {
      return "landscape";
    }

    if (ratio < 0.89) {
      return "portrait";
    }

    return "square";
  };

  const readImageMetadata = (
    imageData: string
  ): Promise<{
    width: number;
    height: number;
    aspectRatio: number;
    orientation: ImageOrientation;
  }> => {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const aspectRatio = width / Math.max(height, 1);

        resolve({
          width,
          height,
          aspectRatio,
          orientation: classifyOrientation(width, height),
        });
      };

      image.onerror = () =>
        reject(
          new Error(
            "Could not read image dimensions"
          )
        );

      image.src = imageData;
    });
  };

  const addImageMetadata = async (
    albumImages: StoredImage[]
  ): Promise<StoredImage[]> => {
    return Promise.all(
      albumImages.map(async (image) => {
        if (
          image.width &&
          image.height &&
          image.aspectRatio &&
          image.orientation
        ) {
          return image;
        }

        try {
          const metadata =
            await readImageMetadata(image.data);

          return {
            ...image,
            ...metadata,
          };
        } catch (error) {
          console.error(
            `Could not measure ${image.name}:`,
            error
          );

          return {
            ...image,
            width: 1,
            height: 1,
            aspectRatio: 1,
            orientation: "square" as ImageOrientation,
          };
        }
      })
    );
  };

  type PixelRect = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  type PixelFrame = PixelRect & {
    imageId: string;
  };

  const PAGE_WIDTH = 500;
  const PAGE_HEIGHT = 650;
  const PAGE_PADDING = 30;
  const FRAME_GAP = 18;

  const fitAspectRatioInside = (
    image: StoredImage,
    rect: PixelRect
  ): PixelFrame => {
    const ratio =
      image.aspectRatio && image.aspectRatio > 0
        ? image.aspectRatio
        : 1;

    const availableRatio =
      rect.width / Math.max(rect.height, 1);

    let width = rect.width;
    let height = rect.height;

    if (ratio > availableRatio) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }

    return {
      imageId: image.id,
      x: rect.x + (rect.width - width) / 2,
      y: rect.y + (rect.height - height) / 2,
      width,
      height,
    };
  };

  const frameAreaScore = (
    frames: PixelFrame[],
    rect: PixelRect
  ) => {
    const totalArea = frames.reduce(
      (sum, frame) =>
        sum + frame.width * frame.height,
      0
    );

    const rectArea =
      Math.max(rect.width * rect.height, 1);

    const smallestShare = Math.min(
      ...frames.map(
        (frame) =>
          (frame.width * frame.height) /
          rectArea
      )
    );

    // Prefer layouts that use the page well while preventing
    // one photograph from becoming unnecessarily tiny.
    return (
      totalArea / rectArea +
      Math.min(smallestShare, 0.22) * 0.8
    );
  };

  const buildBestLayout = (
    pageImages: StoredImage[],
    rect: PixelRect
  ): PixelFrame[] => {
    if (pageImages.length === 1) {
      return [
        fitAspectRatioInside(
          pageImages[0],
          rect
        ),
      ];
    }

    let bestFrames: PixelFrame[] = [];
    let bestScore = Number.NEGATIVE_INFINITY;

    // Try every possible split and both split directions.
    // This creates different layouts from the actual photo shapes
    // instead of selecting a pre-built template.
    for (
      let splitIndex = 1;
      splitIndex < pageImages.length;
      splitIndex++
    ) {
      const firstGroup =
        pageImages.slice(0, splitIndex);
      const secondGroup =
        pageImages.slice(splitIndex);

      const firstLandscapeWeight =
        firstGroup.reduce(
          (sum, image) =>
            sum + Math.sqrt(image.aspectRatio || 1),
          0
        );

      const secondLandscapeWeight =
        secondGroup.reduce(
          (sum, image) =>
            sum + Math.sqrt(image.aspectRatio || 1),
          0
        );

      const firstPortraitWeight =
        firstGroup.reduce(
          (sum, image) =>
            sum + 1 / Math.sqrt(image.aspectRatio || 1),
          0
        );

      const secondPortraitWeight =
        secondGroup.reduce(
          (sum, image) =>
            sum + 1 / Math.sqrt(image.aspectRatio || 1),
          0
        );

      // VERTICAL DIVISION: groups sit side-by-side.
      const totalHorizontalWeight =
        firstLandscapeWeight +
        secondLandscapeWeight;

      const firstWidth = Math.max(
        1,
        (rect.width - FRAME_GAP) *
          (firstLandscapeWeight /
            totalHorizontalWeight)
      );

      const verticalFirstRect: PixelRect = {
        x: rect.x,
        y: rect.y,
        width: firstWidth,
        height: rect.height,
      };

      const verticalSecondRect: PixelRect = {
        x: rect.x + firstWidth + FRAME_GAP,
        y: rect.y,
        width: Math.max(
          1,
          rect.width - firstWidth - FRAME_GAP
        ),
        height: rect.height,
      };

      const verticalFrames = [
        ...buildBestLayout(
          firstGroup,
          verticalFirstRect
        ),
        ...buildBestLayout(
          secondGroup,
          verticalSecondRect
        ),
      ];

      const verticalScore =
        frameAreaScore(verticalFrames, rect);

      if (verticalScore > bestScore) {
        bestScore = verticalScore;
        bestFrames = verticalFrames;
      }

      // HORIZONTAL DIVISION: groups sit one above another.
      const totalVerticalWeight =
        firstPortraitWeight +
        secondPortraitWeight;

      const firstHeight = Math.max(
        1,
        (rect.height - FRAME_GAP) *
          (firstPortraitWeight /
            totalVerticalWeight)
      );

      const horizontalFirstRect: PixelRect = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: firstHeight,
      };

      const horizontalSecondRect: PixelRect = {
        x: rect.x,
        y: rect.y + firstHeight + FRAME_GAP,
        width: rect.width,
        height: Math.max(
          1,
          rect.height - firstHeight - FRAME_GAP
        ),
      };

      const horizontalFrames = [
        ...buildBestLayout(
          firstGroup,
          horizontalFirstRect
        ),
        ...buildBestLayout(
          secondGroup,
          horizontalSecondRect
        ),
      ];

      const horizontalScore =
        frameAreaScore(horizontalFrames, rect);

      if (horizontalScore > bestScore) {
        bestScore = horizontalScore;
        bestFrames = horizontalFrames;
      }
    }

    return bestFrames;
  };

  // =====================================================
  // MULTI-DESIGN DYNAMIC LAYOUT ENGINE
  //
  // Every design below calculates frames from the REAL image
  // aspect ratios. The designs are intentionally different:
  //
  // classic   -> balanced adaptive packing
  // editorial -> dominant hero + supporting images
  // collage   -> layered scrapbook composition
  // story     -> cinematic sequence / film-strip composition
  //
  // fitAspectRatioInside() keeps every frame at the photograph's
  // natural ratio, so there is no empty space between the photo
  // and its own frame.
  // =====================================================

  const toPercentFrames = (
    pixelFrames: PixelFrame[]
  ): DynamicFrame[] =>
    pixelFrames.map((frame) => ({
      imageId: frame.imageId,
      x: (frame.x / PAGE_WIDTH) * 100,
      y: (frame.y / PAGE_HEIGHT) * 100,
      width: (frame.width / PAGE_WIDTH) * 100,
      height: (frame.height / PAGE_HEIGHT) * 100,
    }));

  const buildClassicFrames = (
    pageImages: StoredImage[],
    rect: PixelRect
  ) => buildBestLayout(pageImages, rect);

  const buildEditorialFrames = (
    pageImages: StoredImage[],
    rect: PixelRect
  ): PixelFrame[] => {
    if (pageImages.length === 1) {
      return [
        fitAspectRatioInside(pageImages[0], {
          x: rect.x + rect.width * 0.03,
          y: rect.y + rect.height * 0.03,
          width: rect.width * 0.94,
          height: rect.height * 0.94,
        }),
      ];
    }

    const frames: PixelFrame[] = [];

    // EDITORIAL = clean magazine / publication composition.
    // It deliberately uses asymmetrical zones rather than the
    // cinematic lead + strip structure used by Story Sequence.

    if (pageImages.length === 2) {
      const first = pageImages[0];
      const second = pageImages[1];

      if (first.orientation === "landscape") {
        frames.push(
          fitAspectRatioInside(first, {
            x: rect.x,
            y: rect.y,
            width: rect.width * 0.68,
            height: rect.height * 0.72,
          })
        );

        frames.push(
          fitAspectRatioInside(second, {
            x: rect.x + rect.width * 0.63,
            y: rect.y + rect.height * 0.28,
            width: rect.width * 0.34,
            height: rect.height * 0.62,
          })
        );
      } else {
        frames.push(
          fitAspectRatioInside(first, {
            x: rect.x,
            y: rect.y,
            width: rect.width * 0.46,
            height: rect.height * 0.92,
          })
        );

        frames.push(
          fitAspectRatioInside(second, {
            x: rect.x + rect.width * 0.43,
            y: rect.y + rect.height * 0.18,
            width: rect.width * 0.55,
            height: rect.height * 0.64,
          })
        );
      }

      return frames;
    }

    if (pageImages.length === 3) {
      const lead = pageImages[0];

      if (lead.orientation === "portrait") {
        // Tall editorial feature + two supporting images.
        frames.push(
          fitAspectRatioInside(lead, {
            x: rect.x,
            y: rect.y,
            width: rect.width * 0.53,
            height: rect.height * 0.94,
          })
        );

        frames.push(
          fitAspectRatioInside(pageImages[1], {
            x: rect.x + rect.width * 0.57,
            y: rect.y,
            width: rect.width * 0.39,
            height: rect.height * 0.43,
          })
        );

        frames.push(
          fitAspectRatioInside(pageImages[2], {
            x: rect.x + rect.width * 0.57,
            y: rect.y + rect.height * 0.51,
            width: rect.width * 0.39,
            height: rect.height * 0.43,
          })
        );
      } else {
        // Wide editorial hero + two separate lower images.
        frames.push(
          fitAspectRatioInside(lead, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height * 0.55,
          })
        );

        frames.push(
          fitAspectRatioInside(pageImages[1], {
            x: rect.x,
            y: rect.y + rect.height * 0.62,
            width: rect.width * 0.44,
            height: rect.height * 0.32,
          })
        );

        frames.push(
          fitAspectRatioInside(pageImages[2], {
            x: rect.x + rect.width * 0.51,
            y: rect.y + rect.height * 0.62,
            width: rect.width * 0.44,
            height: rect.height * 0.32,
          })
        );
      }

      return frames;
    }

    // Four-photo editorial: intentionally asymmetrical magazine grid.
    const editorialZones: PixelRect[] = [
      {
        x: rect.x,
        y: rect.y,
        width: rect.width * 0.59,
        height: rect.height * 0.57,
      },
      {
        x: rect.x + rect.width * 0.64,
        y: rect.y,
        width: rect.width * 0.32,
        height: rect.height * 0.36,
      },
      {
        x: rect.x,
        y: rect.y + rect.height * 0.64,
        width: rect.width * 0.36,
        height: rect.height * 0.30,
      },
      {
        x: rect.x + rect.width * 0.42,
        y: rect.y + rect.height * 0.46,
        width: rect.width * 0.54,
        height: rect.height * 0.48,
      },
    ];

    pageImages.slice(0, 4).forEach((image, index) => {
      frames.push(
        fitAspectRatioInside(image, editorialZones[index])
      );
    });

    return frames;
  };

  const buildCollageFrames = (
    pageImages: StoredImage[],
    rect: PixelRect
  ): PixelFrame[] => {
    if (pageImages.length === 1) {
      return [
        fitAspectRatioInside(pageImages[0], {
          x: rect.x + rect.width * 0.06,
          y: rect.y + rect.height * 0.05,
          width: rect.width * 0.88,
          height: rect.height * 0.9,
        }),
      ];
    }

    const zones: PixelRect[] = [
      {
        x: rect.x,
        y: rect.y + rect.height * 0.04,
        width: rect.width * 0.62,
        height: rect.height * 0.56,
      },
      {
        x: rect.x + rect.width * 0.56,
        y: rect.y,
        width: rect.width * 0.44,
        height: rect.height * 0.42,
      },
      {
        x: rect.x + rect.width * 0.08,
        y: rect.y + rect.height * 0.52,
        width: rect.width * 0.48,
        height: rect.height * 0.44,
      },
      {
        x: rect.x + rect.width * 0.52,
        y: rect.y + rect.height * 0.48,
        width: rect.width * 0.46,
        height: rect.height * 0.48,
      },
    ];

    return pageImages.map((image, index) =>
      fitAspectRatioInside(
        image,
        zones[index % zones.length]
      )
    );
  };

  const buildStoryFrames = (
    pageImages: StoredImage[],
    rect: PixelRect
  ): PixelFrame[] => {
    if (pageImages.length === 1) {
      return [
        fitAspectRatioInside(pageImages[0], {
          x: rect.x + rect.width * 0.12,
          y: rect.y + rect.height * 0.04,
          width: rect.width * 0.76,
          height: rect.height * 0.88,
        }),
      ];
    }

    const frames: PixelFrame[] = [];

    // STORY SEQUENCE = scrapbook / memory-journal composition.
    // Photos are staggered and layered to feel like a sequence
    // of moments rather than a magazine grid.

    if (pageImages.length === 2) {
      frames.push(
        fitAspectRatioInside(pageImages[0], {
          x: rect.x + rect.width * 0.05,
          y: rect.y + rect.height * 0.03,
          width: rect.width * 0.58,
          height: rect.height * 0.62,
        })
      );

      frames.push(
        fitAspectRatioInside(pageImages[1], {
          x: rect.x + rect.width * 0.40,
          y: rect.y + rect.height * 0.42,
          width: rect.width * 0.53,
          height: rect.height * 0.51,
        })
      );

      return frames;
    }

    if (pageImages.length === 3) {
      // One central feature with two smaller memory cards.
      frames.push(
        fitAspectRatioInside(pageImages[0], {
          x: rect.x + rect.width * 0.25,
          y: rect.y + rect.height * 0.02,
          width: rect.width * 0.50,
          height: rect.height * 0.67,
        })
      );

      frames.push(
        fitAspectRatioInside(pageImages[1], {
          x: rect.x,
          y: rect.y + rect.height * 0.55,
          width: rect.width * 0.38,
          height: rect.height * 0.38,
        })
      );

      frames.push(
        fitAspectRatioInside(pageImages[2], {
          x: rect.x + rect.width * 0.61,
          y: rect.y + rect.height * 0.59,
          width: rect.width * 0.36,
          height: rect.height * 0.34,
        })
      );

      return frames;
    }

    // Four-photo storyboard. This is deliberately NOT a 2x2 grid.
    const storyZones: PixelRect[] = [
      {
        x: rect.x + rect.width * 0.18,
        y: rect.y,
        width: rect.width * 0.64,
        height: rect.height * 0.48,
      },
      {
        x: rect.x,
        y: rect.y + rect.height * 0.40,
        width: rect.width * 0.36,
        height: rect.height * 0.35,
      },
      {
        x: rect.x + rect.width * 0.64,
        y: rect.y + rect.height * 0.38,
        width: rect.width * 0.36,
        height: rect.height * 0.36,
      },
      {
        x: rect.x + rect.width * 0.25,
        y: rect.y + rect.height * 0.69,
        width: rect.width * 0.50,
        height: rect.height * 0.27,
      },
    ];

    pageImages.slice(0, 4).forEach((image, index) => {
      frames.push(
        fitAspectRatioInside(image, storyZones[index])
      );
    });

    return frames;
  };

  const calculateDynamicFrames = (
    pageImages: StoredImage[],
    design: AlbumDesign = "classic"
  ): DynamicFrame[] => {
    const innerRect: PixelRect = {
      x: PAGE_PADDING,
      y: PAGE_PADDING,
      width:
        PAGE_WIDTH - PAGE_PADDING * 2,
      height:
        PAGE_HEIGHT - PAGE_PADDING * 2,
    };

    let pixelFrames: PixelFrame[];

    switch (design) {
      case "editorial":
        pixelFrames = buildEditorialFrames(
          pageImages,
          innerRect
        );
        break;

      case "collage":
        pixelFrames = buildCollageFrames(
          pageImages,
          innerRect
        );
        break;

      case "story":
        pixelFrames = buildStoryFrames(
          pageImages,
          innerRect
        );
        break;

      default:
        pixelFrames = buildClassicFrames(
          pageImages,
          innerRect
        );
    }

    return toPercentFrames(pixelFrames);
  };

  const getPageLayoutScore = (
    pageImages: StoredImage[]
  ) => {
    const frames =
      calculateDynamicFrames(pageImages);

    const totalArea = frames.reduce(
      (sum, frame) =>
        sum + frame.width * frame.height,
      0
    );

    const smallestArea = Math.min(
      ...frames.map(
        (frame) =>
          frame.width * frame.height
      )
    );

    let score = totalArea;

    // Reward useful multi-photo pages but reject layouts where
    // adding another image makes one frame visually too small.
    score += pageImages.length * 340;

    if (smallestArea < 650) {
      score -= 1200;
    }

    if (smallestArea < 400) {
      score -= 1800;
    }

    return score;
  };

  const generateAlbumPages = (
    albumImages: StoredImage[],
    design: AlbumDesign = "classic"
  ): AlbumPage[] => {
    const pages: AlbumPage[] = [];
    let imageIndex = 0;
    let pageNumber = 1;

    while (imageIndex < albumImages.length) {
      const remaining =
        albumImages.length - imageIndex;

      const maximumOnPage =
        Math.min(4, remaining);

      let bestCount = 1;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (
        let count = 1;
        count <= maximumOnPage;
        count++
      ) {
        const candidate =
          albumImages.slice(
            imageIndex,
            imageIndex + count
          );

        const score =
          getPageLayoutScore(candidate);

        if (score > bestScore) {
          bestScore = score;
          bestCount = count;
        }
      }

      const pageImages =
        albumImages.slice(
          imageIndex,
          imageIndex + bestCount
        );

      pages.push({
        id:
          `page-${pageNumber}-${Date.now()}-${imageIndex}`,
        images: pageImages,
        frames:
          calculateDynamicFrames(
            pageImages,
            design
          ),
      });

      imageIndex += bestCount;
      pageNumber++;
    }

    return pages;
  };

  // =====================================================
  // CREATE ALBUM
  // =====================================================

  const createAlbum =
    async () => {
      if (
        images.length === 0
      ) {
        alert(
          "Please upload at least one image."
        );

        return;
      }

      try {
        setIsAnalyzing(
          true
        );

        setAlbumCreated(
          false
        );

        setAlbumPages([]);

        setBookOpened(
          false
        );

        setAlbumDesign(
          "classic"
        );

        const response =
          await fetch(
            "/api/album-analyze",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  images,
                }),
            }
          );

        const result =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            result.error ||
              "Album analysis failed"
          );
        }

        if (
          !result.success
        ) {
          throw new Error(
            result.error ||
              "Album analysis failed"
          );
        }

        const analyzedImages =
          images.map(
            (image) => {
              const analysisResult =
                result.results.find(
                  (
                    item: any
                  ) =>
                    item.id ===
                    image.id
                );

              if (
                !analysisResult
              ) {
                return image;
              }

              return {
                ...image,

                analysis: {
                  finalLabel:
                    analysisResult.finalLabel ||
                    "Unknown location",

                  finalConfidence:
                    analysisResult.finalConfidence ||
                    0,

                  detectionType:
                    analysisResult.detectionType ||
                    "general_location",

                  labels:
                    analysisResult.labels ||
                    [],
                },
              };
            }
          );

        // Measure the real image dimensions before designing pages.
        const measuredImages =
          await addImageMetadata(
            analyzedImages
          );

        setImages(
          measuredImages
        );

        setAlbumPages(
          generateAlbumPages(
            measuredImages,
            "classic"
          )
        );

        setBookKey(
          (previous) =>
            previous + 1
        );

        setBookOpened(
          false
        );

        setAlbumCreated(
          true
        );
      } catch (error) {
        console.error(
          "Album creation error:",
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : "AI album analysis failed"
        );
      } finally {
        setIsAnalyzing(
          false
        );
      }
    };

  // =====================================================
  // BOOK CONTROLS
  // =====================================================

  const openAlbum = () => {
    if (
      bookOpened
    ) {
      return;
    }

    setBookOpened(
      true
    );

    // Give the book a moment before flipping
    // the hard front cover.
    window.setTimeout(
      () => {
        bookRef.current
          ?.flipNext();
      },
      100
    );
  };

  const nextPage = () => {
    setBookOpened(true);

    bookRef.current
      ?.flipNext();
  };

  const previousPage =
    () => {
      bookRef.current
        ?.flipPrev();
    };

  const closeAlbum = () => {
    setBookOpened(
      false
    );

    // Remounting starts the book back at page 0.
    setBookKey(
      (previous) =>
        previous + 1
    );
  };

  // =====================================================
  // ALBUM DESIGN SWITCHER
  //
  // This does NOT re-upload or disturb the current album.
  // It only recalculates the frames around the same photos.
  // =====================================================

  const changeAlbumDesign = (
    design: AlbumDesign
  ) => {
    setAlbumDesign(design);

    setAlbumPages((previousPages) =>
      previousPages.map((page) => ({
        ...page,
        frames: calculateDynamicFrames(
          page.images,
          design
        ),
      }))
    );

    setBookKey(
      (previous) => previous + 1
    );

    setBookOpened(false);
  };

  // =====================================================
  // PHOTO EDITOR
  // =====================================================

  const openPhotoEditor = (
    image: StoredImage
  ) => {
    setSelectedImage(image);
    setEditorCrop({ x: 0, y: 0 });
    setEditorZoom(1);
    setCroppedAreaPixels(null);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSelectedFilter("none");
    setFaceBoxes([]);
  };

  const closePhotoEditor = () => {
    setSelectedImage(null);
    setFaceBoxes([]);
  };

  const onCropComplete = (
    _croppedArea: Area,
    croppedPixels: Area
  ) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const getEditedImage = async (
    source: string,
    cropArea: Area | null
  ): Promise<string> => {
    const image = new Image();
    image.src = source;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Could not load image"));
    });

    const sourceX = cropArea?.x ?? 0;
    const sourceY = cropArea?.y ?? 0;
    const sourceWidth =
      cropArea?.width ?? image.naturalWidth;
    const sourceHeight =
      cropArea?.height ?? image.naturalHeight;

    const canvas =
      document.createElement("canvas");

    canvas.width = Math.round(sourceWidth);
    canvas.height = Math.round(sourceHeight);

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Canvas is not supported"
      );
    }

    context.filter = getPreviewFilter();

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    return canvas.toDataURL(
      "image/jpeg",
      0.95
    );
  };

  const getCanvasFilter = (
    filterName: string
  ) => {
    switch (filterName) {
      case "grayscale":
        return "grayscale(1)";
      case "sepia":
        return "sepia(0.75)";
      case "warm":
        return "sepia(0.25) saturate(1.15)";
      case "cool":
        return "hue-rotate(12deg) saturate(0.9)";
      default:
        return "";
    }
  };

  // This single value is used both by the live editor preview and
  // by the canvas when the user presses Apply.
  const getPreviewFilter = () =>
    [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      getCanvasFilter(selectedFilter),
    ]
      .filter(Boolean)
      .join(" ");

  const applyPhotoEdits = async () => {
    if (!selectedImage) return;

    try {
      const editedData =
        await getEditedImage(
          selectedImage.data,
          croppedAreaPixels
        );

      const editedMetadata =
        await readImageMetadata(
          editedData
        );

      const updatedImages =
        images.map((image) =>
          image.id === selectedImage.id
            ? {
                ...image,
                data: editedData,
                ...editedMetadata,
              }
            : image
        );

      setImages(updatedImages);

      // Recalculate the whole page layout because cropping can change
      // the photograph's aspect ratio and therefore its ideal frame.
      setAlbumPages(
        generateAlbumPages(
          updatedImages,
          albumDesign
        )
      );

      setBookKey(
        (previous) => previous + 1
      );

      // Close the editor after saving. The updated image is already
      // written into both the photo list and the generated album pages.
      setSelectedImage(null);
      setFaceBoxes([]);
    } catch (error) {
      console.error(
        "Photo editing failed:",
        error
      );

      alert(
        "Could not apply the photo edits."
      );
    }
  };

  // =====================================================
  // AUTOMATIC FACE DETECTION
  // Runs whenever a photograph is opened in the editor.
  // =====================================================

  useEffect(() => {
    if (!selectedImage) return;

    let active = true;

    const detectFaces = async () => {
      try {
        setIsDetectingFaces(true);

        const faceDetection =
          await import(
            "@tensorflow-models/face-detection"
          );

        await import(
          "@tensorflow/tfjs-backend-webgl"
        );

        const detector =
          await faceDetection.createDetector(
            faceDetection.SupportedModels.MediaPipeFaceDetector,
            {
              runtime: "tfjs",
              maxFaces: 10,
              modelType: "short",
            }
          );

        const image = new Image();
        image.src = selectedImage.data;

        await new Promise<void>(
          (resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () =>
              reject(
                new Error(
                  "Could not load image"
                )
              );
          }
        );

        const faces =
          await detector.estimateFaces(image);

        if (!active) {
          detector.dispose();
          return;
        }

        setFaceBoxes(
          faces.map((face) => ({
            x: face.box.xMin,
            y: face.box.yMin,
            width: face.box.width,
            height: face.box.height,
          }))
        );

        detector.dispose();
      } catch (error) {
        console.error(
          "Automatic face detection failed:",
          error
        );

        if (active) {
          setFaceBoxes([]);
        }
      } finally {
        if (active) {
          setIsDetectingFaces(false);
        }
      }
    };

    detectFaces();

    return () => {
      active = false;
    };
  }, [selectedImage?.id]);

  // =====================================================
  // PHOTO FRAME
  //
  // Main image uses contain = full image visible.
  //
  // The blurred background prevents ugly empty bars.
  // =====================================================

  const PhotoFrame = ({
    image,
    className = "",
  }: {
    image: StoredImage;
    className?: string;
  }) => {
    return (
      <button
        type="button"
        className={`album-photo-frame album-photo-button ${className}`}
        onClick={() => openPhotoEditor(image)}
        aria-label={`Edit ${image.name || "photograph"}`}
      >
        <img
          src={
            image.data
          }
          alt=""
          aria-hidden="true"
          className="album-photo-background"
        />

        <img
          src={
            image.data
          }
          alt={
            image.name ||
            "Album photograph"
          }
          className="album-photo-main"
        />

        <span className="album-photo-edit-hint">
          Edit photo
        </span>
      </button>
    );
  };

  // =====================================================
  // DYNAMIC ALBUM PAGE
  //
  // Frame positions come from the layout engine above.
  // Their shape follows the real photograph aspect ratios.
  // =====================================================

  const renderAlbumPage = (
    page: AlbumPage
  ) => {
    return (
      <div
        className={`dynamic-template-page dynamic-design-${albumDesign}`}
      >
        {page.frames.map((frame) => {
          const image =
            page.images.find(
              (item) =>
                item.id === frame.imageId
            );

          if (!image) {
            return null;
          }

          return (
            <div
              key={image.id}
              className={`dynamic-photo-slot dynamic-${
                image.orientation || "square"
              }`}
              style={{
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.width}%`,
                height: `${frame.height}%`,
              }}
            >
              <PhotoFrame image={image} />
            </div>
          );
        })}
      </div>
    );
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <>
      <style jsx global>{`
        .album-photo-button {
          appearance: none;
          padding: 0;
          cursor: pointer;
          position: relative;
        }

        .album-photo-edit-hint {
          position: absolute;
          right: 12px;
          bottom: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,0.62);
          color: white;
          font-size: 12px;
          opacity: 0;
          transition: opacity 180ms ease;
          pointer-events: none;
        }

        .album-photo-button:hover .album-photo-edit-hint {
          opacity: 1;
        }

        .photo-editor-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(5,7,10,0.82);
          backdrop-filter: blur(10px);
        }

        .photo-editor-modal {
          width: min(1100px, 96vw);
          max-height: 92vh;
          overflow: auto;
          background: #17191d;
          color: white;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px;
          box-shadow: 0 30px 100px rgba(0,0,0,0.65);
        }

        .photo-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 26px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .photo-editor-header span {
          font-size: 11px;
          letter-spacing: 3px;
          color: #a9a9a9;
        }

        .photo-editor-header h2 {
          margin: 7px 0 0;
          font-size: 22px;
        }

        .editor-close-button {
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 50%;
          background: #2b2e34;
          color: white;
          font-size: 27px;
          cursor: pointer;
        }

        .photo-editor-body {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.75fr);
          gap: 24px;
          padding: 24px;
        }

        .editor-preview-panel {
          min-width: 0;
        }

        .editor-crop-area {
          position: relative;
          width: 100%;
          height: min(62vh, 580px);
          overflow: hidden;
          border-radius: 12px;
          background: #08090b;
        }

        /* Apply live edits directly to the image rendered by react-easy-crop. */
        .editor-crop-area .reactEasyCrop_Image,
        .editor-crop-area .reactEasyCrop_Video {
          filter: var(--editor-photo-filter, none) !important;
          transition: filter 120ms linear;
        }

        .face-status,
        .editor-ai-result {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          color: #d8d8d8;
          font-size: 14px;
        }

        .editor-ai-result {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .editor-controls-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 6px 0;
        }

        .editor-control-group {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .editor-control-group label {
          font-size: 14px;
          color: #e4e4e4;
        }

        .editor-control-group input[type="range"] {
          width: 100%;
        }

        .filter-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .filter-buttons button,
        .editor-actions button {
          border: 1px solid #444;
          border-radius: 8px;
          padding: 9px 12px;
          background: #24272d;
          color: white;
          cursor: pointer;
        }

        .filter-buttons .active-filter {
          border-color: #ffffff;
          background: #3b414b;
        }

        .editor-actions {
          margin-top: auto;
          display: flex;
          gap: 10px;
          padding-top: 10px;
        }

        .editor-actions .apply-edits-button {
          flex: 1;
          background: white;
          color: #111;
          border-color: white;
          font-weight: 700;
        }


        /* ===============================================
           ALBUM DESIGN SWITCHER
        =============================================== */

        .album-design-controls {
          width: min(980px, 96vw);
          margin-top: 28px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          background: rgba(255,255,255,0.035);
          text-align: center;
        }

        .album-design-controls h3 {
          margin: 0 0 7px;
          font-size: 14px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #d9d1c8;
        }

        .album-design-controls p {
          margin: 0 0 14px;
          color: #9da3aa;
          font-size: 13px;
        }

        .album-design-buttons {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .album-design-buttons button {
          min-width: 130px;
          padding: 11px 15px;
          border: 1px solid #4b515b;
          border-radius: 9px;
          background: #16191e;
          color: #f1f1f1;
          cursor: pointer;
          transition: 180ms ease;
        }

        .album-design-buttons button:hover {
          transform: translateY(-1px);
          background: #242830;
        }

        .album-design-buttons button.active-design {
          border-color: #d8b28a;
          background: #342a21;
          color: #fff6ed;
        }

        /* Collage is intentionally layered. This is a different
           composition style, not a renamed version of Classic. */
        .dynamic-design-collage .dynamic-photo-slot:nth-child(1) {
          z-index: 4;
          transform: rotate(-2deg);
        }

        .dynamic-design-collage .dynamic-photo-slot:nth-child(2) {
          z-index: 3;
          transform: rotate(2deg);
        }

        .dynamic-design-collage .dynamic-photo-slot:nth-child(3) {
          z-index: 5;
          transform: rotate(1.2deg);
        }

        .dynamic-design-collage .dynamic-photo-slot:nth-child(4) {
          z-index: 2;
          transform: rotate(-1.5deg);
        }

        .dynamic-design-editorial .dynamic-photo-slot {
          z-index: 1;
        }

        .dynamic-design-editorial .dynamic-photo-slot:nth-child(1) {
          z-index: 4;
        }

        .dynamic-design-editorial .dynamic-photo-slot:nth-child(2) {
          z-index: 3;
        }

        .dynamic-design-editorial .dynamic-photo-slot:nth-child(3) {
          z-index: 2;
        }

        .dynamic-design-editorial .dynamic-photo-slot:nth-child(4) {
          z-index: 1;
        }

        .dynamic-design-story .dynamic-photo-slot {
          z-index: 1;
        }

        .dynamic-design-story .dynamic-photo-slot:nth-child(1) {
          z-index: 4;
          transform: rotate(-1deg);
        }

        .dynamic-design-story .dynamic-photo-slot:nth-child(2) {
          z-index: 3;
          transform: rotate(1.5deg);
        }

        .dynamic-design-story .dynamic-photo-slot:nth-child(3) {
          z-index: 2;
          transform: rotate(-1.2deg);
        }

        .dynamic-design-story .dynamic-photo-slot:nth-child(4) {
          z-index: 3;
          transform: rotate(0.8deg);
        }

        .dynamic-design-editorial .album-photo-main,
        .dynamic-design-story .album-photo-main {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
        }

        @media (max-width: 760px) {
          .photo-editor-body {
            grid-template-columns: 1fr;
          }

          .editor-crop-area {
            height: 48vh;
          }
        }
      `}</style>

    <main className="album-app">
      <section className="album-workspace">

        {!albumCreated && (
          <>
            <h1 className="prototype-title">
              FEAG AI Album Prototype
            </h1>

            <div className="upload-area">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={
                  handleFileChange
                }
              />

              <p>
                Maximum 10 photos
              </p>
            </div>

            <h2 className="uploaded-title">
              Uploaded Images (
              {images.length}/10)
            </h2>

            {isAnalyzing && (
              <p className="analysis-status">
                🤖 AI is analyzing and arranging your photos...
              </p>
            )}

            <div className="upload-grid">
              {images.map(
                (
                  image,
                  index
                ) => (
                  <article
                    key={
                      image.id
                    }
                    className="uploaded-photo-card"
                  >
                    <img
                      src={
                        image.data
                      }
                      alt={`Image ${index + 1}`}
                    />

                    <h3>
                      Image{" "}
                      {index + 1}
                    </h3>

                    {image.analysis && (
                      <div className="analysis-copy">
                        <strong>
                          AI detected:{" "}
                          {formatLabel(
                            image.analysis
                              .finalLabel
                          )}
                        </strong>

                        <span>
                          Confidence:{" "}
                          {(
                            image
                              .analysis
                              .finalConfidence *
                            100
                          ).toFixed(1)}
                          %
                        </span>

                        {image.analysis
                          .detectionType ===
                          "famous_landmark" && (
                          <span className="famous-label">
                            🏛️ Famous Landmark
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() =>
                        deleteImage(
                          image.id
                        )
                      }
                    >
                      Delete
                    </button>
                  </article>
                )
              )}
            </div>

            <button
              type="button"
              className="create-album-button"
              onClick={
                createAlbum
              }
              disabled={
                isAnalyzing ||
                images.length ===
                  0
              }
            >
              {isAnalyzing
                ? "ANALYZING..."
                : "CREATE ALBUM"}
            </button>
          </>
        )}


        {/* =================================================
            DIGITAL BOOK
        ================================================= */}

        {albumCreated && (
          <section className="digital-album-section">

            <header className="album-book-header">
              <span>
                FEAG DIGITAL ALBUM
              </span>

              <h1>
                Your Album
              </h1>

              <p>
                Click the cover to open the book.
                You can also drag page corners.
              </p>
            </header>


            {/* =============================================
                REAL FLIPBOOK
            ============================================== */}

            <div className="book-stage">

              <FlipBook
                key={
                  bookKey
                }
                ref={
                  bookRef
                }
                className="feag-flipbook"
                width={
                  500
                }
                height={
                  650
                }
                size="stretch"
                cover
              >

                {/* =========================================
                    FRONT COVER
                ========================================== */}

                <Page
                  density="hard"
                  className="flip-page book-cover-page"
                >
                  <button
                    type="button"
                    className="front-cover"
                    onClick={
                      openAlbum
                    }
                  >

                    {images[0] && (
                      <img
                        src={
                          images[0]
                            .data
                        }
                        alt=""
                        className="cover-background-image"
                      />
                    )}

                    <div className="cover-overlay" />

                    <div className="book-cover-spine" />

                    <div className="cover-border">

                      <span className="cover-small-text">
                        YOUR MEMORIES
                      </span>

                      <h2>
                        FEAG Album
                      </h2>

                      <div className="cover-divider" />

                      <p>
                        A collection of your favourite moments
                      </p>

                      <small>
                        {images.length} photographs
                      </small>

                    </div>

                    <span className="cover-open-hint">
                      CLICK TO OPEN
                    </span>

                  </button>
                </Page>


                {/* =========================================
                    INSIDE COVER / TITLE PAGE
                ========================================== */}

                <Page className="flip-page paper-page">
                  <div className="title-page">

                    <span>
                      FEAG
                    </span>

                    <h2>
                      Memories
                    </h2>

                    <div className="title-divider" />

                    <p>
                      A story told through{" "}
                      {images.length} photographs.
                    </p>

                  </div>
                </Page>


                {/* =========================================
                    GENERATED ALBUM PAGES
                ========================================== */}

                {albumPages.map(
                  (
                    page,
                    index
                  ) => (
                    <Page
                      key={
                        page.id
                      }
                      className="flip-page paper-page"
                    >
                      <div className="physical-page">

                        {renderAlbumPage(
                          page
                        )}

                        <span className="physical-page-number">
                          {index + 1}
                        </span>

                      </div>
                    </Page>
                  )
                )}


                {/* =========================================
                    END PAGE
                ========================================== */}

                <Page className="flip-page paper-page">
                  <div className="ending-page">

                    <span>
                      THE END
                    </span>

                    <h2>
                      Memories preserved.
                    </h2>

                    <p>
                      Created with the FEAG AI Album Prototype.
                    </p>

                  </div>
                </Page>


                {/* =========================================
                    BACK COVER
                ========================================== */}

                <Page
                  density="hard"
                  className="flip-page back-cover-page"
                >
                  <div className="back-cover">

                    <div className="back-cover-logo">
                      FEAG
                    </div>

                  </div>
                </Page>

              </FlipBook>

            </div>


            {/* =============================================
                CONTROLS
            ============================================== */}

            <div className="book-controls">

              <button
                type="button"
                onClick={
                  previousPage
                }
              >
                ← Previous
              </button>

              <span>
                {bookOpened
                  ? "Drag the corner or use the arrows"
                  : "Click the cover to open"}
              </span>

              <button
                type="button"
                onClick={
                  nextPage
                }
              >
                Next →
              </button>

            </div>


            <div className="secondary-controls">

              <button
                type="button"
                onClick={
                  closeAlbum
                }
              >
                📕 Close Album
              </button>

              <button
                type="button"
                onClick={() => {
                  setAlbumCreated(
                    false
                  );

                  setBookOpened(
                    false
                  );

                  setBookKey(
                    (
                      previous
                    ) =>
                      previous +
                      1
                  );
                }}
              >
                ← Back to Photos
              </button>

            </div>


            {/* =============================================
                DYNAMIC ALBUM DESIGN OPTIONS
            ============================================== */}

            <div className="album-design-controls">
              <h3>Choose Album Design</h3>

              <p>
                Each option uses a different framing composition while
                still calculating every frame from the real photo shape.
              </p>

              <div className="album-design-buttons">
                {[
                  {
                    id: "classic",
                    label: "Classic Dynamic",
                  },
                  {
                    id: "editorial",
                    label: "Editorial",
                  },
                  {
                    id: "collage",
                    label: "Creative Collage",
                  },
                  {
                    id: "story",
                    label: "Story Sequence",
                  },
                ].map((design) => (
                  <button
                    key={design.id}
                    type="button"
                    className={
                      albumDesign === design.id
                        ? "active-design"
                        : ""
                    }
                    onClick={() =>
                      changeAlbumDesign(
                        design.id as AlbumDesign
                      )
                    }
                  >
                    {design.label}
                  </button>
                ))}
              </div>
            </div>

          </section>
        )}

        {selectedImage && (
          <div
            className="photo-editor-backdrop"
            onMouseDown={closePhotoEditor}
          >
            <section
              className="photo-editor-modal"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <header className="photo-editor-header">
                <div>
                  <span>PHOTO EDITOR</span>
                  <h2>
                    {selectedImage.name ||
                      "Edit photograph"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="editor-close-button"
                  onClick={closePhotoEditor}
                >
                  ×
                </button>
              </header>

              <div className="photo-editor-body">
                <div className="editor-preview-panel">
                  <div
                    className="editor-crop-area"
                    style={{
                      ["--editor-photo-filter" as string]:
                        getPreviewFilter(),
                    }}
                  >
                    <Cropper
                      key={selectedImage.id}
                      image={selectedImage.data}
                      crop={editorCrop}
                      zoom={editorZoom}
                      aspect={undefined}
                      onCropChange={setEditorCrop}
                      onZoomChange={setEditorZoom}
                      onCropComplete={onCropComplete}
                      style={{
                        mediaStyle: {
                          filter: getPreviewFilter(),
                          transition: "filter 120ms ease",
                        },
                      }}
                    />
                  </div>

                  <div className="face-status">
                    {isDetectingFaces
                      ? "👤 Detecting faces..."
                      : faceBoxes.length > 0
                        ? `👤 ${faceBoxes.length} face${faceBoxes.length === 1 ? "" : "s"} detected`
                        : "👤 No faces detected"}
                  </div>

                  {selectedImage.analysis && (
                    <div className="editor-ai-result">
                      <strong>
                        AI detected:{" "}
                        {formatLabel(
                          selectedImage.analysis
                            .finalLabel
                        )}
                      </strong>
                      <span>
                        {selectedImage.analysis
                          .detectionType ===
                        "famous_landmark"
                          ? "🏛️ Famous landmark"
                          : "📍 Scene / object detection"}
                      </span>
                    </div>
                  )}
                </div>

                <aside className="editor-controls-panel">
                  <div className="editor-control-group">
                    <label>
                      Crop / Zoom
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.01"
                      value={editorZoom}
                      onChange={(event) =>
                        setEditorZoom(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    />
                  </div>

                  <div className="editor-control-group">
                    <label>
                      Brightness {brightness}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="160"
                      value={brightness}
                      onChange={(event) =>
                        setBrightness(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    />
                  </div>

                  <div className="editor-control-group">
                    <label>
                      Contrast {contrast}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="170"
                      value={contrast}
                      onChange={(event) =>
                        setContrast(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    />
                  </div>

                  <div className="editor-control-group">
                    <label>
                      Saturation {saturation}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      value={saturation}
                      onChange={(event) =>
                        setSaturation(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    />
                  </div>

                  <div className="editor-control-group">
                    <label>
                      Filters
                    </label>

                    <div className="filter-buttons">
                      {[
                        "none",
                        "grayscale",
                        "sepia",
                        "warm",
                        "cool",
                      ].map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={
                            selectedFilter === filter
                              ? "active-filter"
                              : ""
                          }
                          onClick={() =>
                            setSelectedFilter(filter)
                          }
                        >
                          {formatLabel(filter)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="editor-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditorCrop({
                          x: 0,
                          y: 0,
                        });
                        setEditorZoom(1);
                        setBrightness(100);
                        setContrast(100);
                        setSaturation(100);
                        setSelectedFilter("none");
                      }}
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      className="apply-edits-button"
                      onClick={applyPhotoEdits}
                    >
                      Apply to Album
                    </button>
                  </div>
                </aside>
              </div>
            </section>
          </div>
        )}

      </section>
      </main>
    </>
  );
}