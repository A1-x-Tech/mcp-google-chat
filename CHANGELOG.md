# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-24

### Changed

- First stable release. The code is unchanged from 0.2.0; the version now states
  what was already true of it — the tool surface, tool argument shapes,
  environment variable names and response envelopes are settled, and breaking any
  of them from here on requires a major bump.

## [0.2.0] - 2026-09-20

### Added

- In-chat Google login via `@a1-x-tech/mcp-google-auth` — 6 new onboarding
  tools: `auth_status`, `setup_instructions`, `set_client`, `start_login`
  (deliberately not read-only), `finish_login`, `logout`. The flow is loopback
  `127.0.0.1` + PKCE against a user-owned Desktop OAuth client; the code is
  exchanged locally and the client secret never passes through the chat.
  20 tools total, each with a capability page under `docs/capabilities/`.
- `finish_login` verifies a fresh login against the **Chat API itself**
  (`spaces.list`, one page) rather than Google's identity endpoint: OIDC
  answers even when the Chat API is switched off in the Cloud project, which
  would make a broken setup look connected. A 403 that says the API is disabled
  is translated into the actual fix — enable it in the same project as the
  OAuth client — instead of a bare `PERMISSION_DENIED`.
- Tokens from a login are stored per server in
  `~/.config/mcp-google-chat/credentials.json` (0600) and re-read on every
  call, so a login finished mid-session works without restarting the AI client.
  `GOOGLE_CHAT_OAUTH_PORT` pins the loopback listener port for SSH forwarding.

### Changed

- `GoogleChatClient` accepts the component's `TokenProvider` as a fallback
  token source: environment credentials (the refresh triple or
  `GOOGLE_CHAT_ACCESS_TOKEN`) keep absolute priority and behave exactly as
  before; the stored in-chat login is used only when the environment carries no
  credentials. The single 401 re-mint + replay now works for provider-backed
  tokens too, and is skipped when nothing can be re-minted.
- The unconfigured `initialize` instructions lead with the in-chat login
  (`setup_instructions` → `set_client` → `start_login` → `finish_login`, no
  restart needed); setting the environment variables + restart remains the
  documented alternative.

### Notes

- The login requests `chat.spaces.readonly`, `chat.messages`,
  `chat.messages.reactions` and `chat.memberships.readonly`. The org-wide
  `chat.admin.spaces.readonly` scope behind `search_spaces` is deliberately NOT
  requested — admins keep using the environment path, where the scope set is
  theirs to choose.

## [0.1.0] - 2026-08-30

### Added

- Initial release: MCP server for the Google Chat API v1 over stdio.
- Space discovery: `list_spaces`, `get_space`, `search_spaces` (Workspace
  admin, `useAdminAccess`), `find_direct_message`.
- Messages & threads: `list_messages` (createTime/thread filters),
  `get_message`, `send_message` (thread_name/thread_key + reply options,
  custom `client-` message ids), `update_message`, `delete_message`.
- Reactions: `manage_reactions` (add/list/remove unicode emoji).
- Attachments: `get_attachment` (metadata; auth split documented).
- Memberships: `list_members`, `manage_members` (get/add/update_role/remove).
- Escape hatch: `raw_request` (GET/POST/PATCH/DELETE with SSRF guard).
- OAuth2 refresh-token flow with token caching, deduped refreshes and one
  forced re-mint + replay on 401; static access-token alternative.
- Degraded start without credentials: the server completes the MCP handshake,
  prefixes the instructions with the fix, and fails tool calls with an
  actionable `CredentialsError` before any network I/O.
- Retry policy: 429 always with backoff (Retry-After honored); 5xx/network
  errors only for GET — writes are never replayed after ambiguous failures.
- Anonymous usage telemetry (opt-out `ASKADS_TELEMETRY=0`); no credentials,
  message content or arguments ever leave the machine.
- Offline unit tests for config, client, telemetry and every tool; dist smoke
  test with a real stdio MCP handshake; opt-in live smoke with a disposable
  message cycle and guaranteed cleanup.
- Capability documentation: one task-oriented page per tool + index, enforced
  by coverage and link tests.
