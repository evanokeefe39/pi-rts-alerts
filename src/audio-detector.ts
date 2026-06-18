/**
 * Audio detection abstraction — microphone capture → event emission.
 *
 * Architecture:
 *   - AudioCapture: reads from mic, feeds chunks to registered detectors
 *   - AudioDetector (abstract): processes chunks, returns DetectionResult or null
 *   - Built-in detectors: clap (energy threshold), silence, always-match
 *   - Extensible: registerDetector(type, factory)
 *
 * The pi event emission happens in event-mapper.ts, not here.
 * This module only handles audio capture and detection.
 */

import type { ChildProcess } from "node:child_process";
import { execSync, spawn } from "node:child_process";

// Shared audio buffer type
export type AudioChunk = Float32Array;

export interface DetectionResult {
	/** Detector type that fired */
	type: string;
	/** Confidence 0-1 */
	confidence: number;
	/** Arbitrary data from the detector */
	data?: Record<string, unknown>;
}

// ─── Detector abstraction ────────────────────────────────────────────

export abstract class AudioDetector {
	abstract readonly type: string;
	abstract process(
		chunk: AudioChunk,
		sampleRate: number,
	): DetectionResult | null;
	reset(): void {
		/* optional */
	}
}

// ─── Energy/Clap detector ────────────────────────────────────────────

export interface ClapDetectorParams {
	/** Energy threshold (0-1, default 0.3) */
	threshold?: number;
	/** Minimum silence gap between triggers in seconds (default 0.5) */
	cooldown?: number;
}

export class ClapDetector extends AudioDetector {
	readonly type = "clap";
	private threshold: number;
	private cooldown: number;
	private lastTrigger: number = 0;

	constructor(params: ClapDetectorParams = {}) {
		super();
		this.threshold = params.threshold ?? 0.3;
		this.cooldown = params.cooldown ?? 0.5;
	}

	process(chunk: AudioChunk, sampleRate: number): DetectionResult | null {
		const now = Date.now();
		if (now - this.lastTrigger < this.cooldown * 1000) return null;

		// ponytail: RMS energy detection — not FFT-based, good enough for claps
		let sumSq = 0;
		for (let i = 0; i < chunk.length; i++) {
			sumSq += chunk[i] * chunk[i];
		}
		const rms = Math.sqrt(sumSq / chunk.length);

		if (rms > this.threshold) {
			this.lastTrigger = now;
			return {
				type: this.type,
				confidence: Math.min(rms, 1),
				data: { rms, threshold: this.threshold },
			};
		}

		return null;
	}
}

// ─── Silence detector ────────────────────────────────────────────────

export interface SilenceDetectorParams {
	/** RMS below this = silence (default 0.02) */
	silenceThreshold?: number;
	/** Seconds of continuous silence to trigger (default 2.0) */
	duration?: number;
}

export class SilenceDetector extends AudioDetector {
	readonly type = "silence";
	private threshold: number;
	private duration: number;
	private silentSamples: number = 0;

	constructor(params: SilenceDetectorParams = {}) {
		super();
		this.threshold = params.silenceThreshold ?? 0.02;
		this.duration = params.duration ?? 2.0;
	}

	process(chunk: AudioChunk, sampleRate: number): DetectionResult | null {
		let sumSq = 0;
		for (let i = 0; i < chunk.length; i++) {
			sumSq += chunk[i] * chunk[i];
		}
		const rms = Math.sqrt(sumSq / chunk.length);

		if (rms < this.threshold) {
			this.silentSamples += chunk.length;
			const silentSec = this.silentSamples / sampleRate;
			if (silentSec >= this.duration) {
				this.silentSamples = 0;
				return {
					type: this.type,
					confidence: 1,
					data: { durationSec: silentSec },
				};
			}
		} else {
			this.silentSamples = 0;
		}

		return null;
	}

	reset(): void {
		this.silentSamples = 0;
	}
}

// ─── Always-match detector (for testing/direct triggers) ─────────────

export class AlwaysDetector extends AudioDetector {
	readonly type = "always";
	private triggered = false;

	process(_chunk: AudioChunk, _sampleRate: number): DetectionResult | null {
		if (this.triggered) return null;
		this.triggered = true;
		return { type: this.type, confidence: 1 };
	}

	reset(): void {
		this.triggered = false;
	}
}

// ─── Detector registry ───────────────────────────────────────────────

type DetectorFactory = (params?: Record<string, unknown>) => AudioDetector;

const detectorFactories = new Map<string, DetectorFactory>([
	["clap", (p) => new ClapDetector(p as ClapDetectorParams)],
	["silence", (p) => new SilenceDetector(p as SilenceDetectorParams)],
	["always", () => new AlwaysDetector()],
]);

/** Register a custom detector type. */
export function registerDetector(type: string, factory: DetectorFactory): void {
	detectorFactories.set(type, factory);
}

