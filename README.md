# pi-rts-alerts 🔊🎮

> **Pi extension** that plays iconic RTS game sounds when the AI finishes
> responding or asks you a question — using `ffplay` for **zero-window,
> headless audio** on Windows, macOS, and Linux.

[![CI](https://github.com/evanokeefe39/pi-rts-alerts/actions/workflows/ci.yml/badge.svg)](https://github.com/evanokeefe39/pi-rts-alerts/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/pi-rts-alerts?logo=npm&label=npm)](https://www.npmjs.com/package/pi-rts-alerts)
[![License](https://img.shields.io/github/license/evanokeefe39/pi-rts-alerts)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

## Demo

```
AI finishes a response    →  "Work work!" (Warcraft III Peon)
                          →  "Reporting for duty!" (StarCraft II SCV)
                          →  "Shi Ho!" (Age of Empires II Villager)
                          →  "Incoming transmission" (Red Alert 2)

AI asks you a question    →  Town bell (AoE2) / Klaxxon (RA2) / Siege Tank (SC2)
```

## Sound Packs

| Pack | Done Sound | Question Sound | Status |
|------|-----------|----------------|--------|
| ⭐ **Age of Empires II** | Villager "Ready" / Unit Created | Town Bell / Under Attack | ✅ Complete |
| ⭐ **StarCraft II — Terran** | SCV "Ready" | Siege Tank alarm | ✅ Complete |
| ⭐ **StarCraft II — Protoss** | Ethereal chime | "Waiting" | ✅ Complete |
| ⭐ **Warcraft III — Human** | Peasant "Ready" / "Yes mi lord" | Quest Complete | ✅ Complete |
| ⭐ **Warcraft III — Orc** | Peon "Work work" / Work Complete | Peon "Okay" | ✅ Complete |
| ⭐ **Red Alert 2** | Incoming Transmission / Red Alert | Klaxxon / Alarm | ✅ Complete |
| 🟡 **Warcraft III — Night Elf** | Level Up | Okay | ⚠️ Fallback |
| 🟡 **Warcraft III — Undead** | Okay | Level Up | ⚠️ Fallback |
| 🟡 **StarCraft II — Zerg** | Protoss fallback | Insufficient Gas | ⚠️ Fallback |
| 🛠️ **Custom** | Your own WAV/MP3 | Your own WAV/MP3 | ✅ |

## Prerequisites

- **[pi](https://github.com/earendil-works/pi-coding-agent)** — the coding agent runtime
- **[ffmpeg](https://ffmpeg.org/)** (includes `ffplay`) — needed for headless audio playback

### Install ffmpeg

```bash
# Windows (via winget)
winget install Gyan.FFmpeg

# macOS (via Homebrew)
brew install ffmpeg

# Linux (via apt)
sudo apt install ffmpeg
```

## Installation

### Option 1: pi install (recommended)

```bash
pi install git:github.com/evanokeefe39/pi-rts-alerts
```

This clones the package, runs `npm install` (which automatically downloads
sound files), and registers the extension. Run `/reload` in pi to activate.

### Option 2: Clone & link (for development)

```bash
git clone https://github.com/evanokeefe39/pi-rts-alerts.git
cd pi-rts-alerts

# Install deps + download sound files + install git hooks
npm install

# Register with pi (adds to ~/.pi/agent/settings.json)
pi install --link .
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow.

## Usage

Once installed and loaded (run `/reload` if pi was already running), you'll see
a widget showing the active sound pack:

```
🎮 Age of Empires II — Villager + Town Bell
   🔊 | /audio to change
```

### Commands

| Command | Description |
|---------|-------------|
| `/audio` | Open the interactive config menu |

The `/audio` command lets you:

- **Change sound pack** — browse and select from all available packs
- **Toggle enabled/disabled** — turn sounds on/off
- **Toggle background mode** — play sounds even in non-TUI modes (RPC, JSON)
- **Preview sounds** — hear "done" and "question" sounds before committing
- **Configure custom sounds** — point to your own WAV/MP3 files
- **Show config path** — display where config and sound files live

### Events

| Event | Sound Triggered | Typical Sound |
|-------|----------------|---------------|
| `agent_end` (AI finished) | ✅ "Done" sound | Worker voice, chime |
| `tool_call` with `ask_user` | ✅ "Question" sound | Alert, bell, klaxxon |

### Config File

`~/.pi/agent/audio-alerts-config.json` — created automatically when you run `/audio`.

```json
{
  "soundPack": "ageofempires2",
  "enabled": true,
  "backgroundMode": true
}
```

## How It Works

The extension uses **ffplay** (part of ffmpeg) with these flags for truly
headless playback:

```
ffplay -nodisp -autoexit -loglevel quiet <sound-file>
```

- `-nodisp` — No video window (audio-only files don't need display)
- `-autoexit` — Exit ffplay when playback finishes
- `-loglevel quiet` — No console output

This means **zero windows**, **zero popups**, **zero console spam** — the audio
plays silently in the background.

### Fallback Chain

1. `ffplay` → preferred, works on all platforms
2. `ffmpeg` decode → PowerShell `SoundPlayer` (Windows only, WAV files)

## Project Structure

```
pi-rts-alerts/
├── src/
│   └── extension.ts          # Main extension code
│   └── types/
│       └── pi-coding-agent.d.ts  # Ambient type declarations
├── scripts/
│   ├── download-sounds.mjs   # Download sound files from public soundboards
│   ├── link-types.mjs        # Link pi types for local type-checking
│   └── postinstall.mjs       # Post-install setup (sounds + types)
├── .github/
│   ├── workflows/
│   │   └── ci.yml            # CI: commitlint + typecheck + test + format + release
│   ├── ISSUE_TEMPLATE/       # Bug report and feature request templates
│   ├── dependabot.yml        # Automated dependency updates
│   ├── CODEOWNERS            # Code ownership
│   └── PULL_REQUEST_TEMPLATE.md
├── .commitlintrc.json        # Conventional commits config
├── .editorconfig             # Editor settings
├── .gitignore
├── lefthook.yml              # Git hooks (pre-commit, commit-msg, pre-push)
├── CHANGELOG.md              # Auto-generated release notes
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md           # Branching strategy, PR workflow, conventions
├── LICENSE                   # MIT
├── package.json
├── SECURITY.md
├── tsconfig.json
└── README.md                 # This file
```

## Development

```bash
# Type-check
npm run typecheck

# Run tests
npm test

# Format code
npm run format

# Full check (typecheck + format check + test)
npm run check

# Interactive commit (conventional commits wizard)
npm run commit

# Watch mode
npm run test:watch
```

### Git Hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs automatically on:

- **`pre-commit`** — type-check + format staged files
- **`commit-msg`** — validate conventional commit format
- **`pre-push`** — full typecheck + test + format check

To install hooks manually:

```bash
npx lefthook install
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Branch naming and strategy
- Conventional commit format
- Pull request process
- Adding new sound packs
- Code style and testing

## Versioning

This project uses [SemVer](https://semver.org/) with automated releases via
[semantic-release](https://semantic-release.gitbook.io/). Version bumps are
determined automatically from commit messages:

| Commit Type | Version Bump |
|-------------|-------------|
| `BREAKING CHANGE` | Major |
| `feat` | Minor |
| `fix`, `perf` | Patch |
| `docs`, `chore`, `ci` | No release |

## License

MIT — see [LICENSE](LICENSE) for details.

## Credits

- Game sound clips sourced from [myinstants.com](https://www.myinstants.com)
  and [101soundboards.com](https://www.101soundboards.com) — all rights belong
  to their respective game developers (Blizzard Entertainment, Microsoft Ensemble
  Studios, Westwood Studios)
- Built as a [pi](https://github.com/earendil-works/pi-coding-agent) extension
