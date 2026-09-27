<p align="center">
  <img src="landing/logo.svg" width="128" alt="Muli logo">
</p>

<h1 align="center">Muli</h1>

<p align="center">
  <strong>M</strong>ole <strong>UI</strong> <strong>L</strong>ibrary — clean your Mac without touching the terminal.
</p>

<p align="center">
  <a href="https://github.com/athasamid/muli/releases/latest"><img src="https://img.shields.io/github/v/release/athasamid/muli?color=0070eb" alt="Latest release"></a>
  <a href="https://github.com/athasamid/muli/releases"><img src="https://img.shields.io/github/downloads/athasamid/muli/total?color=0058bc" alt="Downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-ISC-green" alt="License"></a>
</p>

---

**Muli** is a macOS desktop app that puts a friendly face on [Mole](https://github.com/tw93/mole), the open-source Mac cleaner CLI. It exists for people who will never open a terminal: one click to scan, preview, and clean caches, logs, and junk files — with the full power of `mo clean`, including system-level cleanup that needs an admin password.

Everything runs locally. No telemetry, no accounts, no data leaves the Mac.

## Download

| Chip | Download |
|---|---|
| Apple Silicon (M1–M4) | [`Muli-arm64.dmg`](https://github.com/athasamid/muli/releases/latest/download/Muli-arm64.dmg) |
| Intel | [`Muli-x64.dmg`](https://github.com/athasamid/muli/releases/latest/download/Muli-x64.dmg) |

Or visit the landing page: **https://athasamid.github.io/muli/**

> **First launch:** Muli isn't notarized with an Apple Developer certificate yet, so macOS shows a warning once. Right-click the app → **Open** → **Open**. If it's still blocked: **System Settings → Privacy & Security → Open Anyway**.

## Features

- **One-click clean** — app caches, logs, temp files, and developer junk. Personal documents are never touched (Mole's whitelist applies).
- **Preview mode** — dry-run first: see exactly what would be deleted and how much space you'd get back, without deleting anything.
- **Full deep clean from the GUI** — system caches need `sudo`; Muli shows a native-feeling password dialog and streams it straight to macOS. The password is never stored or logged.
- **Auto-installs Mole** — if Mole isn't on the Mac yet, Muli walks the user through installing it, live log included.
- **Live system stats** — real storage, memory, and CPU numbers on the dashboard (memory computed honestly via `vm_stat`, not the scary `os.freemem()` figure).

## How it works

```
┌──────────────┐   IPC    ┌──────────────────┐   node-pty   ┌────────────┐
│  Nuxt 4 UI   │ ◄──────► │  Electron main   │ ◄──────────► │  mo clean  │
│  (renderer)  │  events  │  parser/service  │  pseudo-tty  │   (Mole)   │
└──────────────┘          └──────────────────┘              └────────────┘
```

The key trick: Mole reads the sudo password from `/dev/tty` and only enables system cleanup when it detects an interactive terminal. Spawning it through a plain pipe silently skips the deep clean. Muli runs `mo clean` inside a **pseudo-terminal** ([node-pty](https://github.com/microsoft/node-pty)), parses the output stream into UI events (sections, items, prompts, summary), and writes the user's answers back into the pty — exactly as if they were typing in Terminal.

## Development

Requirements: Node 22+, macOS.

```bash
npm install          # also rebuilds node-pty for Electron
cd ui && npm install && cd ..
npm run dev          # Nuxt dev server + Electron
```

Useful during development:

```bash
# Force the "Mole not installed" flow without touching your real install
MULI_SIMULATE_NOT_INSTALLED=1 npm run dev

# Test detection for real without uninstalling
brew unlink mole   # ...then: brew link mole
```

## Building installers

```bash
npm run dist:mac     # builds ui + .dmg/.zip for the current arch into dist/
```

Releases are automated: pushing a tag `v*` triggers [`build-macos.yml`](.github/workflows/build-macos.yml), which builds **arm64** (macos-latest) and **x64** (macos-13) installers and attaches them to the GitHub Release. The landing page in [`landing/`](landing/) deploys to GitHub Pages via [`deploy-pages.yml`](.github/workflows/deploy-pages.yml) and always links to the latest release.

```bash
npm version patch    # bump version
git push && git push --tags
```

## Project structure

```
electron/
  main.js                 window, app:// serving, lifecycle
  preload.js              contextBridge API (window.mole, window.system)
  ipc/                    IPC channel registration
  services/
    mole.service.js       pty spawn, install/clean orchestration
    mole.parser.js        pure output parser (testable without Electron)
ui/                       Nuxt 4 + Tailwind 4 + shadcn-vue renderer
landing/                  static landing page (GitHub Pages)
build/icon.png            app icon source (electron-builder converts to .icns)
```

## Credits

- [tw93/mole](https://github.com/tw93/mole) — the cleaning engine that does the real work.
- UI design drafted with [Google Stitch](https://stitch.withgoogle.com).

## License

[ISC](LICENSE)
