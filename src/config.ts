/**
 * Config types and YAML/JSON loading for audio-event mappings.
 *
 * Supports two directions:
 *   1. OUTPUT: pi event → play sound file
 *   2. INPUT:  audio detection → emit pi event
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { load as parseYaml } from "js-yaml";

export const CONFIG_FILENAME = "audio-alerts.yaml";
export const CONFIG_DIR = path.join(os.homedir(), ".pi", "agent");
export const SOUNDS_DIR = path.join(CONFIG_DIR, "rts-sounds");

// ─── Output mapping: pi event → play sound ──────────────────────────

/** Condition that event data must match. All specified fields must match. */
export interface EventCondition {
	toolName?: string;
	[key: string]: unknown;
}

/** Resolve the actual file path, possibly from event data. */
export type PlayTarget =
	| string // literal file path
	| { from: string }; // field path in event data, e.g. "payload.file"

export interface OutputMapping {
	/** Pi lifecycle event name (e.g. "agent_end") or inter-extension event (prefixed with "pi-events:") */
	on: string;
	/** Optional filter — only play when event data matches these fields */
	when?: EventCondition;
	/** Sound file(s) to play. Array = pick first that exists. */
	play: PlayTarget | PlayTarget[];
	/** Volume (0-1, passed to player if supported) */
	volume?: number;
	/** Human label for menus/previews */
	label?: string;
}

// ─── Input mapping: audio detection → emit pi event ─────────────────

export interface InputMapping {
	/** Detector type: "clap" | "keyword" | "vad" | "threshold" | (custom) */
	type: string;
	/** Detector-specific parameters */
	params?: Record<string, unknown>;
	/** Pi event name to emit when detected */
	emit: string;
	/** Data to attach to the emitted event */
	data?: Record<string, unknown>;
	/** Seconds to ignore after a trigger (default: 0.5) */
	cooldown?: number;
	/** Human label */
	label?: string;
}

// ─── Full config ─────────────────────────────────────────────────────

export interface AudioAlertsConfig {
	/** Master toggle */
	enabled: boolean;
	/** Play even in non-TUI modes (rpc, json, print) */
	backgroundMode: boolean;
	/** Legacy RTS sound pack name (backward compat) */
	soundPack?: string;
	/** Custom done/question file paths (legacy backward compat) */
	customDoneFile?: string;
	customQuestionFile?: string;
	/** Rhythm mode: cycle sounds on a beat, vary by active agent count */
	rhythmMode?: boolean;
	/** Beats per minute for rhythm mode */
	bpm?: number;
	/** Output mappings: event → sound */
	outputs: OutputMapping[];
	/** Input mappings: sound → event */
	inputs: InputMapping[];
}

// ─── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AudioAlertsConfig = {
	enabled: true,
	backgroundMode: true,
	rhythmMode: false,
	bpm: 120,
	outputs: [],
	inputs: [],
};

/** Built-in defaults that recreate the original RTS alert behavior. */
export function builtinOutputMappings(): OutputMapping[] {
	return [
		{
			on: "agent_end",
			label: "AI finished responding",
			play: [], // resolved at runtime by legacy pack logic
		},
		{
			on: "tool_call",
			when: { toolName: "ask_user" },
			label: "AI asked a question",
			play: [], // resolved at runtime by legacy pack logic
		},
	];
}

// ─── Config loading ──────────────────────────────────────────────────

/** Resolve config path, trying .yaml first, falling back to old .json. */
function resolveConfigPath(): string | null {
	const yamlPath = path.join(CONFIG_DIR, CONFIG_FILENAME);
	if (fs.existsSync(yamlPath)) return yamlPath;

	const jsonPath = path.join(CONFIG_DIR, "audio-alerts-config.json");
	if (fs.existsSync(jsonPath)) return jsonPath;

	return null;
}

/**
 * Load config from YAML (preferred) or legacy JSON.
 * Returns a merged config with defaults applied.
 */
