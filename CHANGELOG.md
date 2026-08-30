# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
