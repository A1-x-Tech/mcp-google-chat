import { test } from "node:test";
import assert from "node:assert/strict";
import { registerReactionTools } from "./reactions.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { ok: true };
    };
  const client = {
    createReaction: make("createReaction"),
    listReactions: make("listReactions"),
    deleteReaction: make("deleteReaction"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerReactionTools(server as never, client as never);
  return { calls, tools };
}

test("registers manage_reactions", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["manage_reactions"]);
});

test("each action routes to the matching client method", async () => {
  const { calls, tools } = harness();
  await tools.manage_reactions({ action: "add", message: "spaces/A/messages/B", emoji: "👍" });
  assert.deepEqual(calls[0], { method: "createReaction", params: ["spaces/A/messages/B", "👍"] });

  await tools.manage_reactions({
    action: "list",
    message: "spaces/A/messages/B",
    emoji: "🎉",
    page_size: 10,
    page_token: "tok",
  });
  assert.equal(calls[1].method, "listReactions");
  assert.deepEqual(calls[1].params[0], {
    message: "spaces/A/messages/B",
    emoji: "🎉",
    pageSize: 10,
    pageToken: "tok",
  });

  await tools.manage_reactions({ action: "remove", reaction_name: "spaces/A/messages/B/reactions/R" });
  assert.deepEqual(calls[2], { method: "deleteReaction", params: ["spaces/A/messages/B/reactions/R"] });
});

test("missing per-action params fail without calling the client", async () => {
  const { calls, tools } = harness();

  const add = await tools.manage_reactions({ action: "add", message: "spaces/A/messages/B" });
  assert.equal(add.isError, true);
  assert.match(add.content[0].text, /requires message and emoji/);

  const list = await tools.manage_reactions({ action: "list" });
  assert.equal(list.isError, true);
  assert.match(list.content[0].text, /requires message/);

  const remove = await tools.manage_reactions({ action: "remove" });
  assert.equal(remove.isError, true);
  assert.match(remove.content[0].text, /requires reaction_name/);

  assert.equal(calls.length, 0, "validation failures must not reach the API");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listReactions" });
  const res = await tools.manage_reactions({ action: "list", message: "spaces/A/messages/B" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
