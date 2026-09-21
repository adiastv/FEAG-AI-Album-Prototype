import type {
  EventType,
  PhotoAnalysis,
  PhotoGroup,
} from "./types";

interface GroupCandidate {
  name: string;
  keywords: string[];
}

const SECTION_CANDIDATES: Record<EventType, GroupCandidate[]> = {
  wedding: [
    {
      name: "Getting Ready",
      keywords: [
        "getting ready",
        "preparation",
        "makeup",
        "dress",
        "bride",
        "groom",
      ],
    },
    {
      name: "Haldi",
      keywords: ["haldi", "turmeric", "yellow", "ceremony"],
    },
    {
      name: "Mehendi",
      keywords: ["mehendi", "henna", "hands", "ceremony"],
    },
    {
      name: "Sangeet",
      keywords: [
        "sangeet",
        "dance",
        "performance",
        "stage",
      ],
    },
    {
      name: "Ceremony",
      keywords: [
        "ceremony",
        "mandap",
        "ritual",
        "wedding",
        "vows",
      ],
    },
    {
      name: "Reception",
      keywords: [
        "reception",
        "party",
        "dance",
        "stage",
        "celebration",
      ],
    },
    {
      name: "Family & Friends",
      keywords: [
        "family",
        "friends",
        "group",
        "people",
      ],
    },
  ],

  birthday: [
    {
      name: "Decorations",
      keywords: [
        "decoration",
        "decor",
        "balloons",
        "birthday",
      ],
    },
    {
      name: "Guests",
      keywords: [
        "guests",
        "friends",
        "family",
        "people",
        "group",
      ],
    },
    {
      name: "Cake",
      keywords: [
        "cake",
        "birthday cake",
        "candles",
      ],
    },
    {
      name: "Gifts",
      keywords: [
        "gift",
        "present",
        "presents",
      ],
    },
    {
      name: "Celebration",
      keywords: [
        "celebration",
        "party",
        "dance",
        "fun",
      ],
    },
  ],

  travel: [
    {
      name: "Arrival",
      keywords: [
        "arrival",
        "airport",
        "train",
        "travel",
        "journey",
      ],
    },
    {
      name: "Places",
      keywords: [
        "landscape",
        "landmark",
        "monument",
        "building",
        "city",
      ],
    },
    {
      name: "People",
      keywords: [
        "people",
        "portrait",
        "friends",
        "family",
      ],
    },
    {
      name: "Food",
      keywords: [
        "food",
        "restaurant",
        "meal",
        "dish",
      ],
    },
    {
      name: "Activities",
      keywords: [
        "activity",
        "adventure",
        "sport",
        "hiking",
        "beach",
      ],
    },
  ],

  college: [
    {
      name: "Campus",
      keywords: [
        "campus",
        "college",
        "university",
        "building",
      ],
    },
    {
      name: "Students",
      keywords: [
        "student",
        "students",
        "class",
        "group",
      ],
    },
    {
      name: "Activities",
      keywords: [
        "activity",
        "event",
        "competition",
        "club",
      ],
    },
    {
      name: "Performances",
      keywords: [
        "performance",
        "stage",
        "dance",
        "music",
      ],
    },
    {
      name: "Ceremony",
      keywords: [
        "ceremony",
        "graduation",
        "award",
      ],
    },
  ],

  corporate: [
    {
      name: "Venue",
      keywords: [
        "conference",
        "venue",
        "office",
        "building",
      ],
    },
    {
      name: "Presentations",
      keywords: [
        "presentation",
        "speaker",
        "screen",
        "meeting",
      ],
    },
    {
      name: "Team",
      keywords: [
        "team",
        "employees",
        "group",
        "people",
      ],
    },
    {
      name: "Networking",
      keywords: [
        "networking",
        "conversation",
        "meeting",
        "people",
      ],
    },
  ],

  sports: [
    {
      name: "Venue",
      keywords: [
        "stadium",
        "arena",
        "field",
        "court",
      ],
    },
    {
      name: "Action",
      keywords: [
        "sports",
        "athlete",
        "player",
        "competition",
      ],
    },
    {
      name: "Teams",
      keywords: [
        "team",
        "players",
        "group",
      ],
    },
    {
      name: "Celebration",
      keywords: [
        "celebration",
        "victory",
        "trophy",
      ],
    },
  ],

  fashion: [
    {
      name: "Runway",
      keywords: [
        "runway",
        "fashion",
        "model",
        "catwalk",
      ],
    },
    {
      name: "Portraits",
      keywords: [
        "portrait",
        "model",
        "fashion",
      ],
    },
    {
      name: "Behind the Scenes",
      keywords: [
        "behind",
        "backstage",
        "studio",
        "preparation",
      ],
    },
  ],

  concert: [
    {
      name: "Stage",
      keywords: [
        "stage",
        "concert",
        "performer",
        "musician",
      ],
    },
    {
      name: "Audience",
      keywords: [
        "audience",
        "crowd",
        "people",
      ],
    },
    {
      name: "Performance",
      keywords: [
        "performance",
        "singer",
        "guitar",
        "music",
      ],
    },
  ],

  festival: [
    {
      name: "Decorations",
      keywords: [
        "decoration",
        "festival",
        "lights",
      ],
    },
    {
      name: "Celebration",
      keywords: [
        "celebration",
        "festival",
        "crowd",
      ],
    },
    {
      name: "People",
      keywords: [
        "people",
        "family",
        "friends",
        "group",
      ],
    },
  ],

  party: [
    {
      name: "Decorations",
      keywords: [
        "decoration",
        "balloons",
        "lights",
      ],
    },
    {
      name: "Guests",
      keywords: [
        "guests",
        "friends",
        "people",
        "group",
      ],
    },
    {
      name: "Celebration",
      keywords: [
        "party",
        "dance",
        "celebration",
      ],
    },
  ],

  family: [
    {
      name: "Family Portraits",
      keywords: [
        "family",
        "portrait",
        "group",
      ],
    },
    {
      name: "Activities",
      keywords: [
        "family",
        "activity",
        "outdoor",
      ],
    },
    {
      name: "Candid Moments",
      keywords: [
        "people",
        "candid",
        "family",
      ],
    },
  ],

  vacation: [
    {
      name: "Arrival",
      keywords: [
        "arrival",
        "hotel",
        "airport",
        "travel",
      ],
    },
    {
      name: "Exploring",
      keywords: [
        "sightseeing",
        "landmark",
        "city",
        "travel",
      ],
    },
    {
      name: "Relaxing",
      keywords: [
        "beach",
        "pool",
        "hotel",
        "vacation",
      ],
    },
    {
      name: "People",
      keywords: [
        "people",
        "friends",
        "family",
        "portrait",
      ],
    },
  ],

  product: [
    {
      name: "Product",
      keywords: [
        "product",
        "object",
        "commercial",
      ],
    },
    {
      name: "Details",
      keywords: [
        "detail",
        "close-up",
        "product",
      ],
    },
    {
      name: "Lifestyle",
      keywords: [
        "lifestyle",
        "person",
        "product",
      ],
    },
  ],

  nature: [
    {
      name: "Landscapes",
      keywords: [
        "landscape",
        "mountain",
        "nature",
        "scenery",
      ],
    },
    {
      name: "Wildlife",
      keywords: [
        "animal",
        "wildlife",
        "bird",
      ],
    },
    {
      name: "Outdoor",
      keywords: [
        "outdoor",
        "forest",
        "nature",
      ],
    },
  ],

  other: [
    {
      name: "Highlights",
      keywords: [],
    },
  ],
};

