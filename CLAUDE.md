# CLAUDE.md — mcp-google-chat

MCP server for the Google Chat API v1 (TypeScript, stdio). Mixed read/write:
tools cover space discovery (list/get/search/find-DM), message CRUD with
threads, emoji reactions, attachment metadata and membership management;
`raw_request` is the escape hatch. The server talks to
`https://chat.googleapis.com` with a Bearer token; the token is minted from an
OAuth2 refresh token via `https://oauth2.googleapis.com/token` (or a static
`GOOGLE_CHAT_ACCESS_TOKEN` — e.g. a service-account/Chat-app token, or for
testing). With user credentials the server acts AS THE SIGNED-IN USER: sends
appear under their name and only their own messages/reactions can be
edited/deleted.

## Commands

```bash
npm run dev        # run from source (tsx watch)
npm test           # unit tests + dist smoke, no network
npm run typecheck  # types for src + tests
npm run build      # emit dist/
npm run smoke      # live check: read-only by default; full disposable write cycle
                   # with cleanup when a space is given (argv/GOOGLE_CHAT_SMOKE_SPACE)
```

## Architecture

- `src/config.ts` — env → config. Credentials: either the refresh triple
  `GOOGLE_CHAT_CLIENT_ID` + `GOOGLE_CHAT_CLIENT_SECRET` + `GOOGLE_CHAT_REFRESH_TOKEN`
  (all three or `ConfigError` `incomplete_oauth_config`) or `GOOGLE_CHAT_ACCESS_TOKEN`;
  optional `GOOGLE_CHAT_API_BASE`, `GOOGLE_CHAT_TIMEOUT_MS`, `GOOGLE_CHAT_MAX_RETRIES`.
  No credentials at all is NOT an error: the fields stay `undefined` and the server starts
  degraded. Also home to `CredentialsError` / `MISSING_CREDENTIALS_MESSAGE` (opens with the
  historical startup error verbatim, then names the variables and the restart) and
  `hasCredentials()`.
- `src/client.ts` — all HTTP and all wire mapping. Token lifecycle (cache until ~60s before
  expiry, dedupe concurrent refreshes, one forced re-mint + replay on 401); `request()`
  resolves the path against the base and rejects foreign origins (SSRF guard), enforces an
  AbortController timeout that also covers reading the body, retries 429 always but 5xx/network
  errors **only for GET** — replaying a write after an ambiguous failure would duplicate the
  send — and throws `GoogleChatError(status, body)`. Resource-name normalizers
  (`asSpaceName`, `asUserName`, `asMessageName`, `asThreadName`, `asMemberName`,
  `asReactionName`, `asAttachmentName`) accept the shapes users paste, validate them strictly
  (no path smuggling) and are exported for tests. Wire enums (`SPACE`/`GROUP_CHAT`/
  `DIRECT_MESSAGE`, `ROLE_MEMBER`/`ROLE_MANAGER`, `REPLY_MESSAGE_*`) and filter strings
  (`createTime > "..."`, `thread.name = ...`, `role = "..."`, `emoji.unicode = "..."`) are
  built here only. `createMessage` defaults `messageReplyOption` to the fallback whenever a
  thread is targeted — the API's own default silently ignores the thread.
- `src/tools/spaces.ts` — `list_spaces`, `get_space`, `search_spaces` (admin-only,
  useAdminAccess), `find_direct_message`.
  `src/tools/messages.ts` — `list_messages`, `get_message`, `send_message`,
  `update_message`, `delete_message`.
  `src/tools/reactions.ts` — `manage_reactions` (add/list/remove).
  `src/tools/attachments.ts` — `get_attachment` (metadata; the endpoint itself is app-auth
  only — user flows read the same fields from `get_message`).
  `src/tools/members.ts` — `list_members`, `manage_members` (get/add/update_role/remove).
  `src/tools/raw.ts` — `raw_request` (GET/POST/PATCH/DELETE). `src/tools/util.ts` —
  `ok`/`fail`, the four annotation presets (`READ_ONLY`/`WRITE`/`UPDATE`/`DESTRUCTIVE`) and
  shared zod schema factories (`spaceSchema`, `messageNameSchema`, `memberNameSchema`,
  `userSchema`, `rfc3339Timestamp`, `pageTokenSchema`).
- `src/index.ts` — wires every `register*` into the McpServer. `loadConfigOrDegraded()`
  catches `ConfigError`, pings `startup_failed` (fire-and-forget) and degrades the config to
  "no credentials"; an unconfigured start prepends `UNCONFIGURED_PREFIX` — plus
  `Configuration problem: <message>` when a ConfigError was caught — to the initialize
  `instructions`, and `oninitialized` sends `server_start` for a configured install or
  `unconfigured_start` (with the reason) otherwise.
