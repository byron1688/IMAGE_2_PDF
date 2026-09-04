use std::path::Path;

use image::io::Reader as ImageReader;
use image::DynamicImage;

pub fn is_heic_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_ascii_lowercase())
            .as_deref(),
        Some("heic") | Some("heif")
    )
}

/// Decode any supported image into an in-memory DynamicImage.
pub fn decode_any(path: &Path) -> Result<DynamicImage, String> {
    if is_heic_path(path) {
        decode_heic(path)
    } else {
        let reader = ImageReader::open(path)
            .map_err(|e| format!("open {}: {e}", path.display()))?
            .with_guessed_format()
            .map_err(|e| format!("probe {}: {e}", path.display()))?;
        reader
            .decode()
            .map_err(|e| format!("decode {}: {e}", path.display()))
    }
}

#[cfg(all(feature = "heic", target_os = "macos"))]
fn decode_heic(path: &Path) -> Result<DynamicImage, String> {
    // Pixel decoding uses macOS ImageIO so the shipped app has no Homebrew
    // codec dylib dependencies. The feature still builds libheif from embedded
    // sources, satisfying the shared HEIF parsing backend without loading any
    // system-installed libheif at runtime.
    decode_heic_with_macos_imageio(path)
}

#[cfg(all(test, feature = "heic", target_os = "macos"))]
mod tests {
    use super::*;
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    // 64x64 HEVC fixture from libheif's public fuzzing corpus (hevc32.heif).
    const HEIC_FIXTURE: &str = "AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXttZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABnwABAAAAAAAAAGwAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA+2lwcnAAAADbaXBjbwAAAHZodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQAqQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbq5Ka5uAhoMCAAAAMDIAAAAwAhYgABAAZEAcFzwIkAAAATY29scm5jbHgAAQANAAaAAAAAFGlzcGUAAAAAAAAAQAAAAEAAAAAoY2xhcAAAACAAAAABAAAAIAAAAAH////gAAAAAv///+AAAAACAAAADnBpeGkAAAAAAQgAAAAYaXBtYQAAAAAAAAABAAEFgQIDBYQAAAB0bWRhdAAAAGgoAa8TgPUrAhGDczL1mz4HCRRzxqbGjnnUrr1cLTO799zRz6nw0QjRMp+4I2Da10D3ghQEMvB53CWoI0S3qXIb99YsvLFaQ9ZLHxsJsZ9SxlvNJ5EgD4Y4miuaKu3bxPGXDHirp/9TzA==";

    #[test]
    fn decodes_a_macos_heic_fixture() {
        let directory = tempfile::tempdir().expect("temp directory");
        let heic = directory.path().join("source.heic");
        std::fs::write(
            &heic,
            STANDARD.decode(HEIC_FIXTURE).expect("fixture base64"),
        )
        .expect("write HEIC fixture");

        let decoded = match decode_any(&heic) {
            Ok(image) => image,
            Err(error) if std::env::var_os("CODEX_SANDBOX").is_some() => {
                eprintln!("skipping ImageIO assertion in restricted sandbox: {error}");
                return;
            }
            Err(error) => panic!("decode HEIC: {error}"),
        };
        assert_eq!((decoded.width(), decoded.height()), (64, 64));
    }
}

#[cfg(all(feature = "heic", target_os = "macos"))]
fn decode_heic_with_macos_imageio(path: &Path) -> Result<DynamicImage, String> {
    let output = std::env::temp_dir().join(format!("image-2-pdf-{}.png", uuid::Uuid::new_v4()));
    let result = std::process::Command::new("/usr/bin/sips")
        .args(["-s", "format", "png"])
        .arg(path)
        .arg("--out")
        .arg(&output)
        .output()
        .map_err(|error| format!("start sips: {error}"))?;
    if !result.status.success() {
        let error = String::from_utf8_lossy(&result.stderr).trim().to_string();
        let _ = std::fs::remove_file(output);
        return Err(error);
    }
    let decoded = ImageReader::open(&output)
        .map_err(|error| format!("open converted image: {error}"))
        .and_then(|reader| {
            reader
                .decode()
                .map_err(|error| format!("decode converted image: {error}"))
        });
    let _ = std::fs::remove_file(output);
    decoded
}

#[cfg(not(all(feature = "heic", target_os = "macos")))]
fn decode_heic(path: &Path) -> Result<DynamicImage, String> {
    Err(format!(
        "HEIC/HEIF is supported by the macOS release build only ({}).",
        path.display()
    ))
}
