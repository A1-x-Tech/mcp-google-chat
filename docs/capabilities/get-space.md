# Google Chat: Get a space — MCP tool

**Google Chat MCP tool:** Returns one space's details — displayName, spaceType, description, threading state and membership count.

Technical name: `get_space`

## What task it solves

> I want to inspect one Google Chat space before working in it.

Returns the space resource: displayName, spaceType, spaceDetails (description/guidelines), spaceThreadingState, membershipCount, createTime and settings.

## When to use it

Use it to confirm a space id before writing into it, or to check the threading model (`THREADED_MESSAGES` vs flat) before replying into a thread with send_message.

## What to provide

- `space` — **required**. `spaces/<id>` or the bare id from list_spaces / a Chat URL.

## What it returns

One space object with its full resource name and settings.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> Show the details of the Google Chat space spaces/AAAAAAAAAAA.

## Errors and limitations

The authenticated user must be a member of the space (or a Workspace admin using raw_request with useAdminAccess). Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [List spaces](./list-spaces.md) — `list_spaces`
- [List messages](./list-messages.md) — `list_messages`
- [List space members](./list-members.md) — `list_members`

## Technical details

- **Impact:** read-only
- **Group:** Spaces
- **Description source:** `get_space` registration in `src/tools/spaces.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
