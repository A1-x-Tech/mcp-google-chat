# Development

## Requirements

- Node.js 20+ (the published package ships compiled `dist/`; `npx` needs no separate
  install). CI runs the suite on Node 20, 22 and 24.

## Commands

```bash
npm install
npm run dev        # run from source with tsx watch
npm test           # unit tests (node:test) + dist smoke, no network
npm run typecheck  # type-check src + tests (no emit)
npm run build      # clean dist/ and compile with tsc
npm run smoke      # live check (see below)
```

## Local run

```bash
npm run build
GOOGLE_CHAT_CLIENT_ID=... GOOGLE_CHAT_CLIENT_SECRET=... GOOGLE_CHAT_REFRESH_TOKEN=... \
  node dist/index.js
# or, for a quick session with a short-lived token:
GOOGLE_CHAT_ACCESS_TOKEN=$(gcloud auth print-access-token) node dist/index.js
# optional: GOOGLE_CHAT_API_BASE, GOOGLE_CHAT_TIMEOUT_MS, GOOGLE_CHAT_MAX_RETRIES
```

## Live smoke (opt-in write cycle with cleanup)

`npm run smoke` has two levels:

- **Default (read-only):** mints an access token from the refresh token and lists one page
  of spaces. Nothing is written.
- **Opt-in write cycle:** with a space id (first argv or `GOOGLE_CHAT_SMOKE_SPACE`) it runs
  the full disposable cycle in that space — send a throwaway message, update it, read it
  back, and **delete it in a `finally` block**, so the space is left clean after success and
  after any mid-cycle failure. Point it at a dedicated test space: the message is visible to
  the space's members for the seconds it exists. If the cleanup itself fails, the smoke exits
  non-zero and prints the message name to delete manually.

## Tests

Unit tests mock `globalThis.fetch` (client) or use a fake server + fake client (tools), so
the whole suite runs offline — including the OAuth refresh flow, whose token endpoint is
served by the same fetch stub. `test/dist-smoke.test.js` additionally spawns the built
`dist/index.js` and performs a real MCP handshake over stdio through the official SDK,
asserting the server identity and the full tool list — with and without credentials (the
degraded-start contract). Put a `*.test.ts` next to the code it covers;
`npm run typecheck && npm test` is the gate (also run by `prepublishOnly`).

## Usage telemetry

The server sends anonymous events to `usage.gistrec.cloud` (`server_start` when a client
connects to a configured install, `unconfigured_start` when a client connects to a server
without credentials, `tool_call` with the tool **name**, and `startup_failed` with a
fixed-vocabulary reason code when the configuration is malformed) to count active installs
and tool demand. An event carries only impersonal technical fields: a random installation id
(`~/.config/mcp-google-chat/instance-id`), the package version, the AI client's name and
version from the MCP handshake, the Node.js version and the OS.

OAuth credentials, chat messages, tool arguments and prompts are never sent or stored
(implementation: `src/telemetry.ts`). Sends run in the background with a 2 s timeout and are
silently skipped on any error. Opt out for all servers of this line at once:
`ASKADS_TELEMETRY=0`.
