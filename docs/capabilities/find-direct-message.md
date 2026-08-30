# Google Chat: Find a direct-message space — MCP tool

**Google Chat MCP tool:** Finds the existing direct-message space between the authenticated user and another user.

Technical name: `find_direct_message`

## What task it solves

> I want to message a specific person directly.

Resolves the other user (id or email) to the existing DM space, whose name then feeds send_message and list_messages.

## When to use it

Use it before sending a direct message when only the person is known, not the space id.

## What to provide

- `user` — **required**. `users/<id>`, `users/<email>`, or a bare Google user id / email address.

## What it returns

The DM space (name `spaces/<id>`, spaceType DIRECT_MESSAGE).

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> Find my direct-message space with colleague@example.com so I can send them a note.

## Errors and limitations

Returns HTTP 404 when no DM with that user exists yet — this tool cannot create one (creating a DM needs `spaces:setup` via [Raw Google Chat API call](./raw-request.md)). Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Send a message](./send-message.md) — `send_message`
- [List spaces](./list-spaces.md) — `list_spaces`
- [Raw Google Chat API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** read-only
- **Group:** Spaces
- **Description source:** `find_direct_message` registration in `src/tools/spaces.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
