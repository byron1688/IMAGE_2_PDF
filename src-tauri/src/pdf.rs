use std::fs::File;
use std::io::{BufWriter, Cursor};
use std::path::{Path, PathBuf};

use image::codecs::jpeg::{JpegDecoder, JpegEncoder};
use image::codecs::png::PngDecoder;
use image::{ColorType, DynamicImage, GenericImageView, ImageEncoder};

use crate::decode::decode_any;
use printpdf::{
    Image, ImageTransform, Mm, PdfDocument, PdfDocumentReference, PdfLayerIndex, PdfPageIndex,
};
use serde::Deserialize;

const A4_W_MM: f32 = 210.0;
const A4_H_MM: f32 = 297.0;
const MARGIN_PT: f32 = 24.0;
const MM_PER_PT: f32 = 25.4 / 72.0;
const MM_PER_IN: f32 = 25.4;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfItem {
    pub path: String,
    #[serde(default)]
    pub rotation: i32,
    #[serde(default)]
    pub crop: Option<CropRect>,
}

pub fn build_pdf<F>(items: &[PdfItem], output: &Path, mut on_page: F) -> Result<(), String>
where
    F: FnMut(usize, usize),
{
    if items.is_empty() {
        return Err("no items to export".into());
    }
    let margin_mm = MARGIN_PT * MM_PER_PT;
    let total = items.len();

    let first = load_and_transform(&items[0])?;
    let (fw, fh) = page_size_for(&first);
    let (doc, page_idx, layer_idx) = PdfDocument::new("Images", Mm(fw), Mm(fh), "Layer 1");
    render_page(&doc, page_idx, layer_idx, first, fw, fh, margin_mm)?;
    on_page(1, total);

    for (i, item) in items[1..].iter().enumerate() {
        let img = load_and_transform(item)?;
        let (pw, ph) = page_size_for(&img);
        let (p, l) = doc.add_page(Mm(pw), Mm(ph), "Layer 1");
        render_page(&doc, p, l, img, pw, ph, margin_mm)?;
        on_page(i + 2, total);
    }

    let file = File::create(output).map_err(|e| format!("create {}: {e}", output.display()))?;
    doc.save(&mut BufWriter::new(file))
        .map_err(|e| format!("save pdf: {e}"))?;
    Ok(())
}

fn page_size_for(img: &DynamicImage) -> (f32, f32) {
    let (w, h) = img.dimensions();
    if w > h {
        (A4_H_MM, A4_W_MM)
    } else {
        (A4_W_MM, A4_H_MM)
    }
}

fn render_page(
    doc: &PdfDocumentReference,
    page: PdfPageIndex,
    layer: PdfLayerIndex,
    img: DynamicImage,
    page_w: f32,
    page_h: f32,
    margin_mm: f32,
) -> Result<(), String> {
    let (px_w, px_h) = img.dimensions();
    let avail_w = page_w - 2.0 * margin_mm;
    let avail_h = page_h - 2.0 * margin_mm;
    let dpi_w = px_w as f32 * MM_PER_IN / avail_w;
    let dpi_h = px_h as f32 * MM_PER_IN / avail_h;
    let dpi = dpi_w.max(dpi_h);
    let disp_w = px_w as f32 / dpi * MM_PER_IN;
    let disp_h = px_h as f32 / dpi * MM_PER_IN;
    let tx = (page_w - disp_w) / 2.0;
    let ty = (page_h - disp_h) / 2.0;

    let pimg = encode_for_pdf(&img)?;
    let layer_ref = doc.get_page(page).get_layer(layer);
    pimg.add_to_layer(
        layer_ref,
        ImageTransform {
            translate_x: Some(Mm(tx)),
            translate_y: Some(Mm(ty)),
            dpi: Some(dpi),
            ..Default::default()
        },
    );
    Ok(())
}

fn encode_for_pdf(img: &DynamicImage) -> Result<Image, String> {
    // Per contract: alpha OR ≤256 unique colors → keep as lossless PNG (line-art);
    // otherwise re-encode as JPEG quality 85 (photos).
    if has_alpha(img) || is_low_color(img, 256) {
        let rgba = img.to_rgba8();
        let mut buf = Vec::with_capacity(256 * 1024);
        image::codecs::png::PngEncoder::new(&mut buf)
            .write_image(rgba.as_raw(), rgba.width(), rgba.height(), ColorType::Rgba8)
            .map_err(|e| format!("png encode: {e}"))?;
        let dec = PngDecoder::new(Cursor::new(buf)).map_err(|e| format!("png decode: {e}"))?;
        Image::try_from(dec).map_err(|e| format!("pdf image (png): {e}"))
    } else {
        let rgb = img.to_rgb8();
        let mut buf = Vec::with_capacity(256 * 1024);
        JpegEncoder::new_with_quality(&mut buf, 85)
            .encode(rgb.as_raw(), rgb.width(), rgb.height(), ColorType::Rgb8)
            .map_err(|e| format!("jpeg encode: {e}"))?;
        let dec = JpegDecoder::new(Cursor::new(buf)).map_err(|e| format!("jpeg decode: {e}"))?;
        Image::try_from(dec).map_err(|e| format!("pdf image (jpeg): {e}"))
    }
}

fn has_alpha(img: &DynamicImage) -> bool {
    matches!(
        img.color(),
        ColorType::La8 | ColorType::La16 | ColorType::Rgba8 | ColorType::Rgba16
    )
}

