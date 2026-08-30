import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleChatClient } from "../client.js";
import {
  DESTRUCTIVE,
  fail,
  messageNameSchema,
  ok,
  pageTokenSchema,
  READ_ONLY,
  rfc3339Timestamp,
  spaceSchema,
  UPDATE,
  WRITE,
} from "./util.js";

export function registerMessageTools(server: McpServer, client: GoogleChatClient): void {
  server.registerTool(
    "list_messages",
    {
      title: "List messages",
      annotations: READ_ONLY,
      description:
        "Lists messages in a space (including messages from blocked members and spaces): name, text, sender, createTime, thread.name, attachment metadata and emoji reaction summaries. Filters are the API's only two: created_after (createTime) and thread_name (one thread's messages) — there is no text search, match client-side. order defaults to ascending by createTime; show_deleted includes tombstones of deleted messages. Poll incrementally with created_after + page_token instead of re-listing history. Requires the chat.messages.readonly (or chat.messages) scope and works only with user authentication.",
      inputSchema: {
        space: spaceSchema(),
        thread_name: z
          .string()
          .regex(
            /^spaces\/[^\s/?#]+\/threads\/[^\s/?#]+$/,
            'Must be a full thread name: "spaces/<space>/threads/<thread>"',
          )
          .optional()
          .describe("Only messages in this thread (thread.name from a message)."),
        created_after: rfc3339Timestamp()
          .optional()
          .describe("Only messages created after this RFC3339 UTC timestamp, e.g. 2026-08-01T00:00:00Z."),
        order: z.enum(["asc", "desc"]).optional().describe("Sort by createTime (default asc)."),
        show_deleted: z.boolean().optional().describe("Include deleted messages (deletion metadata only)."),
        page_size: z.number().int().min(1).max(1000).optional().describe("Max messages per page (1..1000; default 25)."),
        page_token: pageTokenSchema().optional(),
      },
    },
    async ({ space, thread_name, created_after, order, show_deleted, page_size, page_token }) => {
      try {
        return ok(
          await client.listMessages({
            space,
            threadName: thread_name,
            createdAfter: created_after,
            orderBy: order,
            showDeleted: show_deleted,
            pageSize: page_size,
            pageToken: page_token,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_message",
    {
      title: "Get a message",
      annotations: READ_ONLY,
      description:
        "Fetches one message by its full resource name: text, formattedText, sender, createTime/lastUpdateTime, thread.name (reply target for send_message), attachment[] metadata (name, contentName, contentType, downloadUri, attachmentDataRef) and emojiReactionSummaries. Also resolves custom-id names (spaces/<space>/messages/client-<id>) for messages sent with message_id. Deleted messages return deletionMetadata instead of content.",
      inputSchema: { message: messageNameSchema() },
    },
    async ({ message }) => {
      try {
        return ok(await client.getMessage(message));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "send_message",
    {
      title: "Send a message",
      annotations: WRITE,
      description:
        "Sends a text message to a space AS THE AUTHENTICATED USER (their name and avatar; needs the chat.messages.create or chat.messages scope, and the user must be a member of the space). Text supports Chat markup: *bold*, _italic_, ~strike~, `code`, <https://url|link>, <users/123> mentions. Threads: pass thread_name (from a message's thread.name) or a stable thread_key of your choosing to reply in a thread; by default a missing thread falls back to starting a new one — set reply_option=\"or_fail\" to error instead. In non-threaded spaces the thread params are ignored by the API. message_id (must start with \"client-\") makes the send addressable later without storing the returned name — reuse of an id fails with ALREADY_EXISTS, which also makes accidental duplicate sends detectable. Returns the created message with name, thread.name and createTime. A send is NEVER retried after a 5xx/timeout: check with list_messages before re-sending. Cards (cardsV2) are app-auth-only — out of scope; use raw_request with a Chat-app token.",
      inputSchema: {
        space: spaceSchema(),
        text: z.string().min(1).max(4096).describe("The message text (up to 4096 characters; Chat markup supported)."),
        thread_name: z
          .string()
          .regex(
            /^spaces\/[^\s/?#]+\/threads\/[^\s/?#]+$/,
            'Must be a full thread name: "spaces/<space>/threads/<thread>"',
          )
          .optional()
          .describe("Reply into this existing thread (thread.name from get_message/list_messages)."),
        thread_key: z
          .string()
          .min(1)
          .max(4000)
          .optional()
          .describe("Opaque key of your choosing: first use starts a thread, reuse replies into it."),
        reply_option: z
          .enum(["fallback_to_new_thread", "or_fail"])
          .optional()
          .describe(
            "When targeting a thread: fallback_to_new_thread (default) starts a new thread if it doesn't exist; or_fail errors instead.",
          ),
        message_id: z
          .string()
          .regex(/^client-[a-z0-9-]{1,56}$/, 'Must be "client-" + 1-56 chars of [a-z0-9-]')
          .optional()
          .describe('Custom id for the message, e.g. "client-deploy-42"; must be unique per space.'),
      },
    },
    async ({ space, text, thread_name, thread_key, reply_option, message_id }) => {
      try {
        return ok(
          await client.createMessage({
            space,
            text,
            threadName: thread_name,
            threadKey: thread_key,
            replyOption: reply_option,
            messageId: message_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_message",
    {
      title: "Update a message",
      annotations: UPDATE,
      description:
        "Replaces the text of an existing message (updateMask=text; the previous text is overwritten, not appended). With user authentication only the authenticated user's OWN messages can be edited — editing someone else's returns PERMISSION_DENIED, a Chat rule, not a missing scope. The message keeps its name and thread; lastUpdateTime is set and clients show an Edited marker. Updating cards or accessory widgets needs app auth via raw_request.",
      inputSchema: {
        message: messageNameSchema(),
        text: z.string().min(1).max(4096).describe("The new message text (replaces the old text entirely)."),
      },
    },
    async ({ message, text }) => {
      try {
        return ok(await client.updateMessage({ message, text }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_message",
    {
      title: "Delete a message",
      annotations: DESTRUCTIVE,
      description:
        "Permanently deletes a message. With user authentication the user can delete their OWN messages; space managers can also delete others' messages in spaces they manage — otherwise PERMISSION_DENIED (a Chat permission rule, not a missing scope). If the message started a thread that has replies, the delete fails with FAILED_PRECONDITION; force=true deletes the replies too but works only with app (service-account) authentication. Deletion cannot be undone — read the message with get_message first if its content matters. Returns an empty object on success.",
      inputSchema: {
        message: messageNameSchema(),
        force: z
          .boolean()
          .optional()
          .describe("Also delete threaded replies (app authentication only; ignored for user auth)."),
      },
    },
    async ({ message, force }) => {
      try {
        return ok(await client.deleteMessage(message, force));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
