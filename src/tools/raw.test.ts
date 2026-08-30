import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleChatClient } from "../client.js";
import { registerRawTool } from "./raw.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Registers raw_request against a real client with a recording fetch stub. */
function harness() {
  const original = globalThis.fetch;
  const calls: { url: string; method: string; auth: unknown; body: unknown }[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as { method: string; headers?: Record<string, string>; body?: string };
    calls.push({
      url: String(url),
      method: i.method,
      auth: i.headers?.Authorization,
      body: i.body ? JSON.parse(i.body) : undefined,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new GoogleChatClient({
    accessToken: "TKN",
    apiBase: "https://chat.googleapis.com",
    maxRetries: 0,
  });
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, h: Handler) => {
      tools[name] = h;
    },
  };
  registerRawTool(server as never, client);
  return {
    tools,
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("raw_request defaults to GET with the Bearer token", async () => {
  const { tools, calls, restore } = harness();
  try {
    const res = await tools.raw_request({ path: "v1/spaces/AAA" });
    assert.equal(res.isError, undefined);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://chat.googleapis.com/v1/spaces/AAA");
    assert.equal(calls[0].auth, "Bearer TKN");
    assert.equal(calls[0].body, undefined);
  } finally {
    restore();
  }
});

test("raw_request POSTs a JSON body to a relative path", async () => {
  const { tools, calls, restore } = harness();
  try {
    await tools.raw_request({
      path: "v1/spaces:setup",
      method: "POST",
      body: { space: { spaceType: "DIRECT_MESSAGE" } },
    });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://chat.googleapis.com/v1/spaces:setup");
    assert.deepEqual(calls[0].body, { space: { spaceType: "DIRECT_MESSAGE" } });
  } finally {
    restore();
  }
});

test("raw_request PATCHes with a query-string updateMask preserved", async () => {
  const { tools, calls, restore } = harness();
  try {
    await tools.raw_request({
      path: "v1/spaces/AAA?updateMask=displayName",
      method: "PATCH",
      body: { displayName: "New name" },
    });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, "https://chat.googleapis.com/v1/spaces/AAA?updateMask=displayName");
    assert.deepEqual(calls[0].body, { displayName: "New name" });
  } finally {
    restore();
  }
});

test("raw_request rejects an absolute path as an isError result, without fetching", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const { tools, calls, restore } = harness();
    try {
      const res = await tools.raw_request({ path: evil });
      assert.equal(res.isError, true, `${JSON.stringify(evil)} should be isError`);
      assert.match(res.content[0].text, /foreign origin/);
      assert.equal(calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      restore();
    }
  }
});
