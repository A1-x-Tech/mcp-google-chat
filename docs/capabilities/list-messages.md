# Google Chat: List messages — MCP tool

**Google Chat MCP tool:** Lists messages in a space with sender, text, thread, attachment metadata and reaction summaries.

Technical name: `list_messages`

## What task it solves

> I want to read what has been said in a Google Chat space.

Returns messages with name, text, sender, createTime, `thread.name`, attachment metadata and emoji reaction summaries.

## When to use it

Use it to read history, follow one thread (`thread_name`), or poll a space incrementally with `created_after`.

## What to provide

- `space` — **required**. `spaces/<id>` or the bare id.
- `thread_name` — optional. Only one thread's messages (`spaces/<space>/threads/<thread>`).
- `created_after` — optional. RFC3339 UTC timestamp; only newer messages.
- `order` — optional. `asc` (default) or `desc` by createTime.
- `show_deleted` — optional. Include deletion tombstones.
- `page_size`, `page_token` — optional pagination (1..1000 per page, default 25).

## What it returns

A page of messages with `nextPageToken` when more exist.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> Show the messages in spaces/AAAAAAAAAAA created after yesterday, newest first.

## Errors and limitations

The API's only filters are createTime and thread.name — there is NO text search; match text client-side. Works only with user authentication and the chat.messages.readonly (or chat.messages) scope, and the user must be a member of the space. Poll with `created_after` + `page_token` instead of re-listing history — quotas are per minute.

## Related MCP tools

- [Get a message](./get-message.md) — `get_message`
- [Send a message](./send-message.md) — `send_message`
- [List spaces](./list-spaces.md) — `list_spaces`

## Technical details

- **Impact:** read-only
- **Group:** Messages
- **Description source:** `list_messages` registration in `src/tools/messages.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
