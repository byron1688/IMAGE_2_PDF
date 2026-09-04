import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import type { AddImagesResult, CropRect, ImageItem, Rotation } from './types';

export const EXPORT_PROGRESS_EVENT = 'export://progress';

export interface ExportProgressPayload {
  current: number;
  total: number;
}

export const onExportProgress = (
  handler: (p: ExportProgressPayload) => void,
): Promise<UnlistenFn> =>
  listen<ExportProgressPayload>(EXPORT_PROGRESS_EVENT, (e) => handler(e.payload));

export interface PdfItemPayload {
  path: string;
  rotation: Rotation;
  crop?: CropRect;
}

export const toPdfItems = (items: ImageItem[]): PdfItemPayload[] =>
  items.map((i) => ({ path: i.path, rotation: i.rotation, crop: i.crop }));

export const addImages = (paths: string[]): Promise<AddImagesResult> =>
  invoke<AddImagesResult>('add_images', { paths });

export const exportPdf = (items: PdfItemPayload[], outputPath: string): Promise<void> =>
  invoke<void>('export_pdf', { items, outputPath });

export interface PreviewImage {
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
}

export const readImageDataUrl = (path: string, rotation: number): Promise<PreviewImage> =>
  invoke<PreviewImage>('read_image_data_url', { path, rotation });

export const revealInFolder = (path: string): Promise<void> =>
  invoke<void>('reveal_in_folder', { path });

export const pickSavePath = (): Promise<string | null> =>
  save({
    title: 'Export PDF',
    defaultPath: 'images.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  }).then((p) => (typeof p === 'string' ? p : null));
