# Google Chat MCP capabilities

This catalog contains 14 public pages—one for every registered MCP tool in `mcp-google-chat`. Each page starts with the user's task, explains the result, and states whether the call changes real data.

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Spaces

- [List spaces](./list-spaces.md) — Lists the spaces the authenticated user is a member of. **Impact:** read-only.
- [Get a space](./get-space.md) — Returns one space's details: displayName, spaceType, threading state, membership count. **Impact:** read-only.
- [Search spaces (admin)](./search-spaces.md) — Server-side search over all named spaces in the Workspace organization (admin only). **Impact:** read-only.
- [Find a direct-message space](./find-direct-message.md) — Finds the existing DM space with another user. **Impact:** read-only.

## Messages

- [List messages](./list-messages.md) — Lists messages in a space with sender, thread, attachments and reaction summaries. **Impact:** read-only.
- [Get a message](./get-message.md) — Fetches one message by its resource name. **Impact:** read-only.
- [Send a message](./send-message.md) — Sends a text message to a space or thread as the authenticated user. **Impact:** changes data.
- [Update a message](./update-message.md) — Replaces the text of a message the user sent. **Impact:** destructive operation.
- [Delete a message](./delete-message.md) — Permanently deletes a message. **Impact:** destructive operation.

## Reactions

- [Manage message reactions](./manage-reactions.md) — Adds, lists and removes emoji reactions on a message. **Impact:** destructive operation.

## Attachments

- [Get attachment metadata](./get-attachment.md) — Filename, MIME type and download references of a message attachment. **Impact:** read-only.

## Members

- [List space members](./list-members.md) — Who is in a space, with which role and state. **Impact:** read-only.
- [Manage space membership](./manage-members.md) — Adds, promotes/demotes and removes members (with sufficient access). **Impact:** destructive operation.

## Additional API methods

- [Raw Google Chat API call](./raw-request.md) — Escape hatch for any Chat API v1 path the typed tools don't cover. **Impact:** destructive operation.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-chat)
