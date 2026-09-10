import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        {
          success: false,
          error: "No image provided",
        },
        { status: 400 }
      );
    }

    // Convert Base64 image into a Blob
    const imageResponse = await fetch(image);
    const imageBlob = await imageResponse.blob();

    // Create FormData for Sightengine
    const formData = new FormData();

    formData.append(
      "media",
      imageBlob,
      "image.jpg"
    );

    // Moderation models
    formData.append(
      "models",
      "nudity-2.1,gore-2.0,violence"
    );

    formData.append(
      "api_user",
      process.env.SIGHTENGINE_API_USER || ""
    );

    formData.append(
      "api_secret",
      process.env.SIGHTENGINE_API_SECRET || ""
    );

    // Send image to Sightengine
    const response = await fetch(
      "https://api.sightengine.com/1.0/check.json",
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    // Log complete Sightengine response
    console.log(
      "Sightengine Response:",
      JSON.stringify(result, null, 2)
    );

    // Check HTTP error
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error?.message ||
            "Sightengine API request failed",
          details: result,
        },
        {
          status: response.status,
        }
      );
    }

    // Check Sightengine API error
    if (result.status === "failure") {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error?.message ||
            "Sightengine detection failed",
          details: result,
        },
        { status: 400 }
      );
    }

    // Successful detection
    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error(
      "Detection error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Image detection failed",
      },
      { status: 500 }
    );
  }
}