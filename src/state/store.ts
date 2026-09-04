import { create } from 'zustand';
import type { CropRect, ImageItem, ImageMeta, ImportHistoryEntry, Language, Rotation } from '../types';

export type ExportStatus = 'idle' | 'importing' | 'exporting' | 'done' | 'error';

interface ProgressState {
  current: number;
  total: number;
  message?: string;
}

interface Store {
  items: ImageItem[];
  status: ExportStatus;
  progress: ProgressState;
  lastError?: string;
  language: Language;
  importHistory: ImportHistoryEntry[];

  addImages: (metas: ImageMeta[]) => void;
  removeImage: (id: string) => void;
  clear: () => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  moveById: (activeId: string, overId: string) => void;
  rotateCw: (id: string) => void;
  rotateCcw: (id: string) => void;
  setRotation: (id: string, rotation: Rotation) => void;
  setCrop: (id: string, crop: CropRect | undefined) => void;

  setStatus: (status: ExportStatus) => void;
  setProgress: (current: number, total: number, message?: string) => void;
  setError: (message?: string) => void;
  setLanguage: (language: Language) => void;
  recordImport: (entry: Omit<ImportHistoryEntry, 'id' | 'importedAt'>) => void;
  clearImportHistory: () => void;
}

const readLanguage = (): Language => {
  try {
    return localStorage.getItem('image2pdf.language') === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
};

const readHistory = (): ImportHistoryEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem('image2pdf.importHistory') ?? '[]');
    return Array.isArray(parsed) ? (parsed as ImportHistoryEntry[]).slice(0, 50) : [];
  } catch {
    return [];
  }
};

const saveHistory = (entries: ImportHistoryEntry[]) => {
  try {
    localStorage.setItem('image2pdf.importHistory', JSON.stringify(entries));
  } catch {
    // History is optional; importing must still work when storage is unavailable.
  }
};

const normalizeRotation = (deg: number): Rotation => {
  const n = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  return n as Rotation;
};

// Dimensions of the image AFTER a given rotation, given the original.
const dimsAtRotation = (
  origW: number,
  origH: number,
  rotation: Rotation,
): { w: number; h: number } =>
  rotation === 90 || rotation === 270
    ? { w: origH, h: origW }
    : { w: origW, h: origH };

// Rotate a crop rect that is expressed in the "currently rotated" coordinate
// system into the coordinate system after applying an additional 90° CW step.
// Container dims (`w`, `h`) are the image dimensions BEFORE the new rotation.
const rotateCrop90 = (
  crop: CropRect,
  w: number,
  h: number,
  direction: 'cw' | 'ccw',
): CropRect =>
  direction === 'cw'
    ? {
        x: Math.max(0, h - crop.y - crop.height),
        y: crop.x,
        width: crop.height,
        height: crop.width,
      }
    : {
        x: crop.y,
        y: Math.max(0, w - crop.x - crop.width),
        width: crop.height,
        height: crop.width,
      };

const applyRotation = (
  item: ImageItem,
  direction: 'cw' | 'ccw',
): ImageItem => {
  const nextRotation = normalizeRotation(item.rotation + (direction === 'cw' ? 90 : -90));
  const { w, h } = dimsAtRotation(item.width, item.height, item.rotation);
  const nextCrop = item.crop ? rotateCrop90(item.crop, w, h, direction) : undefined;
  return { ...item, rotation: nextRotation, crop: nextCrop };
};

const moveArray = <T,>(arr: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || from >= arr.length) return arr;
  const clampedTo = Math.max(0, Math.min(arr.length - 1, to));
  const copy = arr.slice();
  const [picked] = copy.splice(from, 1);
  copy.splice(clampedTo, 0, picked);
  return copy;
};

export const useStore = create<Store>((set) => ({
  items: [],
  status: 'idle',
  progress: { current: 0, total: 0 },
  lastError: undefined,
  language: readLanguage(),
  importHistory: readHistory(),

  addImages: (metas) =>
    set((s) => {
      const existingPaths = new Set(s.items.map((i) => i.path));
      const additions: ImageItem[] = metas
        .filter((m) => {
          if (existingPaths.has(m.path)) return false;
          existingPaths.add(m.path);
          return true;
        })
        .map((m) => ({ ...m, rotation: 0 as Rotation }));
      return { items: [...s.items, ...additions] };
    }),

  removeImage: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  clear: () => set({ items: [], progress: { current: 0, total: 0 }, status: 'idle', lastError: undefined }),

  reorder: (fromIndex, toIndex) =>
    set((s) => ({ items: moveArray(s.items, fromIndex, toIndex) })),

  moveById: (activeId, overId) =>
    set((s) => {
      const from = s.items.findIndex((i) => i.id === activeId);
      const to = s.items.findIndex((i) => i.id === overId);
      if (from === -1 || to === -1) return s;
      return { items: moveArray(s.items, from, to) };
    }),

  rotateCw: (id) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? applyRotation(i, 'cw') : i)),
    })),

  rotateCcw: (id) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? applyRotation(i, 'ccw') : i)),
    })),

  setRotation: (id, rotation) =>
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i;
        // Absolute rotation set: existing crop coordinates no longer make sense
        // in the new orientation, so we drop it. Users can re-crop afterwards.
        const next = normalizeRotation(rotation);
        return next === i.rotation ? i : { ...i, rotation: next, crop: undefined };
      }),
    })),

  setCrop: (id, crop) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, crop } : i)),
    })),

  setStatus: (status) => set({ status }),
  setProgress: (current, total, message) => set({ progress: { current, total, message } }),
  setError: (message) => set({ lastError: message, status: message ? 'error' : 'idle' }),
  setLanguage: (language) => {
    try {
      localStorage.setItem('image2pdf.language', language);
    } catch {
      // Keep the in-memory preference when persistent storage is unavailable.
    }
    set({ language });
  },
  recordImport: (entry) =>
    set((state) => {
      const importHistory = [
        {
          ...entry,
          id: crypto.randomUUID(),
          importedAt: new Date().toISOString(),
        },
        ...state.importHistory,
      ].slice(0, 50);
      saveHistory(importHistory);
      return { importHistory };
    }),
  clearImportHistory: () => {
    saveHistory([]);
    set({ importHistory: [] });
  },
}));
