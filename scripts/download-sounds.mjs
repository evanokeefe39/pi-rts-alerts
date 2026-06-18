/**
 * pi-rts-alerts — Sound Installer
 *
 * Downloads/installs RTS game sound files for the pi-rts-alerts extension.
 * Sound files are sourced from myinstants.com and stored under
 * ~/.pi/agent/rts-sounds/.
 *
 * The sounds themselves are NOT redistributed in this repo due to
 * copyright. This script helps you fetch them from public soundboards.
 *
 * Usage:
 *   node scripts/download-sounds.mjs
 *   npm run install:sounds
 *
 * When run as `postinstall` (during `npm install`), failures are non-fatal
 * so package installation doesn't break on network issues. Run manually
 * with `npm run install:sounds` to see full error details.
 *
 * Environment:
 *   PI_RTS_SOUNDS_DIR — override the target directory (default: ~/.pi/agent/rts-sounds/)
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const TARGET_DIR = process.env.PI_RTS_SOUNDS_DIR
	? path.resolve(process.env.PI_RTS_SOUNDS_DIR)
	: path.join(os.homedir(), ".pi", "agent", "rts-sounds");

/**
 * URL map of sound files that can be auto-downloaded.
 * Keys are relative paths under TARGET_DIR, values are download URLs.
 *
 * NOTE: These URLs may change over time. If a download fails, visit
 * https://www.myinstants.com to find the current URL for that sound.
 */
const SOUND_URLS = {
	// ── Age of Empires 2 ──────────────────────────────────────────────
	"ageofempires2/villager-ready.mp3":
		"https://www.myinstants.com/media/sounds/aoe2-villager-ready.mp3",
	"ageofempires2/unit-created.mp3":
		"https://www.myinstants.com/media/sounds/aoe2-unit-created.mp3",
	"ageofempires2/town-bell.mp3":
		"https://www.myinstants.com/media/sounds/aoe2-town-bell.mp3",
	"ageofempires2/under-attack.mp3":
		"https://www.myinstants.com/media/sounds/aoe2-under-attack.mp3",
	"ageofempires2/cease-villagers.mp3":
		"https://www.myinstants.com/media/sounds/aoe2-cease.mp3",
	"ageofempires2/create-villagers.mp3":
		"https://www.myinstants.com/media/sounds/aoe2-create-villager.mp3",

	// ── StarCraft II — Terran ─────────────────────────────────────────
	"starcraft2/terran/scv-ready.mp3":
		"https://www.myinstants.com/media/sounds/scv-ready.mp3",
	"starcraft2/terran/scv-orders.mp3":
		"https://www.myinstants.com/media/sounds/scv-orders.mp3",
	"starcraft2/terran/scv-orders-captain.mp3":
		"https://www.myinstants.com/media/sounds/scv-orders-captain.mp3",
	"starcraft2/terran/scv-good-to-go.mp3":
		"https://www.myinstants.com/media/sounds/scv-good-to-go.mp3",
	"starcraft2/terran/siege-tank.mp3":
		"https://www.myinstants.com/media/sounds/siege-tank-attack.mp3",
	"starcraft2/terran/battlecruiser.mp3":
		"https://www.myinstants.com/media/sounds/battlecruiser-operational.mp3",

	// ── StarCraft II — Protoss ────────────────────────────────────────
	"starcraft2/protoss/chime.mp3":
		"https://www.myinstants.com/media/sounds/protoss-chime.mp3",
	"starcraft2/protoss/waiting.mp3":
		"https://www.myinstants.com/media/sounds/protoss-waiting.mp3",
	"starcraft2/protoss/insufficient-gas.mp3":
		"https://www.myinstants.com/media/sounds/insufficient-vespene.mp3",
	"starcraft2/protoss/pylons.mp3":
		"https://www.myinstants.com/media/sounds/protoss-pylons.mp3",
	"starcraft2/protoss/upgrade.mp3":
		"https://www.myinstants.com/media/sounds/protoss-upgrade.mp3",
	"starcraft2/protoss/adun-toridas.mp3":
		"https://www.myinstants.com/media/sounds/adun-toridas.mp3",

	// ── Warcraft III — Human ──────────────────────────────────────────
	"warcraft3/human/peasant-ready.mp3":
		"https://www.myinstants.com/media/sounds/wc3-peasant-ready.mp3",
	"warcraft3/human/yes-mi-lord.mp3":
		"https://www.myinstants.com/media/sounds/wc3-yes-mi-lord.mp3",

	// ── Warcraft III — Orc ────────────────────────────────────────────
	"warcraft3/orc/peon-work-work.mp3":
		"https://www.myinstants.com/media/sounds/wc3-peon-work-work.mp3",
	"warcraft3/orc/peon-work-complete.mp3":
		"https://www.myinstants.com/media/sounds/wc3-work-complete.mp3",

	// ── Warcraft III — Generic ────────────────────────────────────────
	"warcraft3/quest-complete.mp3":
		"https://www.myinstants.com/media/sounds/wc3-quest-complete.mp3",
	"warcraft3/level-up.mp3":
		"https://www.myinstants.com/media/sounds/wc3-level-up.mp3",
	// "Something you're doing" — downloaded dynamically from 101soundboards
	// in downloadSpecial() because their URLs have expiring signatures.
	//"warcraft3/wc3-okay.mp3":
	//  "https://www.myinstants.com/media/sounds/wc3-okay-alt.mp3",
	"warcraft3/dreadlord.mp3":
		"https://www.myinstants.com/media/sounds/wc3-dreadlord.mp3",

	// ── Red Alert 2 ───────────────────────────────────────────────────
	"redalert2/incoming-transmission.mp3":
		"https://www.myinstants.com/media/sounds/ra2-incoming.mp3",
	"redalert2/redalert.mp3":
		"https://www.myinstants.com/media/sounds/ra2-red-alert.mp3",
	"redalert2/klaxxon.mp3":
		"https://www.myinstants.com/media/sounds/ra2-klaxxon.mp3",
	"redalert2/alarm.mp3":
		"https://www.myinstants.com/media/sounds/ra2-alarm.mp3",
	"redalert2/unit-ready.mp3":
		"https://www.myinstants.com/media/sounds/ra2-unit-ready.mp3",
	"redalert2/unit-promoted.mp3":
		"https://www.myinstants.com/media/sounds/ra2-unit-promoted.mp3",
	"redalert2/unit-lost.mp3":
		"https://www.myinstants.com/media/sounds/ra2-unit-lost.mp3",
	"redalert2/hell-march.mp3":
		"https://www.myinstants.com/media/sounds/ra2-hell-march.mp3",
};

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

