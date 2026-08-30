import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleChatClient } from "../client.js";
import {
  DESTRUCTIVE,
  fail,
  memberNameSchema,
  ok,
  pageTokenSchema,
  READ_ONLY,
  spaceSchema,
  userSchema,
} from "./util.js";

export function registerMemberTools(server: McpServer, client: GoogleChatClient): void {
  server.registerTool(
    "list_members",
    {
      title: "List space members",
      annotations: READ_ONLY,
      description:
        "Lists memberships in a space: each membership's name (spaces/<space>/members/<member> — the handle manage_members needs), member (users/<id>, displayName, type HUMAN|BOT), role (ROLE_MEMBER or ROLE_MANAGER) and state (JOINED, INVITED, NOT_A_MEMBER). role filters to managers or members; show_invited includes invited-but-not-joined users, show_groups includes Google Groups. Requires the chat.memberships.readonly (or chat.memberships) scope and membership in the space.",
      inputSchema: {
        space: spaceSchema(),
        role: z.enum(["member", "manager"]).optional().describe("Only memberships with this role."),
        show_invited: z.boolean().optional().describe("Include invited memberships not yet joined."),
        show_groups: z.boolean().optional().describe("Include Google Group memberships."),
        page_size: z.number().int().min(1).max(1000).optional().describe("Max memberships per page (1..1000; default 100)."),
        page_token: pageTokenSchema().optional(),
      },
    },
    async ({ space, role, show_invited, show_groups, page_size, page_token }) => {
      try {
        return ok(
          await client.listMembers({
            space,
            role,
            showInvited: show_invited,
            showGroups: show_groups,
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
    "manage_members",
    {
      title: "Manage space membership",
      // One tool covers get/add/update_role/remove; remove kicks a member, so
      // the whole tool carries the destructive, non-idempotent hints.
      annotations: DESTRUCTIVE,
      description:
        "Membership management in a space — WORKS ONLY WITH SUFFICIENT ACCESS: the authenticated user needs the chat.memberships scope, and add/update_role/remove additionally require them to be a space MANAGER (otherwise PERMISSION_DENIED — a Chat role rule, not a network problem; check their role via list_members). action=get reads one membership by member_name. action=add invites/adds a human user (space + user, optional role=manager); in DMs and group chats members cannot be added. action=update_role switches a membership between member and manager (member_name + role). action=remove deletes the membership — the user is kicked from the space immediately and this is not undoable from here (re-add creates a fresh invitation). Google Groups and Chat-app memberships are managed via raw_request.",
      inputSchema: {
        action: z.enum(["get", "add", "update_role", "remove"]).describe("What to do with the space's membership."),
        space: spaceSchema().optional().describe("add: the space to add the user to."),
        user: userSchema().optional().describe("add: the user to add (users/<id>, users/<email>, or bare id/email)."),
        member_name: memberNameSchema()
          .optional()
          .describe("get/update_role/remove: the membership from list_members."),
        role: z
          .enum(["member", "manager"])
          .optional()
          .describe("add (optional, default member) / update_role (required): the target role."),
      },
    },
    async ({ action, space, user, member_name, role }) => {
      try {
        switch (action) {
          case "get":
            if (!member_name) return fail(new Error('action "get" requires member_name.'));
            return ok(await client.getMember(member_name));
          case "add":
            if (!space || !user) return fail(new Error('action "add" requires space and user.'));
            return ok(await client.createMember({ space, user, role }));
          case "update_role":
            if (!member_name || !role) return fail(new Error('action "update_role" requires member_name and role.'));
            return ok(await client.updateMemberRole({ member: member_name, role }));
          case "remove":
            if (!member_name) return fail(new Error('action "remove" requires member_name.'));
            return ok(await client.deleteMember(member_name));
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
