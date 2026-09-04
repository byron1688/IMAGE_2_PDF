import { useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area, type Size } from 'react-easy-crop';
import { readImageDataUrl, type PreviewImage } from '../ipc';
import { t } from '../i18n';
import { useStore } from '../state/store';
import type { CropRect } from '../types';

interface Props {
  itemId: string | null;
  onClose: () => void;
}

interface Bounds {
  width: number;
  height: number;
}

const MIN_CROP_PERCENT = 10;

export function EditModal({ itemId, onClose }: Props) {
  const item = useStore((s) => s.items.find((candidate) => candidate.id === itemId));
  const rotateCw = useStore((s) => s.rotateCw);
  const rotateCcw = useStore((s) => s.rotateCcw);
  const setCrop = useStore((s) => s.setCrop);
  const language = useStore((s) => s.language);
  const cropperContainer = useRef<HTMLDivElement>(null);

  const [preview, setPreview] = useState<PreviewImage>();
  const [bounds, setBounds] = useState<Bounds>();
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropWidthPercent, setCropWidthPercent] = useState(100);
  const [cropHeightPercent, setCropHeightPercent] = useState(100);
  const [pixelCrop, setPixelCrop] = useState<CropRect>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    const element = cropperContainer.current;
    if (!element) return;
    const updateBounds = () => {
      const rect = element.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(element);
    return () => observer.disconnect();
  }, [itemId]);

  useEffect(() => {
    if (!item) {
      setPreview(undefined);
      setPixelCrop(undefined);
      setCropPosition({ x: 0, y: 0 });
      setZoom(1);
      setCropWidthPercent(100);
      setCropHeightPercent(100);
      setLoadError(undefined);
      return;
    }

    let cancelled = false;
    setPreview(undefined);
    setPixelCrop(item.crop);
    setCropPosition({ x: 0, y: 0 });
    setZoom(1);
    setLoadError(undefined);
    readImageDataUrl(item.path, item.rotation)
      .then((next) => {
        if (cancelled) return;
        setPreview(next);
        setCropWidthPercent(
          item.crop ? Math.max(MIN_CROP_PERCENT, (item.crop.width / next.originalWidth) * 100) : 100,
        );
        setCropHeightPercent(
          item.crop ? Math.max(MIN_CROP_PERCENT, (item.crop.height / next.originalHeight) * 100) : 100,
        );
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
    // Crop is local until Apply, except for the synchronous save before rotate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.path, item?.rotation]);

  const containedMediaSize = useMemo<Size | undefined>(() => {
    if (!preview || !bounds || bounds.width <= 0 || bounds.height <= 0) return undefined;
    const scale = Math.min(
      bounds.width / preview.previewWidth,
      bounds.height / preview.previewHeight,
    );
    return {
      width: preview.previewWidth * scale,
      height: preview.previewHeight * scale,
    };
  }, [bounds, preview]);

  const cropSize = useMemo<Size | undefined>(() => {
    if (!containedMediaSize) return undefined;
    return {
      width: Math.max(24, containedMediaSize.width * (cropWidthPercent / 100)),
      height: Math.max(24, containedMediaSize.height * (cropHeightPercent / 100)),
    };
  }, [containedMediaSize, cropHeightPercent, cropWidthPercent]);

  if (!item) return null;

  const initialCrop =
    preview && item.crop
      ? {
          x: (item.crop.x / preview.originalWidth) * preview.previewWidth,
          y: (item.crop.y / preview.originalHeight) * preview.previewHeight,
          width: (item.crop.width / preview.originalWidth) * preview.previewWidth,
          height: (item.crop.height / preview.originalHeight) * preview.previewHeight,
        }
      : undefined;

  const handleCropComplete = (_area: Area, areaPixels: Area) => {
    if (!preview) return;
    const scaleX = preview.originalWidth / preview.previewWidth;
    const scaleY = preview.originalHeight / preview.previewHeight;
    setPixelCrop({
      x: Math.max(0, Math.round(areaPixels.x * scaleX)),
      y: Math.max(0, Math.round(areaPixels.y * scaleY)),
      width: Math.max(1, Math.round(areaPixels.width * scaleX)),
      height: Math.max(1, Math.round(areaPixels.height * scaleY)),
    });
  };

  const rotate = (direction: 'cw' | 'ccw') => {
    setCrop(item.id, pixelCrop);
    if (direction === 'cw') rotateCw(item.id);
    else rotateCcw(item.id);
  };

  const reset = () => {
    setCropPosition({ x: 0, y: 0 });
    setZoom(1);
    setCropWidthPercent(100);
    setCropHeightPercent(100);
    setPixelCrop(undefined);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t(language, 'cropEdit')}: ${item.fileName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <h2 className="truncate text-sm font-semibold text-neutral-800" title={item.fileName}>
            {item.fileName}
          </h2>
          <button type="button" onClick={onClose} aria-label={t(language, 'close')} className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100">✕</button>
        </div>

        <div ref={cropperContainer} className="relative h-[60vh] bg-neutral-900">
          {loadError ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-300">
              {t(language, 'previewError', { message: loadError })}
            </div>
          ) : !preview || !cropSize ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400">{t(language, 'loadingPreview')}</div>
          ) : (
            <Cropper
              key={`${item.id}-${item.rotation}`}
              image={preview.dataUrl}
              crop={cropPosition}
              zoom={zoom}
              rotation={0}
              cropSize={cropSize}
              initialCroppedAreaPixels={initialCrop}
              onCropChange={setCropPosition}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              objectFit="contain"
              restrictPosition
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 px-4 py-3">
          <button type="button" onClick={() => rotate('ccw')} title={t(language, 'rotateCcw')} aria-label={t(language, 'rotateCcw')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">⟲ 90°</button>
          <button type="button" onClick={() => rotate('cw')} title={t(language, 'rotateCw')} aria-label={t(language, 'rotateCw')} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">⟳ 90°</button>
          <label className="flex items-center gap-2 text-xs text-neutral-600">{t(language, 'width')}
            <input type="range" min={MIN_CROP_PERCENT} max={100} value={cropWidthPercent} onChange={(event) => setCropWidthPercent(Number(event.target.value))} className="w-24" />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-600">{t(language, 'height')}
            <input type="range" min={MIN_CROP_PERCENT} max={100} value={cropHeightPercent} onChange={(event) => setCropHeightPercent(Number(event.target.value))} className="w-24" />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-600">{t(language, 'zoom')}
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-24" />
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={reset} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">{t(language, 'reset')}</button>
            <button type="button" onClick={() => { setCrop(item.id, pixelCrop); onClose(); }} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">{t(language, 'apply')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
