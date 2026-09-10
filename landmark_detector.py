from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from transformers import CLIPProcessor, CLIPModel
from PIL import Image

import io
import math
import torch


# =====================================================
# FASTAPI APP
# =====================================================

app = FastAPI()


# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# LOAD CLIP MODEL
# =====================================================

MODEL_NAME = "openai/clip-vit-base-patch32"

print("Loading CLIP model...")

model = CLIPModel.from_pretrained(
    MODEL_NAME
)

processor = CLIPProcessor.from_pretrained(
    MODEL_NAME
)

model.eval()

print("CLIP model loaded successfully!")


# =====================================================
# FAMOUS LANDMARK DEFINITIONS
#
# IMPORTANT:
#
# Instead of giving CLIP only the landmark name,
# we give it visual characteristics.
#
# This is especially important for:
#
# Taj Mahal vs Victoria Memorial
#
# because both can look like large white buildings
# with domes.
# =====================================================

FAMOUS_LANDMARKS = {

    "Taj Mahal": [
        "the Taj Mahal in Agra India",
        "the famous Taj Mahal white marble mausoleum",
        "the Taj Mahal with a large white onion dome and four minarets",
        "white marble Mughal architecture with four tall minarets",
        "a symmetrical white marble mausoleum in Agra",
        "people standing in front of the Taj Mahal",
    ],

    "Red Fort": [
        "the Red Fort in Delhi India",
        "the famous Red Fort made of red sandstone",
        "a large red sandstone Mughal fort in Delhi",
        "the Red Fort with massive red walls",
    ],

    "India Gate": [
        "India Gate in New Delhi India",
        "the India Gate war memorial arch",
        "a large stone triumphal arch in Delhi",
        "the famous India Gate monument",
    ],

    "Qutub Minar": [
        "Qutub Minar in Delhi India",
        "the tall Qutub Minar stone tower",
        "a historic Indian minaret tower",
        "the famous Qutub Minar monument",
    ],

    "Gateway of India": [
        "the Gateway of India in Mumbai",
        "the famous Gateway of India stone arch",
        "a monumental waterfront arch in Mumbai",
        "people standing near the Gateway of India",
    ],

    "Hawa Mahal": [
        "Hawa Mahal in Jaipur India",
        "the pink Hawa Mahal palace facade",
        "a pink sandstone palace with many small windows",
        "the famous Palace of Winds in Jaipur",
    ],

    "Amer Fort": [
        "Amer Fort in Jaipur India",
        "the historic Amer Fort in Rajasthan",
        "a large Indian hill fort palace",
        "the sandstone Amer Fort",
    ],

    "Mysore Palace": [
        "Mysore Palace in India",
        "the ornate Mysore Palace with domes",
        "a grand illuminated Indian royal palace",
        "the famous Mysore Palace architecture",
    ],

    "Golden Temple": [
        "the Golden Temple in Amritsar India",
        "the Harmandir Sahib covered in golden architecture",
        "the Golden Temple beside the sacred water pool",
        "a golden Sikh temple reflected in water",
    ],

    "Victoria Memorial": [
        "Victoria Memorial in Kolkata India",
        "the Victoria Memorial white marble building in Kolkata",
        "a large colonial white marble memorial with a central dome",
        "the famous Victoria Memorial monument",
    ],

    "Charminar": [
        "Charminar in Hyderabad India",
        "the Charminar monument with four tall minarets",
        "a historic monument with four towers and arches",
        "the famous Charminar in Hyderabad",
    ],

    "Konark Sun Temple": [
        "Konark Sun Temple in Odisha India",
        "the ancient Konark Sun Temple stone architecture",
        "the historic stone Sun Temple of Konark",
        "ancient Indian temple carvings at Konark",
    ],

    "Meenakshi Temple": [
        "Meenakshi Temple in Madurai India",
        "a colorful South Indian temple gopuram",
        "the Meenakshi temple with detailed colorful towers",
        "a large Hindu temple with ornate gopuram architecture",
    ],

    "Lotus Temple": [
        "the Lotus Temple in Delhi India",
        "the famous white Lotus Temple shaped like a flower",
        "a white building shaped like lotus petals",
        "the Bahai Lotus Temple architecture",
    ],

    "Statue of Unity": [
        "the Statue of Unity in India",
        "the world's tallest statue of Sardar Vallabhbhai Patel",
        "a giant standing statue beside mountains and a river",
        "the famous Statue of Unity monument",
    ],

}


