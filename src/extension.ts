/**
 * pi-rts-alerts — RTS Sound Alerts Extension for pi
 * 
 * https://github.com/evanokeefe39/pi-rts-alerts
 * 
 * Plays iconic RTS game worker/notification sounds when:
 * - AI finishes responding (agent_end) → worker "ready" sounds
 * - AI asks a question via ask_user tool → warning/alert sounds
 * 
 * Playback uses ffplay (part of ffmpeg) with -nodisp -autoexit -loglevel quiet
 * so NO windows pop up — fully headless, cross-platform audio.
 * 
 * Sound packs (with actual game audio files from myinstants.com):
 *   - starcraft2: terran / protoss / zerg (racial worker sounds)
 *   - warcraft3: human / orc (racial worker sounds)
 *   - ageofempires2: generic villager "Shi Ho!" ~ "Ready" / town bell
 *   - redalert2: klaxxon / alarm (warning) + unit/faction sounds
 *   - custom: point to your own WAV/MP3 files
 * 
 * Config: ~/.pi/agent/audio-alerts-config.json
 * Command: /audio to change settings interactively
 * Sound files: ~/.pi/agent/rts-sounds/ (install via: npm run install:sounds)
 * Prerequisite: ffmpeg (install via: winget install Gyan.FFmpeg / brew install ffmpeg / apt install ffmpeg)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { exec, execSync } from "node:child_process";

// ─── Types ────────────────────────────────────────────────────────────

type SoundPack =
  | "starcraft2-terran"
  | "starcraft2-protoss"
  | "starcraft2-zerg"
  | "warcraft3-human"
  | "warcraft3-orc"
  | "warcraft3-nightelf"
  | "warcraft3-undead"
  | "ageofempires2"
  | "redalert2"
  | "custom";

interface AudioConfig {
  soundPack: SoundPack;
  /** Optional path to custom sound file for "done" */
  customDoneFile?: string;
  /** Optional path to custom sound file for "question" */
  customQuestionFile?: string;
  /** Enable sounds at all */
  enabled: boolean;
  /** Play sounds on non-TUI modes too (rpc, json, print) */
  backgroundMode: boolean;
}

// ─── Default config ────────────────────────────────────────────────────

const DEFAULT_CONFIG: AudioConfig = {
  soundPack: "ageofempires2",
  enabled: true,
  backgroundMode: true,
};

// ─── Config path ──────────────────────────────────────────────────────

const RTS_SOUNDS_DIR = path.join(os.homedir(), ".pi", "agent", "rts-sounds");

function getConfigPath(): string {
  return path.join(os.homedir(), ".pi", "agent", "audio-alerts-config.json");
}

