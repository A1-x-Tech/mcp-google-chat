# Tools

For task-oriented guidance, open the [MCP capability catalog](./capabilities/index.md). This page remains the technical reference for schemas and API responses.

The Google Chat API mixes reads and writes, so every tool carries explicit MCP
annotations: reads are `readOnlyHint`, updates are idempotent-but-overwriting,
deletes are destructive. Inputs use a normalized snake_case vocabulary; the
client maps them to the API's wire values (`SPACE` / `GROUP_CHAT` /
`DIRECT_MESSAGE`, `ROLE_MANAGER`, `REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`,
updateMask paths) and handles OAuth entirely on its own.

`space` accepts `spaces/<id>` or the bare id; messages, memberships, reactions
and attachments are addressed by their **full resource names** as the API
returns them (`spaces/<space>/messages/<message>`, ...).

## User credentials vs Chat app configuration

With the OAuth refresh triple the server acts **as the signed-in user**:
messages send under their name; only their own messages and reactions can be
edited/deleted; membership writes additionally need the user to be a space
manager. Acting as a **Chat app** (cards, app DMs, `get_attachment`,
`delete_message force`) is a separate Google Cloud configuration (service
account + Chat app settings); the only bridge here is a static
`GOOGLE_CHAT_ACCESS_TOKEN` minted externally for that service account.

## Connection

