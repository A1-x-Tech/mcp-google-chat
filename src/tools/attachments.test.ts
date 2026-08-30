import { test } from "node:test";
import assert from "node:assert/strict";
import { registerAttachmentTools } from "./attachments.js";

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
  const client = { getAttachment: make("getAttachment") };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerAttachmentTools(server as never, client as never);
  return { calls, tools };
}

test("registers get_attachment", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["get_attachment"]);
});

test("get_attachment passes the attachment name through", async () => {
  const { calls, tools } = harness();
  await tools.get_attachment({ attachment: "spaces/A/messages/B/attachments/AT" });
  assert.deepEqual(calls[0], { method: "getAttachment", params: ["spaces/A/messages/B/attachments/AT"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "getAttachment" });
  const res = await tools.get_attachment({ attachment: "spaces/A/messages/B/attachments/AT" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
