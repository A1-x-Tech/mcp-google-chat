import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleChatClient, HttpMethod } from "../client.js";
import { DESTRUCTIVE, fail, ok } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleChatClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Google Chat API call",
      // Full API surface incl. space setup/deletion and membership removal —
      // annotate for the worst case a call can do, not the average.
      annotations: DESTRUCTIVE,
      description:
        'Escape hatch to call any Google Chat API v1 path directly, for requests the typed tools don\'t cover — e.g. creating a space (path "v1/spaces", method POST, body {"spaceType":"SPACE","displayName":"..."}), setting up a DM ("v1/spaces:setup"), custom-emoji reactions, Google Group memberships, space events ("v1/spaces/<id>/spaceEvents"), or updating a space ("v1/spaces/<id>" PATCH with a query updateMask). The path may carry a query string (e.g. "v1/spaces/AAA/members?showInvited=true"). The Bearer token is added automatically; the method defaults to GET. Not for media: attachment upload/download use different endpoints (upload/v1, media/v1) that this server does not proxy.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe('API path relative to https://chat.googleapis.com, e.g. "v1/spaces/AAA/messages".'),
        method: z
          .enum(["GET", "POST", "PATCH", "DELETE"])
          .optional()
          .describe("HTTP method (the Chat API uses these four). Defaults to GET."),
        body: z.record(z.any()).optional().describe("JSON request body (POST/PATCH only)."),
      },
    },
    async ({ path, method, body }) => {
      try {
        const m = (method ?? "GET") as HttpMethod;
        return ok(await client.request(m, path, body));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
