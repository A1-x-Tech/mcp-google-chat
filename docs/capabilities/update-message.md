# Google Chat: Update a message — MCP tool

**Google Chat MCP tool:** Replaces the text of an existing message the authenticated user sent.

Technical name: `update_message`

## What task it solves

> I want to edit a Google Chat message I already sent.

Overwrites the message text (updateMask=text); the message keeps its name and thread, gains lastUpdateTime and an "Edited" marker.

## When to use it

Use it to correct or extend a previously sent message instead of posting a duplicate.

## What to provide

- `message` — **required**. The full message name `spaces/<space>/messages/<message>`.
- `text` — **required**. The new text — it REPLACES the old text entirely.

## What it returns

The updated message object.

## What changes in Google Chat

The message's previous text is overwritten for every member of the space. This modifies existing data; it is not a read.

## Example request

> Edit my last status message in spaces/AAAAAAAAAAA to say the incident is resolved.

## Errors and limitations

With user authentication only the authenticated user's OWN messages can be edited — editing someone else's returns PERMISSION_DENIED (a Chat ownership rule, not broken auth). Updating cards or accessory widgets needs app auth via raw_request. The old text is not recoverable through this server — read it with get_message first if it matters.

## Related MCP tools

- [Get a message](./get-message.md) — `get_message`
- [Send a message](./send-message.md) — `send_message`
- [Delete a message](./delete-message.md) — `delete_message`

## Technical details

- **Impact:** destructive operation
- **Group:** Messages
- **Description source:** `update_message` registration in `src/tools/messages.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
