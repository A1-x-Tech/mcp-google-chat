# Google Chat: List space members — MCP tool

**Google Chat MCP tool:** Lists the memberships of a space — who is in it, with which role and state.

Technical name: `list_members`

## What task it solves

> I want to see who is in a Google Chat space.

Returns memberships: name (`spaces/<space>/members/<member>` — the handle manage_members needs), member (users/<id>, displayName, HUMAN|BOT), role (member or manager) and state (JOINED, INVITED, NOT_A_MEMBER).

## When to use it

Use it before membership changes (to find the member_name and check who is a manager), or to audit a space's roster.

## What to provide

- `space` — **required**. `spaces/<id>` or the bare id.
- `role` — optional. Only `member` or only `manager` memberships.
- `show_invited` — optional. Include invited-but-not-joined users.
- `show_groups` — optional. Include Google Group memberships.
- `page_size`, `page_token` — optional pagination (1..1000, default 100).

## What it returns

A page of memberships with `nextPageToken` when more exist.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> Who are the managers of spaces/AAAAAAAAAAA?

## Errors and limitations

Requires the chat.memberships.readonly (or chat.memberships) scope and membership in the space. Access also depends on quotas and upstream API limits.

## Related MCP tools

- [Manage space membership](./manage-members.md) — `manage_members`
- [Get a space](./get-space.md) — `get_space`
- [List spaces](./list-spaces.md) — `list_spaces`

## Technical details

- **Impact:** read-only
- **Group:** Members
- **Description source:** `list_members` registration in `src/tools/members.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
