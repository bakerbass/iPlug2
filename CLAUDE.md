# CLAUDE.md

This is the iPlug2 framework repository, forked particularly for development of RBFX plugins by Ryan Baker. Upstream: https://github.com/iPlug2/iPlug2.git

## Instructions

- Be concise. Assume the user knows audio programming concepts but not iPlug2 specifically.
- Check current directory before running scripts; return to repo root after.

## iPlug2 Overview

Cross-platform C++ audio plugin framework with two main components:

1. **IPlug** - Core plugin abstraction layer
2. **IGraphics** - GUI toolkit with multiple backends (NanoVG - lightweight, fast, Skia - heavyweight, better quality)

**Plugin Formats:** CLAP, VST3, AUv2/AUv3, AAX, WAM (VST2 is supported but deprecated)
**Extra Formats:** Standalone App, REAPER extensions (& REAPER plugins - plugins that call the REAPER API)
**Platforms:** macOS, iOS, Windows, Web (WAM/WASM)

## Repo Structure

```
├── IPlug/              # Core plugin abstraction
├── IGraphics/          # UI framework
├── IGraphics/Controls  # UI controls library
├── IGraphics/Platforms # Platform-specific implementations
├── IGraphics/Drawing   # Drawing implementations (NanoVG, Skia)
├── Dependencies/       # Third-party libs/SDKs (don't modify)
├── Examples/           # Template projects
├── MyProjects/         # User created projects
├── Tests/              # Framework test projects
├── WDL/                # Cockos WDL (don't modify)
├── Scripts/            # Build utilities
├── Scripts/ci/         # CI/CD scripts
└── Documentation/      # Docs and wiki
```

## Key Concepts

- Three main files per project: `Plugin.cpp`, `Plugin.h`, `config.h`
  - DSP and GUI source located in respective subdirectories
  - set Plugin Manufacturer in config to RBFX
- `ProcessBlock` must be realtime-safe (no allocations, locks, file I/O)
- Parameters: fixed count at compile time, indexed by enum, non-normalized values
- Use `GetParam(kIndex)->Value()` for parameter access
- IGraphics UIs typically built in a lambda in the plugin constructor
- IControls link to parameters via parameter ID
- Visualization controls can use an [ISender](@IPlug/ISender.h) to send data from audio thread to UI thread
- Controls can be grouped and tagged when Attached

- IGraphics is only one UI option; other options include SwiftUI, WebView. See examples in [Examples/](@Examples/).
- The default IGraphics backend NanoVG doesn't need the dependencies to be downloaded

## Code Style

- 2-space indentation, no tabs
- Unix line endings (except Windows-specific files)
- Member variables: `mCamelCase`
- Pointer args: `pCamelCase`
- Internal methods: `_methodName`
- Use C++17 (`override`, `final`, `auto`, `std::optional`, `std::string_view`)
- Avoid STL in core code; prefer WDL alternatives

## Windows Plugin Resources (VST3/CLAP)

iPlug2's CMake only packages resources for macOS bundles (`MACOSX_PACKAGE_LOCATION`). On Windows:
- **Fonts and web files are NOT copied** into VST3/CLAP bundles automatically.
- The standalone APP embeds them via `main.rc` (Win32 binary resources) — that's the only format that works without extra steps.
- **Always add post-build `cmake -E copy_if_different` commands** to copy fonts (`resources/fonts/`) and web files (`resources/web/`) to `Contents/Resources/` in the VST3 bundle — both the build output path AND the deploy path (`$ENV{LOCALAPPDATA}/Programs/Common/VST3/`).
- **Font loading in plugin builds**: add `main.rc` to the VST3/CLAP targets in CMakeLists.txt (with `/I` includes for the fonts dir). The `.rc` file embeds fonts as Win32 binary resources in the DLL — `LocateResource` finds them via `kWinBinary` and `pGraphics->LoadFont("Roboto-Regular", ROBOTO_FN)` works unchanged. **Do NOT** use `BundleResourcePath()` for fonts — with no HMODULE it returns the host app's path, not the plugin DLL path.
- **`IWebViewControl::LoadFile` vs `LoadURL`**: `LoadFile` calls `SetVirtualHostNameToFolderMapping` which requires `ICoreWebView2_3` — if the installed WebView2 runtime is older, the virtual host silently fails and you get "iplug.example server not found". **Always use `LoadURL("file:///absolute/path/to/index.html")` instead** — works on all WebView2 versions, supports `postMessage`, no CORS issues for same-origin JS files.
- See `MyProjects/Petal/.claude/lesson.md` for the canonical fix pattern.

## Resources

- [API Docs](https://iplug2.github.io/docs) | [Wiki](https://github.com/iPlug2/iPlug2/wiki)
- When building standalone app targets only debug builds have the debug menu with screenshot capabilities