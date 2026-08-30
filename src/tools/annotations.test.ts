import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSpaceTools } from "./spaces.js";
import { registerMessageTools } from "./messages.js";
import { registerReactionTools } from "./reactions.js";
import { registerAttachmentTools } from "./attachments.js";
import { registerMemberTools } from "./members.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, UPDATE, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerSpaceTools(server as never, {} as never);
  registerMessageTools(server as never, {} as never);
  registerReactionTools(server as never, {} as never);
  registerAttachmentTools(server as never, {} as never);
  registerMemberTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The Chat API mixes reads and writes, so instead of one blanket invariant the
 * expected hints are pinned per tool. Changing a tool's annotation must be a
 * conscious decision that updates this map.
 */
const EXPECTED: Record<string, Annotations> = {
  list_spaces: READ_ONLY,
  get_space: READ_ONLY,
  search_spaces: READ_ONLY,
  find_direct_message: READ_ONLY,
  list_messages: READ_ONLY,
  get_message: READ_ONLY,
  send_message: WRITE,
  update_message: UPDATE,
  delete_message: DESTRUCTIVE,
  manage_reactions: DESTRUCTIVE,
  get_attachment: READ_ONLY,
  list_members: READ_ONLY,
  manage_members: DESTRUCTIVE,
  raw_request: DESTRUCTIVE,
};

test("registers all fourteen tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("discovery and reading stay read-only — send/delete never hide behind a read hint", () => {
  for (const name of [
    "list_spaces",
    "get_space",
    "search_spaces",
    "find_direct_message",
    "list_messages",
    "get_message",
    "get_attachment",
    "list_members",
  ]) {
    assert.equal(ANN[name]?.readOnlyHint, true, `${name} must be read-only`);
  }
  for (const name of ["send_message", "update_message", "delete_message", "manage_members"]) {
    assert.equal(ANN[name]?.readOnlyHint, false, `${name} must not claim to be read-only`);
  }
});
