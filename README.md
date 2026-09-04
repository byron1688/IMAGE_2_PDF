# IMAGE_2_PDF

IMAGE_2_PDF is a small local desktop application that combines images into a single PDF. It supports macOS and Windows, is built with Tauri v2, React, and Rust, and uses GitHub Actions to build installers.

## Features

- **Import photos:** Click **Add images**, or drag and drop files anywhere in the application window.
- **Reorder pages:** Drag thumbnails into the desired order. Keyboard reordering with the arrow keys is also supported.
- **Edit individual images:** Rotate images 90 degrees clockwise or counterclockwise and crop them freely. Edits are non-destructive and are applied only during export.
- **Preview pages:** Review imported images and their page numbers in the thumbnail grid.
- **English and Chinese interface:** Switch between English and Chinese from the top bar. The selected language is saved locally.
- **Import history:** View or clear the 50 most recent imports, including the import time, file names, number of successful files, and number of skipped files.
- **Export one PDF:** Export all images as a single A4 PDF. Images keep their aspect ratio and are fitted inside each page; pages automatically use landscape orientation for landscape images.
- **Runs locally:** No App Store or Microsoft Store installation is required.

## Supported Image Formats

| Format | macOS | Windows |
| --- | --- | --- |
| JPG / JPEG | Yes | Yes |
| PNG | Yes | Yes |
| WebP | Yes | Yes |
| BMP | Yes | Yes |
| GIF (first frame) | Yes | Yes |
| TIFF | Yes | Yes |
| HEIC / HEIF | Yes (release builds) | Planned |

> **HEIC / HEIF:** macOS release builds enable the Cargo `heic` feature. Pixel decoding uses the built-in macOS ImageIO framework, so the distributed application does not depend on Homebrew libraries at runtime. HEIC is not supported in the Windows v1 build. Common Android formats such as JPG, PNG, and WebP are supported on both platforms.

## Local Development

Prerequisites:

- Node.js 20 or later
- The stable Rust toolchain, installed with `rustup`
- Platform build tools:
  - macOS: Xcode Command Line Tools
  - Windows: Microsoft Visual C++ Build Tools and WebView2
  - Linux: `libwebkit2gtk-4.1-dev` and the other packages listed in `.github/workflows/ci.yml`

Install the dependencies and start the development application:

```bash
npm install
npm run tauri dev
```

## Building Locally

```bash
npm run tauri build
```

Build outputs are written to `src-tauri/target/release/bundle/`:

- macOS: `.dmg` and `.app`
- Windows: `.msi` and NSIS `.exe`

## Publishing with GitHub Actions

Pushing a tag that matches `v*.*.*` starts `.github/workflows/release.yml`. GitHub Actions builds the application on macOS and Windows and attaches the installers to a draft GitHub Release. Review the artifacts and publish the release manually when they are ready.

The release workflow can also be started manually from the Actions page for a build-only test run.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Unsigned Installer Notice

Version 1 installers are not code-signed. Code signing with an Apple Developer ID and a Windows certificate may be added later.

- **macOS:** Gatekeeper may block the application the first time it is opened. Right-click the application, select **Open**, and select **Open** again. Alternatively, use **System Settings > Privacy & Security > Open Anyway**.
- **Windows:** SmartScreen may display a “Windows protected your PC” warning. Select **More info**, then **Run anyway**.

## Project Status

The MVP is under development. The primary stack is Tauri v2, React, TypeScript, dnd-kit, react-easy-crop, Rust `image`, and printpdf.
