/**
 * Sound Player abstraction — pluggable audio output backends.
 *
 * Backends resolved in priority order:
 *   1. ffplay (cross-platform, headless, no window)
 *   2. ffmpeg → PowerShell SoundPlayer (Windows, WAV only)
 *   3. Extensible: register custom backends
 */

import { exec, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ─── Playback options ────────────────────────────────────────────────

export interface PlayOptions {
	volume?: number;
	/** Number of loops (default: 1, -1 = infinite) */
	loops?: number;
}

// ─── SoundPlayer abstraction ─────────────────────────────────────────

export abstract class SoundPlayer {
	abstract get name(): string;

	/** Play a sound file. Returns a cancel function. */
	abstract play(file: string, options?: PlayOptions): () => void;

	/** Check if backend is available on this system. */
	abstract isAvailable(): boolean;
}

// ─── ffplay backend (preferred, cross-platform) ──────────────────────

let _ffplayPath: string | null | undefined;

function resolveFfplayInternal(): string | null {
	if (_ffplayPath !== undefined) return _ffplayPath;

	try {
		execSync("ffplay -version", { stdio: "ignore", windowsHide: true });
		_ffplayPath = "ffplay";
		return _ffplayPath;
	} catch {
		// Not on PATH
	}

	const candidates = [
		"C:\\Program Files\\ffmpeg\\bin\\ffplay.exe",
		"C:\\Program Files\\ffmpeg\\ffplay.exe",
		"C:\\ffmpeg\\bin\\ffplay.exe",
		path.join(
			os.homedir(),
			"scoop",
			"apps",
			"ffmpeg",
			"current",
			"bin",
			"ffplay.exe",
		),
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

export class FfplayPlayer extends SoundPlayer {
	get name(): string {
		return "ffplay";
	}

	play(file: string, options?: PlayOptions): () => void {
		const absPath = path.resolve(file);
		const escaped = absPath.replace(/"/g, '\\"');
		const ffplay = resolveFfplayInternal();
		if (!ffplay) {
			console.warn(`[audio] ffplay not available, skipping: ${file}`);
			return () => {};
		}

		// Volume: ffplay uses -volume <0-100>
		const vol =
			options?.volume !== undefined
				? Math.round(options.volume * 100)
				: undefined;
		const volFlag = vol !== undefined ? ` -volume ${vol}` : "";

		const child = exec(
			`"${ffplay}" -nodisp -autoexit -loglevel quiet ${volFlag} "${escaped}"`,
			{ windowsHide: true },
			() => {
				/* fire-and-forget */
			},
		);

		return () => {
			if (child && !child.killed) {
				child.kill();
			}
		};
	}

	isAvailable(): boolean {
		return resolveFfplayInternal() !== null;
	}
}

// ─── PowerShell SoundPlayer backend (Windows fallback, WAV only) ─────

export class PowerShellPlayer extends SoundPlayer {
	get name(): string {
		return "powershell-soundplayer";
	}

	play(file: string, _options?: PlayOptions): () => void {
		const absPath = path.resolve(file);
		if (!fs.existsSync(absPath)) return () => {};

		const ext = path.extname(absPath).toLowerCase();
		if (ext !== ".wav" && ext !== ".mp3") return () => {};

		const child = exec(
			`powershell -NoProfile -Command "$p='${absPath.replace(/'/g, "''")}'; try { if($p -match '\\.mp3$') { $f=[System.IO.Path]::GetTempFileName()+'.wav'; & ffmpeg -i \\"$p\\" -y \\"$f\\" 2>$null; (New-Object Media.SoundPlayer \\"$f\\").PlaySync(); Remove-Item \\"$f\\" } else { (New-Object Media.SoundPlayer \\"$p\\").PlaySync() } } catch {}"`,
			{ windowsHide: true },
			() => {
				/* fire-and-forget */
			},
		);

		return () => {
			if (child && !child.killed) child.kill();
		};
	}

	isAvailable(): boolean {
		return process.platform === "win32";
	}
}

// ─── Noop backend (silent fallback) ──────────────────────────────────

export class NoopPlayer extends SoundPlayer {
	get name(): string {
		return "noop";
	}

	play(_file: string, _options?: PlayOptions): () => void {
		return () => {};
	}

	isAvailable(): boolean {
		return true;
	}
}

// ─── Registry ─────────────────────────────────────────────────────────

const backends: SoundPlayer[] = [];

/** Register a custom backend. Highest priority first. */
export function registerBackend(backend: SoundPlayer): void {
	backends.unshift(backend);
}

/** Get the best available backend. */
export function getBestPlayer(): SoundPlayer {
	if (backends.length === 0) {
		backends.push(new FfplayPlayer(), new PowerShellPlayer(), new NoopPlayer());
	}

	for (const b of backends) {
		if (b.isAvailable()) return b;
	}

	return new NoopPlayer();
}

/** Check if any audio backend is available. */
export function hasAudioBackend(): boolean {
	if (backends.length === 0) {
		backends.push(new FfplayPlayer(), new PowerShellPlayer(), new NoopPlayer());
	}
	return backends.some((b) => b.isAvailable() && !(b instanceof NoopPlayer));
}

/** List available backends (for diagnostics). */
export function listBackends(): { name: string; available: boolean }[] {
	if (backends.length === 0) {
		backends.push(new FfplayPlayer(), new PowerShellPlayer(), new NoopPlayer());
	}
	return backends.map((b) => ({ name: b.name, available: b.isAvailable() }));
}
