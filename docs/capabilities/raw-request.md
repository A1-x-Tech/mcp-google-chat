# Google Chat: Raw Google Chat API call — MCP tool

**Google Chat MCP tool:** Escape hatch that calls any Google Chat API v1 path directly for requests the typed tools don't cover.

Technical name: `raw_request`

## What task it solves

> I want to use a Google Chat API feature this server has no dedicated tool for.

Sends an authenticated GET/POST/PATCH/DELETE to any relative Chat API path — creating spaces, setting up DMs, custom-emoji reactions, Google Group memberships, space events, space updates.

## When to use it

Use it only when no typed tool covers the request — the typed tools carry the guardrails and normalized vocabulary; this one passes your JSON through as-is.

## What to provide

- `path` — **required**. Relative to `https://chat.googleapis.com`, e.g. `v1/spaces/AAA/messages`; a query string is allowed.
- `method` — optional. GET (default), POST, PATCH or DELETE.
- `body` — optional. JSON body for POST/PATCH.

## What it returns

The raw JSON response of the endpoint.

## What changes in Google Chat

Whatever the chosen endpoint does — including creating spaces, deleting messages and removing members. Treat every non-GET call as a destructive operation.

## Example request

> Create a new Chat space named "Incident bridge" via the raw API (path v1/spaces, method POST).

## Errors and limitations

A path resolving to a foreign origin is rejected before any network call (SSRF guard), so the Bearer token never leaves chat.googleapis.com. Writes are never retried after a 5xx/timeout. Not for media: attachment upload/download use different hosts/endpoints this server does not proxy. Success still depends on the token's scopes.

## Related MCP tools

- [Send a message](./send-message.md) — `send_message`
- [Manage space membership](./manage-members.md) — `manage_members`
- [Manage message reactions](./manage-reactions.md) — `manage_reactions`

## Technical details

- **Impact:** destructive operation
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/raw.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