function loadConfig(): AudioConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config: AudioConfig): void {
  const cfgPath = getConfigPath();
  const dir = path.dirname(cfgPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");
}

// ─── Sound file mappings ──────────────────────────────────────────────

interface SoundFileMapping {
  /** Path(s) to the "done" sound file(s) — first existing one wins */
  done: string[];
  /** Path(s) to the "question" sound file(s) — first existing one wins */
  question: string[];
}

function getSoundMapping(pack: SoundPack): SoundFileMapping {
  const s = RTS_SOUNDS_DIR;
  switch (pack) {
    case "starcraft2-terran":
      return {
        done: [path.join(s, "starcraft2", "terran", "scv-ready.mp3")],
        question: [path.join(s, "starcraft2", "terran", "siege-tank.mp3")],
      };
    case "starcraft2-protoss":
      return {
        done: [path.join(s, "starcraft2", "protoss", "chime.mp3")],
        question: [path.join(s, "starcraft2", "protoss", "waiting.mp3")],
      };
    case "starcraft2-zerg":
      return {
        done: [path.join(s, "starcraft2", "protoss", "chime.mp3")],  // fallback
        question: [path.join(s, "starcraft2", "protoss", "insufficient-gas.mp3")],
      };
    case "warcraft3-human":
      return {
        done: [
          // High-quality WAV rips (first existing wins)
          path.join(s, "warcraft3", "human", "PeasantReady1.wav"),
          path.join(s, "warcraft3", "human", "PeasantYes1.wav"),
          path.join(s, "warcraft3", "human", "PeasantYes2.wav"),
          path.join(s, "warcraft3", "human", "PeasantYes3.wav"),
          path.join(s, "warcraft3", "human", "PeasantYes4.wav"),
          // Fallback MP3s from myinstants
          path.join(s, "warcraft3", "human", "peasant-ready.mp3"),
          path.join(s, "warcraft3", "human", "yes-mi-lord.mp3"),
        ],
        question: [
          path.join(s, "warcraft3", "human", "PeasantWhat1.wav"),
          path.join(s, "warcraft3", "human", "PeasantWhat2.wav"),
          path.join(s, "warcraft3", "human", "PeasantWhat3.wav"),
          path.join(s, "warcraft3", "human", "PeasantWhat4.wav"),
          path.join(s, "warcraft3", "quest-complete.mp3"),
        ],
      };
    case "warcraft3-orc":
      return {
        done: [
          // High-quality WAV rips (first existing wins)
          path.join(s, "warcraft3", "orc", "PeonReady1.wav"),
          path.join(s, "warcraft3", "orc", "PeonYes1.wav"),
          path.join(s, "warcraft3", "orc", "PeonYes2.wav"),
          path.join(s, "warcraft3", "orc", "PeonYes3.wav"),
          // Fallback MP3s from myinstants
          path.join(s, "warcraft3", "orc", "peon-work-work.mp3"),
          path.join(s, "warcraft3", "orc", "peon-work-complete.mp3"),
        ],
        question: [
          // "Something need doing?" — PeonWhat4 is the exact game rip
          path.join(s, "warcraft3", "orc", "PeonWhat4.wav"),
          path.join(s, "warcraft3", "orc", "PeonWhat1.wav"),
          path.join(s, "warcraft3", "orc", "PeonWhat2.wav"),
          path.join(s, "warcraft3", "orc", "PeonWhat3.wav"),
          // Fallback MP3s
          path.join(s, "warcraft3", "orc", "peon-something-need-doing.mp3"),
          path.join(s, "warcraft3", "orc", "peon-okay.mp3"),
        ],
      };
    case "warcraft3-nightelf":
      return {
        done: [
          // High-quality WAV rips (first existing wins)
          path.join(s, "warcraft3", "wisp", "WispReady1.wav"),
          path.join(s, "warcraft3", "wisp", "WispYes1.wav"),
          path.join(s, "warcraft3", "wisp", "WispYes2.wav"),
          path.join(s, "warcraft3", "wisp", "WispYes3.wav"),
          // Fallback MP3
          path.join(s, "warcraft3", "level-up.mp3"),
        ],
        question: [
          path.join(s, "warcraft3", "wisp", "WispWhat1.wav"),
          path.join(s, "warcraft3", "wisp", "WispWhat2.wav"),
          path.join(s, "warcraft3", "wisp", "WispWhat3.wav"),
          path.join(s, "warcraft3", "wc3-okay.mp3"),
        ],
      };
    case "warcraft3-undead":
      return {
        done: [path.join(s, "warcraft3", "wc3-okay.mp3")],
        question: [path.join(s, "warcraft3", "level-up.mp3")],
      };
    case "ageofempires2":
      return {
        done: [path.join(s, "ageofempires2", "villager-ready.mp3"), path.join(s, "ageofempires2", "unit-created.mp3")],
        question: [path.join(s, "ageofempires2", "town-bell.mp3"), path.join(s, "ageofempires2", "under-attack.mp3")],
      };
    case "redalert2":
      return {
        done: [path.join(s, "redalert2", "incoming-transmission.mp3"), path.join(s, "redalert2", "redalert.mp3")],
        question: [path.join(s, "redalert2", "klaxxon.mp3"), path.join(s, "redalert2", "alarm.mp3")],
      };
    case "custom":
      return { done: [], question: [] };
  }
}

// ─── Human-readable names ─────────────────────────────────────────────

const PACK_LABELS: Record<string, string> = {
  "starcraft2-terran": "⭐ StarCraft II — Terran (SCV \"Reporting for duty\")",
  "starcraft2-protoss": "⭐ StarCraft II — Protoss (Ethereal chime)",
  "starcraft2-zerg": "  StarCraft II — Zerg",
  "warcraft3-human": "⭐ Warcraft III — Human (Peasant \"Ready to work\")",
  "warcraft3-orc": "⭐ Warcraft III — Orc Peon",
  "warcraft3-nightelf": "  Warcraft III — Night Elf (Wisp)",
  "warcraft3-undead": "  Warcraft III — Undead",
  "ageofempires2": "⭐ Age of Empires II — Villager + Town Bell",
  "redalert2": "⭐ Red Alert 2 — Klaxxon + Incoming Transmission",
  "custom": "Custom (your own files)",
};

// ─── Sound Player ─────────────────────────────────────────────────────

let pendingQuestionTool = false;

let _ffplayPath: string | null = null;

/**
 * Resolve ffplay path, caching the result.
 * Checks PATH, then common install locations.
 */
function resolveFfplay(): string | null {
  if (_ffplayPath !== null) return _ffplayPath;

  // Check if ffplay is on PATH
  try {
    execSync("ffplay -version", { stdio: "ignore", windowsHide: true });
    _ffplayPath = "ffplay";
    return _ffplayPath;
  } catch {
    // Not on PATH
  }

  // Common Windows install paths
  const candidates = [
    "C:\\Program Files\\ffmpeg\\bin\\ffplay.exe",
    "C:\\Program Files\\ffmpeg\\ffplay.exe",
    "C:\\ffmpeg\\bin\\ffplay.exe",
    path.join(os.homedir(), "scoop", "apps", "ffmpeg", "current", "bin", "ffplay.exe"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      _ffplayPath = c;
      return _ffplayPath;
    }
  }

  _ffplayPath = null;
  return null;
}

/**
 * Play an audio file using ffplay (no window, no UI, cross-platform).
 * Falls back to ffmpeg decode → PowerShell SoundPlayer for WAV if ffplay unavailable.
 */
function playAudioFile(filePath: string): void {
  if (!filePath || !fs.existsSync(filePath)) return;
  const absPath = path.resolve(filePath);

  const ffplay = resolveFfplay();
  if (ffplay) {
    const escapedPath = absPath.replace(/"/g, '\\"');
    exec(
      `"${ffplay}" -nodisp -autoexit -loglevel quiet "${escapedPath}"`,
      { windowsHide: true },
      () => { /* fire-and-forget */ }
    );
    return;
  }

  // Fallback: decode with ffmpeg → pipe to PowerShell SoundPlayer (WAV only)
  if (absPath.endsWith(".mp3") || absPath.endsWith(".wav")) {
    exec(
      `powershell -NoProfile -Command "$p='${absPath.replace(/'/g, "''")}'; try { if($p -match '\\.mp3$') { $f=[System.IO.Path]::GetTempFileName()+'.wav'; & ffmpeg -i \"$p\" -y \"$f\" 2>$null; (New-Object Media.SoundPlayer \"$f\").PlaySync(); Remove-Item \"$f\" } else { (New-Object Media.SoundPlayer \"$p\").PlaySync() } } catch {}"`,
      { windowsHide: true },
      () => { /* fire-and-forget */ }
    );
  }
}

// ─── Init: warn if no ffmpeg found ─────────────────────────────────────

if (!resolveFfplay()) {
  try {
    execSync("ffmpeg -version", { stdio: "ignore", windowsHide: true });
  } catch {
    // No ffmpeg needed — will fall back to PowerShell SoundPlayer for WAV
  }
}

/**
 * Play the appropriate sound based on config and context
 */
function playSound(type: "done" | "question", config: AudioConfig): void {
  if (!config.enabled) return;

  if (config.soundPack === "custom") {
    const file = type === "done" ? config.customDoneFile : config.customQuestionFile;
    if (file) playAudioFile(file);
    return;
  }

  const mapping = getSoundMapping(config.soundPack);
  const candidates = type === "done" ? mapping.done : mapping.question;

  // Pick first existing file
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      playAudioFile(candidate);
      return;
    }
  }

  // If no files exist, fall back silently (files weren't downloaded)
}

