# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Chat MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/mcp-google-chat)](https://www.npmjs.com/package/mcp-google-chat)
[![CI](https://github.com/A1-x-Tech/mcp-google-chat/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-chat/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-chat/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-chat)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Chat MCP** lets an AI app work in Google Chat in plain language. Find the right space or direct message, catch up on a conversation, reply in a thread, react with an emoji and manage who is in a space.

It uses the Google Chat API with your Google account and acts as the signed-in user: messages send under your name, and only your own messages and reactions can be edited or deleted. It makes the limits of the Chat API explicit instead of implying that every chat task is possible.

- **14 tools.** Discover spaces and direct messages, read and send messages with thread control, manage emoji reactions, read attachment metadata and manage membership.
- **You act as yourself.** Sends appear under your name; edits and deletes stop at your own messages and reactions.
- **A send is never replayed.** After an ambiguous failure the server does not retry a write — a replayed send would be a duplicate message in a real room.
- **Minimal Google scopes.** The server sends whatever token you minted; grant scopes per task — read-only ones are enough for browsing spaces and messages.

Start with a read-only question:

> Show today’s messages in the team space and summarize what was decided.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** What was discussed in the release space today?
>
> **Assistant:** Lists today’s messages with senders and threads. Nothing changes.
>
> **You:** Reply in the deploy thread that the rollout is finished.
>
> **Assistant:** Shows the target space, the thread and the drafted text, then asks for confirmation before sending.
>
> **You:** Confirm.
>
> **Assistant:** Sends the reply under your name in that thread. It does not touch any other message.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How the server acts in Chat](#how-the-server-acts-in-chat)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google account with access to Google Chat and OAuth credentials from a Google Cloud project with the Google Chat API enabled.

1. [Prepare Google OAuth access](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → MCP servers**, select **Add server**, choose **STDIO**, enter the command `npx -y mcp-google-chat@latest` and environment variables `GOOGLE_CHAT_CLIENT_ID`, `GOOGLE_CHAT_CLIENT_SECRET`, `GOOGLE_CHAT_REFRESH_TOKEN`, then select **Save** and **Restart**.

**From the command line:**

```bash
codex mcp add google-chat \
  --env GOOGLE_CHAT_CLIENT_ID=your_client_id \
  --env GOOGLE_CHAT_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_CHAT_REFRESH_TOKEN=your_refresh_token \
  -- npx -y mcp-google-chat@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_CHAT_CLIENT_ID=your_client_id \
  --env GOOGLE_CHAT_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_CHAT_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-chat \
  -- npx -y mcp-google-chat@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

The current official path is **Settings → Extensions**. For a custom desktop extension, open **Advanced settings → Extension Developer → Install Extension…**, select a `.mcpb` file and follow the prompts.

This repository currently publishes an npm stdio package and does not contain a `.mcpb` bundle. For Claude Desktop builds that still support local configuration, use the following JSON stdio configuration as a fallback:

```json
{
  "mcpServers": {
    "google-chat": {
      "command": "npx",
      "args": ["-y", "mcp-google-chat@latest"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "your_client_id",
        "GOOGLE_CHAT_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_CHAT_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

In those builds, save it to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-chat": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-chat@latest"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "your_client_id",
        "GOOGLE_CHAT_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_CHAT_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-chat": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-chat@latest"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "${input:chat_client_id}",
        "GOOGLE_CHAT_CLIENT_SECRET": "${input:chat_client_secret}",
        "GOOGLE_CHAT_REFRESH_TOKEN": "${input:chat_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "chat_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "chat_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "chat_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### Catch up on a conversation

- Show my spaces and find the direct message with alex@example.com.
- What was posted in the release space today? Summarize the decisions.
- Show the whole thread this message belongs to.

### Post and maintain messages

- Send a status update to the team space.
- Reply in the deploy thread that the rollout is finished.
- Fix the typo in my last message, or delete it entirely.

### React and check attachments

- Add a 👍 to the announcement and show who else reacted with what.
- Remove my reaction from that message.
- What files are attached to this message? Show their names and types.

### Manage who is in a space

- Who is in this space, and who are its managers?
- Add alex@example.com to the space and make them a manager.
- Remove a former teammate from the space.

## How the server acts in Chat

1. With the OAuth refresh credentials the server acts **as the signed-in user**: messages send under your name, and edits and deletes reach only your own messages and reactions. Membership changes additionally require you to be a space manager.
2. Spaces accept a bare id, but messages, threads, members, reactions and attachments are addressed by the **full resource names** the API returns — list first, then act on an exact name.
3. A reply targets a thread by its name or by a thread key. By default a send falls back to starting a new thread when the target cannot be threaded; you can ask it to fail instead.
4. Acting as a **Chat app** — cards, app direct messages, the dedicated attachment endpoint, forced deletes — is a separate Google Cloud configuration; the only bridge here is a service-account access token supplied as `GOOGLE_CHAT_ACCESS_TOKEN`.

The Chat API cannot search message text — the only message filters are creation time and thread. `find_direct_message` finds an existing DM but never creates one, and file bytes are not downloaded or uploaded through this server. Space creation and the other uncovered API methods go through `raw_request`.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Read spaces, messages, members, reactions and attachment metadata | Reads conversations and metadata | No change |
| Send a message | Posts in a real space under your name | Changes a conversation |
| Update a message | Replaces the text of your own message | Changes a conversation |
| Add or remove a reaction | Changes your own reaction on a message | Changes a conversation |
| Delete a message | Permanently removes a message | Destructive |
| Manage membership | Adds, re-roles or removes a space member | Potentially destructive |
| Raw API request | Can call API methods without a dedicated tool | Potentially destructive |

The AI client controls confirmation prompts. The server marks reads, writes and destructive tools so the client can distinguish catching up from posting.

## Getting access

Google Chat requires OAuth 2.0; an API key is not enough.

1. Create or select a Google Cloud project and enable **Google Chat API**.
2. Configure the OAuth consent screen and create a **Desktop app** OAuth client.
3. Authorize the Google account you chat as. The [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) can obtain the refresh token when **Use your own OAuth credentials** is enabled.
4. Request only the scopes your sessions need. For reading and sending, this is enough:

   ```text
   https://www.googleapis.com/auth/chat.spaces.readonly
   https://www.googleapis.com/auth/chat.messages.readonly
   https://www.googleapis.com/auth/chat.messages.create
   ```

   The full per-task table — editing and deleting your own messages, reactions, memberships, admin search — is in [docs/TOOLS.md](./docs/TOOLS.md#minimal-oauth-scopes).

Testing-mode OAuth refresh tokens can expire after seven days. Publish the OAuth app, or use an Internal app in a Workspace domain, when you need long-lived access. Treat the client secret and refresh token as passwords.

For a quick session, a short-lived token in `GOOGLE_CHAT_ACCESS_TOKEN` also works — for example from `gcloud auth print-access-token` with Chat scopes granted. The same variable is how a service-account Chat-app token reaches the server when you need app-only features.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CHAT_CLIENT_ID` | Yes* | OAuth client ID. |
| `GOOGLE_CHAT_CLIENT_SECRET` | Yes* | OAuth client secret. |
| `GOOGLE_CHAT_REFRESH_TOKEN` | Yes* | OAuth refresh token. |
| `GOOGLE_CHAT_ACCESS_TOKEN` | Yes* | Short-lived alternative to the OAuth trio; can be a service-account or Chat-app token. |
| `GOOGLE_CHAT_API_BASE` | No | Google Chat API base URL override. |
| `GOOGLE_CHAT_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_CHAT_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token.

Started without credentials, the server still completes the MCP handshake; the first tool call then names the exact variables to set and asks for a restart instead of failing silently.

## Data, limits and background work

- **Requests go to Google Chat.** The local server refreshes Google OAuth tokens and calls the Chat API; the token is never sent to any other host. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, message content, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies per-project and per-user quotas.** On `429`, the server uses backoff; reads also retry after network and `5xx` errors, while writes are never replayed after an uncertain failure — a replayed send would be a duplicate message in a real room. `send_message` accepts a custom message id that makes a send addressable and deduplicable.
- **There is no background polling.** The server runs only when called. `list_messages` can poll a space incrementally by creation time if your AI app supports scheduled tasks; space event subscriptions go through `raw_request`.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Chat API reference](https://developers.google.com/workspace/chat)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-chat/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