/** Create a detector instance by type name. */
export function createDetector(
	type: string,
	params?: Record<string, unknown>,
): AudioDetector | null {
	const factory = detectorFactories.get(type);
	return factory ? factory(params) : null;
}

// ─── Audio capture ───────────────────────────────────────────────────

export interface AudioCaptureOptions {
	/** Sample rate in Hz (default: 16000) */
	sampleRate?: number;
	/** Buffer size (default: 1024) */
	blockSize?: number;
	/** Input device index (default: default) */
	device?: number;
}

/**
 * Captures microphone audio and routes chunks through detectors.
 *
 * Uses a pull-based model: start() spawns a background read loop.
 * Shells out to `sox` / `rec` / `arecord` / `ffmpeg` for raw PCM capture.
 *
 * Extensible: override via custom DetectorFactories or replace AudioCapture.
 */
export class AudioCapture {
	private options: Required<AudioCaptureOptions>;
	private detectors: AudioDetector[] = [];
	private running = false;
	private process: ChildProcess | null = null;
	private onDetect: ((result: DetectionResult) => void) | null = null;

	constructor(options: AudioCaptureOptions = {}) {
		this.options = {
			sampleRate: options.sampleRate ?? 16000,
			blockSize: options.blockSize ?? 1024,
			device: options.device ?? -1,
		};
	}

	setDetectors(detectors: AudioDetector[]): void {
		this.detectors = detectors;
	}

	setCallback(cb: (result: DetectionResult) => void): void {
		this.onDetect = cb;
	}

	/**
	 * Start capture. Uses whatever mic tool is available:
	 *   sox/rec > ffmpeg > arecord (Linux) > none
	 */
	start(): boolean {
		if (this.running) return true;

		const cmd = this.resolveCaptureCommand();
		if (!cmd) {
			console.warn(
				"[audio] No microphone capture tool found (try: sox, ffmpeg, arecord)",
			);
			return false;
		}

		this.running = true;
		const parts = cmd.split(" ");
		const prog = parts[0]!;
		const args = parts.slice(1);
		this.process = spawn(prog, args, {
			stdio: ["ignore", "pipe", "ignore"],
			windowsHide: true,
		});

		const bytesPerSample = 2; // 16-bit PCM
		const frameBytes = this.options.blockSize * bytesPerSample;
		let buffer = Buffer.alloc(0);

		this.process.stdout?.on("data", (data: Buffer) => {
			if (!this.running) return;
			buffer = Buffer.concat([buffer, data]);

			while (buffer.length >= frameBytes) {
				const chunk = buffer.subarray(0, frameBytes);
				buffer = buffer.subarray(frameBytes);

				// Convert int16 PCM to Float32Array
				const samples = new Float32Array(this.options.blockSize);
				for (let i = 0; i < this.options.blockSize; i++) {
					const int16 = chunk.readInt16LE(i * 2);
					samples[i] = int16 / 32768;
				}

				// Run through all detectors
				for (const det of this.detectors) {
					const result = det.process(samples, this.options.sampleRate);
					if (result && this.onDetect) {
						this.onDetect(result);
					}
				}
			}
		});

		this.process.on("exit", () => {
			this.running = false;
			this.process = null;
		});

		return true;
	}

	stop(): void {
		this.running = false;
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
	}

	get isRunning(): boolean {
		return this.running;
	}

	private resolveCaptureCommand(): string | null {
		const rate = this.options.sampleRate;
		const dev = this.options.device >= 0 ? ` -d ${this.options.device}` : "";

		// Try sox/rec first (cross-platform, standard)
		try {
			execSync("sox --version", { stdio: "ignore" });
			return `sox${dev} -t raw -r ${rate} -e signed -b 16 -c 1 -`;
		} catch {
			// not found
		}

		try {
			execSync("rec --version", { stdio: "ignore" });
			return `rec${dev} -t raw -r ${rate} -e signed -b 16 -c 1 -`;
		} catch {
			// not found
		}

		// ffmpeg as fallback
		try {
			execSync("ffmpeg -version", { stdio: "ignore", windowsHide: true });
			// Windows DirectShow, Linux ALSA, macOS avfoundation
			const input =
				process.platform === "win32"
					? " -f dshow -i audio='Microphone'"
					: process.platform === "darwin"
						? " -f avfoundation -i ':1'"
						: " -f alsa -i default";
			return `ffmpeg${input} -ar ${rate} -ac 1 -f s16le - 2>NUL`;
		} catch {
			// not found
		}

		// Linux arecord
		try {
			execSync("arecord --version", { stdio: "ignore" });
			return `arecord${dev} -t raw -r ${rate} -f S16_LE -c 1 -`;
		} catch {
			// not found
		}

		return null;
	}
}
