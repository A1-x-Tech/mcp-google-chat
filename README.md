# mcp-google-chat

MCP server for the **Google Chat API v1** (TypeScript, stdio). Lets AI clients
(Claude, Cursor, Codex, ...) list and search Chat spaces, read and send
messages, work with threads, reactions, attachment metadata and memberships —
acting as the signed-in user via OAuth2.

> Technical README for the handover stage. Full public README, marketing and
> publication are the next task.

## Quick start

```json
{
  "mcpServers": {
    "google-chat": {
      "command": "npx",
      "args": ["-y", "mcp-google-chat"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "...",
        "GOOGLE_CHAT_CLIENT_SECRET": "...",
        "GOOGLE_CHAT_REFRESH_TOKEN": "..."
      }
    }
  }
}
```

Alternative for quick sessions: `GOOGLE_CHAT_ACCESS_TOKEN` with a short-lived
token (e.g. `gcloud auth print-access-token`, with Chat scopes granted). Without
credentials the server still starts and completes the MCP handshake — every tool
call then explains exactly which variables to set (degraded start by design).

## Tools

| Group | Tools |
|---|---|
| Spaces | `list_spaces`, `get_space`, `search_spaces` (Workspace admin), `find_direct_message` |
| Messages & threads | `list_messages`, `get_message`, `send_message`, `update_message`, `delete_message` |
| Reactions | `manage_reactions` (add / list / remove) |
| Attachments | `get_attachment` (metadata) |
| Members | `list_members`, `manage_members` (get / add / update_role / remove) |
| Escape hatch | `raw_request` (any Chat API v1 path) |

Details, minimal OAuth scopes and environment variables: [docs/TOOLS.md](docs/TOOLS.md).
Task-oriented pages: [docs/capabilities/](docs/capabilities/index.md).

## Key properties

- **User credentials vs Chat app configuration** are separated: with the OAuth
  refresh triple the server acts as the signed-in user (sends under their name;
  only own messages/reactions editable). Chat-app-only features (cards, app DMs,
  the dedicated attachment endpoint, `force` delete) need a service-account
  token supplied as `GOOGLE_CHAT_ACCESS_TOKEN`.
- **Safe writes:** 429 retried with backoff for all methods; 5xx/network errors
  retried only for GET — a send/delete is never replayed after an ambiguous
  failure. `send_message message_id` makes duplicates detectable.
- **Security:** SSRF guard (foreign-origin paths rejected before any fetch),
  strict resource-name validation, timeout covers body reads, one forced token
  re-mint on 401. Credentials and message content never appear in logs or
  telemetry.
- **Offline test suite** (`npm test`): unit tests for config/client/every tool +
  a dist smoke test doing a real MCP handshake over stdio. Opt-in live smoke
  with disposable resources and cleanup: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Development

```bash
npm install
npm run typecheck && npm test
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/PUBLISHING.md](docs/PUBLISHING.md)
and [CLAUDE.md](CLAUDE.md) (architecture & conventions).

## License

[MIT](LICENSE) © A1 x Tech
