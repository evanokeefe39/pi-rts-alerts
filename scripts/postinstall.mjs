#!/usr/bin/env node
/**
 * pi-rts-alerts — Postinstall Script
 *
 * Runs after every `npm install` / `npm ci`.
 * Downloads sound files (non-fatal) and links pi types (if available).
 *
 * This script always exits 0 so package installation never breaks,
 * even on network failures, missing global pi install, etc.
 */

import { execSync } from "node:child_process";

function run(label, command) {
	try {
		execSync(command, { stdio: "pipe", encoding: "utf8", timeout: 120_000 });
		return true;
	} catch (err) {
		const msg = err.stderr?.trim() || err.message;
		console.log(`ℹ️  pi-rts-alerts: ${label} — ${msg}`);
		return false;
	}
}

console.log("🔧 pi-rts-alerts postinstall");

run("downloading sounds", "node scripts/download-sounds.mjs");
run("linking pi types", "node scripts/link-types.mjs");

console.log("✅ pi-rts-alerts postinstall complete");
