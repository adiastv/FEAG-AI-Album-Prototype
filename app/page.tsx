"use client";

/* eslint-disable @next/next/no-img-element -- The moderation preview uses user-provided data URLs. */

import { useState } from "react";

interface StoredImage {
  id: string;
  name: string;
  data: string;

  moderation?: {
    nsfw: number;
    gore: number;
    violence: number;
    status: "SAFE" | "REVIEW" | "BLOCK";
  };
}

export default function Home() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Upload multiple images
  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const imagePromises = fileArray.map(
      (file) =>
        new Promise<StoredImage>((resolve) => {
          const reader = new FileReader();

          reader.onload = () => {
            resolve({
              id: crypto.randomUUID(),
              name: file.name,
              data: reader.result as string,
            });
          };

          reader.readAsDataURL(file);
        })
    );

    Promise.all(imagePromises).then((newImages) => {
      // Add images only to React state
      setImages((previousImages) => [
        ...previousImages,
        ...newImages,
      ]);
    });

    // Allows the same file to be uploaded again if needed
    event.target.value = "";
  };

  // Detect ONE image and return the result
  const detectSingleImage = async (
    image: StoredImage
  ): Promise<StoredImage> => {
    const response = await fetch("/api/detect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: image.data,
      }),
    });

    const data = await response.json();

    console.log(
      `Detection Result for ${image.name}:`,
      data
    );

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || `Detection failed for ${image.name}`
      );
    }

    const result = data.result;

    // Gore score
    const goreScore = result.gore?.prob ?? 0;

    // Violence score
    const violenceScore = result.violence?.prob ?? 0;

    // NSFW score
    const nsfwScore = Math.max(
      result.nudity?.sexual_activity ?? 0,
      result.nudity?.sexual_display ?? 0,
      result.nudity?.erotica ?? 0
    );

    // Final moderation status
    let status: "SAFE" | "REVIEW" | "BLOCK" = "SAFE";

    if (
      goreScore >= 0.5 ||
      violenceScore >= 0.7 ||
      nsfwScore >= 0.7
    ) {
      status = "BLOCK";
    } else if (
      goreScore >= 0.2 ||
      violenceScore >= 0.3 ||
      nsfwScore >= 0.3
    ) {
      status = "REVIEW";
    }

    return {
      ...image,
      moderation: {
        nsfw: nsfwScore,
        gore: goreScore,
        violence: violenceScore,
        status,
      },
    };
  };

  // Submit entire portfolio for AI detection
  const submitPortfolio = async () => {
    if (images.length === 0) {
      alert("Please upload portfolio images first.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Detect all images
      const detectedImages = await Promise.all(
        images.map((image) => detectSingleImage(image))
      );

      // Sort images:
      // SAFE → REVIEW → BLOCK
      const statusPriority = {
        SAFE: 1,
        REVIEW: 2,
        BLOCK: 3,
      };

      const sortedImages = [...detectedImages].sort(
        (a, b) =>
          statusPriority[a.moderation!.status] -
          statusPriority[b.moderation!.status]
      );

      // Update React state
      setImages(sortedImages);

    } catch (error) {
      console.error(
        "Portfolio detection error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong while checking the portfolio."
      );

    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete image
  const deleteImage = (id: string) => {
    setImages((previousImages) =>
      previousImages.filter(
        (image) => image.id !== id
      )
    );
  };

  // Check whether portfolio contains blocked media
  const hasBlockedMedia = images.some(
    (image) => image.moderation?.status === "BLOCK"
  );

  // Count blocked images
  const blockedMediaCount = images.filter(
    (image) => image.moderation?.status === "BLOCK"
  ).length;

  return (
    <main style={{ padding: "40px" }}>
      <h1>FEAG AI Portfolio Detection Test</h1>

      <br />

      {/* Upload Multiple Images */}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        disabled={isSubmitting}
      />

      <br />
      <br />

      {/* Submit Portfolio */}
      <button
        onClick={submitPortfolio}
        disabled={images.length === 0 || isSubmitting}
      >
        {isSubmitting
          ? "Analyzing Portfolio..."
          : "Submit Portfolio"}
      </button>

      {/* Blocked Portfolio Message */}
      {hasBlockedMedia && (
        <div
          style={{
            marginTop: "25px",
            marginBottom: "25px",
            padding: "15px",
            border: "2px solid red",
          }}
        >
          <strong>
            ⚠ Portfolio media has been blocked.
          </strong>

          <p>
            {blockedMediaCount} media file
            {blockedMediaCount !== 1 ? "s" : ""} violated
            {" "}FEAG&apos;s portfolio content guidelines.
          </p>
        </div>
      )}

      <h2>
        Uploaded Images ({images.length})
      </h2>

      {images.length === 0 && (
        <p>No images uploaded yet.</p>
      )}

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {images.map((image) => (
          <div
            key={image.id}
            style={{
              width: "220px",
              padding: "10px",
              border: "1px solid #ccc",
            }}
          >
            <img
              src={image.data}
              alt={image.name}
              width={200}
              style={{
                maxHeight: "250px",
                objectFit: "cover",
              }}
            />

            <p>{image.name}</p>

            {/* Detection Results */}
            {image.moderation && (
              <div>
                <strong>
                  Status: {image.moderation.status}
                </strong>

                <p>
                  NSFW Score:{" "}
                  {(image.moderation.nsfw * 100).toFixed(2)}%
                </p>

                <p>
                  Gore Score:{" "}
                  {(image.moderation.gore * 100).toFixed(2)}%
                </p>

                <p>
                  Violence Score:{" "}
                  {(image.moderation.violence * 100).toFixed(2)}%
                </p>
              </div>
            )}

            <button
              onClick={() => deleteImage(image.id)}
              disabled={isSubmitting}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