/// Return true if the RGB image has at most `limit` unique colors. Early-exits
/// once the limit is exceeded, so it stays cheap for the photo path.
fn is_low_color(img: &DynamicImage, limit: usize) -> bool {
    let rgb = img.to_rgb8();
    let mut seen = std::collections::HashSet::with_capacity(limit + 1);
    for px in rgb.pixels() {
        let key = ((px[0] as u32) << 16) | ((px[1] as u32) << 8) | (px[2] as u32);
        if seen.insert(key) && seen.len() > limit {
            return false;
        }
    }
    true
}

fn load_and_transform(item: &PdfItem) -> Result<DynamicImage, String> {
    let path = PathBuf::from(&item.path);
    let mut img = decode_any(&path)?;

    // Rotation first (lossless multiples of 90°), then crop in rotated coordinates.
    let rot = ((item.rotation % 360) + 360) % 360;
    img = match rot {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => img,
    };

    if let Some(c) = &item.crop {
        let (w, h) = img.dimensions();
        let x = c.x.min(w);
        let y = c.y.min(h);
        let cw = c.width.min(w.saturating_sub(x));
        let ch = c.height.min(h.saturating_sub(y));
        if cw > 0 && ch > 0 {
            img = img.crop_imm(x, y, cw, ch);
        }
    }

    Ok(img)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};
    use lopdf::{Document, Object};

    const PT_PER_MM: f32 = 72.0 / 25.4;

    fn write_fixture(path: &Path, w: u32, h: u32, tint: [u8; 3]) {
        // Gradient so the image has many unique colors and exercises the
        // JPEG-85 photo path in `encode_for_pdf` (not the PNG low-color branch).
        let mut img = RgbImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let r = ((x * 255 / w.max(1)) as u16 + tint[0] as u16).min(255) as u8;
                let g = ((y * 255 / h.max(1)) as u16 + tint[1] as u16).min(255) as u8;
                let b = ((x.wrapping_add(y)) as u16 % 256 + tint[2] as u16).min(255) as u8;
                img.put_pixel(x, y, Rgb([r, g, b]));
            }
        }
        img.save(path).expect("save fixture");
    }

    #[test]
    fn build_pdf_two_images_produces_a4_pages_with_image_xobjects() {
        let dir = tempfile::tempdir().expect("tempdir");
        let a = dir.path().join("a.jpg");
        let b = dir.path().join("b.jpg");
        write_fixture(&a, 800, 1200, [220, 40, 40]);
        write_fixture(&b, 800, 1200, [40, 160, 220]);

        let items = vec![
            PdfItem {
                path: a.to_string_lossy().into_owned(),
                rotation: 0,
                crop: None,
            },
            PdfItem {
                path: b.to_string_lossy().into_owned(),
                rotation: 0,
                crop: None,
            },
        ];

        let out = dir.path().join("out.pdf");
        let mut pages_seen = Vec::new();
        build_pdf(&items, &out, |current, total| {
            pages_seen.push((current, total))
        })
        .expect("build_pdf ok");

        assert_eq!(
            pages_seen,
            vec![(1, 2), (2, 2)],
            "per-page progress fires in order"
        );
        assert!(out.exists(), "output pdf exists");

        let doc = Document::load(&out).expect("parse pdf");
        let pages = doc.get_pages();
        assert_eq!(pages.len(), 2, "two pages produced");

        let a4_w_pt = A4_W_MM * PT_PER_MM;
        let a4_h_pt = A4_H_MM * PT_PER_MM;

        let mut xobject_count = 0usize;
        for page_id in pages.values() {
            let mb = doc
                .get_dictionary(*page_id)
                .ok()
                .and_then(|d| d.get(b"MediaBox").ok())
                .and_then(|o| o.as_array().ok())
                .expect("MediaBox present");
            let w = as_f32(&mb[2]);
            let h = as_f32(&mb[3]);
            let long = w.max(h);
            let short = w.min(h);
            assert!(
                (long - a4_h_pt).abs() < 1.0 && (short - a4_w_pt).abs() < 1.0,
                "page size is A4 (portrait or landscape): got {}x{} pt",
                w,
                h,
            );

            let (res_dict, res_refs) = doc.get_page_resources(*page_id);
            let mut resource_dicts: Vec<&lopdf::Dictionary> = Vec::new();
            if let Some(d) = res_dict {
                resource_dicts.push(d);
            }
            for id in res_refs {
                if let Ok(d) = doc.get_dictionary(id) {
                    resource_dicts.push(d);
                }
            }
            let xobjects = resource_dicts
                .iter()
                .find_map(|d| d.get(b"XObject").ok())
                .and_then(|o| match o {
                    Object::Dictionary(d) => Some(d.clone()),
                    Object::Reference(id) => doc.get_dictionary(*id).ok().cloned(),
                    _ => None,
                })
                .expect("XObject dict present");
            for (_, xref) in xobjects.iter() {
                let obj_id = xref.as_reference().expect("xobject reference");
                let obj = doc.get_object(obj_id).expect("xobject object");
                let stream = obj.as_stream().expect("xobject stream");
                let subtype = stream
                    .dict
                    .get(b"Subtype")
                    .ok()
                    .and_then(|o| o.as_name_str().ok())
                    .unwrap_or("");
                if subtype == "Image" {
                    xobject_count += 1;
                }
            }
        }
        assert!(
            xobject_count >= 2,
            "at least one image XObject per page (got {xobject_count})",
        );
    }

    fn as_f32(obj: &Object) -> f32 {
        match obj {
            Object::Integer(i) => *i as f32,
            Object::Real(f) => *f,
            _ => panic!("expected number in MediaBox, got {:?}", obj),
        }
    }
}
