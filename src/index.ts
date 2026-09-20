#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleChatClient } from "./client.js";
import { ConfigError, DEFAULT_BASE, hasCredentials, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { GoogleChatConfig } from "./types.js";
import { registerSpaceTools } from "./tools/spaces.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerReactionTools } from "./tools/reactions.js";
import { registerAttachmentTools } from "./tools/attachments.js";
import { registerMemberTools } from "./tools/members.js";
import { registerRawTool } from "./tools/raw.js";
import { authUnconfiguredPrefix, hasAuthToken, registerAuthTools } from "./tools/auth.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which Google product this API is,
 * what the API refuses to do, and the behaviours that make a naive loop
 * expensive, lossy or duplicating.
 */
const INSTRUCTIONS =
  "Google Chat API v1 reads and writes Google Chat spaces, messages, threads, reactions and " +
  "memberships — not Gmail, Meet or Drive. With the OAuth refresh triple the server acts AS THE " +
  "SIGNED-IN USER: messages send under their name, and only their OWN messages/reactions can be " +
  "edited or deleted — a PERMISSION_DENIED there is a Chat ownership rule, not broken auth. " +
  "Acting as a Chat app (cards, app DMs, get_attachment, delete force) is a separate Cloud " +
  "configuration; the only bridge is a static service-account GOOGLE_CHAT_ACCESS_TOKEN. " +
  "Discovery: list_spaces shows only spaces the user is in; search_spaces reaches the whole " +
  "organization but needs a Workspace ADMIN; find_direct_message finds an existing DM and 404s " +
  "if none exists (creating one needs spaces:setup via raw_request). There is NO text search over " +
  "messages: list_messages filters only by createTime and thread.name — poll incrementally with " +
  "created_after, match text client-side. Replying into a thread requires thread_name/thread_key " +
  "on send_message; otherwise a new thread starts. Membership writes additionally require the " +
  "user to be a space manager. Attachment metadata rides on get_message; raw bytes (upload/" +
  "download) are outside these tools. Per-user quotas are per minute and 429s are retried with " +
  "backoff automatically, but writes are NEVER retried after a 5xx/timeout — check with " +
  "list_messages before re-sending (send_message message_id makes duplicates detectable); " +
  "delete_message and membership remove are final. Auth that suddenly breaks usually means the " +
  "OAuth consent screen is still in Testing, where refresh tokens die after 7 days.";

/**
 * Prepended to INSTRUCTIONS when no credentials are configured. The model reads
 * this before it picks a tool, so an unconfigured session opens with the fix
 * rather than with a failed call. The text comes from the auth component, which
 * leads with the in-chat login (no restart needed) and keeps the environment
 * variables as the documented alternative.
 */
function unconfiguredPrefix(): string {
  return authUnconfiguredPrefix();
}

/** Reads the package version so the server reports its real version to MCP clients. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Loads the config without dying on a bad value. A server that exits here never
 * completes the MCP handshake, so the user sees a dead server and no reason.
 * Instead the problem is carried into the session, where the model can read it
 * and relay it: the config degrades to "no credentials" and every tool call
 * fails with the actionable message.
 */
function loadConfigOrDegraded(telemetry: Telemetry): {
  config: GoogleChatConfig;
  problem?: ConfigError;
} {
  try {
    return { config: loadConfig() };
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    // Fire-and-forget now that the process survives: the historical
    // `startup_failed` funnel stays comparable, but nothing blocks startup.
    telemetry.send("startup_failed", { reason: err.reason });
    return {
      config: { apiBase: process.env.GOOGLE_CHAT_API_BASE || DEFAULT_BASE },
      problem: err,
    };
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const { config, problem } = loadConfigOrDegraded(telemetry);

  // Decided once, at startup, for the initialize instructions only: env
  // credentials or a stored in-chat login. A login taken mid-session still
  // works — the client's token provider re-reads the stored file per call.
  const connected = hasCredentials(config) || hasAuthToken();

  const server = new McpServer(
    {
      name: "mcp-google-chat",
      version: readVersion(),
    },
    // Surfaces in the initialize result, before the client sees a single tool.
    {
      instructions: connected
        ? INSTRUCTIONS
        : unconfiguredPrefix() +
          (problem ? `Configuration problem: ${problem.message} ` : "") +
          INSTRUCTIONS,
    },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    // Split on purpose: `server_start` keeps meaning "a usable install started",
    // so the unconfigured case gets its own event instead of inflating that number.
    if (connected) telemetry.send("server_start");
    else telemetry.send("unconfigured_start", { reason: problem?.reason ?? "missing_credentials" });
  };

  // The auth tools come first so their TokenProvider exists before the client:
  // the client falls back to it whenever the environment carries no
  // credentials (env always wins — component invariant 3).
  const tokenProvider = registerAuthTools(server);
  const client = new GoogleChatClient(config, tokenProvider);

  registerSpaceTools(server, client);
  registerMessageTools(server, client);
  registerReactionTools(server, client);
  registerAttachmentTools(server, client);
  registerMemberTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-google-chat running on stdio${connected ? "" : " (not connected — use start_login from the chat, or set the environment variables and restart)"}`,
  );
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-chat:", err);
  process.exit(1);
});
