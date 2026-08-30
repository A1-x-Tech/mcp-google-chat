# Google Chat: Search spaces (admin) — MCP tool

**Google Chat MCP tool:** Server-side search over all named spaces in the Workspace organization — including spaces the caller is not a member of.

Technical name: `search_spaces`

## What task it solves

> I want to find a space anywhere in my organization by name or activity.

Runs the Chat API's admin space search (`spaces:search` with `useAdminAccess=true`) and returns matching spaces with membership counts and activity times.

## When to use it

Use it when list_spaces cannot see the target — the caller is not a member — and the authenticated user is a Google Workspace administrator. Everyone else should use [List spaces](./list-spaces.md) and match displayName client-side.

## What to provide

- `query` — **required**. The API's search syntax; must contain `customer = "customers/my_customer" AND spaceType = "SPACE"`, plus e.g. `displayName:"onboarding"`.
- `order_by` — optional. E.g. `create_time DESC` or `last_active_time DESC`.
- `page_size`, `page_token` — optional pagination.

## What it returns

A page of matching spaces with `nextPageToken` when more exist.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> As a Workspace admin, search our organization's Chat spaces for "onboarding".

## Errors and limitations

ADMIN-ONLY: requires a Workspace administrator authorized with the chat.admin.spaces or chat.admin.spaces.readonly scope; anyone else receives PERMISSION_DENIED. Only named spaces (`spaceType = "SPACE"`) are searchable — group chats and DMs are not. Access also depends on quotas and upstream API limits.

## Related MCP tools

- [List spaces](./list-spaces.md) — `list_spaces`
- [Get a space](./get-space.md) — `get_space`

## Technical details

- **Impact:** read-only
- **Group:** Spaces
- **Description source:** `search_spaces` registration in `src/tools/spaces.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
