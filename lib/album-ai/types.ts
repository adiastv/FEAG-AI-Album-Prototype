export type PhotoOrientation =
  | "portrait"
  | "landscape"
  | "square"
  | "panorama";

export type EventType =
  | "wedding"
  | "birthday"
  | "travel"
  | "college"
  | "corporate"
  | "sports"
  | "fashion"
  | "concert"
  | "festival"
  | "party"
  | "family"
  | "vacation"
  | "product"
  | "nature"
  | "other";

export interface EventSection {
  id: string;
  name: string;
  eventType: EventType;
  confidence: number;
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

export interface FocalPoint {
  x: number;
  y: number;
}

export interface PhotoAnalysis {
  id: string;
  fileName?: string;
  event: EventType;
  eventConfidence: number;
  section?: string;
  sectionConfidence?: number;
  width?: number;
  height?: number;
  orientation: PhotoOrientation;
  peopleCount: number;
  faces: FaceBox[];
  focalPoint?: FocalPoint;
  labels: string[];
  qualityScore: number;
  isDuplicate?: boolean;
  similarityScore?: number;
}

export interface PhotoGroup {
  id: string;
  name: string;
  event: EventType;
  photoIds: string[];
  confidence: number;
  order: number;
}

export type LayoutType =
  | "fullBleed"
  | "hero"
  | "heroTwo"
  | "twoPortraits"
  | "threeColumn"
  | "fourGrid"
  | "splitHorizontal"
  | "splitVertical"
  | "asymmetric"
  | "cinematic"
  | "collage";

export interface PhotoSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  objectFit: "cover" | "contain";
  photoId?: string;
  focalPoint?: FocalPoint;
}

export interface AlbumLayout {
  id: string;
  type: LayoutType;
  slots: PhotoSlot[];
  spacing: number;
  borderRadius: number;
}

export type FrameStyle =
  | "none"
  | "minimal"
  | "classic"
  | "editorial"
  | "cinematic"
  | "decorative"
  | "fullBleed";

export interface FrameConfig {
  style: FrameStyle;
  thickness: number;
  color?: string;
  padding: number;
}

export interface AlbumPage {
  id: string;
  sectionId: string;
  order: number;
  layout: AlbumLayout;
  frame: FrameConfig;
  photoIds: string[];
  title?: string;
}

export interface GeneratedAlbum {
  id: string;
  title: string;
  eventType: EventType;
  photos: PhotoAnalysis[];
  groups: PhotoGroup[];
  pages: AlbumPage[];
  createdAt: string;
}
