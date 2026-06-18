# Contributing to pi-rts-alerts 🎮

Thanks for your interest! This document covers the conventions and workflow
for contributing to pi-rts-alerts.

## Table of Contents

- [Branching Strategy](#branching-strategy)
- [Conventional Commits](#conventional-commits)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Adding Sound Packs](#adding-sound-packs)
- [Release Process](#release-process)

---

## Branching Strategy

We use a **trunk-based development** workflow with short-lived feature branches.

```
main  ──────●──────────●──────────●────
             \        / \        /
feature/     feat/a  /   fix/b  /
branches           /           /
                  /           /
                 /           /
                /           /
               /           /
              /           /
```

### Branch Naming

Use one of these prefixes followed by a short kebab-case description:

| Prefix        | Purpose                                  |
|---------------|------------------------------------------|
| `feat/`       | New features or sound packs              |
| `fix/`        | Bug fixes                                |
| `docs/`       | Documentation changes                    |
| `refactor/`   | Code refactoring (no functional change)  |
| `test/`       | Adding or updating tests                 |
| `chore/`      | Tooling, dependencies, CI config         |

Examples: `feat/warcraft3-night-elf`, `fix/ffplay-not-found`, `docs/update-install`

### Branch Lifecycle

1. Branch from `main`
2. Make changes, commit using [conventional commits](#conventional-commits)
3. Open a PR targeting `main`
4. After review and CI green, **squash-merge** into `main`
5. Delete the feature branch

---

## Conventional Commits

All commits **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Usage                                              |
|------------|----------------------------------------------------|
| `feat`     | A new feature or sound pack                        |
| `fix`      | A bug fix                                          |
| `docs`     | Documentation only                                 |
| `style`    | Code style/formatting (no logic change)            |
| `refactor` | Code refactoring (no functional change)            |
| `perf`     | Performance improvement                            |
| `test`     | Adding or updating tests                           |
| `build`    | Build system, dependencies                         |
| `ci`       | CI/CD configuration                                |
| `chore`    | Other changes (tooling, config, etc.)              |
| `revert`   | Revert a previous commit                           |

### Scopes

| Scope       | Usage                                  |
|-------------|----------------------------------------|
| `extension` | Core extension logic (`src/`)          |
| `sounds`    | Sound file downloads or mappings       |
| `scripts`   | Build/install scripts                  |
| `ci`        | CI/CD pipeline                         |
| `deps`      | Dependency updates                     |
| `docs`      | Documentation                          |
| `release`   | Release commits (auto-generated)       |
| `config`    | Project configuration                  |

### Examples

```
feat(sounds): add Warcraft III night elf wisp sound pack
fix(extension): handle ffplay not found on PATH gracefully
docs: update installation instructions for macOS
chore(deps): update commitlint to v19
ci: add format check job to CI pipeline
```

### Commitizen

You can use `npm run commit` to launch Commitizen's interactive prompt
instead of writing the commit message manually:

```bash
npm run commit
```

---

## Development Workflow

### Prerequisites

- Node.js >= 20
- [ffmpeg](https://ffmpeg.org/) (for audio playback)
- [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)

### Setup

```bash
# Clone the repo
git clone https://github.com/evanokeefe39/pi-rts-alerts.git
cd pi-rts-alerts

# Install dependencies (Git hooks are installed automatically via lefthook)
npm install

# Download sound files
npm run install:sounds

# Type-check to verify everything is set up
npm run typecheck
```

### Make Changes

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make changes and commit using conventional commits:
   ```bash
   git add .
   npm run commit        # Interactive prompt (recommended)
   # or manually:
   git commit -m "feat(scope): description"
   ```

3. Verify everything passes:
   ```bash
   npm run check
   ```

4. Test in pi:
   - Run `/reload` in pi to load your changes
   - Run `/audio` to test the config UI
   - Trigger an AI response to hear "done" sounds

### Pre-commit Hooks

[Lefthook](https://github.com/evilmartians/lefthook) automatically runs:

- **`tsc --noEmit`** — type-check staged TypeScript files
- **`biome check`** — format and lint staged files
- **`commitlint`** — validate commit message format

If hooks fail, fix the issues and try again. Some hooks (like `biome`) will
auto-format files and stage them.

---

## Pull Request Process

1. Ensure your branch name follows the [naming convention](#branch-naming)
2. Ensure all commits follow [conventional commits](#conventional-commits)
3. Ensure the PR title uses a conventional commit prefix (e.g., `feat:`, `fix:`)
4. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md) completely
5. Verify all CI checks pass:
   - ✅ commitlint — commit message convention
   - ✅ typecheck — TypeScript compilation
   - ✅ test — Test suite
   - ✅ format — Code formatting
   - ✅ lint — TypeScript strict checks
6. Request review from a maintainer
7. After approval, **squash-merge** your branch into `main`
   - The squash commit message should match your PR title
   - This keeps the `main` history clean and one-commit-per-feature

---

## Code Style

- **Language:** TypeScript (strict mode)
- **Indentation:** 2 spaces
- **Formatting:** Auto-formatted by [Biome](https://biomejs.dev/)
- **No semicolons** (Biome default)
- **Async:** Use `async/await` over raw promises
- **Imports:** Use ES module syntax (`import/export`)

Run the formatter before committing:

```bash
npm run format
```

---

## Testing

- Tests use [Vitest](https://vitest.dev/)
- Run the suite: `npm test`
- Watch mode: `npm run test:watch`
- Add tests alongside your changes in `src/` or a `tests/` directory
- Pure utility functions (like `resolveFfplay`, `playAudioFile`) should have tests

---

## Adding Sound Packs

To add a new sound pack:

1. **Add sound files** to the download script at `scripts/download-sounds.mjs`
   - Add URLs to the `SOUND_URLS` map
   - Use sounds from [myinstants.com](https://www.myinstants.com) or similar free soundboards

2. **Add the type** to the `SoundPack` union type in `src/extension.ts`

3. **Add the mapping** in `getSoundMapping()` in `src/extension.ts`

4. **Add the label** to `PACK_LABELS` in `src/extension.ts`

5. **Update the table** in `README.md`

6. **Run sound download** to test:
   ```bash
   npm run install:sounds
   ```

---

## Release Process

Releases are **fully automated** via [semantic-release](https://semantic-release.gitbook.io/).
When changes are merged to `main`, the CI pipeline:

1. Analyzes commits since the last release
2. Determines the next version (major/minor/patch) from commit types
3. Updates `CHANGELOG.md`
4. Updates `package.json` version
5. Creates a GitHub release with release notes
6. Publishes to npm (if configured)

### Versioning Rules

| Commit Types in Release | Version Bump |
|------------------------|-------------|
| Any `BREAKING CHANGE`  | Major (x.0.0) |
| `feat`                  | Minor (0.x.0) |
| `fix`, `perf`, etc.    | Patch (0.0.x) |
| `docs`, `chore`, `ci`  | No release |

### Manual Release

In rare cases, you can trigger a manual release:

```bash
npm run release
```

This requires `GITHUB_TOKEN` and `NPM_TOKEN` environment variables.

---

## Questions?

Open a [Discussion](https://github.com/evanokeefe39/pi-rts-alerts/discussions)
or ask in the PR comments. We're happy to help!
