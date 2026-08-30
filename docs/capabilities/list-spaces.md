# Google Chat: List spaces — MCP tool

**Google Chat MCP tool:** Lists the spaces the authenticated user is a member of — named rooms, group chats and direct messages.

Technical name: `list_spaces`

## What task it solves

> I want to see which Google Chat spaces I can read and write.

Returns the caller's spaces: name (`spaces/<id>`), displayName (empty for direct messages), spaceType, threading state and timestamps. Space names from here feed every other tool.

## When to use it

Use it as the discovery entry point — before reading messages, sending, or managing members — or to resolve a space name the user described in words.

## What to provide

- `space_type` — optional. `space` (named room), `group_chat` or `direct_message`.
- `page_size` — optional. 1..1000 spaces per page (default 100).
- `page_token` — optional. `nextPageToken` from the previous page.

## What it returns

A page of spaces with `nextPageToken` when more exist. Results are unordered.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> List my Google Chat spaces of type space and show their names.

## Errors and limitations

Only spaces the authenticated user is a member of appear; there is no text search here — match displayName client-side, or use [Search spaces](./search-spaces.md) as a Workspace admin. Access also depends on token permissions (chat.spaces.readonly or chat.spaces scope), quotas, and upstream API limits.

## Related MCP tools

- [Get a space](./get-space.md) — `get_space`
- [Search spaces (admin)](./search-spaces.md) — `search_spaces`
- [Find a direct-message space](./find-direct-message.md) — `find_direct_message`
- [List messages](./list-messages.md) — `list_messages`

## Technical details

- **Impact:** read-only
- **Group:** Spaces
- **Description source:** `list_spaces` registration in `src/tools/spaces.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
