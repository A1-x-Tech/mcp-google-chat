import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleChatClient } from "../dist/client.js";
import { registerSpaceTools } from "../dist/tools/spaces.js";
import { registerMessageTools } from "../dist/tools/messages.js";
import { registerReactionTools } from "../dist/tools/reactions.js";
import { registerAttachmentTools } from "../dist/tools/attachments.js";
import { registerMemberTools } from "../dist/tools/members.js";
import { registerRawTool } from "../dist/tools/raw.js";
import { registerAuthTools } from "../dist/tools/auth.js";

/**
 * Sorted, because every assertion compares it against a sorted tool list. The
 * six onboarding tools come from @a1-x-tech/mcp-google-auth, so this list is
 * also the check that the component is wired into the published binary.
 */
const ALL_TOOLS = [
  "auth_status",
  "delete_message",
  "find_direct_message",
  "finish_login",
  "get_attachment",
  "get_message",
  "get_space",
  "list_members",
  "list_messages",
  "list_spaces",
  "logout",
  "manage_members",
  "manage_reactions",
  "raw_request",
  "search_spaces",
  "send_message",
  "set_client",
  "setup_instructions",
  "start_login",
  "update_message",
];

/**
 * A throwaway $XDG_CONFIG_HOME for the spawned server. The auth component
 * re-reads $XDG_CONFIG_HOME/mcp-google-chat/credentials.json per call, so
 * without this a real login on the developer's machine would make the
 * "unconfigured" case pass for the wrong reason.
 */
function isolatedConfigDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "mcp-gchat-dist-smoke-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleChatClient({
      accessToken: "SECRET",
      apiBase: "https://chat.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("GET", "https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the Bearer token and JSON bodies", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response('{"name":"spaces/AAA/messages/BBB"}', { status: 200 });
  };
  try {
    const client = new GoogleChatClient({
      accessToken: "SECRET",
      apiBase: "https://chat.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await client.createMessage({ space: "AAA", text: "Smoke" });
    assert.equal(seen.url, "https://chat.googleapis.com/v1/spaces/AAA/messages");
    assert.equal(seen.auth, "Bearer SECRET");
    assert.deepEqual(seen.body, { text: "Smoke" });
  } finally {
    globalThis.fetch = original;
  }
});

test("dist registers the expected tools", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerAuthTools(server, client);
  registerSpaceTools(server, client);
  registerMessageTools(server, client);
  registerReactionTools(server, client);
  registerAttachmentTools(server, client);
  registerMemberTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_CHAT_ACCESS_TOKEN: "test-token",
      XDG_CONFIG_HOME: isolatedConfigDir(t),
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-chat");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Google Chat API v1/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const getSpace = tools.find((t) => t.name === "get_space");
    assert.equal(getSpace.annotations?.readOnlyHint, true);
    assert.ok(getSpace.inputSchema?.properties?.space, "input schema must reach the client");

    const sendMessage = tools.find((t) => t.name === "send_message");
    assert.equal(sendMessage.annotations?.readOnlyHint, false);
    assert.equal(sendMessage.annotations?.destructiveHint, false);
  } finally {
    await client.close();
  }
});

/**
 * The degraded-start contract: without any credentials the binary must not
 * exit(1) before the handshake — it starts, lists every tool, opens the
 * instructions with the fix, which now leads with the in-chat login
 * (start_login) and keeps the environment variables as the alternative, and
 * answers a data-tool call with the actionable error while the auth tools keep
 * working. Offline: AuthRequiredError fires before any fetch, so this test
 * never touches the network.
 */
test("dist binary starts without credentials: handshake, tool list, actionable call error", async (t) => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("GOOGLE_CHAT_"),
    ),
  );
  env.ASKADS_TELEMETRY = "0"; // keep the suite offline
  env.XDG_CONFIG_HOME = isolatedConfigDir(t); // ignore any real login on this machine
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke-unconfigured", version: "0.0.0" });
  await client.connect(transport);
  try {
    // The model must read the fix before it picks a tool.
    const instructions = client.getInstructions() ?? "";
    assert.match(instructions, /NOT CONNECTED/);
    assert.match(instructions, /start_login/);
    assert.match(instructions, /GOOGLE_CHAT_CLIENT_ID/);
    assert.match(instructions, /restart/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    // A data-tool call fails with the actionable message instead of killing
    // the server — and it names BOTH fixes.
    const result = await client.callTool({ name: "get_space", arguments: { space: "smoke-space" } });
    assert.equal(result.isError, true);
    const text = result.content.map((c) => c.text ?? "").join(" ");
    assert.match(text, /not connected/i);
    assert.match(text, /start_login/);
    assert.match(text, /GOOGLE_CHAT_CLIENT_ID/);
    assert.match(text, /restart the server/);

    // The onboarding tools work in the very state they exist for.
    const status = await client.callTool({ name: "auth_status", arguments: {} });
    assert.ok(!status.isError, "auth_status must succeed without credentials");
  } finally {
    await client.close();
  }
});
