/**
 * Event Mapper — the bidirectional bridge between pi events and audio.
 *
 * Two directions:
 *
 *   1. OUTPUT: pi event → play sound
 *      - Subscribes to pi lifecycle events (pi.on) and inter-extension events (pi.events.on)
 *      - Looks up matching OutputMapping, resolves the sound file, plays it
 *
 *   2. INPUT: audio detection → emit pi event
 *      - Starts AudioCapture, routes DetectionResult through configured InputMappings
 *      - Emits pi events via pi.events.emit() and/or pi.sendMessage()
 *
 * Extensions register additional event-to-audio or audio-to-event mappings
 * via the YAML config OR programmatically at runtime via addOutput/addInput.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AudioDetector, DetectionResult } from "./audio-detector.js";
import { AudioCapture, createDetector } from "./audio-detector.js";
import type {
	AudioAlertsConfig,
	EventCondition,
	InputMapping,
	OutputMapping,
	PlayTarget,
} from "./config.js";
import { resolvePlayTarget } from "./config.js";
import type { PlayOptions, SoundPlayer } from "./sound-player.js";

// ─── Match an OutputMapping against event data ─────────────────────

function matchesCondition(
	condition: EventCondition | undefined,
	eventData: Record<string, unknown>,
): boolean {
	if (!condition) return true;
	for (const [key, val] of Object.entries(condition)) {
		if (eventData[key] !== val) return false;
	}
	return true;
}

// ─── Resolve play target(s) to first-existing file ─────────────────

function resolveSoundFile(
	targets: PlayTarget | PlayTarget[],
	eventData?: Record<string, unknown>,
): string | null {
	const list = Array.isArray(targets) ? targets : [targets];
	for (const t of list) {
		const resolved = resolvePlayTarget(t, eventData);
		if (resolved && fs.existsSync(resolved)) return resolved;
	}
	return null;
}

// ─── EventMapper class ─────────────────────────────────────────────

export class EventMapper {
	private pi: ExtensionAPI;
	private player: SoundPlayer;
	private config: AudioAlertsConfig;

	// Input capture
	private capture: AudioCapture | null = null;
	private detectors: AudioDetector[] = [];

	// For backward compat with legacy RTS pack system
	private legacyDoneFiles: string[] = [];
	private legacyQuestionFiles: string[] = [];

	constructor(
		pi: ExtensionAPI,
		player: SoundPlayer,
		config: AudioAlertsConfig,
	) {
		this.pi = pi;
		this.player = player;
		this.config = config;
	}

	// ── Legacy compatibility ────────────────────────────────────────

	/**
	 * Set legacy RTS sound file paths (from old pack system).
	 * These are used as fallbacks for output mappings with empty play[].
	 */
	setLegacyFiles(doneFiles: string[], questionFiles: string[]): void {
		this.legacyDoneFiles = doneFiles;
		this.legacyQuestionFiles = questionFiles;
	}

	// ── Subscribe to pi events (output direction) ─────────────────

	/**
	 * Subscribe to all configured pi lifecycle events.
	 * Call this during session_start.
	 */
	subscribeLifecycle(): void {
		const outputs = this.config.outputs;
		if (!outputs || outputs.length === 0) return;

		// Group by event name so we only subscribe once per event
		const grouped = new Map<string, OutputMapping[]>();
		for (const o of outputs) {
			// Inter-extension events are handled by subscribeEvents()
			if (o.on.startsWith("pi-events:")) continue;
			const list = grouped.get(o.on) ?? [];
			list.push(o);
			grouped.set(o.on, list);
		}

		for (const [eventName, mappings] of grouped) {
			// Use type-safe subscription if it's a known ExtensionEvent
			this.pi.on(
				eventName as any,
				async (_event: any, ctx: ExtensionContext) => {
					if (!this.config.enabled) return;
					if (!ctx.hasUI && !this.config.backgroundMode) return;

					// Build event data from the raw event object
					const eventData = _event as Record<string, unknown>;

					for (const mapping of mappings) {
						if (!matchesCondition(mapping.when, eventData)) continue;

						// Try the configured play targets first
						const file = resolveSoundFile(mapping.play, eventData);

						if (file) {
							const opts: PlayOptions = {};
							if (mapping.volume !== undefined) opts.volume = mapping.volume;
							this.player.play(file, opts);
							return; // one match per event
						}

						// Fallback: legacy pack files
						if (mapping.when?.toolName === "ask_user") {
							const f = this.pickFirstExisting(this.legacyQuestionFiles);
							if (f) this.player.play(f, optsFromMapping(mapping));
						} else if (mapping.on === "agent_end") {
							const f = this.pickFirstExisting(this.legacyDoneFiles);
							if (f) this.player.play(f, optsFromMapping(mapping));
						}
					}
				},
			);
		}
	}

	/**
	 * Subscribe to inter-extension events (pi.events.on).
	 * These are mappings with `on: "pi-events:eventname"`.
	 */
	subscribeEvents(): void {
		const outputs = this.config.outputs;
		if (!outputs || outputs.length === 0) return;
		if (!(this.pi as any).events) return; // not available in all versions

		const events = (this.pi as any).events;

		for (const o of outputs) {
			if (!o.on.startsWith("pi-events:")) continue;
			const eventName = o.on.slice("pi-events:".length);

			events.on(eventName, (data: unknown) => {
				if (!this.config.enabled) return;
				const eventData = data as Record<string, unknown> | undefined;

				const file = resolveSoundFile(o.play, eventData);
				if (file) {
					const opts: PlayOptions = {};
					if (o.volume !== undefined) opts.volume = o.volume;
					this.player.play(file, opts);
				}
			});
		}
	}

	// ── Subscribe to input detection (input direction) ─────────────

	/**
	 * Start microphone capture based on configured input mappings.
	 * Returns true if capture started successfully.
	 */
	startCapture(): boolean {
		const inputs = this.config.inputs;
		if (!inputs || inputs.length === 0) return false;
		if (!this.config.enabled) return false;

		this.detectors = [];

		for (const mapping of inputs) {
			const det = createDetector(mapping.type, mapping.params);
			if (det) {
				this.detectors.push(det);
			} else {
				console.warn(
					`[audio] Unknown detector type "${mapping.type}", skipping`,
				);
			}
		}

		if (this.detectors.length === 0) return false;

		this.capture = new AudioCapture();
		this.capture.setDetectors(this.detectors);
		this.capture.setCallback((result: DetectionResult) => {
			this.onDetection(result);
		});

		return this.capture.start();
	}

	/** Handle a detection result — find matching InputMapping and emit event. */
	private onDetection(result: DetectionResult): void {
		for (const mapping of this.config.inputs) {
			if (mapping.type !== result.type) continue;

			const payload = {
				...mapping.data,
				...result.data,
				type: result.type,
				confidence: result.confidence,
			};

			// Emit to pi's inter-extension event bus
			if ((this.pi as any).events) {
				(this.pi as any).events.emit(mapping.emit, payload);
			}

			// Also send as a message if configured
			if (mapping.data?.sendMessage) {
				this.pi.sendMessage?.({
					customType: "audio-detection",
					content: `Audio detection: ${result.type} (confidence: ${result.confidence.toFixed(2)})`,
					display: true,
					details: { event: mapping.emit, payload },
				} as any);
			}

			// Only process first match
			break;
		}
	}

	/** Check if capture is currently running. */
	isCapturing(): boolean {
		return this.capture?.isRunning ?? false;
	}

	/** Stop capture. */
	stopCapture(): void {
		this.capture?.stop();
		this.capture = null;
	}

	// ── Programmatic API (for use by other extensions) ─────────────

	/**
	 * Play a sound file. Returns cancel function.
	 * This is the public API for external use.
	 */
	play(file: string, options?: PlayOptions): () => void {
		if (!this.config.enabled) return () => {};
		return this.player.play(file, options);
	}

	/**
	 * Get the current config (for diagnostics / UI).
	 */
	getConfig(): AudioAlertsConfig {
		return this.config;
	}

	// ── Helpers ─────────────────────────────────────────────────────

	private pickFirstExisting(files: string[]): string | null {
		for (const f of files) {
			if (fs.existsSync(f)) return f;
		}
		return null;
	}
}

function optsFromMapping(m: OutputMapping): PlayOptions {
	const opts: PlayOptions = {};
	if (m.volume !== undefined) opts.volume = m.volume;
	return opts;
}

// ─── Convenience: create an EventMapper from config + player ───────

/**
 * Factory: build an EventMapper and wire it into pi's event system.
 *
 * @param pi - ExtensionAPI from the extension factory
 * @param player - SoundPlayer backend
 * @param config - Loaded config
 * @returns The EventMapper instance (caller should hold a reference)
 */
export function createEventMapper(
	pi: ExtensionAPI,
	player: SoundPlayer,
	config: AudioAlertsConfig,
): EventMapper {
	const mapper = new EventMapper(pi, player, config);

	// Subscribe to lifecycle events
	mapper.subscribeLifecycle();

	// Subscribe to inter-extension events
	mapper.subscribeEvents();

	// Start capture if inputs are configured
	mapper.startCapture();

	return mapper;
}
