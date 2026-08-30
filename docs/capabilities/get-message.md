# Google Chat: Get a message — MCP tool

**Google Chat MCP tool:** Fetches one message by its resource name — text, sender, thread, attachments and reaction summaries.

Technical name: `get_message`

## What task it solves

> I want to read one specific Google Chat message in full.

Returns the message: text, formattedText, sender, createTime/lastUpdateTime, `thread.name`, `attachment[]` metadata and emojiReactionSummaries.

## When to use it

Use it to re-read a message before editing or deleting it, to get its `thread.name` for a threaded reply, or to read attachment metadata with user credentials.

## What to provide

- `message` — **required**. The full name `spaces/<space>/messages/<message>` from list_messages/send_message, or the custom-id form `spaces/<space>/messages/client-<id>`.

## What it returns

One message object; deleted messages return `deletionMetadata` instead of content.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> Fetch the message spaces/AAAAAAAAAAA/messages/BBBBBBBBBBB.BBBBBBBBBBB and show its thread name.

## Errors and limitations

Requires the chat.messages.readonly (or chat.messages) scope and membership in the space. Access also depends on quotas and upstream API limits.

## Related MCP tools

- [List messages](./list-messages.md) — `list_messages`
- [Update a message](./update-message.md) — `update_message`
- [Delete a message](./delete-message.md) — `delete_message`
- [Get attachment metadata](./get-attachment.md) — `get_attachment`

## Technical details

- **Impact:** read-only
- **Group:** Messages
- **Description source:** `get_message` registration in `src/tools/messages.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