// ─── Extension Entry ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  loadConfig();

  // ── Register /audio command ──────────────────────────────────────────
  pi.registerCommand("audio", {
    description: "Configure audio alerts (sound pack, toggle, test sounds)",
    handler: async (_args, ctx) => {
      const current = loadConfig();

      /**
       * Show the pack detail view — list all sound files in the current pack
       * with preview options, plus back/exit navigation.
       */
      async function showPackDetail(): Promise<"back" | "exit" | undefined> {
        const mapping = getSoundMapping(current.soundPack);
        const packLabel = PACK_LABELS[current.soundPack] || current.soundPack;

        // Build sound preview entries
        const soundEntries: { id: string; label: string; type: "done" | "question"; idx: number }[] = [];

        for (const [type, files] of Object.entries(mapping) as ["done" | "question", string[]][]) {
          for (let i = 0; i < files.length; i++) {
            const fname = path.basename(files[i]);
            const exists = fs.existsSync(files[i]);
            const existsMark = exists ? "" : " ⚠️";
            soundEntries.push({
              id: `preview-${type}-${i}`,
              label: `  ▶️ ${type === "done" ? "Done" : "Question?"}: ${fname}${existsMark}`,
              type,
              idx: i,
            });
          }
        }

        const options = [
          ...soundEntries.map((e) => e.label),
          "───",
          "⬅️ Back to packs",
          "⬅️ Exit",
        ];

        const selected = await ctx.ui.select(
          `🎮 ${packLabel}`,
          options,
        );
        if (!selected) return "back";

        if (selected === "⬅️ Back to packs") return "back";
        if (selected === "⬅️ Exit") return "exit";
        if (selected === "───") return "back";

        // Preview a sound
        const entry = soundEntries.find((e) => e.label === selected);
        if (entry) {
          const file = mapping[entry.type][entry.idx];
          playAudioFile(file);
          // After preview, show the same view again so user can preview more
          return showPackDetail();
        }

        return "back";
      }

      /**
       * Main pack browser — list all packs + toggles, loop until exit.
       */
      async function packBrowser(): Promise<void> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const packEntries = Object.entries(PACK_LABELS);

          // Build options: toggles first, then packs, then exit
          const toggleOptions: { id: string; label: string }[] = [
            {
              id: "__toggle",
              label: `${current.enabled ? "🔊" : "🔇"} Enabled: ${current.enabled ? "ON" : "OFF"}`,
            },
            {
              id: "__bg",
              label: `🔄 Background: ${current.backgroundMode ? "ON" : "OFF"}`,
            },
            {
              id: "__path",
              label: "📁 Config path",
            },
          ];

          const packListOptions = packEntries.map(([key, label]) => ({
            id: key,
            label: `${key === current.soundPack ? "●" : "○"} ${label}`,
          }));

          if (current.soundPack === "custom") {
            packListOptions.push({
              id: "__custom-done",
              label: `  Custom done: ${current.customDoneFile || "(not set)"}`,
            });
            packListOptions.push({
              id: "__custom-question",
              label: `  Custom question: ${current.customQuestionFile || "(not set)"}`,
            });
          }

          const navOptions = [
            { id: "__exit", label: "⬅️ Exit" },
          ];

          const allOptions = [...toggleOptions, "───" as any, ...packListOptions, "───" as any, ...navOptions].map(
            (o: any) => (typeof o === "string" ? o : o.label),
          );

          const selected = await ctx.ui.select(
            "🎮 Audio Alerts",
            allOptions as string[],
          );
          if (!selected) return; // Escape = exit

          // Find the action
          const toggleMatch = toggleOptions.find((o) => o.label === selected);
          if (toggleMatch) {
            switch (toggleMatch.id) {
              case "__toggle":
                current.enabled = !current.enabled;
                saveConfig(current);
                ctx.ui.notify(
                  `Audio alerts ${current.enabled ? "enabled ✅" : "disabled ❌"}`,
                  "info",
                );
                if (current.enabled) playSound("done", loadConfig());
                continue;
              case "__bg":
                current.backgroundMode = !current.backgroundMode;
                saveConfig(current);
                ctx.ui.notify(`Background mode ${current.backgroundMode ? "on" : "off"}`, "info");
                continue;
              case "__path":
                ctx.ui.notify(`Config: ${getConfigPath()}\nSounds: ${RTS_SOUNDS_DIR}`, "info");
                continue;
            }
          }

          // Check exit
          const navMatch = navOptions.find((o) => o.label === selected);
          if (navMatch) return;

          // Separator
          if (selected === "───") continue;

          // Custom file settings
          const customMatch = [
            { id: "__custom-done", label: `  Custom done: ${current.customDoneFile || "(not set)"}` },
            { id: "__custom-question", label: `  Custom question: ${current.customQuestionFile || "(not set)"}` },
          ].find((o) => o.label === selected);
          if (customMatch) {
            const isDone = customMatch.id === "__custom-done";
            const prompt = isDone ? "Path to 'done' sound file:" : "Path to 'question' sound file:";
            const currentVal = isDone ? current.customDoneFile : current.customQuestionFile;
            const p = await ctx.ui.input(prompt, currentVal || "");
            if (p) {
              if (fs.existsSync(p)) {
                if (isDone) current.customDoneFile = p;
                else current.customQuestionFile = p;
                saveConfig(current);
                ctx.ui.notify("Custom sound set", "info");
                playAudioFile(p);
              } else {
                ctx.ui.notify("File not found", "error");
              }
            }
            continue;
          }

          // Find by matching the pack key in the label
          const packMatch = packListOptions.find((o) => o.label === selected);
          if (packMatch) {
            const key = packMatch.id;
            if (key === current.soundPack) {
              // Already on this pack → show pack detail
              const result = await showPackDetail();
              if (result === "exit") return;
              // "back" stays in the pack browser loop
            } else {
              // Switch to this pack
              current.soundPack = key as SoundPack;
              saveConfig(current);
              ctx.ui.notify(`Sound pack: ${PACK_LABELS[key]}`, "info");
              playSound("done", loadConfig());
              // Stay in pack browser to show updated view
            }
          }
        }
      }

      await packBrowser();
    },
  });

  // ── Detect AI asking a question → play warning sound ────────────────
  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "ask_user") {
      pendingQuestionTool = true;
      playSound("question", loadConfig());
    }
  });

  pi.on("tool_call", async (event) => {
    if (
      !pendingQuestionTool &&
      (event.toolName.includes("ask") ||
       event.toolName.includes("question") ||
       event.toolName.includes("clarify"))
    ) {
      if (event.toolName !== "ask_user") {
        pendingQuestionTool = true;
        playSound("question", loadConfig());
      }
    }
  });

  // ── AI finished responding → play "done" sound ───────────────────────
  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI && !loadConfig().backgroundMode) return;

    const cfg = loadConfig();
    if (!pendingQuestionTool) {
      playSound("done", cfg);
    }
    pendingQuestionTool = false;
  });

  // ── Widget on session start ──────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    const cfg = loadConfig();
    if (cfg.enabled) {
      ctx.ui.setWidget("audio-alerts", [
        `🎮 ${PACK_LABELS[cfg.soundPack] || cfg.soundPack}`,
        `   ${cfg.enabled ? "🔊" : "🔇"} | /audio to change`,
      ]);
    }
  });
}

// ─── Exports for testing ───────────────────────────────────────────────
export { resolveFfplay, playAudioFile };