Registered by [`@a1-x-tech/mcp-google-auth`](https://www.npmjs.com/package/@a1-x-tech/mcp-google-auth) — the shared in-chat login of the `mcp-google-*` line. Environment credentials always win over a login stored here.

| Tool | Description |
|---|---|
| `auth_status` | Token present or not, its source (env vs stored login), expiry, account email, scopes and file paths. Local only, no network call. |
| `setup_instructions` | The Cloud-console checklist: project, **Google Chat API**, consent screen, **Desktop app** OAuth client. |
| `set_client` | Stores the OAuth client from the downloaded `client_secret_*.json` — takes the file **path**, so the secret never passes through the chat. Shared across `mcp-google-*`; tokens stay per server. |
| `start_login` | Returns the Google consent URL; a one-shot `127.0.0.1` listener (PKCE) catches the redirect. Not read-only on purpose — it binds a port and starts a flow. Expires in 10 minutes. |
| `finish_login` | Exchanges the code, stores tokens in `~/.config/mcp-google-chat/credentials.json` (0600) and verifies them with a real Chat call; a disabled-API 403 becomes "enable the Chat API in the same project". |
| `logout` | Revokes the token at Google and deletes the local login. `GOOGLE_CHAT_*` variables are untouched. |

Scopes requested by a login: `chat.spaces.readonly`, `chat.messages`, `chat.messages.reactions`, `chat.memberships.readonly`. `search_spaces` needs the admin scope, which a login deliberately does not request — use the environment path for it.

## Spaces

| Tool | Description |
|---|---|
| `list_spaces` | Spaces the user is a member of; `space_type` filter (`space`\|`group_chat`\|`direct_message`), pagination. No text search — match `displayName` client-side. |
| `get_space` | One space: displayName, spaceType, spaceDetails, `spaceThreadingState`, membershipCount. Check the threading state before threaded sends. |
| `search_spaces` | `spaces:search` with `useAdminAccess=true` — **Workspace admin only** (chat.admin.spaces[.readonly] scope). `query` must contain `customer = "customers/my_customer" AND spaceType = "SPACE"`. |
| `find_direct_message` | The existing DM space with a user (id or email). 404 when none exists — creating a DM needs `spaces:setup` via `raw_request`. |

## Messages & threads

| Tool | Description |
|---|---|
| `list_messages` | Messages in a space. Filters: `created_after` (createTime) and `thread_name` — the API's only two; `order` asc/desc; `show_deleted`. Poll incrementally with `created_after`. |
| `get_message` | One message by full name (also `spaces/<s>/messages/client-<id>` custom ids): text, sender, `thread.name`, `attachment[]` metadata, reaction summaries. |
| `send_message` | Sends text (≤4096 chars, Chat markup) as the user. Threads: `thread_name` or `thread_key` + `reply_option` (`fallback_to_new_thread` default, `or_fail`); the client sets `messageReplyOption` automatically when a thread is targeted. `message_id` (`client-...`) makes sends addressable/deduplicable. Never retried after 5xx/timeout. |
| `update_message` | PATCH with `updateMask=text` — replaces the text of the user's OWN message. |
| `delete_message` | Permanent delete. Own messages (or space manager). Thread-starters with replies fail unless `force=true` (app auth only). |

## Reactions

| Tool | Description |
|---|---|
| `manage_reactions` | `action`: `add` (message + unicode `emoji`; duplicate → ALREADY_EXISTS), `list` (optionally one emoji's; pagination), `remove` (own reaction by `reaction_name`). Custom emoji via `raw_request`. |

## Attachments

| Tool | Description |
|---|---|
| `get_attachment` | Attachment metadata by full resource name. The dedicated endpoint is **app-auth only**; with user credentials read the same metadata from `get_message`. Raw bytes (media download/upload) are outside this server. |

## Members

| Tool | Description |
|---|---|
| `list_members` | Memberships: member, role (`ROLE_MEMBER`/`ROLE_MANAGER`), state; `role` filter, `show_invited`, `show_groups`. |
| `manage_members` | `action`: `get` (by `member_name`), `add` (space + user, optional `role=manager`; humans only), `update_role`, `remove`. add/update_role/remove need the user to be a space **manager**. |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | Any Chat API v1 path (`GET`/`POST`/`PATCH`/`DELETE`, default GET) — space creation/updates, `spaces:setup`, custom emoji, Group memberships, spaceEvents. Foreign-origin paths are rejected (SSRF guard) so the Bearer token never leaves `chat.googleapis.com`. |

## Notes

- **Retry policy:** 429 is retried with backoff for every method (the request was rejected
  before executing); 5xx and network errors are retried **only for GET** — replaying a write
  after an ambiguous failure could duplicate the send or hit a different target.
- **OAuth:** access tokens are minted from the refresh token automatically, cached until ~60s
  before expiry, and re-minted once on a 401.
- **Domain errors:** PERMISSION_DENIED on message edit/delete or membership writes is usually
  Chat's ownership/role model (not broken auth); ALREADY_EXISTS on send means the
  `message_id` was already used; FAILED_PRECONDITION on delete means the thread has replies.

## Minimal OAuth scopes

Grant only what the session needs; the server sends whatever token it was given:

| Task | Scope |
|---|---|
| List/read spaces, find DM | `https://www.googleapis.com/auth/chat.spaces.readonly` |
| Read messages | `https://www.googleapis.com/auth/chat.messages.readonly` |
| Send messages | `https://www.googleapis.com/auth/chat.messages.create` |
| Edit/delete own messages | `https://www.googleapis.com/auth/chat.messages` |
| List reactions | `https://www.googleapis.com/auth/chat.messages.reactions.readonly` |
| Add/remove reactions | `https://www.googleapis.com/auth/chat.messages.reactions` |
| List members | `https://www.googleapis.com/auth/chat.memberships.readonly` |
| Manage members | `https://www.googleapis.com/auth/chat.memberships` |
| search_spaces (admin) | `https://www.googleapis.com/auth/chat.admin.spaces.readonly` |

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CHAT_CLIENT_ID` | no* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_CHAT_CLIENT_SECRET` | no* | — | OAuth2 client secret (refresh flow). Secret. |
| `GOOGLE_CHAT_REFRESH_TOKEN` | no* | — | OAuth2 refresh token (refresh flow). Secret. |
| `GOOGLE_CHAT_ACCESS_TOKEN` | no* | — | Alternative: static access token (~1 h lifetime; can be a service-account/Chat-app token). Secret. |
| `GOOGLE_CHAT_OAUTH_PORT` | no | — | Fixed loopback port for `start_login` (SSH port forwarding); otherwise a free port per login. |
| `GOOGLE_CHAT_API_BASE` | no | `https://chat.googleapis.com` | API root override. |
| `GOOGLE_CHAT_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_CHAT_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* None of them is required: without credentials the server connects through the in-chat login above. For the environment path, provide either the refresh triple together or the static access token; both win over a stored login, and the server never refreshes or deletes them.
