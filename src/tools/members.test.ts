import { test } from "node:test";
import assert from "node:assert/strict";
import { registerMemberTools } from "./members.js";

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
    listMembers: make("listMembers"),
    getMember: make("getMember"),
    createMember: make("createMember"),
    updateMemberRole: make("updateMemberRole"),
    deleteMember: make("deleteMember"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerMemberTools(server as never, client as never);
  return { calls, tools };
}

test("registers list_members and manage_members", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["list_members", "manage_members"]);
});

test("list_members forwards normalized params", async () => {
  const { calls, tools } = harness();
  await tools.list_members({
    space: "AAA",
    role: "manager",
    show_invited: true,
    show_groups: true,
    page_size: 200,
    page_token: "tok",
  });
  assert.equal(calls[0].method, "listMembers");
  assert.deepEqual(calls[0].params[0], {
    space: "AAA",
    role: "manager",
    showInvited: true,
    showGroups: true,
    pageSize: 200,
    pageToken: "tok",
  });
});

test("each manage_members action routes to the matching client method", async () => {
  const { calls, tools } = harness();
  await tools.manage_members({ action: "get", member_name: "spaces/A/members/111" });
  assert.deepEqual(calls[0], { method: "getMember", params: ["spaces/A/members/111"] });

  await tools.manage_members({ action: "add", space: "AAA", user: "a@b.example", role: "manager" });
  assert.equal(calls[1].method, "createMember");
  assert.deepEqual(calls[1].params[0], { space: "AAA", user: "a@b.example", role: "manager" });

  await tools.manage_members({ action: "update_role", member_name: "spaces/A/members/111", role: "member" });
  assert.equal(calls[2].method, "updateMemberRole");
  assert.deepEqual(calls[2].params[0], { member: "spaces/A/members/111", role: "member" });

  await tools.manage_members({ action: "remove", member_name: "spaces/A/members/111" });
  assert.deepEqual(calls[3], { method: "deleteMember", params: ["spaces/A/members/111"] });
});

test("missing per-action params fail without calling the client", async () => {
  const { calls, tools } = harness();

  const get = await tools.manage_members({ action: "get" });
  assert.equal(get.isError, true);
  assert.match(get.content[0].text, /requires member_name/);

  const add = await tools.manage_members({ action: "add", space: "AAA" });
  assert.equal(add.isError, true);
  assert.match(add.content[0].text, /requires space and user/);

  const role = await tools.manage_members({ action: "update_role", member_name: "spaces/A/members/1" });
  assert.equal(role.isError, true);
  assert.match(role.content[0].text, /requires member_name and role/);

  const remove = await tools.manage_members({ action: "remove" });
  assert.equal(remove.isError, true);
  assert.match(remove.content[0].text, /requires member_name/);

  assert.equal(calls.length, 0, "validation failures must not reach the API");
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "deleteMember" });
  const res = await tools.manage_members({ action: "remove", member_name: "spaces/A/members/111" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
