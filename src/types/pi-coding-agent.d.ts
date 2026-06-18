/**
 * Ambient type declarations for @earendil-works/pi-coding-agent.
 *
 * These types are used for local type-checking (`tsc --noEmit`) without
 * needing the full @earendil-works package installed in node_modules.
 *
 * At runtime, pi provides these types via jiti compilation.
 * For full type accuracy, install pi globally and symlink the package:
 *   npm install -g @earendil-works/pi-coding-agent
 *   npx symlink-dir "$(npm root -g)/@earendil-works" node_modules/@earendil-works
 */

declare module "@earendil-works/pi-coding-agent" {
	// ── Inter-extension event bus ──────────────────────────────────────

	export interface ExtensionEventBus {
		on(event: string, handler: (data: unknown) => void): void;
		emit(event: string, data?: unknown): void;
	}

	// ── Tool registration ──────────────────────────────────────────────

	export interface ToolDefinition {
		name: string;
		label?: string;
		description: string;
		promptSnippet?: string;
		parameters: unknown; // TypeBox schema
		execute: (
			toolCallId: string,
			params: Record<string, unknown>,
			signal?: AbortSignal,
			onUpdate?: (update: {
				content: { type: string; text: string }[];
			}) => void,
			ctx?: ExtensionContext,
		) => Promise<{
			content: { type: string; text: string }[];
			details?: Record<string, unknown>;
			isError?: boolean;
		}>;
	}

	// ── Extension API ──────────────────────────────────────────────────

	export interface ExtensionAPI {
		readonly events: ExtensionEventBus;

		on<K extends keyof ExtensionEvents>(
			event: K,
			handler: (
				event: ExtensionEvents[K],
				ctx: ExtensionContext,
			) => void | Promise<void>,
		): void;

		on(
			event: string,
			handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>,
		): void;

		registerCommand(
			name: string,
			options: {
				description: string;
				handler: (
					args: string,
					ctx: ExtensionCommandContext,
				) => void | Promise<void>;
			},
		): void;

		registerTool(definition: ToolDefinition): void;

		sendMessage(
			message: {
				customType: string;
				content: string;
				display: boolean;
				details?: Record<string, unknown>;
			},
			options?: { triggerTurn?: boolean },
		): void;

		sendUserMessage(
			content:
				| string
				| {
						type: string;
						text: string;
						source?: { type: string; mediaType: string; data: string };
				  }[],
			options?: { deliverAs?: string },
		): void;

		appendEntry(customType: string, data?: unknown): void;

		setSessionName(name: string): void;
	}

	// ── Events ─────────────────────────────────────────────────────────

	export interface ToolCallEvent {
		toolName: string;
		toolCallId: string;
		input: Record<string, unknown>;
	}

	export interface AgentEndEvent {
		messages: unknown[];
	}

	export interface SessionStartEvent {
		reason: "startup" | "reload" | "new" | "resume" | "fork";
		previousSessionFile?: string;
	}

	export interface SessionShutdownEvent {
		reason: "quit" | "reload" | "new" | "resume" | "fork";
		targetSessionFile?: string;
	}

	export interface TurnStartEvent {
		turnIndex: number;
		timestamp: number;
	}

	export interface TurnEndEvent {
		turnIndex: number;
		message: unknown;
		toolResults: unknown[];
	}

	export interface InputEvent {
		text: string;
		images?: unknown[];
		source?: "interactive" | "rpc" | "extension";
	}

	export interface ExtensionEvents {
		tool_call: ToolCallEvent;
		agent_end: AgentEndEvent;
		session_start: SessionStartEvent;
		session_shutdown: SessionShutdownEvent;
		turn_start: TurnStartEvent;
		turn_end: TurnEndEvent;
		input: InputEvent;
	}

	// ── Context ────────────────────────────────────────────────────────

	export interface UIContext {
		select: (title: string, options: string[]) => Promise<string | undefined>;
		confirm: (title: string, message: string) => Promise<boolean>;
		input: (
			prompt: string,
			placeholder?: string,
		) => Promise<string | undefined>;
		notify: (message: string, type?: "info" | "warning" | "error") => void;
		setWidget: (name: string, lines: string[] | undefined) => void;
		setStatus: (name: string, status: string | undefined) => void;
		editor: (title: string, initial?: string) => Promise<string | undefined>;
	}

	export interface ExtensionContext {
		ui: UIContext;
		mode: string;
		hasUI: boolean;
		cwd: string;
		signal?: AbortSignal;
		sessionManager: {
			getEntries: () => unknown[];
			getBranch: () => unknown[];
			getSessionFile: () => string | undefined;
		};
	}

	export interface ExtensionCommandContext extends ExtensionContext {
		waitForIdle(): Promise<void>;
		reload(): Promise<void>;
		switchSession(
			path: string,
			options?: {
				withSession?: (ctx: ExtensionCommandContext) => Promise<void>;
			},
		): Promise<{ cancelled: boolean }>;
		newSession(options?: {
			withSession?: (ctx: ExtensionCommandContext) => Promise<void>;
		}): Promise<{ cancelled: boolean }>;
	}
}
