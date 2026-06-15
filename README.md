# pi-rts-alerts 🔊🎮

> **Pi extension** that plays iconic RTS game sounds when the AI finishes responding or asks you a question — using `ffplay` for **zero-window, headless audio** on Windows, macOS, and Linux.

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

### Option 1: Clone & link (for development)

```bash
git clone https://github.com/evanokeefe39/pi-rts-alerts.git
cd pi-rts-alerts

# Install deps
npm install

# Download sound files
npm run install:sounds

# The extension auto-discovers from .pi/extensions/ (project-local)
# or symlink to ~/.pi/agent/extensions/ for global use:
ln -s "$PWD" ~/.pi/agent/extensions/pi-rts-alerts
```

### Option 2: Direct copy

```bash
# Copy the extension to pi's extension directory
cp src/extension.ts ~/.pi/agent/extensions/pi-rts-alerts.ts

# Install sound files
node scripts/download-sounds.mjs

# Install dependency (play-sound does the actual audio playback)
cd ~/.pi/agent/extensions && npm install
```

## Usage

Once installed, pi loads the extension automatically. You'll see a widget showing the active sound pack:

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

The extension uses **ffplay** (part of ffmpeg) with these flags for truly headless playback:

```
ffplay -nodisp -autoexit -loglevel quiet <sound-file>
```

- `-nodisp` — No video window (audio-only files don't need display)
- `-autoexit` — Exit ffplay when playback finishes
- `-loglevel quiet` — No console output

This means **zero windows**, **zero popups**, **zero console spam** — the audio plays silently in the background.

### Fallback Chain

1. `ffplay` → preferred, works on all platforms
2. `ffmpeg` decode → PowerShell `SoundPlayer` (Windows only, WAV files)

## Project Structure

```
pi-rts-alerts/
├── src/
│   └── extension.ts          # Main extension code
├── scripts/
│   └── download-sounds.mjs   # Download/generate sound files
├── .github/
│   └── workflows/
│       └── ci.yml            # CI: typecheck + tests
├── package.json              # Dependencies and metadata
├── tsconfig.json             # TypeScript config
├── README.md                 # This file
└── LICENSE                   # MIT
```

## Development

```bash
# Type-check
npm run typecheck

# Run tests
npm test

# Watch mode
npm run test:watch
```

### Making Changes

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make changes to `src/extension.ts`
3. Run `npm run typecheck` to verify types
4. Test by reloading pi: `/reload` and then `/audio`
5. Commit and push, then open a PR

## Contributing

PRs welcome! Please follow the existing code style and add tests for new features.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

## License

MIT — see [LICENSE](LICENSE) for details.

## Credits

- Game sound clips sourced from [myinstants.com](https://www.myinstants.com) — all rights belong to their respective game developers (Blizzard Entertainment, Microsoft Ensemble Studios, Westwood Studios)
- Built as a [pi](https://github.com/earendil-works/pi-coding-agent) extension
