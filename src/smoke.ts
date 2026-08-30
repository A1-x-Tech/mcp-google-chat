import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleChatClient } from "./client.js";

/**
 * Live smoke check with two opt-in levels.
 *
 * Default (no space configured): READ-ONLY — mints an access token from the
 * refresh token, then lists one page of spaces. Nothing is written.
 *
 * With a space (argv[2] or GOOGLE_CHAT_SMOKE_SPACE): the full disposable
 * write cycle in that space — send a throwaway message, update its text, read
 * it back, and DELETE it in a `finally` block so the space is left clean after
 * success AND after any mid-cycle failure. Point it at a dedicated test space:
 * the message is visible to the space's members for the seconds it exists.
 */
async function main(): Promise<void> {
  const client = new GoogleChatClient(loadConfig());
  const space = process.argv[2] ?? process.env.GOOGLE_CHAT_SMOKE_SPACE;

  if (!space) {
    await client.authCheck().catch(async (err) => {
      // A static access token cannot re-mint itself; fall through to the read.
      if (!(err instanceof Error) || !/authCheck needs the refresh flow/.test(err.message)) throw err;
    });
    const spaces = (await client.listSpaces({ pageSize: 5 })) as { spaces?: { name?: string }[] };
    console.log(
      JSON.stringify({ ok: true, mode: "read-only", spaces_seen: spaces.spaces?.length ?? 0 }, null, 2),
    );
    return;
  }

  // Disposable write cycle. The message name is captured immediately so the
  // cleanup in `finally` runs whether the later steps succeed or fail.
  const stamp = new Date().toISOString();
  const created = (await client.createMessage({
    space,
    text: `mcp-google-chat smoke ${stamp} — this message deletes itself.`,
  })) as { name?: string };
  if (typeof created.name !== "string") throw new Error("send returned no message name");

  let cycle: Record<string, unknown> = { sent: created.name };
  try {
    await client.updateMessage({ message: created.name, text: `mcp-google-chat smoke ${stamp} — updated.` });
    cycle.updated = true;
    const read = (await client.getMessage(created.name)) as { text?: string };
    cycle.read_back = typeof read.text === "string" && read.text.includes("updated");
  } finally {
    // Cleanup after success and error alike — the smoke must not litter the space.
    try {
      await client.deleteMessage(created.name);
      cycle.deleted = true;
    } catch (err) {
      cycle.deleted = false;
      cycle.cleanup_error = err instanceof Error ? err.message : String(err);
    }
  }
  if (cycle.deleted !== true) {
    throw new Error(`smoke cleanup failed — delete ${created.name} manually: ${String(cycle.cleanup_error)}`);
  }
  console.log(JSON.stringify({ ok: true, mode: "write-cycle", space, ...cycle }, null, 2));
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
