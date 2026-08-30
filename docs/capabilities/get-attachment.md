# Google Chat: Get attachment metadata — MCP tool

**Google Chat MCP tool:** Fetches metadata of one message attachment — filename, MIME type, source and download references.

Technical name: `get_attachment`

## What task it solves

> I want to know what file is attached to a Google Chat message.

Returns contentName, contentType, source (DRIVE_FILE or UPLOADED_CONTENT), downloadUri/thumbnailUri and attachmentDataRef for one attachment.

## When to use it

Use it with app (service-account) credentials to inspect an attachment by its resource name. With user credentials, read the same metadata from get_message's `attachment[]` field instead.

## What to provide

- `attachment` — **required**. The full name `spaces/<space>/messages/<message>/attachments/<attachment>` from a message's `attachment[].name`.

## What it returns

One attachment metadata object. No file bytes — metadata only.

## What changes in Google Chat

The tool reads Google Chat data and does not change it.

## Example request

> What file is attached to the last message in the reports space? Show its name and type.

## Errors and limitations

The dedicated attachment endpoint accepts only APP (service-account) authentication — with user credentials it errors, but get_message already embeds the same metadata. downloadUri/thumbnailUri are short-lived links for a signed-in browser user, not for server-side download. Uploading and downloading raw bytes use the media/upload endpoints, which are outside this server's tools.

## Related MCP tools

- [Get a message](./get-message.md) — `get_message`
- [List messages](./list-messages.md) — `list_messages`

## Technical details

- **Impact:** read-only
- **Group:** Attachments
- **Description source:** `get_attachment` registration in `src/tools/attachments.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
