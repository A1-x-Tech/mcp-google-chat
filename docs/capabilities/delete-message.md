# Google Chat: Delete a message — MCP tool

**Google Chat MCP tool:** Permanently deletes a message from a space.

Technical name: `delete_message`

## What task it solves

> I want to remove a Google Chat message for good.

Deletes the message; members see it disappear (or a tombstone with deletionMetadata).

## When to use it

Use it to retract a wrong or sensitive message. Deletion cannot be undone — read the message with get_message first if its content matters.

## What to provide

- `message` — **required**. The full message name `spaces/<space>/messages/<message>`.
- `force` — optional. Also delete threaded replies (app authentication only).

## What it returns

An empty object on success.

## What changes in Google Chat

The message is permanently removed for every member of the space. This is a destructive operation, not a read.

## Example request

> Delete the message spaces/AAAAAAAAAAA/messages/BBBBBBBBBBB.BBBBBBBBBBB — it went to the wrong room.

## Errors and limitations

With user authentication the user can delete their OWN messages; space managers can also delete others' messages in spaces they manage — otherwise PERMISSION_DENIED. If the message started a thread with replies, the delete fails with FAILED_PRECONDITION (`force=true` needs app auth). A delete is never retried after a 5xx/timeout — verify with list_messages before repeating.

## Related MCP tools

- [Get a message](./get-message.md) — `get_message`
- [Send a message](./send-message.md) — `send_message`
- [List messages](./list-messages.md) — `list_messages`

## Technical details

- **Impact:** destructive operation
- **Group:** Messages
- **Description source:** `delete_message` registration in `src/tools/messages.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