function scoreSection(
  photo: PhotoAnalysis,
  candidate: GroupCandidate
): number {
  if (candidate.keywords.length === 0) {
    return 0.1;
  }

  const searchableText = [
    photo.event,
    photo.section ?? "",
    ...photo.labels,
  ]
    .join(" ")
    .toLowerCase();

  let matches = 0;

  for (const keyword of candidate.keywords) {
    if (searchableText.includes(keyword.toLowerCase())) {
      matches++;
    }
  }

  if (matches === 0) {
    return 0;
  }

  return matches / candidate.keywords.length;
}

function chooseSection(
  photo: PhotoAnalysis
): {
  name: string;
  confidence: number;
} {
  const candidates =
    SECTION_CANDIDATES[photo.event] ??
    SECTION_CANDIDATES.other;

  const scored = candidates
    .map((candidate) => ({
      name: candidate.name,
      confidence: scoreSection(photo, candidate),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];

  if (!best || best.confidence === 0) {
    return {
      name: "Highlights",
      confidence: 0.2,
    };
  }

  return best;
}

export function groupPhotos(
  photos: PhotoAnalysis[]
): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();

  for (const photo of photos) {
    const section = chooseSection(photo);

    const key = `${photo.event}:${section.name}`;

    if (!groups.has(key)) {
      groups.set(key, {
        id: `group-${groups.size + 1}`,
        name: section.name,
        event: photo.event,
        photoIds: [],
        confidence: section.confidence,
        order: groups.size,
      });
    }

    const group = groups.get(key)!;

    group.photoIds.push(photo.id);

    group.confidence =
      (group.confidence + section.confidence) / 2;
  }

  return Array.from(groups.values());
}

export function assignSections(
  photos: PhotoAnalysis[]
): PhotoAnalysis[] {
  return photos.map((photo) => {
    const section = chooseSection(photo);

    return {
      ...photo,
      section: section.name,
      sectionConfidence: section.confidence,
    };
  });
}