use std::path::Path;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use image::{codecs::jpeg::JpegEncoder, ColorType};

use crate::decode::decode_any;

pub struct DecodedThumbnail {
    pub width: u32,
    pub height: u32,
    pub data_url: String,
}

pub fn generate_thumbnail(path: &Path, max_dim: u32) -> Result<DecodedThumbnail, String> {
    let img = decode_any(path)?;

    let (w, h) = (img.width(), img.height());
    let thumb = if w.max(h) > max_dim {
        img.thumbnail(max_dim, max_dim)
    } else {
        img
    };

    let rgb = thumb.to_rgb8();
    let mut buf = Vec::with_capacity(64 * 1024);
    JpegEncoder::new_with_quality(&mut buf, 75)
        .encode(rgb.as_raw(), rgb.width(), rgb.height(), ColorType::Rgb8)
        .map_err(|e| format!("encode thumbnail for {}: {e}", path.display()))?;

    let mut data_url = String::from("data:image/jpeg;base64,");
    B64.encode_string(&buf, &mut data_url);

    Ok(DecodedThumbnail {
        width: w,
        height: h,
        data_url,
    })
}
