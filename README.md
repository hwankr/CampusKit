# CampusKit

CampusKit is a desktop document utility built with Tauri, React, TypeScript, and Vite.

Phase 1 scope:
- polished desktop shell
- working `PDF Split`
- `Convert`, `Merge`, and `Extract` as placeholders only

## Development Goals

- keep the shell extensible without overbuilding routes
- keep Korean-first copy ready for English expansion
- keep file and platform logic below the React UI boundary
- keep Windows and Linux development as similar as practical

## Prerequisites

CampusKit follows the official Tauri prerequisite model:
- Node.js 24.x
- Rust via `rustup`
- Tauri system prerequisites for your OS

After installing Rust with `rustup`, reopen your terminal so `cargo` is available on `PATH`.

### Windows

- Microsoft C++ Build Tools with `Desktop development with C++`
- Microsoft Edge WebView2 runtime
- Rust with the MSVC toolchain

### Linux

- Rust via `rustup`
- Node.js 24.x
- distro packages for Tauri such as `webkit2gtk`, `openssl`, `libappindicator`, `librsvg`, and `libxdo`

Example package sets from the official Tauri prerequisite guide:

```bash
# Debian / Ubuntu
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel libxdo-devel
sudo dnf group install "c-development"
```

## Getting Started

```bash
npm install
npm run typecheck
npm run test:web
npm run tauri:dev
```

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run tauri:dev
npm run tauri:build
```

## Cross-Platform Notes

- `.gitattributes` normalizes line endings to LF for source files.
- `.editorconfig` keeps editor behavior aligned across Windows and Linux.
- `.nvmrc` pins the Node major used in this repo.
- scripts avoid Windows-only shell syntax.
- platform-specific file handling lives in `src-tauri/` and `src/shared/platform/`.

## References

- Tauri prerequisites: https://tauri.app/start/prerequisites/

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
