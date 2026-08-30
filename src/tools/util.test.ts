import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTRUCTIVE,
  fail,
  memberNameSchema,
  messageNameSchema,
  ok,
  READ_ONLY,
  rfc3339Timestamp,
  spaceSchema,
  UPDATE,
  userSchema,
  WRITE,
} from "./util.js";

test("rfc3339Timestamp accepts RFC3339 timestamps and rejects bare dates/junk", () => {
  const t = rfc3339Timestamp(); // factory → fresh schema
  assert.equal(t.safeParse("2026-08-01T00:00:00Z").success, true);
  assert.equal(t.safeParse("2026-06-01T12:30:00.5+03:00").success, true);
  assert.equal(t.safeParse("2026-08-01").success, false);
  assert.equal(t.safeParse("yesterday").success, false);
});

test("messageNameSchema requires the full resource name", () => {
  const m = messageNameSchema();
  assert.equal(m.safeParse("spaces/AAA/messages/BBB.CCC").success, true);
  assert.equal(m.safeParse("BBB.CCC").success, false);
  assert.equal(m.safeParse("spaces/AAA").success, false);
});

test("memberNameSchema requires the full resource name", () => {
  const m = memberNameSchema();
  assert.equal(m.safeParse("spaces/AAA/members/111").success, true);
  assert.equal(m.safeParse("111").success, false);
});

test("schema factories return independent schemas (no $ref dedup)", () => {
  assert.notEqual(rfc3339Timestamp(), rfc3339Timestamp());
  assert.notEqual(spaceSchema(), spaceSchema());
  assert.notEqual(userSchema(), userSchema());
});

test("ok emits compact JSON; fail flags isError", () => {
  assert.equal((ok({ a: 1 }).content[0] as { text: string }).text, '{"a":1}');
  const f = fail(new Error("boom"));
  assert.equal(f.isError, true);
  assert.match((f.content[0] as { text: string }).text, /boom/);
});

test("fail appends the underlying cause when present", () => {
  const err = new Error("timeout", { cause: new Error("ECONNRESET") });
  const f = fail(err);
  assert.match((f.content[0] as { text: string }).text, /timeout \(ECONNRESET\)/);
});

test("the four annotation presets set all four hints explicitly", () => {
  assert.deepEqual(READ_ONLY, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(WRITE, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(UPDATE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(DESTRUCTIVE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  });
});
