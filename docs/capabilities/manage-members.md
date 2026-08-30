# Google Chat: Manage space membership — MCP tool

**Google Chat MCP tool:** Adds, inspects, promotes/demotes and removes members of a space — when the caller has sufficient access.

Technical name: `manage_members`

## What task it solves

> I want to change who is in a Google Chat space and what they can do there.

One tool with an `action` switch: `get` reads one membership, `add` invites/adds a human user, `update_role` switches member ↔ manager, `remove` kicks the member out.

## When to use it

Use it for roster changes in named spaces the authenticated user manages. Check the caller's own role via list_members first — membership writes need a space MANAGER.

## What to provide

- `action` — **required**. `get`, `add`, `update_role` or `remove`.
- `space` + `user` — add: the space and the user (`users/<id>`, `users/<email>` or bare id/email); optional `role=manager`.
- `member_name` — get/update_role/remove: the membership from list_members.
- `role` — update_role: `member` or `manager`.

## What it returns

`get`/`add`/`update_role` return the membership object; `remove` returns an empty object.

## What changes in Google Chat

`add` makes the user a member (or sends an invitation), `update_role` changes their permissions, `remove` kicks them out immediately. These change real access; only `get` is a read.

## Example request

> Add newhire@example.com to the onboarding space and make them a manager.

## Errors and limitations

WORKS ONLY WITH SUFFICIENT ACCESS: the chat.memberships scope, plus space-manager rights for add/update_role/remove — otherwise PERMISSION_DENIED, which is a Chat role rule, not a network problem. Members cannot be added to DMs or group chats. Removal is not undoable from here — re-adding creates a fresh invitation. Google Groups and Chat-app memberships go through raw_request.

## Related MCP tools

- [List space members](./list-members.md) — `list_members`
- [Get a space](./get-space.md) — `get_space`
- [Raw Google Chat API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** destructive operation
- **Group:** Members
- **Description source:** `manage_members` registration in `src/tools/members.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