async function downloadFile(url, destPath) {
	ensureDir(path.dirname(destPath));

	if (fs.existsSync(destPath)) {
		console.log(`  ✓ Already exists: ${path.relative(TARGET_DIR, destPath)}`);
		return true;
	}

	try {
		console.log(`  ↓ Downloading: ${path.relative(TARGET_DIR, destPath)}`);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		const buffer = Buffer.from(await response.arrayBuffer());
		fs.writeFileSync(destPath, buffer);
		return true;
	} catch (err) {
		console.error(
			`  ✗ Failed: ${path.relative(TARGET_DIR, destPath)} — ${err.message}`,
		);
		return false;
	}
}

/**
 * Download the Warcraft III Peon "Something need doing?" sound from
 * 101soundboards.com. Their CDN URLs have expiring signatures, so we
 * scrape the fresh URL from their board page each time.
 */
async function downloadPeonSomethingNeedDoing() {
	const relPath = "warcraft3/orc/peon-something-need-doing.mp3";
	const destPath = path.join(TARGET_DIR, relPath);

	if (fs.existsSync(destPath)) {
		console.log(`  ✓ Already exists: ${relPath}`);
		return true;
	}

	const boardUrl =
		"https://www.101soundboards.com/boards/10069-peon-sounds-warcraft-iii-reign-of-chaos";
	const soundId = "9468"; // "Something you're doing" sound

	try {
		console.log(`  ↓ Fetching ${relPath} from 101soundboards...`);
		const resp = await fetch(boardUrl, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; pi-rts-alerts/1.0)" },
		});
		if (!resp.ok) throw new Error(`Board page HTTP ${resp.status}`);
		const html = await resp.text();

		// Find the sound_file_url for our soundId in the embedded JSON
		// Pattern: "id":9468,..."sound_file_url":"https://...
		const soundBlock = html.match(
			new RegExp(`"id":${soundId}[^}]{0,2000}"sound_file_url":"([^"]+)"`),
		);
		if (!soundBlock)
			throw new Error("Could not find sound_file_url in board page");

		const rawUrl = soundBlock[1].replace(/\\\//g, "/");
		console.log(`  ↓ Downloading: ${relPath}`);
		const audioResp = await fetch(rawUrl, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; pi-rts-alerts/1.0)" },
		});
		if (!audioResp.ok) throw new Error(`Audio HTTP ${audioResp.status}`);
		const buffer = Buffer.from(await audioResp.arrayBuffer());
		fs.writeFileSync(destPath, buffer);
		console.log(`  ✓ Downloaded: ${relPath} (${buffer.length} bytes)`);
		return true;
	} catch (err) {
		console.error(`  ✗ Failed: ${relPath} — ${err.message}`);
		console.error(`    Tip: Download manually from ${boardUrl} and save as:`);
		console.error(`    ${destPath}`);
		return false;
	}
}