# =====================================================
# GENERAL PLACE / OBJECT LABELS
#
# Used ONLY when a famous landmark cannot be confidently
# identified.
#
# These labels describe WHAT IS IN THE IMAGE.
# =====================================================

GENERAL_LABELS = {

    # =================================================
    # BRIDGES / INFRASTRUCTURE
    # =================================================

    "steel bridge": [
        "a steel bridge",
        "people standing on a steel bridge",
        "a modern steel road bridge",
    ],

    "truss bridge": [
        "a steel truss bridge",
        "a metal bridge with triangular trusses",
        "people standing inside a steel truss bridge",
    ],

    "metal bridge": [
        "a metal bridge",
        "a modern metal structure bridge",
    ],

    "road bridge": [
        "a bridge carrying a road",
        "a highway bridge",
    ],

    "railway bridge": [
        "a railway bridge",
        "a train bridge",
    ],

    "bridge": [
        "a bridge",
        "people standing on a bridge",
    ],


    # =================================================
    # HISTORICAL / MONUMENTS
    # =================================================

    "historical monument": [
        "a historical monument",
        "an ancient historical structure",
        "a famous historical landmark",
    ],

    "heritage monument": [
        "a heritage monument",
        "a protected historical structure",
    ],

    "historical building": [
        "a historical building",
        "an old heritage building",
    ],

    "historic architecture": [
        "historic architecture",
        "ancient architectural structure",
    ],

    "memorial": [
        "a memorial monument",
        "a commemorative monument",
    ],


    # =================================================
    # RELIGIOUS STRUCTURES
    # =================================================

    "Hindu temple": [
        "a Hindu temple",
        "an Indian Hindu temple",
        "a temple with Hindu architecture",
    ],

    "temple": [
        "a temple",
        "a religious temple building",
    ],

    "mosque": [
        "a mosque",
        "an Islamic religious building",
    ],

    "church": [
        "a church",
        "a Christian religious building",
    ],


    # =================================================
    # BUILDINGS
    # =================================================

    "palace": [
        "a palace",
        "a grand royal palace building",
    ],

    "fort": [
        "a historical fort",
        "a large fortified structure",
    ],

    "castle": [
        "a castle",
        "a fortified historic building",
    ],

    "building": [
        "a building",
        "an architectural building",
    ],

    "modern building": [
        "a modern building",
        "modern architecture",
    ],


    # =================================================
    # OUTDOOR LOCATIONS
    # =================================================

    "park": [
        "a park",
        "people standing in a public park",
    ],

    "garden": [
        "a garden",
        "a landscaped public garden",
    ],

    "riverfront": [
        "a riverfront",
        "a public area beside a river",
    ],

    "road": [
        "a road",
        "people standing beside a road",
    ],

    "street": [
        "a street",
        "an urban street",
    ],

    "highway": [
        "a highway",
        "a major road",
    ],

    "outdoor location": [
        "an outdoor location",
        "people outdoors",
    ],


    # =================================================
    # TRANSPORT
    # =================================================

    "railway station": [
        "a railway station",
        "a train station building",
    ],

    "airport": [
        "an airport",
        "an airport terminal",
    ],


    # =================================================
    # OTHER
    # =================================================

    "museum": [
        "a museum building",
        "a public museum",
    ],

    "market": [
        "a market",
        "a busy marketplace",
    ],

    "university": [
        "a university campus",
        "a university building",
    ],

}


# =====================================================
# FLATTEN PROMPTS
#
# Converts:
#
# {
#   "Taj Mahal": [
#       prompt1,
#       prompt2
#   ]
# }
#
# Into a flat list CLIP can process.
# =====================================================

def flatten_prompts(label_dictionary):

    prompts = []

    prompt_labels = []

    for label, label_prompts in label_dictionary.items():

        for prompt in label_prompts:

            prompts.append(
                prompt
            )

            prompt_labels.append(
                label
            )

    return prompts, prompt_labels


# =====================================================
# CLASSIFY IMAGE
#
# IMPORTANT:
#
# We use RAW CLIP SIMILARITY.
#
# We do NOT use softmax because softmax forces the model
# to choose one option even if none are correct.
# =====================================================

