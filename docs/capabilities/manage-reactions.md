# Google Chat: Manage message reactions — MCP tool

**Google Chat MCP tool:** Adds, lists and removes emoji reactions on a message as the authenticated user.

Technical name: `manage_reactions`

## What task it solves

> I want to react to a Google Chat message with an emoji, or see who reacted.

One tool with an `action` switch: `add` puts a unicode emoji on a message, `list` shows each reaction with its name/emoji/user, `remove` deletes one of the caller's own reactions.

## When to use it

Use `add` to acknowledge a message (👍, 🎉), `list` to count votes or find your reaction's name, and `remove` to take a reaction back.

## What to provide

- `action` — **required**. `add`, `list` or `remove`.
- `message` — add/list. The full message name.
- `emoji` — add: the emoji character itself (e.g. "👍", not `:thumbsup:`); list: optional filter.
- `reaction_name` — remove. The full reaction name from `action=list`.
- `page_size`, `page_token` — list pagination.

## What it returns

`add` returns the created reaction; `list` a page of reactions; `remove` an empty object.

## What changes in Google Chat

`add` attaches a visible reaction under the user's name and `remove` deletes one; `list` reads without changing anything. Removal is destructive — the reaction is gone for everyone.

## Example request

> Add a 🎉 reaction to the release announcement message in spaces/AAAAAAAAAAA.

## Errors and limitations

Adding the same emoji twice fails with ALREADY_EXISTS. Only the authenticated user's own reactions can be removed — someone else's returns PERMISSION_DENIED. Custom (workspace) emoji need raw_request with `emoji.customEmoji`. Scopes: chat.messages.reactions (add/remove) or chat.messages.reactions.readonly (list).

## Related MCP tools

- [Get a message](./get-message.md) — `get_message`
- [List messages](./list-messages.md) — `list_messages`
- [Raw Google Chat API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** destructive operation
- **Group:** Reactions
- **Description source:** `manage_reactions` registration in `src/tools/reactions.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
