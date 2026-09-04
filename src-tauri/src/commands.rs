use std::io::Cursor;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use image::{codecs::jpeg::JpegEncoder, ColorType, ImageEncoder};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::decode::decode_any;
use crate::pdf::{build_pdf, PdfItem};
use crate::thumbs::{generate_thumbnail, DecodedThumbnail};

const PREVIEW_MAX_DIM: u32 = 2400;

pub const EXPORT_PROGRESS_EVENT: &str = "export://progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub current: usize,
    pub total: usize,
}

const THUMBNAIL_MAX_DIM: u32 = 320;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMeta {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub thumbnail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageError {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddImagesResult {
    pub items: Vec<ImageMeta>,
    pub errors: Vec<ImageError>,
}

#[tauri::command]
pub async fn add_images(paths: Vec<String>) -> Result<AddImagesResult, String> {
    let mut items = Vec::with_capacity(paths.len());
    let mut errors = Vec::new();

    for raw in paths {
        let path = Path::new(&raw);
        let file_name = path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| raw.clone());

        match generate_thumbnail(path, THUMBNAIL_MAX_DIM) {
            Ok(DecodedThumbnail {
                width,
                height,
                data_url,
            }) => items.push(ImageMeta {
                id: Uuid::new_v4().to_string(),
                path: raw,
                file_name,
                width,
                height,
                thumbnail: data_url,
            }),
            Err(message) => errors.push(ImageError { path: raw, message }),
        }
    }

    Ok(AddImagesResult { items, errors })
}

#[tauri::command]
pub async fn export_pdf(
    app: AppHandle,
    items: Vec<PdfItem>,
    output_path: String,
) -> Result<(), String> {
    if items.is_empty() {
        return Err("no items to export".into());
    }
    let path = std::path::PathBuf::from(&output_path);
    tauri::async_runtime::spawn_blocking(move || {
        build_pdf(&items, &path, |current, total| {
            let _ = app.emit(EXPORT_PROGRESS_EVENT, ExportProgress { current, total });
        })
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

/// Decode a local image and return it as a base64 PNG/JPEG data URL. The Rust side
/// unifies decoding (including TIFF/BMP/HEIC) so the WebView never has to render a
/// format it may not support (e.g. Windows WebView2 lacks TIFF).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewImage {
    pub data_url: String,
    // Dimensions of the rotated original (before any downscale for preview).
    // The frontend multiplies cropper coords by this ratio to recover full-res crops.
    pub original_width: u32,
    pub original_height: u32,
    pub preview_width: u32,
    pub preview_height: u32,
}

#[tauri::command]
pub async fn read_image_data_url(
    path: String,
    rotation: Option<i32>,
) -> Result<PreviewImage, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        let mut img = decode_any(&p)?;
        // Bake the item's rotation into the preview so the cropper always
        // returns crop coordinates in the same "rotated" space Rust uses when
        // building the PDF. Keeps the crop math symmetrical.
        let rot = ((rotation.unwrap_or(0) % 360) + 360) % 360;
        img = match rot {
            90 => img.rotate90(),
            180 => img.rotate180(),
            270 => img.rotate270(),
            _ => img,
        };
        let (original_width, original_height) = (img.width(), img.height());
        let scaled = if original_width.max(original_height) > PREVIEW_MAX_DIM {
            img.thumbnail(PREVIEW_MAX_DIM, PREVIEW_MAX_DIM)
        } else {
            img
        };
        let preview_width = scaled.width();
        let preview_height = scaled.height();
        let has_alpha = matches!(
            scaled.color(),
            ColorType::La8 | ColorType::La16 | ColorType::Rgba8 | ColorType::Rgba16
        );
        let mut buf = Vec::with_capacity(512 * 1024);
        let mime = if has_alpha {
            let rgba = scaled.to_rgba8();
            image::codecs::png::PngEncoder::new(&mut buf)
                .write_image(rgba.as_raw(), rgba.width(), rgba.height(), ColorType::Rgba8)
                .map_err(|e| format!("preview png encode: {e}"))?;
            "image/png"
        } else {
            let rgb = scaled.to_rgb8();
            JpegEncoder::new_with_quality(&mut Cursor::new(&mut buf), 85)
                .encode(rgb.as_raw(), rgb.width(), rgb.height(), ColorType::Rgb8)
                .map_err(|e| format!("preview jpeg encode: {e}"))?;
            "image/jpeg"
        };
        let mut data_url = format!("data:{mime};base64,");
        B64.encode_string(&buf, &mut data_url);
        Ok::<PreviewImage, String>(PreviewImage {
            data_url,
            original_width,
            original_height,
            preview_width,
            preview_height,
        })
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

/// Reveal the exported file in the OS file manager (Finder / Explorer / xdg).
#[tauri::command]
pub async fn reveal_in_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    tauri::async_runtime::spawn_blocking(move || reveal(&p))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[cfg(target_os = "macos")]
fn reveal(path: &Path) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("open -R: {e}"))
}

#[cfg(target_os = "windows")]
fn reveal(path: &Path) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("explorer: {e}"))
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn reveal(path: &Path) -> Result<(), String> {
    let dir = path.parent().unwrap_or(path);
    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("xdg-open: {e}"))
}
