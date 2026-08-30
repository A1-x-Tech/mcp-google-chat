import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleChatClient } from "../client.js";
import { fail, ok, READ_ONLY } from "./util.js";

export function registerAttachmentTools(server: McpServer, client: GoogleChatClient): void {
  server.registerTool(
    "get_attachment",
    {
      title: "Get attachment metadata",
      annotations: READ_ONLY,
      description:
        "Fetches metadata of one message attachment by its resource name (from a message's attachment[].name): contentName (filename), contentType (MIME), source (DRIVE_FILE or UPLOADED_CONTENT), downloadUri/thumbnailUri (short-lived, for a signed-in browser user — not for server-side download) and attachmentDataRef. NOTE the auth split: this dedicated endpoint accepts only APP (service-account) authentication — with user credentials it returns an error, but the SAME metadata is already embedded in get_message's attachment[] field, so user-auth flows should read it there. Downloading raw bytes goes through the media endpoint (v1/media/<resourceName>?alt=media) and uploading new attachments through the upload endpoint — both outside this server's tools.",
      inputSchema: {
        attachment: z
          .string()
          .regex(
            /^spaces\/[^\s/?#]+\/messages\/[^\s/?#]+\/attachments\/[^\s/?#]+$/,
            'Must be a full attachment name: "spaces/<space>/messages/<message>/attachments/<attachment>"',
          )
          .describe("The attachment resource name from a message's attachment[].name."),
      },
    },
    async ({ attachment }) => {
      try {
        return ok(await client.getAttachment(attachment));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
