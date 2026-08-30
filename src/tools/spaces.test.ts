import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSpaceTools } from "./spaces.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
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
    listSpaces: make("listSpaces"),
    getSpace: make("getSpace"),
    searchSpaces: make("searchSpaces"),
    findDirectMessage: make("findDirectMessage"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerSpaceTools(server as never, client as never);
  return { calls, tools };
}

test("registers the four space tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "find_direct_message",
    "get_space",
    "list_spaces",
    "search_spaces",
  ]);
});

test("list_spaces forwards normalized params", async () => {
  const { calls, tools } = harness();
  await tools.list_spaces({ space_type: "group_chat", page_size: 50, page_token: "tok" });
  assert.equal(calls[0].method, "listSpaces");
  assert.deepEqual(calls[0].params[0], { spaceType: "group_chat", pageSize: 50, pageToken: "tok" });
});

test("get_space passes the space through", async () => {
  const { calls, tools } = harness();
  await tools.get_space({ space: "spaces/AAA" });
  assert.deepEqual(calls[0], { method: "getSpace", params: ["spaces/AAA"] });
});

test("search_spaces forwards the query and paging", async () => {
  const { calls, tools } = harness();
  await tools.search_spaces({ query: 'spaceType = "SPACE"', order_by: "create_time DESC", page_size: 10 });
  assert.equal(calls[0].method, "searchSpaces");
  assert.deepEqual(calls[0].params[0], {
    query: 'spaceType = "SPACE"',
    orderBy: "create_time DESC",
    pageSize: 10,
    pageToken: undefined,
  });
});

test("find_direct_message passes the user through", async () => {
  const { calls, tools } = harness();
  await tools.find_direct_message({ user: "a@b.example" });
  assert.deepEqual(calls[0], { method: "findDirectMessage", params: ["a@b.example"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listSpaces" });
  const res = await tools.list_spaces({});
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