/**
 * Copy high-quality WAV rips from the user's Downloads folder if they exist.
 * These are direct game-rip WAVs that provide much better quality than myinstants MP3s.
 * Returns the number of files copied (0 if folder doesn't exist).
 */
const LOCAL_WAV_SOURCES = {
	"warcraft3/orc": path.join(os.homedir(), "Downloads", "wc3sfx-orc-peon"),
	"warcraft3/human": path.join(
		os.homedir(),
		"Downloads",
		"wc3sfx-human-peasant",
	),
	"warcraft3/wisp": path.join(
		os.homedir(),
		"Downloads",
		"wc3sfx-nightelf-wisp",
	),
};

async function copyLocalWavs() {
	let copied = 0;

	for (const [relDir, srcDir] of Object.entries(LOCAL_WAV_SOURCES)) {
		if (!fs.existsSync(srcDir)) continue;

		const destDir = path.join(TARGET_DIR, relDir);
		ensureDir(destDir);

		try {
			const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".wav"));
			for (const file of files) {
				const src = path.join(srcDir, file);
				const dest = path.join(destDir, file);
				if (!fs.existsSync(dest)) {
					fs.copyFileSync(src, dest);
					console.log(`  ✓ Copied WAV: ${relDir}/${file}`);
					copied++;
				}
			}
		} catch (err) {
			console.log(`  ℹ️  Could not copy WAVs from ${srcDir}: ${err.message}`);
		}
	}

	return copied;
}

async function main() {
	const isPostinstall = process.env.npm_lifecycle_event === "postinstall";

	if (!isPostinstall) {
		console.log("");
		console.log("🎮 pi-rts-alerts — Sound Installer");
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log(`Target: ${TARGET_DIR}`);
		console.log("");
	}

	ensureDir(TARGET_DIR);

	const entries = Object.entries(SOUND_URLS);
	let success = 0;
	let failed = 0;

	for (const [relPath, url] of entries) {
		const destPath = path.join(TARGET_DIR, relPath);
		const ok = await downloadFile(url, destPath);
		if (ok) success++;
		else failed++;
	}

	// Download the Orc "Something need doing?" sound from 101soundboards
	const peonOk = await downloadPeonSomethingNeedDoing();
	if (peonOk) success++;
	else failed++;

	// Copy high-quality WAV game rips from local Downloads folder if available
	const wavCopied = await copyLocalWavs();
	if (wavCopied) success += wavCopied;

	if (!isPostinstall) {
		console.log("");
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log(`Result: ${success} downloaded ✓  |  ${failed} failed ✗`);

		if (failed > 0) {
			console.log("");
			console.log(
				"⚠️  Some sounds failed to download. Visit https://www.myinstants.com",
			);
			console.log(
				"   to find alternatives, or place your own MP3 files in the target directory.",
			);
		} else {
			console.log("✅ All sounds installed!");
		}
		console.log("");
	} else if (failed > 0) {
		console.log(
			`ℹ️  pi-rts-alerts: ${success} sounds installed, ${failed} failed (run "npm run install:sounds" for details)`,
		);
	}

	// Never exit with error in postinstall — network issues shouldn't break package install
	if (isPostinstall && failed > 0) {
		process.exit(0);
	} else if (failed > 0) {
		process.exit(1);
	}
}

main().catch((err) => {
	const isPostinstall = process.env.npm_lifecycle_event === "postinstall";
	if (isPostinstall) {
		// Network failures in CI shouldn't break install
		console.log(`ℹ️  pi-rts-alerts: sound download skipped — ${err.message}`);
		process.exit(0);
	}
	console.error("Fatal error:", err);
	process.exit(1);
});
