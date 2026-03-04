---
name: build
description: Build an iPlug2 plugin project for different formats and platforms using xcodebuild or Visual Studio
---

# Build iPlug2 Plugin

Use this skill when the user wants to build their plugin project.

## macOS Build (xcodebuild)

```bash
cd [ProjectFolder]
xcodebuild -project "./projects/[ProjectName]-macOS.xcodeproj" -target [TARGET] -configuration [CONFIG] 2> ./build_errors.log
```

**Targets:** `APP`, `AU`, `VST2`, `VST3`, `CLAP`, `AAX`, `AUv3`, `AUv3App`, `All`
**Configurations:** `Debug`, `Release`, `Tracer`

### Build Locations (from common-mac.xcconfig)
- APP: `~/Applications/[PluginName].app`
- VST3: `~/Library/Audio/Plug-Ins/VST3/`
- AU: `~/Library/Audio/Plug-Ins/Components/`
- CLAP: `~/Library/Audio/Plug-Ins/CLAP/`

### Open in Xcode (recommended for debugging)
```bash
open ./[ProjectName].xcworkspace
```

## iOS Build

```bash
xcodebuild -project "./projects/[ProjectName]-iOS.xcodeproj" -target AUv3App -configuration Release
```

## Windows Build

Open the `.sln` file in Visual Studio:
```
[ProjectName].sln
```

Build from IDE or bash command line:
```bash
cd [ProjectFolder]
MSBuild.exe [ProjectName].sln //p:Configuration=Release //p:Platform=x64 //t:[Target]
```

**Note:** In Git bash, use `//` instead of `/` for MSBuild flags to prevent path expansion.
**Targets:** `LoopRouter-app`, `LoopRouter-vst3`, `LoopRouter-clap`, `LoopRouter-aax`, etc.

To filter output to errors only:
```bash
MSBuild.exe [ProjectName].sln //p:Configuration=Release //p:Platform=x64 //t:[Target] //nologo //v:minimal 2>&1 | grep -E "error|FAILED|succeeded"
```

## Tips

- Build one target at a time; `All` may fail if SDKs are missing
- Check `build_errors.log` for issues
- AUv3 requires building `AUv3App` target (packages plugin as App Extension)
- Recommend AUv2 over AUv3 for new users (simpler setup)
