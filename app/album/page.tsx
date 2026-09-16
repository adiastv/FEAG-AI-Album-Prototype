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

  // Face bounding boxes detected from the original photograph.
  // Coordinates are stored in the original image's pixel space.
  faces?: FaceBox[];

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

type AlbumTheme =
  | "classic"
  | "travel"
  | "birthday"
  | "wedding"
  | "family"
  | "party"
  | "graduation";

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
  // Optional layout override for this specific page.
  layoutDesign?: AlbumDesign;
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

  const [activeAlbumTool, setActiveAlbumTool] =
    useState<"frames" | "backgrounds" | "stickers" | "text" | "borders" | "settings">("frames");

  const [currentBookPage, setCurrentBookPage] =
    useState(0);

  const [albumPages, setAlbumPages] =
    useState<AlbumPage[]>([]);

  // The user can switch between genuinely different layout engines
  // without changing the uploaded photographs or album order.
  const [albumDesign, setAlbumDesign] =
    useState<AlbumDesign>("classic");

  // Natural-language request supplied by the user.
  const [albumPrompt, setAlbumPrompt] =
    useState("");

  // Theme selected from the prompt.
  const [albumTheme, setAlbumTheme] =
    useState<AlbumTheme>("classic");

  const [albumName, setAlbumName] =
    useState("Your Album");

  // Reordering is intentionally an inside-the-album interaction.
  const [draggedAlbumImageId, setDraggedAlbumImageId] =
    useState<string | null>(null);

  const [draggedAlbumTargetId, setDraggedAlbumTargetId] =
    useState<string | null>(null);

  // Inside-the-album page editor.
  const [pageEditorId, setPageEditorId] =
    useState<string | null>(null);

  const [pageSwapSourceId, setPageSwapSourceId] =
    useState<string | null>(null);

  const [pendingAlbumSwap, setPendingAlbumSwap] =
    useState<{
      fromId: string;
      toId: string;
    } | null>(null);

  // Used to re-create the book at the cover.
  const [bookKey, setBookKey] =
    useState(0);

  const [bookOpened, setBookOpened] =
    useState(false);

  const bookRef =
    useRef<Book>(null);

  const pageAddFileInputRef =
    useRef<HTMLInputElement>(null);

  // =====================================================
  // RESPONSIVE BOOK SIZE
  //
  // The album is designed on a 500 x 650 canvas, but the
  // actual flipbook is resized to fit the device viewport.
  // This keeps the page proportions intact on phones.
  // =====================================================

  const [bookSize, setBookSize] = useState({
    width: 500,
    height: 650,
  });

  useEffect(() => {
    const updateBookSize = () => {
      const viewportWidth = window.innerWidth;
      const horizontalPadding =
        viewportWidth <= 480 ? 20 : 32;

      const maxWidth = Math.min(
        500,
        Math.max(
          280,
          viewportWidth - horizontalPadding
        )
      );

      const width = Math.round(maxWidth);
      const height = Math.round(
        width * (650 / 500)
      );

      setBookSize({
        width,
        height,
      });
    };

    updateBookSize();

    window.addEventListener(
      "resize",
      updateBookSize
    );

    window.addEventListener(
      "orientationchange",
      updateBookSize
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateBookSize
      );

      window.removeEventListener(
        "orientationchange",
        updateBookSize
      );
    };
  }, []);


  // =====================================================
  // INSIDE-ALBUM PAGE EDITOR
  // =====================================================

  const openPageEditor = (pageId: string) => {
    setPageEditorId(pageId);
    setPageSwapSourceId(null);
    setPendingAlbumSwap(null);
  };

  const closePageEditor = () => {
    setPageEditorId(null);
    setPageSwapSourceId(null);
    setPendingAlbumSwap(null);
  };

  const getPageDesign = (page: AlbumPage): AlbumDesign =>
    page.layoutDesign || albumDesign;

  // Swap actual photo objects while keeping the frame positions fixed.
  // This is the important part: we never mutate photo IDs, so React and
  // OpenPageFlip keep stable keys and the swap works reliably.
  const swapAlbumImages = (
    fromId: string,
    toId: string
  ) => {
    if (!fromId || !toId || fromId === toId) return;

    const fromImage = images.find((image) => image.id === fromId);
    const toImage = images.find((image) => image.id === toId);

    if (!fromImage || !toImage) return;

    setImages((currentImages) => {
      const fromIndex = currentImages.findIndex((image) => image.id === fromId);
      const toIndex = currentImages.findIndex((image) => image.id === toId);

      if (fromIndex < 0 || toIndex < 0) return currentImages;

      const nextImages = [...currentImages];
      [nextImages[fromIndex], nextImages[toIndex]] =
        [nextImages[toIndex], nextImages[fromIndex]];
      return nextImages;
    });

    setAlbumPages((currentPages) =>
      currentPages.map((page) => {
        const containsFrom = page.images.some((image) => image.id === fromId);
        const containsTo = page.images.some((image) => image.id === toId);

        if (!containsFrom && !containsTo) return page;

        const nextPageImages = page.images.map((image) => {
          if (image.id === fromId) return toImage;
          if (image.id === toId) return fromImage;
          return image;
        });

        const nextFrames = page.frames.map((frame) => ({
          ...frame,
          imageId:
            frame.imageId === fromId
              ? toId
              : frame.imageId === toId
                ? fromId
                : frame.imageId,
        }));

        return {
          ...page,
          images: nextPageImages,
          frames: nextFrames,
        };
      })
    );

    setPageSwapSourceId(null);
    setPendingAlbumSwap(null);
    setDraggedAlbumImageId(null);
    setDraggedAlbumTargetId(null);
  };

  const requestAlbumSwap = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setPendingAlbumSwap({ fromId, toId });
  };

  const confirmAlbumSwap = () => {
    if (!pendingAlbumSwap) return;
    swapAlbumImages(
      pendingAlbumSwap.fromId,
      pendingAlbumSwap.toId
    );
  };

  // Move an existing uploaded photograph to this page. This makes
  // "Add picture" useful without creating duplicate photos.
  const addExistingImageToPage = (
    imageId: string,
    targetPageId: string
  ) => {
    const imageToMove = images.find((image) => image.id === imageId);
    if (!imageToMove) return;

    setAlbumPages((currentPages) => {
      const targetPage = currentPages.find((page) => page.id === targetPageId);
      if (!targetPage || targetPage.images.some((image) => image.id === imageId)) {
        return currentPages;
      }

      if (targetPage.images.length >= 4) {
        return currentPages;
      }

      const sourcePage = currentPages.find((page) =>
        page.images.some((image) => image.id === imageId)
      );

      return currentPages
        .map((page) => {
          if (page.id === sourcePage?.id) {
            const remaining = page.images.filter((image) => image.id !== imageId);
            return {
              ...page,
              images: remaining,
              frames: calculateDynamicFrames(
                remaining,
                getPageDesign(page),
                "classic"
              ),
            };
          }

          if (page.id === targetPageId) {
            const nextImages = [...page.images, imageToMove];
            return {
              ...page,
              images: nextImages,
              frames: calculateDynamicFrames(
                nextImages,
                getPageDesign(page),
                "classic"
              ),
            };
          }

          return page;
        })
        .filter((page) => page.images.length > 0);
    });

    setBookKey((previous) => previous + 1);
    setBookOpened(true);
  };

  const handleAddPhotosToPage = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    const targetPageId = pageEditorId;

    if (!files || !targetPageId) {
      event.target.value = "";
      return;
    }

    const targetPage = albumPages.find((page) => page.id === targetPageId);
    const availablePageSlots = targetPage
      ? Math.max(0, 4 - targetPage.images.length)
      : 0;
    const availableAlbumSlots = Math.max(0, 10 - images.length);
    const maxFiles = Math.min(availablePageSlots, availableAlbumSlots);

    if (maxFiles <= 0) {
      alert(
        targetPage && targetPage.images.length >= 4
          ? "This page already has the maximum of 4 photographs."
          : "You can upload a maximum of 10 photographs."
      );
      event.target.value = "";
      return;
    }

    const filesToAdd = Array.from(files).slice(0, maxFiles);

    try {
      const newImages = await Promise.all(
        filesToAdd.map(async (file, index) => {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () =>
              reject(new Error(`Could not read ${file.name}`));
            reader.readAsDataURL(file);
          });

          const metadata = await readImageMetadata(data);

          return {
            id: `page-add-${Date.now()}-${index}-${Math.random()}`,
            name: file.name,
            data,
            ...metadata,
          } satisfies StoredImage;
        })
      );

      setImages((currentImages) => [...currentImages, ...newImages]);

      setAlbumPages((currentPages) =>
        currentPages.map((page) => {
          if (page.id !== targetPageId) return page;

          const nextImages = [...page.images, ...newImages].slice(0, 4);
          return {
            ...page,
            images: nextImages,
            frames: calculateDynamicFrames(
              nextImages,
              getPageDesign(page),
              "classic"
            ),
          };
        })
      );

      setBookKey((previous) => previous + 1);
      setBookOpened(true);
    } catch (error) {
      console.error("Could not add photos to album page:", error);
      alert("One or more photographs could not be added.");
    } finally {
      event.target.value = "";
    }
  };

  const changePageLayout = (
    pageId: string,
    design: AlbumDesign
  ) => {
    setAlbumPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              layoutDesign: design,
              frames: calculateDynamicFrames(
                page.images,
                design,
                "classic"
              ),
            }
          : page
      )
    );

    setBookKey((previous) => previous + 1);
  };

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

  const [faceDetectionError, setFaceDetectionError] =
    useState<string | null>(null);

  // =====================================================
  // RESET ALBUM
  // =====================================================

  const resetAlbum = () => {
    setAlbumCreated(false);
    setActiveAlbumTool("frames");
    setCurrentBookPage(0);

    setAlbumPages([]);

    setPageEditorId(null);
    setPageSwapSourceId(null);
    setPendingAlbumSwap(null);

    setBookOpened(false);

    setBookKey(
      (previous) =>
        previous + 1
    );
  };

  // =====================================================
  // FILE UPLOAD
  // =====================================================

  const handleFileChange = async (
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

    if (remainingSlots <= 0) {
      alert(
        "You can upload a maximum of 10 images."
      );
      event.target.value = "";
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

    resetAlbum();

    try {
      const newImages =
        await Promise.all(
          filesToUpload.map(
            async (file, index) => {
              const data =
                await new Promise<string>(
                  (resolve, reject) => {
                    const reader =
                      new FileReader();

                    reader.onload = () =>
                      resolve(
                        reader.result as string
                      );

                    reader.onerror = () =>
                      reject(
                        new Error(
                          `Could not read ${file.name}`
                        )
                      );

                    reader.readAsDataURL(file);
                  }
                );

              const metadata =
                await readImageMetadata(data);

              return {
                id:
                  `${Date.now()}-${index}-${Math.random()}`,
                name:
                  file.name,
                data,
                ...metadata,
              } satisfies StoredImage;
            }
          )
        );

      setImages(
        (previousImages) =>
          autoArrangeImages([
            ...previousImages,
            ...newImages,
          ])
      );
    } catch (error) {
      console.error(
        "Image upload failed:",
        error
      );

      alert(
        "One or more images could not be loaded."
      );
    } finally {
      event.target.value = "";
    }
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
  // PROMPT → ALBUM THEME
  //
  // For this prototype, theme selection is deterministic and local.
  // The interface is intentionally isolated so it can later be
  // replaced by an AI prompt classifier without changing the layout
  // engine itself.
  // =====================================================

  const detectAlbumTheme = (
    prompt: string
  ): AlbumTheme => {
    const normalized = prompt
      .toLowerCase()
      .trim();

    const matches = (words: string[]) =>
      words.some((word) =>
        normalized.includes(word)
      );

    if (
      matches([
        "wedding",
        "marriage",
        "bride",
        "groom",
        "engagement",
        "nikah",
        "reception",
      ])
    ) {
      return "wedding";
    }

    if (
      matches([
        "birthday",
        "cake",
        "birthday party",
        "anniversary",
      ])
    ) {
      return "birthday";
    }

    if (
      matches([
        "graduation",
        "graduate",
        "convocation",
        "college farewell",
        "farewell",
      ])
    ) {
      return "graduation";
    }

    if (
      matches([
        "travel",
        "travelling",
        "traveling",
        "trip",
        "vacation",
        "holiday",
        "journey",
        "tour",
        "road trip",
        "backpacking",
      ])
    ) {
      return "travel";
    }

    if (
      matches([
        "family",
        "parents",
        "siblings",
        "family gathering",
        "family trip",
      ])
    ) {
      return "family";
    }

    if (
      matches([
        "party",
        "celebration",
        "celebrate",
        "friends",
        "fest",
        "festival",
        "night out",
      ])
    ) {
      return "party";
    }

    return "classic";
  };
  // =====================================================
  // ALBUM NAME FROM NATURAL-LANGUAGE PROMPT
  // =====================================================

  const extractAlbumName = (
    prompt: string
  ): string | null => {
    const normalizedPrompt =
      prompt
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedPrompt) {
      return null;
    }

    // Match the naming phrase explicitly. The important part here is
    // that "as" is consumed by the prefix, never by the album name.
    const patterns = [
      // Explicit "named as" / "called as" forms.
      /\b(?:named|called|titled)\s+as\s+["“']?(.+?)["”']?(?=\s+(?:with|for|from|using|in|about|and|theme|style)\b|[.!?,]|$)/i,
      /\bname\s+it\s+as\s+["“']?(.+?)["”']?(?=\s+(?:with|for|from|using|in|about|and|theme|style)\b|[.!?,]|$)/i,
      /\bcall\s+it\s+as\s+["“']?(.+?)["”']?(?=\s+(?:with|for|from|using|in|about|and|theme|style)\b|[.!?,]|$)/i,

      // Forms without "as".
      /\b(?:named|called|titled)\s+["“']?(.+?)["”']?(?=\s+(?:with|for|from|using|in|about|and|theme|style)\b|[.!?,]|$)/i,
      /\bname\s+it\s+["“']?(.+?)["”']?(?=\s+(?:with|for|from|using|in|about|and|theme|style)\b|[.!?,]|$)/i,
      /\bcall\s+it\s+["“']?(.+?)["”']?(?=\s+(?:with|for|from|using|in|about|and|theme|style)\b|[.!?,]|$)/i,
    ];

    let rawName: string | null = null;

    for (const pattern of patterns) {
      const match =
        normalizedPrompt.match(pattern);

      if (match?.[1]) {
        rawName = match[1];
        break;
      }
    }

    if (!rawName) {
      return null;
    }

    let name =
      rawName
        .trim()
        .replace(
          /^['"“”]+|['"“”]+$/g,
          ""
        )
        .replace(
          /^(?:as)\s+/i,
          ""
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    // Defensive cleanup for prompts that contain the phrase twice,
    // e.g. "named as as Agra Trip".
    name =
      name.replace(
        /^(?:as\s+)+/i,
        ""
      ).trim();

    if (!name) {
      return null;
    }

    return name
      .split(" ")
      .map((word) =>
        word
          ? word.charAt(0).toUpperCase() +
            word.slice(1)
          : word
      )
      .join(" ")
      .slice(0, 80);
  };

  const getThemeDefaultDesign = (
    theme: AlbumTheme
  ): AlbumDesign => {
    switch (theme) {
      case "travel":
        return "story";
      case "birthday":
        return "collage";
      case "wedding":
        return "editorial";
      case "family":
        return "classic";
      case "party":
        return "collage";
      case "graduation":
        return "editorial";
      default:
        return "classic";
    }
  };

  const getThemeLabel = (
    theme: AlbumTheme
  ) => {
    switch (theme) {
      case "travel":
        return "Travel Story";
      case "birthday":
        return "Birthday Celebration";
      case "wedding":
        return "Wedding Album";
      case "family":
        return "Family Memories";
      case "party":
        return "Party Memories";
      case "graduation":
        return "Graduation Story";
      default:
        return "Classic Memories";
    }
  };

  const getThemeIcon = (
    theme: AlbumTheme
  ) => {
    switch (theme) {
      case "travel":
        return "✈️";
      case "birthday":
        return "🎂";
      case "wedding":
        return "💍";
      case "family":
        return "👨‍👩‍👧";
      case "party":
        return "🎉";
      case "graduation":
        return "🎓";
      default:
        return "📖";
    }
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
  // =====================================================
  // AUTOMATIC UPLOAD ARRANGEMENT
  // =====================================================
  //
  // The user does not manually arrange photos before creating
  // the album. We use the real photo dimensions/orientation to
  // produce a balanced sequence for the dynamic layout engine.

  const autoArrangeImages = (
    albumImages: StoredImage[]
  ): StoredImage[] => {
    if (albumImages.length <= 1) {
      return [...albumImages];
    }

    const score = (image: StoredImage) => {
      const area =
        Math.max(
          1,
          (image.width || 1) *
            (image.height || 1)
        );

      const orientationWeight =
        image.orientation === "landscape"
          ? 1.35
          : image.orientation === "square"
            ? 1.08
            : 0.95;

      return (
        Math.log10(area) *
        orientationWeight
      );
    };

    const pools: Record<
      ImageOrientation,
      StoredImage[]
    > = {
      landscape: [],
      square: [],
      portrait: [],
    };

    albumImages.forEach((image) => {
      pools[
        image.orientation || "square"
      ].push(image);
    });

    (
      Object.keys(pools) as ImageOrientation[]
    ).forEach((orientation) => {
      pools[orientation].sort(
        (a, b) =>
          score(b) -
          score(a)
      );
    });

    const strongest =
      [...albumImages].sort(
        (a, b) =>
          score(b) -
          score(a)
      )[0];

    if (!strongest) {
      return [...albumImages];
    }

    const strongestOrientation =
      strongest.orientation ||
      "square";

    pools[strongestOrientation] =
      pools[strongestOrientation].filter(
        (image) =>
          image.id !== strongest.id
      );

    const arranged =
      [strongest];

    let previousOrientation =
      strongestOrientation;

    while (
      pools.landscape.length ||
      pools.square.length ||
      pools.portrait.length
    ) {
      const available =
        (
          [
            "landscape",
            "square",
            "portrait",
          ] as ImageOrientation[]
        ).filter(
          (orientation) =>
            pools[orientation].length > 0
        );

      const nextOrientation =
        available.find(
          (orientation) =>
            orientation !==
            previousOrientation
        ) ||
        available[0];

      if (!nextOrientation) {
        break;
      }

      const nextImage =
        pools[nextOrientation].shift();

      if (!nextImage) {
        break;
      }

      arranged.push(nextImage);
      previousOrientation =
        nextImage.orientation ||
        "square";
    }

    return arranged;
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
    design: AlbumDesign = "classic",
    theme: AlbumTheme = "classic"
  ): DynamicFrame[] => {
    // A prompt-selected theme supplies the initial composition.
    // Manual design switching later passes theme="classic", making
    // the chosen design an explicit override.
    const effectiveDesign =
      theme === "classic"
        ? design
        : getThemeDefaultDesign(theme);

    const innerRect: PixelRect = {
      x: PAGE_PADDING,
      y: PAGE_PADDING,
      width:
        PAGE_WIDTH - PAGE_PADDING * 2,
      height:
        PAGE_HEIGHT - PAGE_PADDING * 2,
    };

    let pixelFrames: PixelFrame[];

    switch (effectiveDesign) {
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
    pageImages: StoredImage[],
    design: AlbumDesign = "classic",
    theme: AlbumTheme = "classic"
  ) => {
    const frames =
      calculateDynamicFrames(
        pageImages,
        design,
        theme
      );

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
    design: AlbumDesign = "classic",
    theme: AlbumTheme = "classic"
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
          getPageLayoutScore(
            candidate,
            design,
            theme
          );

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
            design,
            theme
          ),
        layoutDesign: design,
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

        const requestedTheme =
          detectAlbumTheme(albumPrompt);

        const requestedDesign =
          getThemeDefaultDesign(
            requestedTheme
          );

        const requestedAlbumName =
          extractAlbumName(
            albumPrompt
          );

        // A name explicitly supplied in the prompt always wins over
        // the theme's default display name.
        const finalAlbumName =
          requestedAlbumName ??
          (requestedTheme === "classic"
            ? "Classic Memories"
            : getThemeLabel(requestedTheme));

        setAlbumName(
          finalAlbumName
        );

        setAlbumTheme(
          requestedTheme
        );

        setAlbumDesign(
          requestedDesign
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
                  prompt: albumPrompt,
                  theme: requestedTheme,
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

        // Keep the same automatic arrangement used during upload.
        const arrangedImages =
          autoArrangeImages(
            measuredImages
          );

        setImages(
          arrangedImages
        );

        setAlbumPages(
          generateAlbumPages(
            arrangedImages,
            requestedDesign,
            requestedTheme
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
    setCurrentBookPage(1);

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

    setCurrentBookPage((page) =>
      Math.min(page + 1, albumPages.length + 3)
    );
  };

  const previousPage =
    () => {
      bookRef.current
        ?.flipPrev();

      setCurrentBookPage((page) =>
        Math.max(0, page - 1)
      );
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
          design,
          "classic"
        ),
        layoutDesign: design,
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
    setFaceBoxes(image.faces ?? []);
    setFaceDetectionError(null);
  };

  const closePhotoEditor = () => {
    setSelectedImage(null);
    setFaceBoxes([]);
    setFaceDetectionError(null);
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

                // The crop/edit changes the image coordinate system, so
                // previously detected face boxes are no longer valid.
                // They will be recalculated when the editor opens again.
                faces: undefined,
              }
            : image
        );

      setImages(updatedImages);

      // Recalculate the whole page layout because cropping can change
      // the photograph's aspect ratio and therefore its ideal frame.
      setAlbumPages(
        generateAlbumPages(
          updatedImages,
          albumDesign,
          albumTheme
        )
      );

      setBookKey(
        (previous) => previous + 1
      );

      // Close the editor after saving. The updated image is already
      // written into both the photo list and the generated album pages.
      setSelectedImage(null);
      setFaceBoxes([]);
      setFaceDetectionError(null);
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
  //
  // The detector works on a downscaled copy of the photograph.
  // This is important for modern phone photos because a 4K/12MP
  // image can otherwise consume a lot of browser/WebGL memory.
  //
  // Detection strategy:
  // 1. MediaPipe TFJS FULL model - best first pass for group photos.
  // 2. MediaPipe TFJS SHORT model - faster fallback.
  // 3. BlazeFace - independent fallback if MediaPipe fails.
  //
  // All returned coordinates are mapped back to the original image
  // dimensions so they can later be used by the crop/layout engine.
  // =====================================================

  useEffect(() => {
    if (!selectedImage) return;

    let active = true;

    const loadImage = async (src: string) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(new Error("Could not load image for face detection"));
      });

      // decode() makes sure the browser has actually decoded the pixels
      // before TensorFlow/MediaPipe receives the image.
      if (typeof image.decode === "function") {
        try {
          await image.decode();
        } catch {
          // onload is already enough for browsers that reject decode().
        }
      }

      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error("Image has no readable dimensions");
      }

      return image;
    };

    const createDetectionCanvas = (image: HTMLImageElement) => {
      const MAX_DETECTION_SIZE = 1600;
      const scale = Math.min(
        1,
        MAX_DETECTION_SIZE / Math.max(
          image.naturalWidth,
          image.naturalHeight
        )
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(
        1,
        Math.round(image.naturalWidth * scale)
      );
      canvas.height = Math.max(
        1,
        Math.round(image.naturalHeight * scale)
      );

      const context = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: false,
      });

      if (!context) {
        throw new Error("Could not create face detection canvas");
      }

      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return {
        canvas,
        scale,
      };
    };

    const mapBoxToOriginal = (
      box: {
        x: number;
        y: number;
        width: number;
        height: number;
      },
      scale: number
    ): FaceBox => ({
      x: Math.max(0, box.x / scale),
      y: Math.max(0, box.y / scale),
      width: Math.max(0, box.width / scale),
      height: Math.max(0, box.height / scale),
    });

    const detectWithMediaPipe = async (
      canvas: HTMLCanvasElement,
      scale: number,
      modelType: "full" | "short"
    ): Promise<FaceBox[]> => {
      const faceDetection =
        await import("@tensorflow-models/face-detection");

      const detector =
        await faceDetection.createDetector(
          faceDetection.SupportedModels.MediaPipeFaceDetector,
          {
            runtime: "tfjs",
            maxFaces: 20,
            modelType,
          }
        );

      try {
        const faces = await detector.estimateFaces(canvas);

        return faces.map((face) =>
          mapBoxToOriginal(
            {
              x: face.box.xMin,
              y: face.box.yMin,
              width: face.box.width,
              height: face.box.height,
            },
            scale
          )
        );
      } finally {
        detector.dispose();
      }
    };

    const detectWithBlazeFace = async (
      canvas: HTMLCanvasElement,
      scale: number
    ): Promise<FaceBox[]> => {
      const blazeface =
        await import("@tensorflow-models/blazeface");

      const model = await blazeface.load();

      try {
        const predictions = await model.estimateFaces(
          canvas,
          false
        );

        return predictions.map((prediction) => {
          const [x1, y1] = prediction.topLeft as [number, number];
          const [x2, y2] = prediction.bottomRight as [number, number];

          return mapBoxToOriginal(
            {
              x: x1,
              y: y1,
              width: Math.max(0, x2 - x1),
              height: Math.max(0, y2 - y1),
            },
            scale
          );
        });
      } finally {
        // BlazeFace does not expose the same detector.dispose() API
        // as the MediaPipe TFJS detector, so the model is released by
        // the browser once this async task finishes.
      }
    };

    const detectFaces = async () => {
      try {
        setIsDetectingFaces(true);
        setFaceDetectionError(null);
        setFaceBoxes([]);

        const image = await loadImage(selectedImage.data);
        const { canvas, scale } =
          createDetectionCanvas(image);

        // Initialise TensorFlow.js/WebGL before constructing detectors.
        // The dynamic import keeps this work out of the initial page load.
        const tf = await import("@tensorflow/tfjs");
        await import("@tensorflow/tfjs-backend-webgl");

        try {
          if (tf.getBackend() !== "webgl") {
            await tf.setBackend("webgl");
          }
        } catch (backendError) {
          console.warn(
            "WebGL backend unavailable; using the TensorFlow.js default backend.",
            backendError
          );
        }

        await tf.ready();

        let faces: FaceBox[] = [];
        let lastError: unknown = null;

        // FULL is intentionally first: it is better suited to a
        // photograph containing several people at different distances.
        for (const modelType of ["full", "short"] as const) {
          try {
            faces = await detectWithMediaPipe(
              canvas,
              scale,
              modelType
            );

            if (faces.length > 0) break;
          } catch (error) {
            lastError = error;
            console.warn(
              `MediaPipe ${modelType} face detection failed; trying fallback.`,
              error
            );
          }
        }

        // BlazeFace is a separate detector, so a MediaPipe model-loading
        // or runtime problem does not automatically mean "zero faces".
        if (faces.length === 0) {
          try {
            faces = await detectWithBlazeFace(
              canvas,
              scale
            );
          } catch (error) {
            lastError = error;
            console.warn(
              "BlazeFace fallback failed.",
              error
            );
          }
        }

        if (!active) return;

        if (faces.length === 0 && lastError) {
          setFaceDetectionError(
            "Face detection could not run. Check the browser console for the model error."
          );
          return;
        }

        setFaceBoxes(faces);

        // Persist the detected coordinates on the image itself.
        // The album layout engine works with StoredImage objects, so
        // the next stage can use these boxes without relying on temporary
        // editor state.
        setImages((currentImages) =>
          currentImages.map((image) =>
            image.id === selectedImage.id
              ? {
                  ...image,
                  faces,
                }
              : image
          )
        );

        setSelectedImage((currentImage) =>
          currentImage &&
          currentImage.id === selectedImage.id
            ? {
                ...currentImage,
                faces,
              }
            : currentImage
        );
      } catch (error) {
        console.error(
          "Automatic face detection failed:",
          error
        );

        if (active) {
          setFaceBoxes([]);
          setFaceDetectionError(
            "Face detection could not run for this photograph."
          );
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

  // =====================================================
  // REFERENCE-INSPIRED THEME ARTWORK
  // =====================================================
  //
  // Original SVG artwork based on the visual language of the
  // supplied references: vintage travel stationery, soft
  // watercolor party stationery, and ornate wedding paper.

  const ThemeDecorations = ({
    theme,
  }: {
    theme: AlbumTheme;
  }) => {
    if (theme === "classic") {
      return null;
    }

    return (
      <svg
        className="theme-decorations"
        viewBox="0 0 500 650"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {theme === "travel" && (
          <g className="theme-art travel-art">
            <path
              className="travel-contour"
              d="M-20 95 C75 55 120 130 205 92 S365 35 520 90"
            />
            <path
              className="travel-contour"
              d="M-20 120 C70 82 135 155 220 116 S375 62 520 113"
            />
            <path
              className="travel-contour-light"
              d="M-10 145 C80 110 140 182 230 140 S390 92 515 136"
            />

            <path
              className="travel-route"
              d="M48 92 C100 132 128 58 184 96 S258 158 318 115 S390 76 451 120"
            />

            <circle
              className="travel-pin"
              cx="48"
              cy="92"
              r="7"
            />
            <circle
              className="travel-pin"
              cx="451"
              cy="120"
              r="7"
            />

            <circle
              className="travel-compass"
              cx="422"
              cy="62"
              r="25"
            />
            <path
              className="travel-compass"
              d="M422 39 V85 M399 62 H445"
            />
            <path
              className="travel-needle"
              d="M422 42 L429 62 L422 82 L415 62 Z"
            />

            <path
              className="travel-plane"
              d="M50 64 L87 53 L109 59 L94 67 L117 78 L110 84 L87 73 L66 82 L72 70 Z"
            />

            <g transform="rotate(-9 82 570)">
              <circle
                className="travel-stamp"
                cx="82"
                cy="570"
                r="34"
              />
              <circle
                className="travel-stamp"
                cx="82"
                cy="570"
                r="27"
              />
              <text
                className="travel-stamp-text"
                x="58"
                y="573"
              >
                EXPLORE
              </text>
              <text
                className="travel-stamp-text"
                x="65"
                y="585"
              >
                TRAVEL
              </text>
            </g>

            <g transform="rotate(8 420 566)">
              <circle
                className="travel-stamp"
                cx="420"
                cy="566"
                r="30"
              />
              <text
                className="travel-stamp-text"
                x="401"
                y="569"
              >
                JOURNEY
              </text>
            </g>

            <text
              className="travel-label"
              x="27"
              y="154"
            >
              THE JOURNEY
            </text>

            <text
              className="travel-label"
              x="375"
              y="622"
            >
              MEMORIES
            </text>
          </g>
        )}

        {theme === "birthday" && (
          <g className="theme-art birthday-art">
            <path
              className="birthday-bunting"
              d="M18 46 Q250 95 482 46"
            />

            <path
              className="birthday-flag birthday-pink"
              d="M54 54 L78 59 L66 84 Z"
            />
            <path
              className="birthday-flag birthday-blue"
              d="M103 64 L127 68 L116 92 Z"
            />
            <path
              className="birthday-flag birthday-peach"
              d="M152 73 L176 76 L164 99 Z"
            />
            <path
              className="birthday-flag birthday-pink"
              d="M324 76 L348 72 L336 99 Z"
            />
            <path
              className="birthday-flag birthday-blue"
              d="M373 67 L397 63 L385 91 Z"
            />
            <path
              className="birthday-flag birthday-peach"
              d="M422 56 L446 51 L434 82 Z"
            />

            <ellipse
              className="birthday-balloon birthday-balloon-pink"
              cx="57"
              cy="133"
              rx="24"
              ry="31"
            />
            <ellipse
              className="birthday-balloon birthday-balloon-blue"
              cx="444"
              cy="135"
              rx="24"
              ry="31"
            />
            <ellipse
              className="birthday-balloon birthday-balloon-peach"
              cx="407"
              cy="171"
              rx="20"
              ry="25"
            />

            <path
              className="birthday-string"
              d="M57 164 C39 208 77 232 59 277"
            />
            <path
              className="birthday-string"
              d="M444 166 C462 211 426 235 445 281"
            />
            <path
              className="birthday-string"
              d="M407 196 C391 234 421 254 407 286"
            />

            <path
              className="birthday-confetti"
              d="M30 305 l11 9 M85 351 l-9 10 M454 319 l-11 10
                 M413 355 l9 10 M96 548 l10 -8 M404 548 l-10 -8"
            />

            <path
              className="birthday-cake"
              d="M201 579 Q250 560 299 579 L291 617 Q250 629 209 617 Z"
            />
            <path
              className="birthday-cake-layer"
              d="M207 590 Q250 602 293 590 L290 608 Q250 620 210 608 Z"
            />
            <path
              className="birthday-candle"
              d="M229 554 V579 M250 549 V577 M271 554 V579"
            />
            <path
              className="birthday-flame"
              d="M229 551 Q224 543 229 536 Q234 544 229 551
                 M250 546 Q245 538 250 531 Q255 539 250 546
                 M271 551 Q266 543 271 536 Q276 544 271 551"
            />

            <text
              className="birthday-label"
              x="199"
              y="645"
            >
              CELEBRATE
            </text>
          </g>
        )}

        {theme === "wedding" && (
          <g className="theme-art wedding-art">
            <g>
              <circle
                className="wedding-mandala wedding-strong"
                cx="20"
                cy="20"
                r="62"
              />
              <circle
                className="wedding-mandala"
                cx="20"
                cy="20"
                r="48"
              />
              <circle
                className="wedding-mandala"
                cx="20"
                cy="20"
                r="33"
              />

              <path
                className="wedding-petal"
                d="M20 -54 Q39 -25 20 1 Q1 -25 20 -54 Z"
              />
              <path
                className="wedding-petal"
                d="M94 20 Q58 39 34 20 Q58 1 94 20 Z"
              />
              <path
                className="wedding-petal"
                d="M20 94 Q1 58 20 35 Q39 58 20 94 Z"
              />
              <path
                className="wedding-petal"
                d="M-54 20 Q-18 1 5 20 Q-18 39 -54 20 Z"
              />
              <path
                className="wedding-petal"
                d="M73 -33 Q45 -27 29 -8 Q37 -36 73 -33 Z"
              />
              <path
                className="wedding-petal"
                d="M73 73 Q45 65 29 46 Q37 75 73 73 Z"
              />
            </g>

            <g transform="translate(500 650) rotate(180)">
              <circle
                className="wedding-mandala wedding-strong"
                cx="20"
                cy="20"
                r="62"
              />
              <circle
                className="wedding-mandala"
                cx="20"
                cy="20"
                r="48"
              />
              <circle
                className="wedding-mandala"
                cx="20"
                cy="20"
                r="33"
              />
              <path
                className="wedding-petal"
                d="M20 -54 Q39 -25 20 1 Q1 -25 20 -54 Z"
              />
              <path
                className="wedding-petal"
                d="M94 20 Q58 39 34 20 Q58 1 94 20 Z"
              />
              <path
                className="wedding-petal"
                d="M20 94 Q1 58 20 35 Q39 58 20 94 Z"
              />
              <path
                className="wedding-petal"
                d="M-54 20 Q-18 1 5 20 Q-18 39 -54 20 Z"
              />
              <path
                className="wedding-petal"
                d="M73 -33 Q45 -27 29 -8 Q37 -36 73 -33 Z"
              />
              <path
                className="wedding-petal"
                d="M73 73 Q45 65 29 46 Q37 75 73 73 Z"
              />
            </g>

            <path
              className="wedding-vine"
              d="M10 173 C47 132 79 116 120 111"
            />
            <path
              className="wedding-vine"
              d="M490 173 C453 132 421 116 380 111"
            />
            <path
              className="wedding-vine"
              d="M10 477 C47 518 79 534 120 539"
            />
            <path
              className="wedding-vine"
              d="M490 477 C453 518 421 534 380 539"
            />

            <path
              className="wedding-leaf"
              d="M60 141 Q38 121 30 98 Q55 104 70 127 Z"
            />
            <path
              className="wedding-leaf"
              d="M440 141 Q462 121 470 98 Q445 104 430 127 Z"
            />

            <circle
              className="wedding-ring"
              cx="250"
              cy="53"
              r="20"
            />
            <circle
              className="wedding-ring"
              cx="250"
              cy="53"
              r="14"
            />

            <path
              className="wedding-heart"
              d="M238 559 C220 540 194 562 250 605 C306 562 280 540 262 559
                 C258 564 254 568 250 573 C246 568 242 564 238 559 Z"
            />

            <text
              className="wedding-label"
              x="202"
              y="636"
            >
              TOGETHER
            </text>
          </g>
        )}

        {theme === "family" && (
          <g className="theme-art family-art">
            <path
              d="M25 620 C55 570 72 520 72 465"
              strokeWidth="2.5"
              opacity="0.28"
            />
            <path
              d="M475 620 C445 570 428 520 428 465"
              strokeWidth="2.5"
              opacity="0.28"
            />
          </g>
        )}

        {theme === "party" && (
          <g className="theme-art party-art">
            <path
              d="M25 80 l12 14 M475 80 l-12 14 M34 560 l10 -10 M466 560 l-10 -10"
              strokeWidth="2"
              opacity="0.4"
            />
          </g>
        )}

        {theme === "graduation" && (
          <g className="theme-art graduation-art">
            <path
              d="M250 35 l6 14 15 2 -11 10 3 15 -13 -8 -13 8 3 -15 -11 -10 15 -2 Z"
              fill="none"
              strokeWidth="1.4"
              opacity="0.38"
            />
          </g>
        )}
      </svg>
    );
  };


  const renderAlbumPage = (
    page: AlbumPage
  ) => {
    const pageDesign = getPageDesign(page);

    return (
      <div
        className={`dynamic-template-page dynamic-design-${pageDesign} dynamic-theme-${albumTheme}`}
        data-theme={albumTheme}
        aria-label={`${getThemeLabel(albumTheme)} album page`}
        /*
         * Page editing is intentionally opened from the small edit button
         * in the bottom-left corner. Photo clicks remain available for the
         * dedicated photo editor.
         */
      >
        <ThemeDecorations theme={albumTheme} />

        <button
          type="button"
          className="album-page-edit-button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openPageEditor(page.id);
          }}
          aria-label="Edit this album page"
          title="Edit this album page"
        >
          ✎
          <span>Edit page</span>
        </button>

        <div className="album-drag-instruction">
          <span>↔</span>
          Drag a photo onto another to swap
        </div>

        {page.frames.map((frame) => {
          const image = page.images.find((item) => item.id === frame.imageId);
          if (!image) return null;

          const isDragging = draggedAlbumImageId === image.id;
          const isDropTarget = draggedAlbumTargetId === image.id;

          return (
            <div
              key={image.id}
              className={`dynamic-photo-slot dynamic-${image.orientation || "square"} ${
                isDragging ? "album-photo-dragging" : ""
              } ${isDropTarget ? "album-photo-drop-target" : ""}`}
              style={{
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.width}%`,
                height: `${frame.height}%`,
              }}
              draggable
              onClick={(event) => event.stopPropagation()}
              onDragStart={(event) => {
                setDraggedAlbumImageId(image.id);
                setDraggedAlbumTargetId(null);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", image.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
                if (draggedAlbumImageId && draggedAlbumImageId !== image.id) {
                  setDraggedAlbumTargetId(image.id);
                }
              }}
              onDragLeave={(event) => {
                event.stopPropagation();
                if (draggedAlbumTargetId === image.id) {
                  setDraggedAlbumTargetId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();

                const sourceId =
                  event.dataTransfer.getData("text/plain") ||
                  draggedAlbumImageId;

                if (sourceId && sourceId !== image.id) {
                  requestAlbumSwap(sourceId, image.id);
                }

                setDraggedAlbumImageId(null);
                setDraggedAlbumTargetId(null);
              }}
              onDragEnd={() => {
                setDraggedAlbumImageId(null);
                setDraggedAlbumTargetId(null);
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

        /* ===============================================
           INSIDE-ALBUM PAGE EDITOR
        =============================================== */

        .album-page-edit-button {
          position: absolute;
          left: 9px;
          bottom: 9px;
          z-index: 8;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 30px;
          min-height: 30px;
          padding: 5px 8px;
          border: 1px solid rgba(255,255,255,0.58);
          border-radius: 999px;
          background: rgba(18,20,22,0.72);
          color: white;
          font-size: 11px;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.22);
          backdrop-filter: blur(5px);
          transition:
            background 140ms ease,
            transform 140ms ease,
            border-color 140ms ease;
        }

        .album-page-edit-button span {
          font-size: 9px;
          letter-spacing: 0.04em;
        }

        .album-page-edit-button:hover {
          background: rgba(35,38,42,0.92);
          border-color: rgba(255,255,255,0.85);
          transform: translateY(-1px);
        }

        .album-page-edit-button:active {
          transform: translateY(0);
        }

        /*
         * Decorative artwork must never block interactions with the page,
         * photos, or the edit button.
         */
        .dynamic-template-page > svg,
        .album-drag-instruction {
          pointer-events: none;
        }

        .album-page-editor-backdrop,
        .album-swap-confirm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
          background: rgba(7,8,10,0.76);
          backdrop-filter: blur(12px);
          overflow-y: auto;
        }

        .album-page-editor-modal {
          width: min(940px, 96vw);
          max-height: 92vh;
          overflow: auto;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          background: #15171b;
          color: #f5f5f5;
          box-shadow: 0 35px 110px rgba(0,0,0,0.7);
        }

        .album-page-editor-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .album-page-editor-header span {
          color: #aaa;
          font-size: 10px;
          letter-spacing: 0.2em;
        }

        .album-page-editor-header h2 {
          margin: 7px 0 4px;
          font-size: 24px;
        }

        .album-page-editor-header p {
          margin: 0;
          color: #9ca1a8;
          font-size: 12px;
        }

        .album-page-editor-body {
          display: grid;
          gap: 18px;
          padding: 22px 24px;
        }

        .page-editor-section {
          padding: 17px;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 15px;
          background: rgba(255,255,255,0.025);
        }

        .page-editor-section h3 {
          margin: 0 0 6px;
          font-size: 14px;
        }

        .page-editor-help {
          margin: 0 0 13px;
          color: #969ca5;
          font-size: 12px;
          line-height: 1.5;
        }

        .page-editor-photo-grid,
        .page-editor-add-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .page-editor-photo-card,
        .page-editor-add-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          padding: 0;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 11px;
          background: #202329;
          color: white;
          text-align: left;
        }

        .page-editor-photo-open {
          display: block;
          width: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          color: white;
          cursor: pointer;
          text-align: left;
        }

        .page-editor-photo-open img,
        .page-editor-add-card img {
          display: block;
          width: 100%;
          height: 130px;
          object-fit: cover;
        }

        .page-editor-photo-open span,
        .page-editor-add-card span {
          display: block;
          padding: 8px 10px 3px;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .page-editor-photo-open em {
          display: block;
          padding: 0 10px 8px;
          color: #cbb79d;
          font-size: 9px;
          font-style: normal;
        }

        .page-editor-photo-open:hover {
          background: rgba(255,255,255,0.035);
        }

        .page-editor-swap-button {
          width: calc(100% - 12px);
          min-height: 32px;
          margin: 0 6px 6px;
          padding: 6px 7px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 7px;
          background: #171a1e;
          color: #d9dce1;
          font-size: 9px;
          cursor: pointer;
        }

        .page-editor-swap-button:hover {
          background: #272b31;
        }

        .page-editor-photo-card.selected {
          border-color: #e7d2b1;
          box-shadow: 0 0 0 2px rgba(231,210,177,0.28);
        }

        .page-editor-upload-button {
          width: 100%;
          min-height: 44px;
          margin-bottom: 12px;
          padding: 9px 14px;
          border: 1px dashed rgba(231,210,177,0.55);
          border-radius: 9px;
          background: rgba(231,210,177,0.07);
          color: #ead9bd;
          cursor: pointer;
        }

        .page-editor-secondary-button,
        .page-editor-close-button {
          min-height: 42px;
          margin-top: 12px;
          padding: 9px 14px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 9px;
          background: #24272d;
          color: white;
          cursor: pointer;
        }

        .page-editor-layout-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .page-editor-layout-grid button {
          min-height: 44px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 9px;
          background: #22252b;
          color: #ddd;
          cursor: pointer;
        }

        .page-editor-layout-grid button.active-page-layout {
          border-color: #e5d1b1;
          background: #3a3329;
          color: #fff;
        }

        .page-editor-limit {
          padding: 13px;
          border-radius: 9px;
          background: rgba(255,255,255,0.045);
          color: #aeb2b8;
          font-size: 12px;
        }

        .album-page-editor-footer {
          display: flex;
          justify-content: flex-end;
          padding: 0 24px 22px;
        }

        .page-editor-close-button {
          min-width: 110px;
          margin-top: 0;
          background: #e8ddcc;
          color: #171717;
          border: 0;
        }

        .album-swap-confirm-modal {
          width: min(480px, 94vw);
          padding: 22px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: #17191d;
          color: white;
          box-shadow: 0 30px 100px rgba(0,0,0,0.7);
          text-align: center;
        }

        .album-swap-preview {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .album-swap-preview img {
          width: 100%;
          height: 130px;
          object-fit: cover;
          border-radius: 10px;
          background: #222;
        }

        .album-swap-preview span {
          color: #e5d1b1;
          font-size: 22px;
        }

        .album-swap-confirm-modal h2 {
          margin: 0 0 8px;
          font-size: 21px;
        }

        .album-swap-confirm-modal p {
          margin: 0;
          color: #a5aab1;
          font-size: 12px;
          line-height: 1.5;
        }

        .album-swap-confirm-actions {
          display: flex;
          justify-content: center;
          gap: 9px;
          margin-top: 18px;
        }

        .album-swap-confirm-actions button {
          min-height: 44px;
          padding: 9px 15px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 9px;
          background: #25282e;
          color: white;
          cursor: pointer;
        }

        .album-swap-confirm-actions .confirm-swap-button {
          background: #e8ddcc;
          color: #171717;
          border: 0;
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
           PROMPT-DRIVEN ALBUM THEME
        =============================================== */

        .album-prompt-panel {
          width: min(760px, 96vw);
          margin: 18px auto 22px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          background: rgba(255,255,255,0.035);
          box-sizing: border-box;
        }

        .album-prompt-panel label {
          display: block;
          margin-bottom: 9px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #e8e1d9;
        }

        .album-prompt-panel textarea {
          width: 100%;
          min-height: 82px;
          resize: vertical;
          box-sizing: border-box;
          padding: 12px 13px;
          border: 1px solid #4b515b;
          border-radius: 10px;
          background: #111419;
          color: #f1f1f1;
          font: inherit;
          line-height: 1.5;
          outline: none;
        }

        .album-prompt-panel textarea:focus {
          border-color: #d8b28a;
          box-shadow: 0 0 0 2px rgba(216,178,138,0.12);
        }

        .album-prompt-hint {
          margin-top: 8px;
          color: #9da3aa;
          font-size: 12px;
          line-height: 1.5;
        }

        .album-theme-note {
          display: block;
          margin-top: 5px;
          color: #8f969e;
          font-size: 11px;
        }

        /* ===============================================
           REFERENCE-INSPIRED THEMED BACKGROUNDS
           ------------------------------------------------
           Visual direction from the supplied references:
           travel = vintage map/passport stationery
           birthday = soft watercolor party stationery
           wedding = ivory/gold ornamental paper
        =============================================== */

        .dynamic-template-page {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-height: 100%;
          background: #fbfaf7;
        }

        .dynamic-template-page::before,
        .dynamic-template-page::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .dynamic-template-page::before {
          z-index: 0;
        }

        .dynamic-template-page::after {
          z-index: 1;
        }

        .theme-decorations {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 2;
          pointer-events: none;
        }

        .dynamic-template-page .dynamic-photo-slot {
          position: absolute;
          z-index: 4;
        }

        .theme-art {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        /* ---------- TRAVEL: VINTAGE MAP PAPER ---------- */

        .dynamic-theme-travel {
          background:
            radial-gradient(
              ellipse at 50% 50%,
              rgba(255,255,255,0.97) 0 44%,
              rgba(244,238,224,0.86) 100%
            ),
            #f1ebdd;
        }

        .dynamic-theme-travel::before {
          opacity: 0.7;
          background:
            linear-gradient(
              12deg,
              transparent 0 49%,
              rgba(102,93,76,0.055) 49.2% 49.7%,
              transparent 50%
            ),
            linear-gradient(
              -8deg,
              transparent 0 54%,
              rgba(102,93,76,0.045) 54.2% 54.7%,
              transparent 55%
            ),
            repeating-linear-gradient(
              0deg,
              rgba(105,97,82,0.018) 0 1px,
              transparent 1px 22px
            );
        }

        .dynamic-theme-travel::after {
          background:
            radial-gradient(
              circle at 8% 8%,
              rgba(100,91,74,0.09) 0 1px,
              transparent 1.5px
            );
          background-size: 12px 12px;
          mask-image:
            linear-gradient(
              to bottom,
              black 0 22%,
              transparent 33% 67%,
              black 78% 100%
            );
        }

        .travel-art {
          color: #756d5d;
          stroke: currentColor;
        }

        .travel-contour {
          stroke-width: 1.2;
          opacity: 0.26;
        }

        .travel-contour-light {
          stroke-width: 0.9;
          opacity: 0.16;
        }

        .travel-route {
          stroke: #4f493d;
          stroke-width: 1.8;
          stroke-dasharray: 2 7;
          opacity: 0.64;
        }

        .travel-pin {
          fill: #514b3f;
          stroke: #f1ebdd;
          stroke-width: 3;
          opacity: 0.72;
        }

        .travel-compass {
          stroke-width: 1.4;
          opacity: 0.48;
        }

        .travel-needle,
        .travel-plane {
          fill: #5c5548;
          stroke: none;
          opacity: 0.62;
        }

        .travel-stamp {
          fill: none;
          stroke: #756d5d;
          stroke-width: 1.2;
          opacity: 0.32;
        }

        .travel-stamp-text,
        .travel-label {
          fill: #756d5d;
          stroke: none;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 7px;
          letter-spacing: 1.8px;
          opacity: 0.4;
        }

        /* ---------- BIRTHDAY: SOFT WATERCOLOUR PAPER ---------- */

        .dynamic-theme-birthday {
          background:
            radial-gradient(
              ellipse at 14% 15%,
              rgba(244,188,205,0.23),
              transparent 34%
            ),
            radial-gradient(
              ellipse at 88% 83%,
              rgba(177,207,230,0.2),
              transparent 33%
            ),
            linear-gradient(
              180deg,
              #fffdfb 0%,
              #fff9f4 100%
            );
        }

        .dynamic-theme-birthday::before {
          background:
            radial-gradient(
              ellipse at 50% 0%,
              rgba(245,211,173,0.14),
              transparent 38%
            );
        }

        .dynamic-theme-birthday::after {
          background:
            radial-gradient(
              circle at 7% 91%,
              rgba(244,183,203,0.1) 0 85px,
              transparent 87px
            ),
            radial-gradient(
              circle at 93% 9%,
              rgba(179,210,231,0.1) 0 85px,
              transparent 87px
            );
        }

        .birthday-art {
          color: #c18799;
          stroke: currentColor;
        }

        .birthday-bunting {
          stroke-width: 1.4;
          opacity: 0.42;
        }

        .birthday-flag {
          stroke: #b98a96;
          stroke-width: 0.8;
          opacity: 0.52;
        }

        .birthday-pink {
          fill: #efb7c8;
        }

        .birthday-blue {
          fill: #b8d1e6;
        }

        .birthday-peach {
          fill: #efd0a8;
        }

        .birthday-balloon {
          stroke-width: 1;
          opacity: 0.56;
        }

        .birthday-string {
          stroke-width: 1;
          opacity: 0.34;
        }

        .birthday-confetti {
          stroke-width: 1.8;
          opacity: 0.42;
        }

        .birthday-cake {
          fill: #f1cbd2;
          stroke: #bd8798;
          stroke-width: 1.1;
          opacity: 0.66;
        }

        .birthday-cake-layer {
          fill: #f6dfcf;
          stroke: #bd8798;
          stroke-width: 0.8;
        }

        .birthday-candle {
          stroke: #c39a61;
          stroke-width: 2;
        }

        .birthday-flame {
          fill: #e8b96e;
          stroke: none;
          opacity: 0.78;
        }

        .birthday-label {
          fill: #b67c8f;
          stroke: none;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 7px;
          letter-spacing: 2.7px;
          opacity: 0.38;
        }

        /* ---------- WEDDING: ORNAMENTAL IVORY / GOLD ---------- */

        .dynamic-theme-wedding {
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(255,255,255,0.99) 0 54%,
              rgba(247,241,231,0.9) 100%
            ),
            #f6f0e6;
        }

        .dynamic-theme-wedding::before {
          background:
            radial-gradient(
              circle at 0% 0%,
              rgba(180,147,101,0.08),
              transparent 28%
            ),
            radial-gradient(
              circle at 100% 100%,
              rgba(180,147,101,0.08),
              transparent 28%
            );
        }

        .dynamic-theme-wedding::after {
          background:
            linear-gradient(
              45deg,
              transparent 0 49.8%,
              rgba(180,147,101,0.035) 49.9% 50.1%,
              transparent 50.2%
            ),
            linear-gradient(
              -45deg,
              transparent 0 49.8%,
              rgba(180,147,101,0.025) 49.9% 50.1%,
              transparent 50.2%
            );
        }

        .wedding-art {
          color: #ad8b5e;
          stroke: currentColor;
        }

        .wedding-mandala {
          stroke-width: 1.05;
          opacity: 0.28;
        }

        .wedding-strong {
          stroke-width: 1.7;
          opacity: 0.44;
        }

        .wedding-petal {
          fill: #f0e4d3;
          stroke: #b18e61;
          stroke-width: 0.9;
          opacity: 0.4;
        }

        .wedding-vine {
          stroke-width: 1.5;
          opacity: 0.38;
        }

        .wedding-leaf {
          fill: #eadfce;
          stroke: #b08d61;
          stroke-width: 0.8;
          opacity: 0.42;
        }

        .wedding-ring {
          fill: none;
          stroke-width: 2;
          opacity: 0.42;
        }

        .wedding-heart {
          fill: #ead7d0;
          stroke: #b08d61;
          stroke-width: 1.1;
          opacity: 0.4;
        }

        .wedding-label {
          fill: #a88a64;
          stroke: none;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 7px;
          letter-spacing: 2.8px;
          opacity: 0.38;
        }

        /* Other themes remain understated. */
        .dynamic-theme-family {
          background:
            linear-gradient(180deg, #f4f7f1, #fcfaf5);
        }

        .dynamic-theme-party {
          background:
            linear-gradient(180deg, #f7f1fb, #fff5ee);
        }

        .dynamic-theme-graduation {
          background:
            linear-gradient(180deg, #eef3fa, #fbfaf5);
        }

        .album-drag-instruction {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8;
          padding: 5px 10px;
          border: 1px solid rgba(255,255,255,0.75);
          border-radius: 999px;
          background: rgba(45,40,32,0.62);
          color: white;
          font-size: 8px;
          letter-spacing: 0.03em;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0.62;
        }

        .album-drag-instruction span {
          margin-right: 4px;
          font-size: 11px;
        }

        .dynamic-photo-slot {
          cursor: grab;
          transition:
            opacity 160ms ease,
            filter 160ms ease,
            transform 160ms ease;
        }

        .dynamic-photo-slot:active {
          cursor: grabbing;
        }

        .dynamic-photo-slot.album-photo-dragging {
          opacity: 0.58;
          filter: saturate(0.7);
          transform: scale(0.985);
        }

        .dynamic-photo-slot.album-photo-drop-target
          .album-photo-frame {
          outline: 2px solid rgba(255,255,255,0.95);
          outline-offset: 4px;
          box-shadow:
            0 0 0 5px rgba(125,102,72,0.16);
        }

        /* ===============================================
           ALBUM DESIGN SWITCHER
        =============================================== */

        /* ===============================================
           REFERENCE-INSPIRED AI ALBUM EDITOR
        =============================================== */
        .ai-album-editor-shell {
          width: 100%;
          background: #1c1f22;
          color: #f4f1ec;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 20px 55px rgba(0,0,0,0.28);
        }
        .ai-album-topbar {
          min-height: 94px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 12px 24px;
          background: linear-gradient(180deg,#202428,#1b1e21);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          box-sizing: border-box;
        }
        .ai-album-brand { display:flex; align-items:center; gap:14px; min-width:0; }
        .ai-album-brand-mark {
          width:54px; height:54px; flex:0 0 54px; display:grid; place-items:center;
          border:2px solid #e9e3d9; border-radius:8px; color:#f7f1e8; font-size:27px;
          background:linear-gradient(135deg,#30343a,#17191c); box-shadow:5px 5px 0 rgba(255,255,255,0.12);
        }
        .ai-album-brand-copy h1 { margin:0; color:#f8f5ef; font-size:27px; line-height:1.05; font-weight:700; }
        .ai-album-brand-copy p { margin:5px 0 0; color:#9ea4ab; font-size:13px; }
        .ai-album-top-actions { display:flex; align-items:stretch; height:70px; }
        .ai-album-top-action {
          min-width:112px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
          padding:5px 16px; border:0; border-left:1px solid rgba(255,255,255,0.08); background:transparent;
          color:#f3f0eb; cursor:pointer;
        }
        .ai-album-top-action:hover,.ai-album-top-action.active { background:rgba(255,255,255,0.055); color:#fff; }
        .ai-album-top-action-icon { font-size:27px; line-height:1; }
        .ai-album-top-action-label { font-size:12px; white-space:nowrap; }
        .ai-album-editor-body { display:grid; grid-template-columns:220px minmax(0,1fr); min-height:690px; }
        .ai-album-tool-rail { background:#22262a; border-right:1px solid rgba(255,255,255,0.07); padding:13px 10px; box-sizing:border-box; }
        .ai-album-tool-item {
          width:100%; min-height:52px; display:flex; align-items:center; gap:13px; padding:9px 12px; margin:0 0 5px;
          border:0; border-radius:8px; background:transparent; color:#f0ede7; text-align:left; font-size:14px; cursor:pointer;
        }
        .ai-album-tool-item:hover { background:rgba(255,255,255,0.055); }
        .ai-album-tool-item.active { background:#34383d; box-shadow:inset 3px 0 0 #e2bd8d; }
        .ai-album-tool-icon { width:24px; flex:0 0 24px; text-align:center; font-size:20px; }
        .ai-album-tool-panel { margin-top:17px; padding:12px; border-top:1px solid rgba(255,255,255,0.07); }
        .ai-album-tool-panel-kicker { display:block; margin-bottom:6px; color:#9ba1a8; font-size:9px; font-weight:700; letter-spacing:.16em; }
        .ai-album-tool-panel h3 { margin:0 0 5px; color:#f3eee6; font-size:14px; }
        .ai-album-tool-panel p { margin:0 0 10px; color:#92989f; font-size:10px; line-height:1.45; }
        .ai-album-frame-options { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
        .ai-album-frame-option { min-width:0; padding:5px; border:1px solid #41464c; border-radius:6px; background:#171a1d; color:#ddd8d0; cursor:pointer; text-align:left; }
        .ai-album-frame-option.active { border-color:#d8b28a; background:#302820; }
        .ai-album-frame-mini { height:45px; display:grid; place-items:center; gap:3px; padding:4px; border-radius:4px; background:linear-gradient(145deg,#f3eee3,#d9d1c3); }
        .ai-album-frame-mini span { display:block; width:70%; height:75%; border:1px solid #a89d8d; background:rgba(255,255,255,.35); }
        .ai-album-frame-mini.two { grid-template-columns:1fr 1fr; }
        .ai-album-frame-mini.three { grid-template-columns:repeat(3,1fr); }
        .ai-album-frame-mini.four { grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(2,1fr); }
        .ai-album-frame-option-label { display:block; margin-top:5px; font-size:9px; color:#b8b2aa; }
        .ai-album-tool-card { padding:10px; margin-top:8px; border:1px solid #3b4046; border-radius:8px; background:#181b1f; color:#aeb3ba; font-size:10px; line-height:1.45; }
        .ai-album-canvas-area { min-width:0; display:flex; flex-direction:column; background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.045),transparent 46%),#24272a; overflow:hidden; }
        .ai-album-book-toolbar { min-height:42px; display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:7px 14px; color:#9da3a9; font-size:10px; box-sizing:border-box; }
        .ai-album-book-title { margin-right:auto; min-width:0; color:#ded9d1; font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ai-album-canvas-area .book-stage { flex:1; width:100%; display:flex; align-items:center; justify-content:center; padding:0 18px 18px; box-sizing:border-box; }
        .ai-album-page-strip { display:flex; align-items:center; gap:10px; min-height:110px; padding:13px 15px; background:#f2f0ed; border-top:1px solid rgba(0,0,0,.1); box-sizing:border-box; overflow-x:auto; }
        .ai-album-page-thumb { position:relative; flex:0 0 116px; height:78px; padding:0; border:2px solid transparent; border-radius:5px; background:#ddd8d0; box-shadow:0 2px 7px rgba(0,0,0,.12); cursor:pointer; overflow:hidden; }
        .ai-album-page-thumb.active { border-color:#0d9bd7; box-shadow:0 0 0 1px rgba(13,155,215,.12); }
        .ai-album-page-thumb-label { position:absolute; left:4px; bottom:3px; padding:2px 4px; border-radius:3px; background:rgba(0,0,0,.56); color:white; font-size:7px; line-height:1; }
        .ai-album-page-thumb-cover { width:100%; height:100%; display:grid; place-items:center; padding:8px; box-sizing:border-box; background:linear-gradient(145deg,#40372f,#1f1d1a); color:#eee7dc; font-size:9px; font-weight:700; text-align:center; }
        .ai-album-page-thumb-title { width:100%; height:100%; display:grid; place-items:center; padding:8px; box-sizing:border-box; background:#f3efe7; color:#645d55; text-align:center; font-family:Georgia,serif; font-size:9px; }
        .ai-album-page-thumb-grid { position:absolute; inset:6px; display:grid; gap:3px; }
        .ai-album-page-thumb-photo { min-width:0; min-height:0; overflow:hidden; border:1px solid rgba(80,70,58,.25); background:#f8f6f2; }
        .ai-album-page-thumb-photo img { width:100%; height:100%; display:block; object-fit:cover; }
        .ai-album-page-strip-arrow { flex:0 0 30px; width:30px; height:30px; border:0; background:transparent; color:#555b60; font-size:25px; cursor:pointer; }
        .album-name-editor-input { width:100%; min-height:36px; padding:8px 9px; box-sizing:border-box; border:1px solid #454a50; border-radius:7px; background:#171a1d; color:#f4f1ec; outline:none; font-size:11px; }
        .album-name-editor-input:focus { border-color:#d8b28a; }
        .ai-album-tool-panel .album-navigation-panel.button { width:100%; min-height:34px; margin-top:7px; padding:7px 8px; border:1px solid #41464c; border-radius:7px; background:#171a1d; color:#e8e4dd; cursor:pointer; font-size:10px; }
        .ai-album-tool-panel .album-navigation-panel.button:hover { background:#272b30; }
        @media (max-width:900px) {
          .ai-album-topbar { padding:10px 16px; }
          .ai-album-top-action { min-width:88px; padding-left:10px; padding-right:10px; }
          .ai-album-editor-body { grid-template-columns:190px minmax(0,1fr); }
        }
        @media (max-width:700px) {
          .ai-album-editor-shell { border-radius:12px; }
          .ai-album-topbar { min-height:74px; gap:10px; }
          .ai-album-brand-mark { width:44px; height:44px; flex-basis:44px; font-size:21px; }
          .ai-album-brand-copy h1 { font-size:19px; }
          .ai-album-brand-copy p { font-size:10px; margin-top:3px; }
          .ai-album-top-actions { height:58px; flex:0 0 auto; }
          .ai-album-top-action { min-width:52px; padding:4px 7px; }
          .ai-album-top-action-icon { font-size:21px; }
          .ai-album-top-action-label { display:none; }
          .ai-album-editor-body { display:flex; flex-direction:column; min-height:0; }
          .ai-album-tool-rail { order:2; border-right:0; border-top:1px solid rgba(255,255,255,.07); padding:8px; }
          .ai-album-tool-item { display:inline-flex; width:auto; min-width:70px; min-height:48px; margin:0 3px 0 0; padding:6px 9px; flex-direction:column; justify-content:center; gap:2px; text-align:center; }
          .ai-album-tool-icon { width:auto; font-size:18px; }
          .ai-album-tool-label { font-size:9px; }
          .ai-album-tool-panel { margin-top:8px; padding:10px 3px 2px; }
          .ai-album-canvas-area { order:1; }
          .ai-album-canvas-area .book-stage { padding:0 6px 8px; }
          .ai-album-page-strip { min-height:92px; padding:9px 8px; gap:7px; }
          .ai-album-page-thumb { flex-basis:92px; height:62px; }
        }
        @media (max-width:420px) {
          .ai-album-brand-copy p { display:none; }
          .ai-album-top-action { min-width:42px; }
          .ai-album-tool-item { min-width:60px; padding-left:5px; padding-right:5px; }
        }

        /* ===============================================
           ALBUM EDITOR WORKSPACE
           ------------------------------------------------
           Desktop: tools stay to the LEFT of the book.
           Mobile: tools become a compact full-width panel
           below the book so the 500x650 page is never forced
           outside the viewport.
        =============================================== */

        .digital-album-section {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          box-sizing: border-box;
          overflow: visible;
        }

        .album-editor-workspace {
          width: 100%;
          display: grid;
          grid-template-columns: 230px minmax(0, 1fr);
          align-items: start;
          justify-content: center;
          gap: 22px;
          box-sizing: border-box;
        }

        .album-side-panel {
          position: sticky;
          top: 18px;
          width: 230px;
          max-width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-sizing: border-box;
        }

        .album-side-panel-section {
          width: 100%;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 14px;
          background: rgba(255,255,255,0.035);
          box-sizing: border-box;
        }

        .album-side-panel-kicker {
          display: block;
          margin-bottom: 9px;
          color: #aeb3bb;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
        }

        .album-side-panel-section h3 {
          margin: 0 0 7px;
          color: #e9e3dc;
          font-size: 13px;
          line-height: 1.35;
        }

        .album-side-panel-section > p {
          margin: 0 0 12px;
          color: #9299a3;
          font-size: 11px;
          line-height: 1.45;
        }

        .album-navigation-panel {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .album-navigation-panel button,
        .album-side-panel .album-design-buttons button {
          width: 100%;
          min-height: 42px;
          padding: 9px 10px;
          border: 1px solid #414752;
          border-radius: 9px;
          background: #15181d;
          color: #f1f1f1;
          font-size: 11px;
          cursor: pointer;
          touch-action: manipulation;
          box-sizing: border-box;
        }

        .album-navigation-panel button:hover,
        .album-side-panel .album-design-buttons button:hover {
          background: #22262d;
        }

        .album-side-panel .album-design-buttons {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .album-side-panel .album-design-buttons button {
          min-width: 0;
          flex: none;
        }

        .album-side-panel .album-design-buttons button.active-design {
          border-color: #d8b28a;
          background: #342a21;
          color: #fff6ed;
        }

        .album-side-help {
          margin: 4px 2px 0 !important;
          color: #808791 !important;
          font-size: 9px !important;
          line-height: 1.45 !important;
        }

        .album-side-panel-tip {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 12px 14px;
          border-left: 2px solid #b99a77;
          background: rgba(185,154,119,0.07);
          color: #969da6;
          font-size: 10px;
          line-height: 1.45;
        }

        .album-side-panel-tip strong {
          color: #d9c7b3;
          font-size: 10px;
        }

        .album-side-panel-tip span {
          display: block;
        }

        .book-stage {
          min-width: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          box-sizing: border-box;
          overflow: visible;
        }

        .feag-flipbook {
          width: min(
            500px,
            100%
          );
          max-width: 100%;
          flex: 0 0 auto;
        }

        /* The controls now live in the side panel. Keep these classes
           only for compatibility with older markup/styles. */
        .book-controls,
        .secondary-controls,
        .album-design-controls {
          display: none;
        }

        /* ===============================================
           ALBUM NAME EDITOR
        =============================================== */





        /* ===============================================
           PHOTO REORDERING
        =============================================== */

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

        /* =================================================
           MOBILE-FIRST ALBUM EXPERIENCE
           -------------------------------------------------
           The album keeps its internal 500 x 650 coordinate system.
           Only the rendered viewport size changes. This prevents
           mobile scaling from changing any generated frame geometry.
        ================================================= */

        .mobile-album-workspace {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding-left: 16px;
          padding-right: 16px;
          box-sizing: border-box;
        }

        .mobile-book-stage {
          width: 100%;
          padding: 0 8px;
          box-sizing: border-box;
        }

        .mobile-book-stage .feag-flipbook,
        .feag-flipbook {
          width: min(500px, calc(100vw - 32px));
          max-width: 100%;
          margin-left: auto;
          margin-right: auto;
        }

        /* Never allow controls to create horizontal scrolling. */
        .album-workspace button,
        .album-workspace input,
        .album-workspace textarea,
        .album-workspace select {
          max-width: 100%;
          box-sizing: border-box;
        }

        .album-prompt-panel {
          width: min(760px, 100%);
          margin-left: auto;
          margin-right: auto;
        }

        .album-design-controls,
        .book-controls,
        .secondary-controls {
          width: min(980px, 100%);
          max-width: 100%;
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .album-editor-workspace {
            grid-template-columns: 200px minmax(0, 1fr);
            gap: 14px;
          }

          .album-side-panel {
            width: 200px;
          }

          .album-side-panel-section {
            padding: 11px;
          }
        }

        @media (max-width: 700px) {
          .mobile-album-workspace,
          .album-workspace {
            padding-left: 10px;
            padding-right: 10px;
          }

          .album-workspace h1 {
            font-size: clamp(24px, 7vw, 34px);
            line-height: 1.15;
          }

          .album-workspace h2 {
            font-size: clamp(19px, 5.5vw, 27px);
          }

          .album-prompt-panel {
            margin-top: 12px;
            margin-bottom: 16px;
            padding: 13px;
            border-radius: 12px;
          }

          .album-prompt-panel textarea {
            min-height: 96px;
            font-size: 16px;
          }

          .album-prompt-hint {
            font-size: 11px;
          }

          .mobile-book-stage,
          .book-stage {
            padding-left: 0;
            padding-right: 0;
            overflow: visible;
          }

          .mobile-book-stage .feag-flipbook,
          .feag-flipbook {
            width: min(500px, calc(100vw - 20px));
            max-width: calc(100vw - 20px);
          }

          .book-controls,
          .secondary-controls {
            gap: 8px;
            padding: 0 2px;
          }

          .book-controls button,
          .secondary-controls button,
          .album-design-buttons button {
            min-height: 46px;
            font-size: 13px;
            padding: 10px 12px;
          }

          .album-design-controls {
            padding: 12px;
            border-radius: 12px;
          }

          .album-design-buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .album-design-buttons button {
            min-width: 0;
            width: 100%;
          }

          .upload-area {
            padding: 14px 10px;
          }

          .upload-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .uploaded-photo-card {
            min-width: 0;
          }

          .uploaded-photo-card button {
            min-width: 0;
            width: 100%;
          }

          /* Prevent long filenames/theme prompts from pushing the page
             wider than the phone viewport. */
          .uploaded-photo-card,
          .uploaded-photo-card * {
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .photo-editor-modal {
            width: calc(100vw - 20px);
            max-width: calc(100vw - 20px);
            max-height: calc(100dvh - 20px);
            margin: 10px auto;
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
          }

          .photo-editor-backdrop {
            padding: 10px;
            align-items: flex-start;
          }

          .photo-editor-modal .crop-container {
            width: 100%;
            max-width: 100%;
          }

          .photo-editor-modal input[type="range"] {
            width: 100%;
          }
        }

        @media (max-width: 700px) {
}

        @media (max-width: 700px) {
          .cover-border {
            inset: 20px;
            padding: 22px 14px;
          }

          .cover-title-input {
            font-size: clamp(24px, 8vw, 38px);
          }

          .album-drag-instruction {
            top: 5px;
            font-size: 7px;
          }
        }

        @media (max-width: 480px) {
          .mobile-album-workspace,
          .album-workspace {
            padding-left: 8px;
            padding-right: 8px;
          }

          .mobile-book-stage .feag-flipbook,
          .feag-flipbook {
            width: calc(100vw - 16px);
            max-width: calc(100vw - 16px);
          }

          .upload-grid {
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .album-design-buttons {
            grid-template-columns: 1fr 1fr;
          }

          .book-controls,
          .secondary-controls {
            width: 100%;
          }

          .book-controls button,
          .secondary-controls button {
            flex: 1 1 calc(50% - 8px);
          }

          .album-theme-note {
            font-size: 10px;
          }
        }

        @media (max-width: 360px) {
          .mobile-album-workspace,
          .album-workspace {
            padding-left: 5px;
            padding-right: 5px;
          }

          .mobile-book-stage .feag-flipbook,
          .feag-flipbook {
            width: calc(100vw - 10px);
            max-width: calc(100vw - 10px);
          }

          .upload-grid {
            grid-template-columns: 1fr;
          }

          .album-design-buttons {
            grid-template-columns: 1fr;
          }
        }

        @media (orientation: landscape) and (max-height: 600px) {
          /* On a landscape phone, fit the entire book vertically so the
             user can actually see and flip it without excessive scrolling. */
          .mobile-book-stage .feag-flipbook,
          .feag-flipbook {
            width: min(
              500px,
              calc((100dvh - 90px) * 500 / 650)
            );
            max-width: calc(100vw - 20px);
          }
        }


        @supports (padding: max(0px)) {
          .album-app {
            padding-left: max(0px, env(safe-area-inset-left));
            padding-right: max(0px, env(safe-area-inset-right));
            padding-bottom: max(0px, env(safe-area-inset-bottom));
          }
        }

        /* =================================================
           MOBILE / TABLET RESPONSIVE DESIGN
        ================================================= */

        html,
        body {
          max-width: 100%;
          overflow-x: hidden;
        }

        .album-app {
          width: 100%;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .album-workspace {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .upload-area,
        .upload-grid,
        .album-design-controls,
        .book-controls,
        .secondary-controls {
          box-sizing: border-box;
        }

        .upload-area input[type="file"] {
          max-width: 100%;
        }

        .upload-grid {
          width: 100%;
          grid-template-columns: repeat(
            auto-fit,
            minmax(180px, 1fr)
          );
        }

        .uploaded-photo-card {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .uploaded-photo-card img {
          max-width: 100%;
          height: auto;
          display: block;
        }

        .book-stage {
          width: 100%;
          max-width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          box-sizing: border-box;
          overflow: visible;
        }

        .feag-flipbook {
          max-width: 100%;
        }

        .book-controls,
        .secondary-controls {
          width: min(980px, 100%);
          max-width: 100%;
          box-sizing: border-box;
          flex-wrap: wrap;
        }

        .book-controls button,
        .secondary-controls button,
        .album-design-buttons button {
          min-height: 44px;
          touch-action: manipulation;
        }

        .album-design-controls {
          width: min(980px, 100%);
          max-width: 100%;
        }

        .album-design-buttons button {
          flex: 1 1 150px;
        }

        .photo-editor-backdrop {
          box-sizing: border-box;
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .photo-editor-modal {
          box-sizing: border-box;
          width: min(1100px, 100%);
          max-width: 100%;
        }

        .photo-editor-body {
          min-width: 0;
        }

        .editor-preview-panel,
        .editor-controls-panel {
          min-width: 0;
          max-width: 100%;
        }

        .editor-crop-area {
          max-width: 100%;
          touch-action: none;
        }

        .editor-controls-panel input[type="range"] {
          min-height: 28px;
          touch-action: manipulation;
        }

        .filter-buttons {
          width: 100%;
        }

        .filter-buttons button {
          min-height: 44px;
          flex: 1 1 95px;
          touch-action: manipulation;
        }

        .editor-actions {
          width: 100%;
        }

        .editor-actions button {
          min-height: 46px;
          touch-action: manipulation;
        }

        @media (max-width: 760px) {
          .album-page-editor-backdrop,
          .album-swap-confirm-backdrop {
            align-items: flex-start;
            padding: 8px;
          }

          .album-page-editor-modal {
            width: 100%;
            max-height: calc(100dvh - 16px);
            border-radius: 15px;
          }

          .album-page-editor-header {
            padding: 16px;
          }

          .album-page-editor-header h2 {
            font-size: 19px;
          }

          .album-page-editor-body {
            padding: 12px;
          }

          .page-editor-section {
            padding: 12px;
          }

          .page-editor-photo-grid,
          .page-editor-add-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .page-editor-photo-card img,
          .page-editor-add-card img {
            height: 145px;
          }

          .page-editor-layout-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .album-page-editor-footer {
            padding: 0 12px 12px;
          }

          .page-editor-close-button {
            width: 100%;
          }

          .album-swap-confirm-modal {
            width: 100%;
            max-width: 480px;
            padding: 17px;
          }

          .album-swap-preview img {
            height: 105px;
          }
          .album-swap-confirm-actions {
            flex-direction: column-reverse;
          }
          .album-swap-confirm-actions button {
            width: 100%;
          }
        }
          .album-workspace {
            padding-left: 14px;
            padding-right: 14px;
          }

          .prototype-title {
            font-size: clamp(28px, 8vw, 42px);
            line-height: 1.05;
            text-align: center;
          }

          .uploaded-title {
            font-size: 20px;
            text-align: center;
          }

          .upload-area {
            width: 100%;
            padding: 18px;
          }

          .upload-area input[type="file"] {
            width: 100%;
            font-size: 14px;
          }

          .upload-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
            gap: 12px;
          }

          .uploaded-photo-card {
            padding: 10px;
            border-radius: 12px;
          }

          .uploaded-photo-card h3 {
            font-size: 14px;
            margin: 8px 0;
          }

          .analysis-copy {
            font-size: 12px;
          }

          .delete-button {
            width: 100%;
            min-height: 40px;
          }

          .create-album-button {
            width: 100%;
            min-height: 50px;
            font-size: 15px;
          }

          .front-cover {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border: 0;
          padding: 0;
          background: #24211e;
          color: white;
          cursor: pointer;
          text-align: center;
          box-sizing: border-box;
        }

        .cover-background-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(0.76) brightness(0.6);
        }

        .cover-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              180deg,
              rgba(18,16,14,0.2) 0%,
              rgba(18,16,14,0.55) 58%,
              rgba(18,16,14,0.84) 100%
            );
        }

        .book-cover-spine {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 12px;
          z-index: 3;
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,0.18),
              rgba(0,0,0,0.2)
            );
        }

        .cover-border {
          position: absolute;
          inset: 28px;
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.56);
          padding: 30px 20px;
          box-sizing: border-box;
          background: rgba(0,0,0,0.08);
        }

        .cover-small-text {
          margin-bottom: 18px;
          font-size: 9px;
          letter-spacing: 0.28em;
          opacity: 0.76;
        }

        .cover-title-input {
          width: min(100%, 390px);
          border: 0;
          border-bottom: 2px solid rgba(255,255,255,0.68);
          outline: none;
          background: transparent;
          color: white;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(28px, 5vw, 46px);
          font-weight: 700;
          line-height: 1.05;
          text-align: center;
          padding: 4px 5px 9px;
          box-sizing: border-box;
          text-shadow: 0 2px 16px rgba(0,0,0,0.35);
        }

        .cover-title-input:focus {
          border-bottom-color: white;
          background: rgba(255,255,255,0.08);
        }

        .cover-divider {
          width: 72px;
          height: 1px;
          margin: 18px 0 15px;
          background: rgba(255,255,255,0.66);
        }

        .cover-border p {
          max-width: 300px;
          margin: 0 0 10px;
          font-size: 11px;
          line-height: 1.5;
          opacity: 0.86;
        }

        .cover-border small {
          font-size: 9px;
          letter-spacing: 0.1em;
          opacity: 0.66;
        }

        .cover-theme-decoration {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }

        .cover-theme-decoration .theme-decorations {
          opacity: 0.7;
        }

        .cover-open-hint {
          position: absolute;
          left: 50%;
          bottom: 16px;
          z-index: 6;
          transform: translateX(-50%);
          font-size: 8px;
          letter-spacing: 0.16em;
          opacity: 0.62;
        }

        .album-book-header {
            padding-left: 4px;
            padding-right: 4px;
            text-align: center;
          }

          .album-book-header h1 {
            font-size: clamp(28px, 9vw, 42px);
          }

          .album-book-header p {
            font-size: 13px;
            line-height: 1.5;
          }

          .book-stage {
            padding: 0;
            margin: 0 auto;
          }

          .book-controls {
            flex-direction: column;
            gap: 9px;
            margin-top: 16px;
          }

          .book-controls button {
            width: 100%;
          }

          .book-controls span {
            order: -1;
            width: 100%;
            text-align: center;
            font-size: 12px;
            line-height: 1.4;
          }

          .secondary-controls {
            flex-direction: column;
            gap: 9px;
          }

          .secondary-controls button {
            width: 100%;
          }

          .album-design-controls {
            margin-top: 20px;
            padding: 15px;
          }

          .album-design-controls p {
            line-height: 1.5;
          }

          .album-design-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .album-design-buttons button {
            min-width: 0;
            width: 100%;
            padding: 10px 8px;
            font-size: 12px;
          }

          .photo-editor-backdrop {
            align-items: flex-start;
            justify-content: center;
            padding: 10px;
          }

          .photo-editor-modal {
            width: 100%;
            max-height: calc(100dvh - 20px);
            border-radius: 14px;
          }

          .photo-editor-header {
            padding: 16px;
          }

          .photo-editor-header h2 {
            max-width: calc(100vw - 90px);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 18px;
          }

          .photo-editor-body {
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 14px;
          }

          .editor-crop-area {
            height: min(54dvh, 480px);
            min-height: 280px;
          }

          .editor-controls-panel {
            gap: 15px;
            padding-bottom: 4px;
          }

          .editor-control-group {
            gap: 7px;
          }

          .filter-buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
          }

          .filter-buttons button {
            width: 100%;
          }

          .editor-actions {
            position: sticky;
            bottom: 0;
            z-index: 3;
            margin: 0 -2px;
            padding: 10px 2px 2px;
            background: #17191d;
          }

          .editor-actions button {
            flex: 1;
          }

          .face-status,
          .editor-ai-result {
            font-size: 13px;
          }
        }

        @media (max-width: 430px) {
          .album-workspace {
            padding-left: 10px;
            padding-right: 10px;
          }

          .upload-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .uploaded-photo-card {
            padding: 8px;
          }

          .album-design-buttons {
            grid-template-columns: 1fr;
          }

          .album-design-buttons button {
            min-height: 44px;
            font-size: 13px;
          }

          .book-controls span {
            font-size: 11px;
          }

          .photo-editor-backdrop {
            padding: 6px;
          }

          .photo-editor-modal {
            max-height: calc(100dvh - 12px);
          }

          .photo-editor-header {
            padding: 13px;
          }

          .photo-editor-body {
            padding: 10px;
          }

          .editor-crop-area {
            height: 45dvh;
            min-height: 250px;
          }

          .editor-actions {
            gap: 7px;
          }

          .editor-actions button {
            padding: 10px 8px;
            font-size: 13px;
          }
        }

        @media (max-width: 360px) {
          .upload-grid {
            grid-template-columns: 1fr;
          }

          .filter-buttons {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-height: 700px) and (max-width: 760px) {
          .editor-crop-area {
            height: 40dvh;
            min-height: 230px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .album-design-buttons button,
          .album-photo-edit-hint {
            transition: none;
          }
        }

        @media (max-width: 700px) {
          .digital-album-section {
            width: 100%;
            max-width: 100%;
            padding: 0;
            overflow: visible;
          }

          .album-editor-workspace {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            gap: 12px;
          }

          .book-stage {
            order: 1;
            width: 100%;
            padding: 0;
            margin: 0 auto;
            overflow: visible;
          }

          .feag-flipbook {
            width: min(
              500px,
              calc(100vw - 20px)
            ) !important;
            max-width: calc(100vw - 20px) !important;
            height: auto;
            margin: 0 auto;
          }

          .album-side-panel {
            order: 2;
            position: static;
            width: 100%;
            max-width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .album-side-panel-section,
          .album-side-panel-tip {
            min-width: 0;
          }

          .album-navigation-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .album-navigation-panel .album-side-panel-kicker,
          .album-navigation-panel .album-side-help {
            grid-column: 1 / -1;
          }

          .album-side-panel .album-design-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .album-side-panel-tip {
            grid-column: 1 / -1;
          }

          .album-navigation-panel button,
          .album-side-panel .album-design-buttons button {
            min-height: 46px;
            font-size: 12px;
          }

          .album-page-edit-button {
            left: 7px;
            bottom: 7px;
            min-width: 36px;
            min-height: 36px;
            padding: 7px 9px;
          }

          .album-page-edit-button span {
            display: none;
          }

          .album-side-panel-tip {
            padding: 11px 12px;
          }

          .album-drag-instruction {
            max-width: calc(100% - 18px);
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        @media (max-width: 480px) {
          .album-editor-workspace {
            gap: 9px;
          }

          .feag-flipbook {
            width: calc(100vw - 16px) !important;
            max-width: calc(100vw - 16px) !important;
          }

          .album-side-panel {
            grid-template-columns: 1fr;
          }

          .album-navigation-panel {
            grid-template-columns: 1fr 1fr;
          }

          .album-side-panel-tip {
            grid-column: auto;
          }

          .album-side-panel-section {
            border-radius: 12px;
          }

          .album-side-panel .album-design-buttons {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 360px) {
          .feag-flipbook {
            width: calc(100vw - 10px) !important;
            max-width: calc(100vw - 10px) !important;
          }

          .album-navigation-panel {
            grid-template-columns: 1fr;
          }

          .album-navigation-panel .album-side-panel-kicker,
          .album-navigation-panel .album-side-help {
            grid-column: auto;
          }

          .album-side-panel .album-design-buttons {
            grid-template-columns: 1fr;
          }
        }

        @media (orientation: landscape) and (max-height: 600px) and (max-width: 900px) {
          .album-editor-workspace {
            grid-template-columns: minmax(180px, 210px) minmax(0, 1fr);
            align-items: start;
          }

          .album-side-panel {
            position: sticky;
            top: 8px;
            width: 100%;
          }

          .feag-flipbook {
            width: min(
              500px,
              calc((100dvh - 35px) * 500 / 650)
            ) !important;
            max-width: calc(100vw - 20px) !important;
          }
        }


        /* ===============================================
           COMPACT PHOTO EDITOR DIALOG
           ------------------------------------------------
           Keep the existing crop/filter/face-detection
           functionality, but present it as a centered
           dialogue box instead of a near-full-screen panel.
        =============================================== */

        .photo-editor-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          box-sizing: border-box;
          overflow: auto;
        }

        .photo-editor-modal {
          width: min(820px, calc(100vw - 36px));
          max-width: 820px;
          max-height: min(700px, calc(100vh - 36px));
          margin: auto;
          overflow-y: auto;
          overflow-x: hidden;
          border-radius: 14px;
          box-sizing: border-box;
        }

        .photo-editor-header {
          padding: 14px 18px;
        }

        .photo-editor-header h2 {
          margin: 5px 0 0;
          font-size: 18px;
        }

        .editor-close-button {
          width: 34px;
          height: 34px;
          font-size: 22px;
        }

        .photo-editor-body {
          grid-template-columns:
            minmax(0, 1.35fr)
            minmax(220px, 0.75fr);
          gap: 16px;
          padding: 16px;
        }

        .editor-crop-area {
          height: min(48vh, 430px);
          min-height: 280px;
          border-radius: 10px;
        }

        .editor-controls-panel {
          gap: 13px;
          padding: 2px 0;
        }

        .editor-control-group {
          gap: 6px;
        }

        .editor-control-group label {
          font-size: 12px;
        }

        .face-status,
        .editor-ai-result {
          margin-top: 9px;
          padding: 9px 11px;
          font-size: 11px;
        }

        .filter-buttons {
          gap: 5px;
        }

        .filter-buttons button,
        .editor-actions button {
          min-height: 34px;
          padding: 6px 9px;
          font-size: 11px;
        }

        @media (max-width: 700px) {
          .photo-editor-backdrop {
            padding: 10px;
            align-items: center;
          }

          .photo-editor-modal {
            width: min(620px, calc(100vw - 20px));
            max-height: calc(100vh - 20px);
          }

          .photo-editor-body {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 12px;
          }

          .editor-crop-area {
            height: min(44vh, 360px);
            min-height: 220px;
          }

          .photo-editor-header {
            padding: 12px 14px;
          }

          .photo-editor-header h2 {
            font-size: 16px;
          }
        }

        @media (max-width: 480px) {
          .photo-editor-backdrop {
            padding: 7px;
          }

          .photo-editor-modal {
            width: calc(100vw - 14px);
            max-height: calc(100vh - 14px);
            border-radius: 12px;
          }

          .photo-editor-body {
            padding: 10px;
          }

          .editor-crop-area {
            height: min(40vh, 300px);
            min-height: 200px;
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

            <div className="album-prompt-panel">
              <label htmlFor="album-prompt">
                Describe the album you want
              </label>

              <textarea
                id="album-prompt"
                value={albumPrompt}
                onChange={(event) =>
                  setAlbumPrompt(event.target.value)
                }
                rows={3}
                maxLength={240}
                placeholder="Example: Create a travel album named as Agra Trip with a travel feel"
              />

              <div className="album-prompt-hint">
                Try: travel, birthday, wedding, family, party or graduation.
                You can also write a natural sentence.
              </div>
            </div>

            <h2 className="uploaded-title">
              Uploaded Images (
              {images.length}/10)
            </h2>
{isAnalyzing && (
              <p className="analysis-status">
                Creating your album... Please wait
              </p>
            )}

            <div className="upload-grid">
              {images.map(
                (
                  image,
                  index
                ) => (
                  <article
                    key={image.id}
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

            <div className="ai-album-editor-shell">
              <header className="ai-album-topbar">
                <div className="ai-album-brand">
                  <div className="ai-album-brand-mark" aria-hidden="true">▧</div>
                  <div className="ai-album-brand-copy">
                    <h1>Album Maker</h1>
                    <p>Create Beautiful Photo Albums</p>
                  </div>
                </div>
                <div className="ai-album-top-actions">
                  <button type="button" className="ai-album-top-action" onClick={() => albumPages[0] && openPageEditor(albumPages[0].id)}>
                    <span className="ai-album-top-action-icon">⊕</span>
                    <span className="ai-album-top-action-label">Add Photos</span>
                  </button>
                  <button type="button" className={`ai-album-top-action ${activeAlbumTool === "frames" ? "active" : ""}`} onClick={() => setActiveAlbumTool("frames")}>
                    <span className="ai-album-top-action-icon">▤</span>
                    <span className="ai-album-top-action-label">Layouts</span>
                  </button>
                  <button type="button" className={`ai-album-top-action ${activeAlbumTool === "backgrounds" ? "active" : ""}`} onClick={() => setActiveAlbumTool("backgrounds")}>
                    <span className="ai-album-top-action-icon">◉</span>
                    <span className="ai-album-top-action-label">Design</span>
                  </button>
                  <button type="button" className={`ai-album-top-action ${activeAlbumTool === "settings" ? "active" : ""}`} onClick={() => setActiveAlbumTool("settings")}>
                    <span className="ai-album-top-action-icon">⇩</span>
                    <span className="ai-album-top-action-label">Save / Export</span>
                  </button>
                </div>
              </header>

              <div className="ai-album-editor-body">
                <aside className="ai-album-tool-rail">
                  {[
                    { id: "frames", icon: "▣", label: "Frames" },
                    { id: "backgrounds", icon: "▧", label: "Backgrounds" },
                    { id: "stickers", icon: "☆", label: "Stickers" },
                    { id: "text", icon: "T", label: "Text" },
                    { id: "borders", icon: "▢", label: "Borders" },
                    { id: "settings", icon: "⚙", label: "Settings" },
                  ].map((tool) => (
                    <button key={tool.id} type="button" className={`ai-album-tool-item ${activeAlbumTool === tool.id ? "active" : ""}`} onClick={() => setActiveAlbumTool(tool.id as typeof activeAlbumTool)}>
                      <span className="ai-album-tool-icon">{tool.icon}</span>
                      <span className="ai-album-tool-label">{tool.label}</span>
                    </button>
                  ))}

                  <div className="ai-album-tool-panel">
                    {activeAlbumTool === "frames" && (
                      <>
                        <span className="ai-album-tool-panel-kicker">FRAMES</span>
                        <h3>Page Layouts</h3>
                        <p>Choose how photographs are framed on the album pages.</p>
                        <div className="ai-album-frame-options">
                          {[
                            { id: "classic", label: "Classic", mini: "one" },
                            { id: "editorial", label: "Editorial", mini: "two" },
                            { id: "collage", label: "Collage", mini: "four" },
                            { id: "story", label: "Story", mini: "three" },
                          ].map((frame) => (
                            <button key={frame.id} type="button" className={`ai-album-frame-option ${albumDesign === frame.id ? "active" : ""}`} onClick={() => changeAlbumDesign(frame.id as AlbumDesign)}>
                              <div className={`ai-album-frame-mini ${frame.mini}`}>
                                <span />
                                {frame.mini !== "one" && <span />}
                                {frame.mini === "four" && <><span /><span /></>}
                              </div>
                              <span className="ai-album-frame-option-label">{frame.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {activeAlbumTool === "backgrounds" && (
                      <>
                        <span className="ai-album-tool-panel-kicker">BACKGROUNDS</span>
                        <h3>Album Theme</h3>
                        <p>Change the decorative background without changing your photographs.</p>
                        <div className="ai-album-frame-options">
                          {["classic","travel","birthday","wedding","family","party"].map((theme) => (
                            <button key={theme} type="button" className={`ai-album-frame-option ${albumTheme === theme ? "active" : ""}`} onClick={() => setAlbumTheme(theme as AlbumTheme)}>
                              <div className="ai-album-frame-mini"><span /></div>
                              <span className="ai-album-frame-option-label">{getThemeLabel(theme as AlbumTheme)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {activeAlbumTool === "stickers" && (
                      <>
                        <span className="ai-album-tool-panel-kicker">STICKERS</span>
                        <h3>Decorations</h3>
                        <p>Theme artwork is already generated automatically for this album.</p>
                        <div className="ai-album-tool-card">Sticker placement can be added here without disturbing the generated photo frames.</div>
                      </>
                    )}

                    {activeAlbumTool === "text" && (
                      <>
                        <span className="ai-album-tool-panel-kicker">TEXT</span>
                        <h3>Album Title</h3>
                        <p>Edit the title shown on the front cover.</p>
                        <input type="text" value={albumName} onChange={(event) => setAlbumName(event.target.value.slice(0, 80))} maxLength={80} className="album-name-editor-input" aria-label="Album title" />
                      </>
                    )}

                    {activeAlbumTool === "borders" && (
                      <>
                        <span className="ai-album-tool-panel-kicker">BORDERS</span>
                        <h3>Frame Styling</h3>
                        <p>The generated album keeps its theme-aware frame treatment.</p>
                        <div className="ai-album-tool-card">Use the small edit icon on each page for page-level framing changes.</div>
                      </>
                    )}

                    {activeAlbumTool === "settings" && (
                      <>
                        <span className="ai-album-tool-panel-kicker">ALBUM</span>
                        <h3>Album Controls</h3>
                        <p>{images.length} photographs · {albumPages.length} generated pages</p>
                        <button type="button" className="album-navigation-panel button" onClick={previousPage}>← Previous</button>
                        <button type="button" className="album-navigation-panel button" onClick={nextPage}>Next →</button>
                        <button type="button" className="album-navigation-panel button" onClick={closeAlbum}>Close Album</button>
                      </>
                    )}
                  </div>
                </aside>

                <div className="ai-album-canvas-area">
                  <div className="ai-album-book-toolbar">
                    <span className="ai-album-book-title">{albumName || getThemeLabel(albumTheme)}</span>
                    <span>{images.length} photos</span><span>•</span><span>{albumPages.length} pages</span>
                  </div>

                  <div className="book-stage mobile-book-stage">


              <FlipBook
                key={
                  bookKey
                }
                ref={
                  bookRef
                }
                className="feag-flipbook"
                width={
                  bookSize.width
                }
                height={
                  bookSize.height
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
                  <div
                    className={`front-cover themed-cover-${albumTheme}`}
                    role="button"
                    tabIndex={0}
                    onClick={openAlbum}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        openAlbum();
                      }
                    }}
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

                    <div className="cover-theme-decoration">
                      <ThemeDecorations
                        theme={albumTheme}
                      />
                    </div>

                    <div className="cover-border">
                      <span className="cover-small-text">
                        YOUR MEMORIES
                      </span>

                      <input
                        type="text"
                        value={albumName}
                        onChange={(event) =>
                          setAlbumName(
                            event.target.value
                              .slice(0, 80)
                          )
                        }
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                        onKeyDown={(event) =>
                          event.stopPropagation()
                        }
                        maxLength={80}
                        aria-label="Edit album title on cover"
                        className="cover-title-input"
                      />

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
                  </div>
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
                      {albumName || getThemeLabel(albumTheme)}
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

                    <div className="ai-album-page-strip">
                      <button type="button" className="ai-album-page-strip-arrow" onClick={previousPage} aria-label="Previous page">‹</button>

                      <button type="button" className={`ai-album-page-thumb ${currentBookPage === 0 ? "active" : ""}`} onClick={() => { setCurrentBookPage(0); setBookOpened(false); bookRef.current?.turnToPage(0); }} aria-label="Front cover">
                        <span className="ai-album-page-thumb-cover">{albumName || "Album"}</span>
                        <span className="ai-album-page-thumb-label">COVER</span>
                      </button>

                      <button type="button" className={`ai-album-page-thumb ${currentBookPage === 1 ? "active" : ""}`} onClick={() => { setCurrentBookPage(1); setBookOpened(true); bookRef.current?.turnToPage(1); }} aria-label="Title page">
                        <span className="ai-album-page-thumb-title">{albumName || getThemeLabel(albumTheme)}</span>
                        <span className="ai-album-page-thumb-label">TITLE</span>
                      </button>

                      {albumPages.map((page, pageIndex) => {
                        const bookPageIndex = pageIndex + 2;
                        const count = page.images.length;
                        const columns = count >= 3 ? "repeat(3,1fr)" : count === 2 ? "repeat(2,1fr)" : "1fr";
                        const rows = count >= 4 ? "repeat(2,1fr)" : "1fr";
                        return (
                          <button key={`thumb-${page.id}`} type="button" className={`ai-album-page-thumb ${currentBookPage === bookPageIndex ? "active" : ""}`} onClick={() => { setCurrentBookPage(bookPageIndex); setBookOpened(true); bookRef.current?.turnToPage(bookPageIndex); }} aria-label={`Album page ${pageIndex + 1}`}>
                            <span className="ai-album-page-thumb-grid" style={{ gridTemplateColumns: columns, gridTemplateRows: rows }}>
                              {page.images.slice(0,4).map((image) => <span key={image.id} className="ai-album-page-thumb-photo"><img src={image.data} alt="" /></span>)}
                            </span>
                            <span className="ai-album-page-thumb-label">{pageIndex + 1}</span>
                          </button>
                        );
                      })}

                      <button type="button" className={`ai-album-page-thumb ${currentBookPage === albumPages.length + 2 ? "active" : ""}`} onClick={() => { const endPage = albumPages.length + 2; setCurrentBookPage(endPage); setBookOpened(true); bookRef.current?.turnToPage(endPage); }} aria-label="End page">
                        <span className="ai-album-page-thumb-title">THE END</span>
                        <span className="ai-album-page-thumb-label">END</span>
                      </button>

                      <button type="button" className="ai-album-page-strip-arrow" onClick={nextPage} aria-label="Next page">›</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </section>
        )}

        {pageEditorId && (() => {
          const editorPage = albumPages.find((page) => page.id === pageEditorId);
          if (!editorPage) return null;

          const otherImages = images.filter(
            (image) => !editorPage.images.some((pageImage) => pageImage.id === image.id)
          );

          return (
            <div
              className="album-page-editor-backdrop"
              onMouseDown={closePageEditor}
            >
              <section
                className="album-page-editor-modal"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="album-page-editor-header">
                  <div>
                    <span>PAGE EDITOR</span>
                    <h2>Customize this album page</h2>
                    <p>
                      {editorPage.images.length} photograph{editorPage.images.length === 1 ? "" : "s"} on this page
                    </p>
                  </div>
                  <button
                    type="button"
                    className="editor-close-button"
                    onClick={closePageEditor}
                    aria-label="Close page editor"
                  >
                    ×
                  </button>
                </header>

                <div className="album-page-editor-body">
                  <div className="page-editor-section">
                    <h3>Photos on this page</h3>
                    <p className="page-editor-help">
                      Select two photos to swap them, or drag a photo onto another photo in the album.
                    </p>

                    <div className="page-editor-photo-grid">
                      {editorPage.images.map((image, index) => {
                        const selected = pageSwapSourceId === image.id;
                        return (
                          <div
                            key={image.id}
                            className={`page-editor-photo-card ${selected ? "selected" : ""}`}
                          >
                            <button
                              type="button"
                              className="page-editor-photo-open"
                              onClick={() => openPhotoEditor(image)}
                              aria-label={`Edit ${image.name || `Photo ${index + 1}`}`}
                              title="Open photo editor"
                            >
                              <img
                                src={image.data}
                                alt={image.name || `Photo ${index + 1}`}
                              />
                              <span>
                                {image.name || `Photo ${index + 1}`}
                              </span>
                              <em>✎ Edit photo</em>
                            </button>

                            <button
                              type="button"
                              className="page-editor-swap-button"
                              onClick={() => {
                                if (!pageSwapSourceId) {
                                  setPageSwapSourceId(image.id);
                                } else if (pageSwapSourceId === image.id) {
                                  setPageSwapSourceId(null);
                                } else {
                                  requestAlbumSwap(
                                    pageSwapSourceId,
                                    image.id
                                  );
                                }
                              }}
                            >
                              {selected
                                ? "Selected — choose another"
                                : "↔ Select to swap"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {pageSwapSourceId && (
                      <button
                        type="button"
                        className="page-editor-secondary-button"
                        onClick={() => setPageSwapSourceId(null)}
                      >
                        Cancel photo selection
                      </button>
                    )}
                  </div>

                  <div className="page-editor-section">
                    <h3>Add / move a picture</h3>
                    <p className="page-editor-help">
                      Choose a photograph already uploaded. It will move here instead of being duplicated.
                    </p>

                    <input
                      ref={pageAddFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={handleAddPhotosToPage}
                    />

                    {editorPage.images.length < 4 && (
                      <button
                        type="button"
                        className="page-editor-upload-button"
                        onClick={() => pageAddFileInputRef.current?.click()}
                      >
                        ＋ Upload new picture{editorPage.images.length < 3 ? "s" : ""}
                      </button>
                    )}

                    {editorPage.images.length >= 4 ? (
                      <div className="page-editor-limit">This page already has the maximum of 4 photographs.</div>
                    ) : otherImages.length ? (
                      <div className="page-editor-add-grid">
                        {otherImages.map((image) => (
                          <button
                            key={image.id}
                            type="button"
                            className="page-editor-add-card"
                            onClick={() => addExistingImageToPage(image.id, editorPage.id)}
                          >
                            <img src={image.data} alt={image.name || "Uploaded photo"} />
                            <span>＋ Add</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="page-editor-limit">All uploaded photographs are already on this page.</div>
                    )}
                  </div>

                  <div className="page-editor-section">
                    <h3>Change photo framing</h3>
                    <p className="page-editor-help">
                      This changes the composition of this page only. Other pages stay untouched.
                    </p>
                    <div className="page-editor-layout-grid">
                      {[
                        { id: "classic", label: "Classic" },
                        { id: "editorial", label: "Editorial" },
                        { id: "collage", label: "Collage" },
                        { id: "story", label: "Story" },
                      ].map((layout) => (
                        <button
                          key={layout.id}
                          type="button"
                          className={
                            getPageDesign(editorPage) === layout.id
                              ? "active-page-layout"
                              : ""
                          }
                          onClick={() =>
                            changePageLayout(
                              editorPage.id,
                              layout.id as AlbumDesign
                            )
                          }
                        >
                          {layout.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <footer className="album-page-editor-footer">
                  <button
                    type="button"
                    className="page-editor-close-button"
                    onClick={closePageEditor}
                  >
                    Done
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}

        {pendingAlbumSwap && (
          <div
            className="album-swap-confirm-backdrop"
            onMouseDown={() => setPendingAlbumSwap(null)}
          >
            <section
              className="album-swap-confirm-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="album-swap-preview">
                <img
                  src={images.find((image) => image.id === pendingAlbumSwap.fromId)?.data || ""}
                  alt="First photo"
                />
                <span>↔</span>
                <img
                  src={images.find((image) => image.id === pendingAlbumSwap.toId)?.data || ""}
                  alt="Second photo"
                />
              </div>
              <h2>Interchange these photos?</h2>
              <p>
                The two photographs will swap their current positions. Their frames will stay where they are.
              </p>
              <div className="album-swap-confirm-actions">
                <button
                  type="button"
                  onClick={() => setPendingAlbumSwap(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-swap-button"
                  onClick={confirmAlbumSwap}
                >
                  Yes, interchange
                </button>
              </div>
            </section>
          </div>
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
                        : faceDetectionError
                          ? `⚠️ ${faceDetectionError}`
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