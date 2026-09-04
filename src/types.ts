export type Rotation = 0 | 90 | 180 | 270;
export type Language = 'en' | 'zh';

export interface ImportHistoryEntry {
  id: string;
  importedAt: string;
  files: string[];
  imported: number;
  skipped: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageItem {
  id: string;
  path: string;
  fileName: string;
  width: number;
  height: number;
  thumbnail: string;
  rotation: Rotation;
  crop?: CropRect;
}

export interface ImageMeta {
  id: string;
  path: string;
  fileName: string;
  width: number;
  height: number;
  thumbnail: string;
}

export interface ImageError {
  path: string;
  message: string;
}

export interface AddImagesResult {
  items: ImageMeta[];
  errors: ImageError[];
}
