import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Schema factories, not shared consts: reusing one zod object across two fields
 * makes zod-to-json-schema dedupe them into a `$ref`, which some tool-schema
 * consumers (OpenAI Apps review) don't dereference and flag as `any`. A fresh
 * object per field keeps each one inlined with its type + pattern.
 */

/** A space — the full resource name or the bare id (the client normalizes both). */
export const spaceSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      'The space — "spaces/<id>" or the bare id from list_spaces / a Chat URL (chat.google.com/room/<id>).',
    );

/** A full message resource name — messages are only ever returned this way. */
export const messageNameSchema = () =>
  z
    .string()
    .regex(
      /^spaces\/[^\s/?#]+\/messages\/[^\s/?#]+$/,
      'Must be a full message name: "spaces/<space>/messages/<message>"',
    )
    .describe('The full message name from list_messages/send_message, e.g. "spaces/AAA/messages/BBB.CCC".');

/** A full membership resource name from list_members. */
export const memberNameSchema = () =>
  z
    .string()
    .regex(
      /^spaces\/[^\s/?#]+\/members\/[^\s/?#]+$/,
      'Must be a full membership name: "spaces/<space>/members/<member>"',
    )
    .describe('The full membership name from list_members, e.g. "spaces/AAA/members/111".');

/** A user — "users/<id>", "users/<email>" or a bare id/email (the client normalizes). */
export const userSchema = () =>
  z
    .string()
    .min(1)
    .describe('The user — "users/<id>", "users/<email>", or a bare Google user id / email address.');

/** An RFC3339 UTC timestamp, e.g. 2026-08-01T00:00:00Z — the shape the createTime filter accepts. */
export const rfc3339Timestamp = () =>
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
      "Must be an RFC3339 timestamp, e.g. 2026-08-01T00:00:00Z",
    );

/** A pagination token from the previous page's nextPageToken. */
export const pageTokenSchema = () => z.string().describe("nextPageToken from the previous page.");

/** Wraps a value as a compact-JSON tool result (compact: the consumer is an LLM). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text", text: text ?? "null" }] };
}

export function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  // Surface the underlying cause (e.g. the network error behind a timeout) — no
  // secrets live in cause, and it makes failures far easier to diagnose.
  if (err instanceof Error && err.cause instanceof Error) message += ` (${err.cause.message})`;
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * MCP tool annotations — hints the consuming client can use to gate or label a
 * tool. All four hints are set explicitly on every tool: some clients (OpenAI
 * Apps review) require readOnlyHint, destructiveHint and openWorldHint on each.
 *
 * The Chat API mixes reads and writes, so each tool picks one of four presets:
 * READ_ONLY (pure reads), WRITE (creates new state; replaying duplicates it),
 * UPDATE (overwrites existing fields; replaying the same update converges) and
 * DESTRUCTIVE (removes existing state; replaying hits different targets).
 */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const UPDATE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
