import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleChatClient } from "../client.js";
import { fail, ok, pageTokenSchema, READ_ONLY, spaceSchema, userSchema } from "./util.js";

export function registerSpaceTools(server: McpServer, client: GoogleChatClient): void {
  server.registerTool(
    "list_spaces",
    {
      title: "List spaces",
      annotations: READ_ONLY,
      description:
        "Lists the spaces the authenticated user is a member of: name (spaces/<id>), displayName (empty for direct messages), spaceType (SPACE = named room, GROUP_CHAT, DIRECT_MESSAGE), spaceThreadingState and timestamps. This is the discovery entry point — space names from here feed every other tool. space_type narrows the listing server-side; there is no text search here — match displayName client-side, or use search_spaces (Workspace admin only). Paginate with page_token from nextPageToken; results are unordered.",
      inputSchema: {
        space_type: z
          .enum(["space", "group_chat", "direct_message"])
          .optional()
          .describe("Only spaces of this type: space (named room), group_chat, or direct_message."),
        page_size: z.number().int().min(1).max(1000).optional().describe("Max spaces per page (1..1000; default 100)."),
        page_token: pageTokenSchema().optional(),
      },
    },
    async ({ space_type, page_size, page_token }) => {
      try {
        return ok(await client.listSpaces({ spaceType: space_type, pageSize: page_size, pageToken: page_token }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_space",
    {
      title: "Get a space",
      annotations: READ_ONLY,
      description:
        "Returns one space's details: displayName, spaceType, spaceDetails (description/guidelines), spaceThreadingState (THREADED_MESSAGES = replies go into threads, otherwise the space is flat), membershipCount, createTime and settings. Use it to check the threading model before send_message with a thread, or to confirm a space id before writing into it.",
      inputSchema: { space: spaceSchema() },
    },
    async ({ space }) => {
      try {
        return ok(await client.getSpace(space));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_spaces",
    {
      title: "Search spaces (admin)",
      annotations: READ_ONLY,
      description:
        'Server-side search over ALL named spaces in the Workspace organization — including ones the caller is not a member of. ADMIN-ONLY: the call runs with useAdminAccess=true and requires a Google Workspace administrator authorized with the chat.admin.spaces or chat.admin.spaces.readonly scope; anyone else gets PERMISSION_DENIED — fall back to list_spaces and match displayName client-side. query uses the API\'s search syntax and MUST contain customer = "customers/my_customer" AND spaceType = "SPACE"; add displayName:"text" for name search, e.g. customer = "customers/my_customer" AND spaceType = "SPACE" AND displayName:"onboarding". order_by accepts membership_count.joined_direct_human_user_count, last_active_time or create_time with ASC/DESC.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            'Search query, e.g. customer = "customers/my_customer" AND spaceType = "SPACE" AND displayName:"onboarding".',
          ),
        order_by: z
          .string()
          .optional()
          .describe('Sort, e.g. "create_time DESC" or "last_active_time DESC" (default create_time ASC).'),
        page_size: z.number().int().min(1).max(1000).optional().describe("Max spaces per page (1..1000)."),
        page_token: pageTokenSchema().optional(),
      },
    },
    async ({ query, order_by, page_size, page_token }) => {
      try {
        return ok(
          await client.searchSpaces({ query, orderBy: order_by, pageSize: page_size, pageToken: page_token }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "find_direct_message",
    {
      title: "Find a direct-message space",
      annotations: READ_ONLY,
      description:
        "Finds the EXISTING direct-message space between the authenticated user and another user, returning the space (name spaces/<id>) to send_message into. Returns HTTP 404 when no DM with that user exists yet — this tool cannot create one (creating DMs needs spaces.setup via raw_request). The user can be a Google user id (users/123...) or an email address.",
      inputSchema: { user: userSchema() },
    },
    async ({ user }) => {
      try {
        return ok(await client.findDirectMessage(user));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