def classify_image(image, label_dictionary):

    prompts, prompt_labels = flatten_prompts(
        label_dictionary
    )


    # =================================================
    # PREPARE INPUT
    # =================================================

    inputs = processor(

        text=prompts,

        images=image,

        return_tensors="pt",

        padding=True,

    )


    # =================================================
    # RUN CLIP
    # =================================================

    with torch.no_grad():

        outputs = model(
            **inputs
        )

        logits = outputs.logits_per_image


    raw_scores = logits[0].tolist()


    # =================================================
    # GROUP SCORES BY LABEL
    # =================================================

    grouped_scores = {}

    for label, score in zip(

        prompt_labels,

        raw_scores,

    ):

        if label not in grouped_scores:

            grouped_scores[label] = []

        grouped_scores[label].append(
            float(score)
        )


    # =================================================
    # SCORE EACH LABEL
    #
    # Instead of simple average:
    #
    # We combine:
    #
    # 60% strongest prompt
    # 40% average score
    #
    # This helps when one highly specific prompt strongly
    # matches something such as the Taj Mahal.
    # =================================================

    results = []

    for label, scores in grouped_scores.items():

        best_score = max(
            scores
        )

        average_score = (

            sum(scores)

            /

            len(scores)

        )


        final_score = (

            best_score * 0.60

            +

            average_score * 0.40

        )


        results.append({

            "label": label,

            "score": float(
                final_score
            ),

            "bestPromptScore": float(
                best_score
            ),

        })


    # =================================================
    # SORT
    # =================================================

    results = sorted(

        results,

        key=lambda item:
            item["score"],

        reverse=True,

    )


    return results


# =====================================================
# SCORE TO CONFIDENCE
#
# Converts CLIP similarity into a reasonable display
# confidence.
#
# IMPORTANT:
#
# This does NOT automatically turn the highest result
# into 100%.
# =====================================================

def score_to_confidence(

    score,

    margin=0,

):

    # Base confidence from similarity score

    confidence = (

        1

        /

        (

            1

            +

            math.exp(

                -(score - 20) / 4

            )

        )

    )


    # Reward clear separation from second candidate

    margin_bonus = min(

        max(

            margin / 8,

            0,

        ),

        0.15,

    )


    confidence = min(

        confidence + margin_bonus,

        0.99,

    )


    return float(
        confidence
    )


# =====================================================
# DETERMINE IF IMAGE LOOKS LIKE A MONUMENT
#
# This helps create the distinction:
#
# Famous landmark:
#
# Taj Mahal
#
# Unidentified monument:
#
# historical monument
#
# Normal object:
#
# steel bridge
# =====================================================

MONUMENT_LIKE_LABELS = [

    "historical monument",

    "heritage monument",

    "historical building",

    "historic architecture",

    "memorial",

    "Hindu temple",

    "temple",

    "mosque",

    "church",

    "palace",

    "fort",

    "castle",

]


# =====================================================
# DETECT LANDMARK
# =====================================================

