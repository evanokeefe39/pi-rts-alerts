/**
 * pi-rts-alerts — Audio-Event Mapping Extension for pi
 *
 * Maps audio to any pi event via the same event system extensions use:
 *
 *   1. OUTPUT: any pi event → play any sound (configurable YAML mappings)
 *   2. INPUT:  microphone detects sound → emit pi events (inter-extension bus)
 *   3. EXTEND: other extensions use pi.events.emit("audio:play", {file})
 *              or listen for pi.events.on("audio:clap", handler)
 *
 * Legacy RTS sound pack system fully backward-compatible.
 *
 * Config: ~/.pi/agent/audio-alerts.yaml
 * Command: /audio to change settings
 * Sound files: ~/.pi/agent/rts-sounds/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AudioAlertsConfig } from "./config.js";
import {
	builtinOutputMappings,
	loadConfig,
	SOUNDS_DIR,
	saveConfig,
} from "./config.js";
import { createEventMapper, type EventMapper } from "./event-mapper.js";
import type { SoundPlayer } from "./sound-player.js";
import { getBestPlayer } from "./sound-player.js";

// ─── Sound pack mappings (legacy, kept for backward compat) ──────────

interface LegacySoundMapping {
	done: string[];
	question: string[];
}

type LegacySoundPack =
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

function getLegacyMapping(pack: LegacySoundPack): LegacySoundMapping {
	const s = SOUNDS_DIR;
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
				done: [path.join(s, "starcraft2", "protoss", "chime.mp3")],
				question: [
					path.join(s, "starcraft2", "protoss", "insufficient-gas.mp3"),
				],
			};
		case "warcraft3-human":
			return {
				done: [
					path.join(s, "warcraft3", "human", "PeasantReady1.wav"),
					path.join(s, "warcraft3", "human", "PeasantYes1.wav"),
					path.join(s, "warcraft3", "human", "PeasantYes2.wav"),
					path.join(s, "warcraft3", "human", "PeasantYes3.wav"),
					path.join(s, "warcraft3", "human", "PeasantYes4.wav"),
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
					path.join(s, "warcraft3", "orc", "PeonReady1.wav"),
					path.join(s, "warcraft3", "orc", "PeonYes1.wav"),
					path.join(s, "warcraft3", "orc", "PeonYes2.wav"),
					path.join(s, "warcraft3", "orc", "PeonYes3.wav"),
					path.join(s, "warcraft3", "orc", "peon-work-work.mp3"),
					path.join(s, "warcraft3", "orc", "peon-work-complete.mp3"),
				],
				question: [
					path.join(s, "warcraft3", "orc", "PeonWhat4.wav"),
					path.join(s, "warcraft3", "orc", "PeonWhat1.wav"),
					path.join(s, "warcraft3", "orc", "PeonWhat2.wav"),
					path.join(s, "warcraft3", "orc", "PeonWhat3.wav"),
					path.join(s, "warcraft3", "orc", "peon-something-need-doing.mp3"),
					path.join(s, "warcraft3", "orc", "peon-okay.mp3"),
				],
			};
		case "warcraft3-nightelf":
			return {
				done: [
					path.join(s, "warcraft3", "wisp", "WispReady1.wav"),
					path.join(s, "warcraft3", "wisp", "WispYes1.wav"),
					path.join(s, "warcraft3", "wisp", "WispYes2.wav"),
					path.join(s, "warcraft3", "wisp", "WispYes3.wav"),
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
				done: [
					path.join(s, "ageofempires2", "villager-ready.mp3"),
					path.join(s, "ageofempires2", "unit-created.mp3"),
				],
				question: [
					path.join(s, "ageofempires2", "town-bell.mp3"),
					path.join(s, "ageofempires2", "under-attack.mp3"),
				],
			};
		case "redalert2":
			return {
				done: [
					path.join(s, "redalert2", "incoming-transmission.mp3"),
					path.join(s, "redalert2", "redalert.mp3"),
				],
				question: [
					path.join(s, "redalert2", "klaxxon.mp3"),
					path.join(s, "redalert2", "alarm.mp3"),
				],
			};
		case "custom":
			return { done: [], question: [] };
	}
}

const PACK_LABELS: Record<string, string> = {
	"starcraft2-terran": '⭐ StarCraft II — Terran (SCV "Reporting for duty")',
	"starcraft2-protoss": "⭐ StarCraft II — Protoss (Ethereal chime)",
	"starcraft2-zerg": "  StarCraft II — Zerg",
	"warcraft3-human": '⭐ Warcraft III — Human (Peasant "Ready to work")',
	"warcraft3-orc": "⭐ Warcraft III — Orc Peon",
	"warcraft3-nightelf": "  Warcraft III — Night Elf (Wisp)",
	"warcraft3-undead": "  Warcraft III — Undead",
	ageofempires2: "⭐ Age of Empires II — Villager + Town Bell",
	redalert2: "⭐ Red Alert 2 — Klaxxon + Incoming Transmission",
	custom: "Custom (your own files)",
};

// ─── Module-level state ───────────────────────────────────────────────

let _mapper: EventMapper | null = null;

// ponytail: shared beat + agent counter for rhythm mode.
// Upgrade: replace simple counter with proper conductor when
// multiple concurrent subagents need phase-locked audio.
let _beat = 0;
let _activeAgents = 0;
let _rhythmConfig = { enabled: false, bpm: 120 };

export function getMapper(): EventMapper | null {
	return _mapper;
}

// ─── Extension entry ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const config = loadConfig();
	const player = getBestPlayer();

	// ── Expose for other extensions ──────────────────────────────────
	// Other extensions can call:
	//   pi.sendMessage("/audio:play /path/to/file.mp3")
	//   pi.events.emit("audio:play", { file: "/path/to/file.mp3" })
	//   pi.events.on("audio:detection:clap", handler)

	// Register inter-extension event listener for "audio:play"
	if (pi.events) {
		pi.events.on("audio:play", (data: unknown) => {
			const d = data as { file?: string; volume?: number } | undefined;
			if (d?.file) {
				player.play(d.file, { volume: d.volume });
			}
		});
	}

	// ── Create EventMapper (the core abstraction) ────────────────────
	_mapper = createEventMapper(pi, player, config);

	// Seed legacy file paths for backward compat
	const legacyMapping = getLegacyMapping(
		(config.soundPack as LegacySoundPack) ?? "ageofempires2",
	);
	const doneFiles =
		config.soundPack === "custom" && config.customDoneFile
			? [config.customDoneFile]
			: legacyMapping.done;
	const questionFiles =
		config.soundPack === "custom" && config.customQuestionFile
			? [config.customQuestionFile]
			: legacyMapping.question;
	_mapper.setLegacyFiles(doneFiles, questionFiles);

	// Legacy pending-Question tracker (for the "don't play done after question" rule)
	let pendingQuestionTool = false;

	// ── Track active agents for rhythm mode ──────────────────────────
	// ponytail: simple counter, doesn't track per-agent identity.
	// Upgrade: track agent IDs if per-agent sound profiles needed.
	_activeAgents = 0;
	_beat = 0;
	_rhythmConfig = {
		enabled: config.rhythmMode ?? false,
		bpm: config.bpm ?? 120,
	};

	pi.on("tool_call", async (event: any, _ctx: any) => {
		_activeAgents++;
		_beat++;

		if (event.toolName === "ask_user") {
			pendingQuestionTool = true;
			const file = _rhythmConfig.enabled
				? pickCyclic(questionFiles, _beat)
				: pickFirstExisting(questionFiles);
			if (file) player.play(file);
		}
	});

	pi.on("agent_end", async (_event: any, ctx: any) => {
		_activeAgents = Math.max(0, _activeAgents - 1);
		_beat++;

		if (!ctx.hasUI && !config.backgroundMode) return;
		if (pendingQuestionTool) {
			pendingQuestionTool = false;
			return; // question sound already played
		}
		const files = _rhythmConfig.enabled
			? rotateFiles(doneFiles, _beat)
			: doneFiles;
		const file = pickFirstExisting(files);
		if (file) player.play(file);
	});

	// ── /audio command (keeps existing UI, now also shows new features) ──

	pi.registerCommand("audio", {
		description: "Configure audio alerts (sound pack, toggle, custom mappings)",
		handler: async (_args: string, ctx: any) => {
			const current = loadConfig();
			const nconf = current; // mutable reference

			async function showPackDetail(): Promise<"back" | "exit" | undefined> {
				const mapping = getLegacyMapping(
					(nconf.soundPack as LegacySoundPack) ?? "ageofempires2",
				);
				const packLabel = PACK_LABELS[nconf.soundPack ?? ""] || nconf.soundPack;

				const soundEntries: {
					id: string;
					label: string;
					type: "done" | "question";
					idx: number;
				}[] = [];

				for (const [type, files] of Object.entries(mapping) as [
					"done" | "question",
					string[],
				][]) {
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

				const selected = await ctx.ui.select(`🎮 ${packLabel}`, options);
				if (!selected) return "back";
				if (selected === "⬅️ Back to packs") return "back";
				if (selected === "⬅️ Exit") return "exit";
				if (selected === "───") return "back";

				const entry = soundEntries.find((e) => e.label === selected);
				if (entry) {
					const file = mapping[entry.type][entry.idx];
					if (file && fs.existsSync(file)) {
						player.play(file);
					}
					return showPackDetail();
				}

				return "back";
			}

			async function packBrowser(): Promise<void> {
				while (true) {
					const packEntries = Object.entries(PACK_LABELS);

					const toggleOptions: { id: string; label: string }[] = [
						{
							id: "__toggle",
							label: `${nconf.enabled ? "🔊" : "🔇"} Enabled: ${nconf.enabled ? "ON" : "OFF"}`,
						},
						{
							id: "__bg",
							label: `🔄 Background: ${nconf.backgroundMode ? "ON" : "OFF"}`,
						},
						{
							id: "__mappings",
							label: "🔗 Custom event mappings",
						},
						{
							id: "__detectors",
							label: "🎤 Audio input detectors",
						},
						{
							id: "__rhythm",
							label: `${nconf.rhythmMode ? "🥁" : "▫️"} Rhythm: ${nconf.rhythmMode ? `ON (${nconf.bpm ?? 120} BPM)` : "OFF"}`,
						},
						{
							id: "__path",
							label: "📁 Config path",
						},
					];

					const packListOptions = packEntries.map(([key, label]) => ({
						id: key,
						label: `${key === nconf.soundPack ? "●" : "○"} ${label}`,
					}));

					if (nconf.soundPack === "custom") {
						packListOptions.push({
							id: "__custom-done",
							label: `  Custom done: ${nconf.customDoneFile || "(not set)"}`,
						});
						packListOptions.push({
							id: "__custom-question",
							label: `  Custom question: ${nconf.customQuestionFile || "(not set)"}`,
						});
					}

					const navOptions = [{ id: "__exit", label: "⬅️ Exit" }];

					const allOptions = [
						...toggleOptions,
						"───" as any,
						...packListOptions,
						"───" as any,
						...navOptions,
					].map((o: any) => (typeof o === "string" ? o : o.label));

					const selected = await ctx.ui.select("🎮 Audio Alerts", allOptions);
					if (!selected) return;

					const toggleMatch = toggleOptions.find((o) => o.label === selected);
					if (toggleMatch) {
						switch (toggleMatch.id) {
							case "__toggle":
								nconf.enabled = !nconf.enabled;
								saveConfig(nconf);
								ctx.ui.notify(
									`Audio alerts ${nconf.enabled ? "enabled ✅" : "disabled ❌"}`,
									"info",
								);
								continue;
							case "__bg":
								nconf.backgroundMode = !nconf.backgroundMode;
								saveConfig(nconf);
								ctx.ui.notify(
									`Background mode ${nconf.backgroundMode ? "on" : "off"}`,
									"info",
								);
								continue;
							case "__mappings":
								await showMappingsMenu(ctx, nconf, player);
								continue;
							case "__detectors":
								await showDetectorsMenu(ctx, nconf);
								continue;
							case "__path":
								ctx.ui.notify(
									`Config: ${path.join(os.homedir(), ".pi", "agent", "audio-alerts.yaml")}\nSounds: ${SOUNDS_DIR}`,
									"info",
								);
								continue;
						}
					}

					const navMatch = navOptions.find((o) => o.label === selected);
					if (navMatch) return;

					if (selected === "───") continue;

					const customMatch = [
						{
							id: "__custom-done",
							label: `  Custom done: ${nconf.customDoneFile || "(not set)"}`,
						},
						{
							id: "__custom-question",
							label: `  Custom question: ${nconf.customQuestionFile || "(not set)"}`,
						},
					].find((o) => o.label === selected);
					if (customMatch) {
						const isDone = customMatch.id === "__custom-done";
						const prompt = isDone
							? "Path to 'done' sound file:"
							: "Path to 'question' sound file:";
						const currentVal = isDone
							? nconf.customDoneFile
							: nconf.customQuestionFile;
						const p = await ctx.ui.input(prompt, currentVal || "");
						if (p) {
							if (fs.existsSync(p)) {
								if (isDone) nconf.customDoneFile = p;
								else nconf.customQuestionFile = p;
								saveConfig(nconf);
								ctx.ui.notify("Custom sound set", "info");
								player.play(p);
							} else {
								ctx.ui.notify("File not found", "error");
							}
						}
						continue;
					}

					const packMatch = packListOptions.find((o) => o.label === selected);
					if (packMatch) {
						const key = packMatch.id;
						if (key === nconf.soundPack) {
							const result = await showPackDetail();
							if (result === "exit") return;
						} else {
							nconf.soundPack = key as LegacySoundPack;
							saveConfig(nconf);
							// Update legacy files in mapper
							const m = getLegacyMapping(key as LegacySoundPack);
							_mapper?.setLegacyFiles(m.done, m.question);
							ctx.ui.notify(`Sound pack: ${PACK_LABELS[key] || key}`, "info");
							const f = pickFirstExisting(m.done);
							if (f) player.play(f);
						}
					}
				}
			}

			await packBrowser();
		},
	});

	// ── Register LLM-callable tool for audio control ─────────────────
	// Allows the LLM to trigger audio playback
	pi.registerTool({
		name: "play_audio",
		label: "Play Audio",
		description:
			"Play a sound file. Path can be absolute or relative to sounds directory.",
		promptSnippet: "Play audio sound effects for the user",
		parameters: {
			type: "object",
			properties: {
				file: {
					type: "string",
					description: "Path to audio file (WAV or MP3)",
				},
				volume: {
					type: "number",
					description: "Volume 0-1 (default: 1.0)",
					minimum: 0,
					maximum: 1,
				},
			},
			required: ["file"],
		},
		async execute(_toolCallId: string, params: any) {
			const file = params.file as string;
			if (!fs.existsSync(file)) {
				return {
					content: [{ type: "text", text: `File not found: ${file}` }],
					isError: true,
				};
			}
			player.play(file, { volume: params.volume as number | undefined });
			return {
				content: [{ type: "text", text: `Playing: ${path.basename(file)}` }],
			};
		},
	});

	// ── Session lifecycle ─────────────────────────────────────────────
	pi.on("session_shutdown", async () => {
		_mapper?.stopCapture();
	});

	// ── Widget (disabled — user removed status line) ─────────────────
	// ponytail: status line widget removed per user request.
	// Add back: pi.on("session_start", ...ctx.ui.setWidget("audio-alerts", [...]))
}

// ─── Mapping browser UI ───────────────────────────────────────────────

async function showMappingsMenu(
	ctx: any,
	config: AudioAlertsConfig,
	player: SoundPlayer,
): Promise<void> {
	while (true) {
		const outputs = config.outputs ?? [];
		const lines = outputs.map(
			(o, i) =>
				`${o.label || o.on}${o.when?.toolName ? ` (${o.when.toolName})` : ""}` +
				` → ${Array.isArray(o.play) ? (o.play.length > 0 ? path.basename(resolveAnyPlayTarget(o.play[0]) ?? "") : "pack") : typeof o.play === "string" ? path.basename(o.play) : (o.play?.from ?? "?")}`,
		);

		const options = [
			...(lines.length > 0 ? lines : ["  (no custom mappings)"]),
			"───",
			"📝 Edit YAML config directly",
			"⬅️ Back",
		];

		const selected = await ctx.ui.select("🔗 Event → Audio Mappings", options);
		if (!selected || selected === "⬅️ Back" || selected === "───") return;

		if (selected === "📝 Edit YAML config directly") {
			const yamlPath = path.join(
				os.homedir(),
				".pi",
				"agent",
				"audio-alerts.yaml",
			);
			if (fs.existsSync(yamlPath)) {
				ctx.ui.notify(`Edit: ${yamlPath}`, "info");
			} else {
				ctx.ui.notify(
					"Create a YAML config file to add custom mappings",
					"info",
				);
			}
			// Show the config path, user can edit externally
		}
	}
}

// ─── Detectors menu UI ────────────────────────────────────────────────

async function showDetectorsMenu(
	ctx: any,
	config: AudioAlertsConfig,
): Promise<void> {
	while (true) {
		const inputs = config.inputs ?? [];
		const lines = inputs.map(
			(i, idx) =>
				`${idx + 1}. ${i.type} → emit "${i.emit}"` +
				(i.label ? ` (${i.label})` : ""),
		);

		const isRunning = _mapper?.isCapturing();
		const statusLine = `🎤 Capture: ${isRunning ? "● RUNNING" : "○ STOPPED"}`;

		const options = [
			statusLine,
			...(lines.length > 0 ? lines : ["  (no detectors configured)"]),
			"───",
			...(isRunning ? ["⏹ Stop capture"] : ["▶️ Start capture"]),
			"⬅️ Back",
		];

		const selected = await ctx.ui.select("🎤 Audio Input Detectors", options);
		if (!selected || selected === "⬅️ Back" || selected === "───") return;

		if (selected === "⏹ Stop capture") {
			_mapper?.stopCapture();
			ctx.ui.notify("Capture stopped", "info");
			continue;
		}
		if (selected === "▶️ Start capture") {
			const ok = _mapper?.startCapture();
			ctx.ui.notify(
				ok ? "Capture started ✅" : "No mic tool found ❌",
				ok ? "info" : "error",
			);
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────

import * as os from "node:os";

function pickFirstExisting(files: string[]): string | null {
	for (const f of files) {
		if (fs.existsSync(f)) return f;
	}
	return null;
}

function resolveAnyPlayTarget(t: unknown): string | null {
	if (typeof t === "string") return t;
	return null;
}

// ─── Exports for testing ──────────────────────────────────────────────
export { pickFirstExisting };
