import { test } from "node:test";
import assert from "node:assert/strict";
import { registerMessageTools } from "./messages.js";

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
    listMessages: make("listMessages"),
    getMessage: make("getMessage"),
    createMessage: make("createMessage"),
    updateMessage: make("updateMessage"),
    deleteMessage: make("deleteMessage"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerMessageTools(server as never, client as never);
  return { calls, tools };
}

test("registers the five message tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "delete_message",
    "get_message",
    "list_messages",
    "send_message",
    "update_message",
  ]);
});

test("list_messages forwards normalized filters", async () => {
  const { calls, tools } = harness();
  await tools.list_messages({
    space: "AAA",
    thread_name: "spaces/AAA/threads/T",
    created_after: "2026-08-01T00:00:00Z",
    order: "desc",
    show_deleted: true,
    page_size: 100,
    page_token: "tok",
  });
  assert.equal(calls[0].method, "listMessages");
  assert.deepEqual(calls[0].params[0], {
    space: "AAA",
    threadName: "spaces/AAA/threads/T",
    createdAfter: "2026-08-01T00:00:00Z",
    orderBy: "desc",
    showDeleted: true,
    pageSize: 100,
    pageToken: "tok",
  });
});

test("get_message passes the message name through", async () => {
  const { calls, tools } = harness();
  await tools.get_message({ message: "spaces/A/messages/B" });
  assert.deepEqual(calls[0], { method: "getMessage", params: ["spaces/A/messages/B"] });
});

test("send_message forwards text, thread targeting and the custom id", async () => {
  const { calls, tools } = harness();
  await tools.send_message({
    space: "AAA",
    text: "hi",
    thread_key: "deploy-42",
    reply_option: "or_fail",
    message_id: "client-deploy-42",
  });
  assert.equal(calls[0].method, "createMessage");
  assert.deepEqual(calls[0].params[0], {
    space: "AAA",
    text: "hi",
    threadName: undefined,
    threadKey: "deploy-42",
    replyOption: "or_fail",
    messageId: "client-deploy-42",
  });
});

test("update_message and delete_message forward normalized params", async () => {
  const { calls, tools } = harness();
  await tools.update_message({ message: "spaces/A/messages/B", text: "new" });
  assert.deepEqual(calls[0].params[0], { message: "spaces/A/messages/B", text: "new" });
  await tools.delete_message({ message: "spaces/A/messages/B", force: true });
  assert.deepEqual(calls[1], { method: "deleteMessage", params: ["spaces/A/messages/B", true] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "createMessage" });
  const res = await tools.send_message({ space: "AAA", text: "hi" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