@app.post("/detect-landmark")
async def detect_landmark(

    file: UploadFile = File(...)

):

    try:

        # =============================================
        # READ IMAGE
        # =============================================

        image_bytes = await file.read()

        image = Image.open(

            io.BytesIO(
                image_bytes
            )

        ).convert("RGB")


        # =============================================
        # RUN FAMOUS LANDMARK DETECTION
        # =============================================

        famous_results = classify_image(

            image,

            FAMOUS_LANDMARKS,

        )


        # =============================================
        # RUN GENERAL OBJECT / LOCATION DETECTION
        # =============================================

        general_results = classify_image(

            image,

            GENERAL_LABELS,

        )


        # =============================================
        # BEST RESULTS
        # =============================================

        best_famous = famous_results[0]

        second_famous = famous_results[1]

        best_general = general_results[0]


        # =============================================
        # FAMOUS LANDMARK SCORES
        # =============================================

        famous_score = (

            best_famous["score"]

        )


        famous_margin = (

            best_famous["score"]

            -

            second_famous["score"]

        )


        # =============================================
        # FAMOUS LANDMARK VALIDATION
        #
        # We require:
        #
        # 1. Strong visual match
        #
        # 2. Clear difference from second landmark
        #
        # This prevents:
        #
        # steel bridge -> Statue of Unity
        #
        # random temple -> Golden Temple
        #
        # Taj Mahal -> Victoria Memorial
        # unless the model has strong evidence.
        # =============================================

        MIN_FAMOUS_SCORE = 24.0

        MIN_FAMOUS_MARGIN = 1.2


        is_famous_landmark = (

            famous_score

            >=

            MIN_FAMOUS_SCORE

            and

            famous_margin

            >=

            MIN_FAMOUS_MARGIN

        )


        # =============================================
        # SPECIAL TAJ MAHAL CHECK
        #
        # Taj Mahal has extremely distinctive features:
        #
        # - white marble
        # - central dome
        # - four minarets
        #
        # Because we added multiple visual prompts above,
        # we allow Taj Mahal to pass with a slightly
        # lower margin IF the visual score is strong.
        # =============================================

        if (

            best_famous["label"] == "Taj Mahal"

            and

            famous_score >= 23.0

            and

            famous_margin >= 0.7

        ):

            is_famous_landmark = True


        # =============================================
        # CHECK GENERAL CATEGORY
        # =============================================

        general_label = (

            best_general["label"]

        )


        is_monument_like = (

            general_label

            in

            MONUMENT_LIKE_LABELS

        )


        # =============================================
        # FINAL DECISION
        # =============================================

        if is_famous_landmark:

            # =========================================
            # CASE 1
            #
            # Famous landmark confidently detected.
            # =========================================

            final_label = (

                best_famous["label"]

            )

            final_score = (

                famous_score

            )

            final_margin = (

                famous_margin

            )

            detection_type = (

                "famous_landmark"

            )


        elif is_monument_like:

            # =========================================
            # CASE 2
            #
            # The image looks like a monument or
            # historical structure.
            #
            # But we cannot confidently identify the
            # specific famous landmark.
            #
            # Example:
            #
            # Unknown temple
            #
            # -> Hindu temple
            #
            # Unknown historical building
            #
            # -> historical monument
            # =========================================

            final_label = (

                general_label

            )

            final_score = (

                best_general["score"]

            )

            second_general = (

                general_results[1]

            )

            final_margin = (

                best_general["score"]

                -

                second_general["score"]

            )

            detection_type = (

                "monument_or_historical"

            )


        else:

            # =========================================
            # CASE 3
            #
            # Normal object or location.
            #
            # Example:
            #
            # steel bridge
            #
            # truss bridge
            #
            # park
            #
            # building
            #
            # DO NOT force it to become a monument.
            # =========================================

            final_label = (

                general_label

            )

            final_score = (

                best_general["score"]

            )

            second_general = (

                general_results[1]

            )

            final_margin = (

                best_general["score"]

                -

                second_general["score"]

            )

            detection_type = (

                "general_object_or_location"

            )


        # =============================================
        # DISPLAY CONFIDENCE
        #
        # No more automatic 100% confidence.
        # =============================================

        display_confidence = (

            score_to_confidence(

                final_score,

                final_margin,

            )

        )


        # =============================================
        # CLEAN RESULTS
        #
        # Remove internal bestPromptScore before sending
        # results to Next.js.
        # =============================================

        clean_general_results = [

            {

                "label":
                    item["label"],

                "score":
                    item["score"],

            }

            for item

            in

            general_results[:5]

        ]


        clean_famous_results = [

            {

                "label":
                    item["label"],

                "score":
                    item["score"],

            }

            for item

            in

            famous_results[:3]

        ]


        # =============================================
        # RETURN RESULT
        # =============================================

        return {

            "success": True,


            # =========================================
            # FINAL RESULT
            # =========================================

            "bestLabel":

                final_label,


            "bestConfidence":

                display_confidence,


            "detectionType":

                detection_type,


            # =========================================
            # GENERAL LABEL RESULTS
            # =========================================

            "labels":

                clean_general_results,


            # =========================================
            # FAMOUS LANDMARK RESULTS
            # =========================================

            "famousLabels":

                clean_famous_results,

        }


    except Exception as error:

        print(

            "Landmark detection error:",

            error,

        )


        return {

            "success": False,

            "error":

                str(error),

        }