- `src/telemetry.ts` — anonymous usage pings (ids/names/versions only, never data or
  arguments; fire-and-forget, must never block or throw; opt-out `ASKADS_TELEMETRY=0`).
  `server_start` means "a usable install started"; `unconfigured_start` is a degraded start
  and `startup_failed` a malformed config caught at load — both carry a `reason` from a
  closed vocabulary (`missing_credentials`, `incomplete_oauth_config`) — never a variable's
  name or value.

## Conventions (do not break)

- **Never exit because of configuration.** A server that dies before the MCP handshake leaves
  the user with a red cross and no reason — telemetry across this line of servers showed that
  state accounted for nearly every unconfigured install, and almost none of them recovered.
  Missing credentials are a survivable state: start, answer initialize (with the unconfigured
  prefix in `instructions`) and tools/list, and let the first tool call fail with
  `CredentialsError` — its message names the variables to set and says to restart, because
  credentials come only from the environment. `config.test.ts`, `client.test.ts` and
  `test/dist-smoke.test.js` pin this.
- **Credential failures are not transport failures.** `CredentialsError` is thrown in
  `accessToken()` before any fetch — before the retry/backoff loop, the token mint and the
  401 replay — because retrying it burns seconds of backoff before the user sees the one
  message that helps. Pinned by the "fetch never called" assertion in `client.test.ts`.
- **Never retry a write on 5xx/network errors.** Only 429 (rejected before executing) and GET
  are safe; the gate lives in `request()` and is pinned by tests. A replayed send is a
  duplicate message in a real room.
- **Wire mapping lives in the client, not the tools.** Tools accept the normalized snake_case
  vocabulary and must not know the wire enums (`SPACE`, `ROLE_MANAGER`,
  `REPLY_MESSAGE_OR_FAIL`, filter/updateMask strings) — add any mapping in `client.ts`.
- **Auth is the client's job.** Tools never see tokens; the Bearer header, refresh, caching
  and the 401 replay all live in `request()`/`accessToken()`.
- **Full resource names for sub-resources.** Spaces and users are normalized from bare
  ids/emails, but messages, threads, members, reactions and attachments are addressed only by
  the full names the API returns — descriptions must keep steering the model to
  `list_messages`/`list_members`/`manage_reactions list` first.
- **Domain limits stay documented, not faked.** No message text search (filters are createTime
  and thread.name only), no DM creation in `find_direct_message`, no card sends with user
  auth, no media byte transfer — say so in descriptions and route the rest to `raw_request`.
- **Validate inputs with zod** in `inputSchema`; reuse the shared schema **factories** in
  `util.ts` (a fresh schema per field avoids `$ref` dedup in the JSON schema).
- **Annotations are pinned per tool** in `annotations.test.ts` — changing one is a conscious
  decision that updates the map, with all four hints always set.
- **Output compact JSON via `ok`** — the consumer is an LLM; pretty-printing burns tokens.
  Responses pass through verbatim (describe the fields in the tool `description`, the only
  place the external model reads).

## Adding a tool

Before changing the tool registry, read [the MCP capability documentation contract](docs/CAPABILITY-DOCUMENTATION.md). Every registered tool must have exactly one task-oriented page in `docs/capabilities/`; update that page, the index, and the coverage test in the same change.

1. Add (or extend) `src/tools/<name>.ts` with `register<Name>Tools(server, client)`.
2. If it hits a new endpoint, add a method to `src/client.ts` with the wire mapping.
3. Import and call the register fn in `src/index.ts`.
4. Add a `*.test.ts` using the mock-fetch (client) / fake-client (tools) harness — no
   network — and add the tool + hints to `annotations.test.ts` and `test/dist-smoke.test.js`.
5. `npm run typecheck && npm test`.

## Releasing

Keep the version in sync across **all** channels in one go (`git push --follow-tags` pushes
the tag but does **not** create a GitHub Release; the registry is immutable per version):

1. Bump `version` in **three places, identically**: `package.json`, and in `server.json`
   **both** the root `version` **and** `packages[0].version`. `mcpName` in `package.json` must
   match `name` in `server.json` (`io.github.A1-x-Tech/mcp-google-chat`). Verify:
   `grep -n '"version"' package.json server.json`.
   > ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. A stale root makes
   > `mcp-publisher publish` fail with a misleading `400 cannot publish duplicate version`
   > while `npm publish` succeeds.
2. Update `CHANGELOG.md`, then `npm publish` (runs typecheck + tests + build via
   `prepublishOnly` / `prepare`).
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:** `mcp-publisher publish` (login with
   `mcp-publisher login github --token "$(gh auth token)"`).
