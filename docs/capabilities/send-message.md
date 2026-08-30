# Google Chat: Send a message — MCP tool

**Google Chat MCP tool:** Sends a text message to a space as the authenticated user, optionally into a thread.

Technical name: `send_message`

## What task it solves

> I want to post a message into a Google Chat space or thread.

Creates a real message under the authenticated user's name and returns it with `name`, `thread.name` and `createTime`.

## When to use it

Use it to notify a room, answer in a thread (`thread_name` or a stable `thread_key`), or DM a person (space from find_direct_message). This is a write — the message is immediately visible to the space's members.

## What to provide

- `space` — **required**. `spaces/<id>` or the bare id.
- `text` — **required**. Up to 4096 characters; Chat markup (*bold*, _italic_, `code`, <users/123> mentions) supported.
- `thread_name` / `thread_key` — optional thread targeting.
- `reply_option` — optional. `fallback_to_new_thread` (default) or `or_fail`.
- `message_id` — optional. Custom id starting with `client-`, unique per space.

## What it returns

The created message with its resource name and thread.

## What changes in Google Chat

A new message appears in the space under the authenticated user's name. This creates data; it is not a read.

## Example request

> Send "Deploy finished ✅" into the release thread of spaces/AAAAAAAAAAA.

## Errors and limitations

Needs the chat.messages.create or chat.messages scope and membership in the space. A send is NEVER retried after a 5xx/timeout — check with list_messages before re-sending; reusing a `message_id` fails with ALREADY_EXISTS, which makes accidental duplicates detectable. Cards (cardsV2) require app authentication and are out of scope. In non-threaded spaces the thread parameters are ignored by the API.

## Related MCP tools

- [Find a direct-message space](./find-direct-message.md) — `find_direct_message`
- [Update a message](./update-message.md) — `update_message`
- [Delete a message](./delete-message.md) — `delete_message`
- [List messages](./list-messages.md) — `list_messages`

## Technical details

- **Impact:** changes data
- **Group:** Messages
- **Description source:** `send_message` registration in `src/tools/messages.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
