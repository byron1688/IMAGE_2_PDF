# IMAGE_2_PDF

一个把图片合并导出成 PDF 的本地桌面小工具，支持 **macOS** 和 **Windows**。基于 Tauri v2 + React + Rust，安装包由 GitHub Actions 自动构建。

## 功能

- **导入照片**：点击 "Add images" 按钮，或直接把文件**拖拽（drag & drop）**到窗口任意位置。
- **调整顺序**：缩略图网格中拖动重新排序（支持键盘方向键）。
- **每张图片可编辑**：90° 旋转（CW / CCW）、自由裁剪。编辑是非破坏性的，参数保存在内存中，导出时才应用。
- **预览**：缩略图网格，序号标记当前顺序。
- **中英文界面**：顶部可在 English / 中文之间切换，选择会保存在本机。
- **导入记录**：记录最近 50 次导入的时间、文件名、成功数和跳过数，可在应用内查看或清空。
- **导出**：一键导出为**单个 A4 PDF**（纵向；图片为横向时该页自动切换为横向），保持宽高比 contain-fit 到 A4 页面。
- **本地运行**：不发布到应用商店，双击安装即可使用。

## 支持的图片格式

| 格式 | macOS | Windows |
| --- | --- | --- |
| JPG / JPEG | ✅ | ✅ |
| PNG | ✅ | ✅ |
| WebP | ✅ | ✅ |
| BMP | ✅ | ✅ |
| GIF（取第一帧） | ✅ | ✅ |
| TIFF | ✅ | ✅ |
| HEIC / HEIF | ✅（release 构建） | ⚠️ 计划中 |

> **HEIC / HEIF**：macOS release 使用 Cargo `heic` feature 构建内嵌 `libheif` 后端，并通过 macOS 自带的 ImageIO 完成像素解码，因此成品不链接 Homebrew dylib。Windows v1 暂不支持 HEIC；Android 常见的 JPG / PNG / WebP 均已支持。

## 开发（本地跑）

先决条件：
- Node.js 20+
- Rust stable（`rustup`）
- 平台构建工具：macOS 需要 Xcode Command Line Tools；Windows 需要 MSVC Build Tools + WebView2；Linux 需要 `libwebkit2gtk-4.1-dev` 等（见 `.github/workflows/ci.yml`）。

```bash
npm install
npm run tauri dev
```

## 本地打包

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`：
- macOS：`.dmg` / `.app`
- Windows：`.msi` / `.exe`（NSIS）

## 通过 GitHub Actions 发布

推一个 `v*.*.*` 的 tag 会触发 `.github/workflows/release.yml`，在 macOS（runner 原生架构）和 Windows runner 上并行构建，安装包作为 **draft Release** 的附件上传，检查后手动 publish 即可。也可以在 Actions 页面用 "Run workflow" 手动跑一次。

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 未签名安装包提示

v1 的安装包**未做代码签名**（未来再考虑 Apple Developer ID / Windows 代码签名证书）：

- **macOS**：首次打开会被 Gatekeeper 拦截。右键 App → **"打开"** → 再次点 **"打开"**；或到 *系统设置 → 隐私与安全性* 里点 "仍要打开"。
- **Windows**：SmartScreen 会提示 "Windows 已保护你的电脑"。点击 **"更多信息"** → **"仍要运行"**。

## 状态

MVP 开发中。技术栈：Tauri v2、React + TypeScript、dnd-kit、react-easy-crop、Rust（`image` + `printpdf`）。
