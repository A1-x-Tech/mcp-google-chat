import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleChatClient } from "../client.js";
import { DESTRUCTIVE, fail, messageNameSchema, ok, pageTokenSchema } from "./util.js";

export function registerReactionTools(server: McpServer, client: GoogleChatClient): void {
  server.registerTool(
    "manage_reactions",
    {
      title: "Manage message reactions",
      // One tool covers add/list/remove; remove deletes state, so the whole
      // tool carries the destructive, non-idempotent hints.
      annotations: DESTRUCTIVE,
      description:
        'Emoji reactions on a message, as the authenticated user. action=add puts a unicode emoji (the emoji character itself, e.g. "👍" or "🎉" — not :shortcode:) on the message; adding the same emoji twice fails with ALREADY_EXISTS. action=list returns who reacted with what — each reaction\'s name (spaces/.../reactions/<id>), emoji and user; filter with emoji to one emoji\'s reactions. action=remove deletes ONE reaction by its full reaction_name from list — only the authenticated user\'s own reactions can be removed (someone else\'s returns PERMISSION_DENIED). Custom (workspace) emoji need raw_request with emoji.customEmoji. Scopes: chat.messages.reactions (add/remove; .create suffices for add-only) or chat.messages.reactions.readonly (list).',
      inputSchema: {
        action: z.enum(["add", "list", "remove"]).describe("What to do with the message's reactions."),
        message: messageNameSchema().optional().describe("add/list: the message to react to / read reactions from."),
        emoji: z
          .string()
          .min(1)
          .max(16)
          .optional()
          .describe('add: the unicode emoji to add (e.g. "👍"). list: only this emoji\'s reactions.'),
        reaction_name: z
          .string()
          .regex(
            /^spaces\/[^\s/?#]+\/messages\/[^\s/?#]+\/reactions\/[^\s/?#]+$/,
            'Must be a full reaction name: "spaces/<space>/messages/<message>/reactions/<reaction>"',
          )
          .optional()
          .describe("remove: the reaction to delete, from action=list."),
        page_size: z.number().int().min(1).max(200).optional().describe("list: max reactions per page (1..200)."),
        page_token: pageTokenSchema().optional().describe("list: nextPageToken from the previous page."),
      },
    },
    async ({ action, message, emoji, reaction_name, page_size, page_token }) => {
      try {
        switch (action) {
          case "add":
            if (!message || !emoji) return fail(new Error('action "add" requires message and emoji.'));
            return ok(await client.createReaction(message, emoji));
          case "list":
            if (!message) return fail(new Error('action "list" requires message.'));
            return ok(await client.listReactions({ message, emoji, pageSize: page_size, pageToken: page_token }));
          case "remove":
            if (!reaction_name) return fail(new Error('action "remove" requires reaction_name.'));
            return ok(await client.deleteReaction(reaction_name));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
