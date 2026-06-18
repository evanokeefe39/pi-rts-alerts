# Changelog

All notable changes to pi-rts-alerts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/).

---

## [Unreleased]

### Added

- Warcraft III Orc Peon high-quality WAV sound rip support (#7)
- `/audio` interactive config browser with sound preview (#8)
- Custom sound pack support (point to your own WAV/MP3)
- Background mode toggle for non-TUI modes
- Widget showing active sound pack on session start

### Changed

- Warcraft III sound overhaul: orc peon, human peasant, night elf wisp game rips
- FFplay detection with fallback to PowerShell SoundPlayer (Windows)
- Default sound pack changed to Age of Empires II

### Fixed

- No crash when ffplay is not installed
- Windows path resolution for sound files

---

## [1.0.0] — 2026-06-01

### Added

- Initial release with 7 sound packs: Age of Empires II, StarCraft II (Terran/Protoss/Zerg),
  Warcraft III (Human/Orc/Undead), Red Alert 2
- `/audio` command with pack selection, toggle, and config
- Event-driven playback on `agent_end` and `tool_call(ask_user)`
- Sound download script (`scripts/download-sounds.mjs`)
- MIT License
- CI pipeline with type-checking and tests

[Unreleased]: https://github.com/evanokeefe39/pi-rts-alerts/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/evanokeefe39/pi-rts-alerts/releases/tag/v1.0.0