export function loadConfig(): AudioAlertsConfig {
	const cfgPath = resolveConfigPath();
	if (!cfgPath) return { ...DEFAULT_CONFIG };

	try {
		const raw = fs.readFileSync(cfgPath, "utf-8");
		let parsed: Partial<AudioAlertsConfig>;

		if (cfgPath.endsWith(".yaml") || cfgPath.endsWith(".yml")) {
			parsed = (parseYaml(raw) ?? {}) as Partial<AudioAlertsConfig>;
		} else {
			parsed = JSON.parse(raw);
		}

		return {
			...DEFAULT_CONFIG,
			...parsed,
			outputs: parsed.outputs ?? builtinOutputMappings(),
			inputs: parsed.inputs ?? [],
		};
	} catch {
		return { ...DEFAULT_CONFIG, outputs: builtinOutputMappings() };
	}
}

/**
 * Save config as YAML.
 */
export function saveConfig(config: AudioAlertsConfig): void {
	const yamlPath = path.join(CONFIG_DIR, CONFIG_FILENAME);
	if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

	// Manual YAML serialization to avoid adding another dep.
	// js-yaml's dump() is available but produces messy output;
	// a simple serializer keeps the file clean and human-editable.
	const lines: string[] = [
		"# Pi Audio Alerts Configuration",
		"# See https://github.com/evanokeefe39/pi-rts-alerts",
		"",
		`enabled: ${config.enabled}`,
		`backgroundMode: ${config.backgroundMode}`,
		`rhythmMode: ${config.rhythmMode ?? false}`,
		`bpm: ${config.bpm ?? 120}`,
	];

	if (config.soundPack) {
		lines.push(`soundPack: "${config.soundPack}"`, "");
	}

	// Output mappings
	lines.push("outputs:");
	if (config.outputs.length === 0) {
		lines.push("  []");
	} else {
		for (const o of config.outputs) {
			lines.push(`  - on: "${o.on}"`);
			if (o.label) lines.push(`    label: "${o.label}"`);
			if (o.when) {
				lines.push("    when:");
				for (const [k, v] of Object.entries(o.when)) {
					lines.push(`      ${k}: "${v}"`);
				}
			}
			if (o.volume !== undefined) lines.push(`    volume: ${o.volume}`);
			if (Array.isArray(o.play)) {
				if (o.play.length > 0) {
					lines.push("    play:");
					for (const p of o.play) {
						if (typeof p === "string") {
							lines.push(`      - "${p}"`);
						} else if (p && typeof p === "object") {
							lines.push(`      - from: "${p.from}"`);
						}
					}
				}
			} else if (typeof o.play === "string") {
				lines.push(`    play: "${o.play}"`);
			} else if (o.play && typeof o.play === "object") {
				lines.push(`    play:`);
				lines.push(`      from: "${(o.play as { from: string }).from}"`);
			}
		}
	}

	// Input mappings
	lines.push("", "inputs:");
	if (config.inputs.length === 0) {
		lines.push("  []");
	} else {
		for (const i of config.inputs) {
			lines.push(`  - type: "${i.type}"`);
			if (i.label) lines.push(`    label: "${i.label}"`);
			lines.push(`    emit: "${i.emit}"`);
			if (i.cooldown !== undefined) lines.push(`    cooldown: ${i.cooldown}`);
			if (i.params) {
				lines.push("    params:");
				for (const [k, v] of Object.entries(i.params)) {
					if (typeof v === "string") {
						lines.push(`      ${k}: "${v}"`);
					} else {
						lines.push(`      ${k}: ${JSON.stringify(v)}`);
					}
				}
			}
			if (i.data) {
				lines.push("    data:");
				for (const [k, v] of Object.entries(i.data)) {
					if (typeof v === "string") {
						lines.push(`      ${k}: "${v}"`);
					} else {
						lines.push(`      ${k}: ${JSON.stringify(v)}`);
					}
				}
			}
		}
	}

	lines.push(""); // trailing newline
	fs.writeFileSync(yamlPath, lines.join("\n"), "utf-8");
}

/**
 * Resolve a PlayTarget to an actual file path.
 * If `from`-style, eventData provides the value.
 */
export function resolvePlayTarget(
	target: PlayTarget,
	eventData?: Record<string, unknown>,
): string | null {
	if (typeof target === "string") return target;
	if (target.from && eventData) {
		const parts = target.from.split(".");
		let val: unknown = eventData;
		for (const p of parts) {
			if (val && typeof val === "object") {
				val = (val as Record<string, unknown>)[p];
			} else {
				return null;
			}
		}
		return typeof val === "string" ? val : null;
	}
	return null;
}
