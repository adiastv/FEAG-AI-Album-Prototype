import { NextResponse } from "next/server";

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


// =====================================================
// LOCAL PYTHON LANDMARK API
// =====================================================

const LANDMARK_API_URL =
  "http://127.0.0.1:8000/detect-landmark";


// =====================================================
// CALL PYTHON DETECTOR
// =====================================================

async function detectImage(

  imageBlob: Blob,

): Promise<LandmarkApiResponse> {

  try {

    const formData =
      new FormData();


    formData.append(

      "file",

      imageBlob,

      "image.jpg",

    );


    const response =
      await fetch(

        LANDMARK_API_URL,

        {

          method: "POST",

          body: formData,

        },

      );


    if (!response.ok) {

      throw new Error(

        `Python detector returned ${response.status}`,

      );

    }


    return await response.json();

  } catch (error) {

    console.error(

      "Python detector failed:",

      error,

    );


    return {

      success: false,

      error:

        error instanceof Error

          ? error.message

          : "Image detector failed",

    };

  }

}


// =====================================================
// ANALYZE ONE IMAGE
// =====================================================

async function analyzeImage(

  image: {

    id: string;

    data: string;

  },

) {

  try {

    // ===============================================
    // CONVERT IMAGE DATA TO BLOB
    // ===============================================

    const imageResponse =
      await fetch(

        image.data,

      );


    const imageBlob =
      await imageResponse.blob();


    // ===============================================
    // SEND IMAGE TO PYTHON AI
    // ===============================================

    const result =
      await detectImage(

        imageBlob,

      );


    // ===============================================
    // IF DETECTION FAILED
    // ===============================================

    if (

      !result.success

    ) {

      return {

        id:

          image.id,


        labels: [],


        famousLandmarkLabels: [],


        landmarkLabels: [],


        finalLabel:

          "Unknown Location",


        finalConfidence:

          0,


        detectionType:

          "failed",


        isMonumentLike:

          false,

      };

    }


    // ===============================================
    // PYTHON MAKES THE FINAL DECISION
    //
    // Examples:
    //
    // Taj Mahal
    //
    // Steel bridge
    //
    // Temple
    //
    // Historical monument
    //
    // Park
    // ===============================================

    return {

      id:

        image.id,


      // =============================================
      // GENERAL OBJECT / PLACE DETECTIONS
      // =============================================

      labels:

        result.labels ||

        [],


      // =============================================
      // FAMOUS LANDMARK CANDIDATES
      //
      // You don't need to display these.
      // =============================================

      famousLandmarkLabels:

        result.famousLabels ||

        [],


      // =============================================
      // FRONTEND COMPATIBILITY
      // =============================================

      landmarkLabels:

        result.famousLabels ||

        [],


      lucknowLabels: [],


      historicalLabels: [],


      architectureLabels: [],


      // =============================================
      // FINAL AI DECISION
      // =============================================

      finalLabel:

        result.bestLabel ||

        "Unknown Location",


      finalConfidence:

        result.bestConfidence ||

        0,


      detectionType:

        result.detectionType ||

        "unknown",


      isMonumentLike:

        result.isMonumentLike ||

        false,

    };

  } catch (error) {

    console.error(

      `Image analysis failed for ${image.id}:`,

      error,

    );


    return {

      id:

        image.id,


      labels: [],


      famousLandmarkLabels: [],


      landmarkLabels: [],


      lucknowLabels: [],


      historicalLabels: [],


      architectureLabels: [],


      finalLabel:

        "Unknown Location",


      finalConfidence:

        0,


      detectionType:

        "failed",


      isMonumentLike:

        false,

    };

  }

}


// =====================================================
// POST API
// =====================================================

export async function POST(

  request: Request,

) {

  try {

    const {

      images,

    } = await request.json();


    // ===============================================
    // VALIDATE
    // ===============================================

    if (

      !images ||

      !Array.isArray(

        images,

      ) ||

      images.length === 0

    ) {

      return NextResponse.json(

        {

          success:

            false,


          error:

            "No images provided",

        },

        {

          status:

            400,

        },

      );

    }


    // ===============================================
    // ANALYZE ALL IMAGES
    //
    // Python is now the ONLY AI decision-maker.
    // ===============================================

    const results =
      await Promise.all(

        images.map(

          (

            image,

          ) =>

            analyzeImage(

              image,

            ),

        ),

      );


    // ===============================================
    // RETURN RESULTS
    // ===============================================

    return NextResponse.json({

      success:

        true,


      results,

    });

  } catch (error) {

    console.error(

      "Album analysis error:",

      error,

    );


    return NextResponse.json(

      {

        success:

          false,


        error:

          error instanceof Error

            ? error.message

            : "AI album analysis failed",

      },

      {

        status:

          500,

      },

    );

  }

}