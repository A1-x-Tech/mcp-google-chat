import type {
  GoogleChatConfig,
  MemberRole,
  MessageOrder,
  ReplyOption,
  SpaceType,
} from "./types.js";
import { GoogleChatError } from "./types.js";
import { CredentialsError } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** Google's OAuth2 token endpoint — refresh tokens are exchanged here. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ---- Resource-name normalization -------------------------------------------
//
// Chat addresses everything by resource name (spaces/AAA, spaces/AAA/messages/BBB,
// ...). Users paste bare ids as often as full names, so the short forms are
// normalized here; every name is then validated against the exact shape the API
// expects — a malformed name must fail with a readable message before any fetch,
// and can never smuggle path segments ("../", query strings) into the URL.

/** "AAA" or "spaces/AAA" → "spaces/AAA". */
export function asSpaceName(space: string): string {
  const name = space.startsWith("spaces/") ? space : `spaces/${space}`;
  if (!/^spaces\/[^\s/?#]+$/.test(name)) {
    throw new Error(`Invalid space: expected "spaces/<id>" or a bare id, got ${JSON.stringify(space)}.`);
  }
  return name;
}

/** "user@example.com", "123", or "users/..." → "users/...". */
export function asUserName(user: string): string {
  const name = user.startsWith("users/") ? user : `users/${user}`;
  if (!/^users\/[^\s/?#]+$/.test(name)) {
    throw new Error(`Invalid user: expected "users/<id or email>" or a bare id/email, got ${JSON.stringify(user)}.`);
  }
  return name;
}

/** Requires the full message resource name (messages are only ever returned that way). */
export function asMessageName(message: string): string {
  if (!/^spaces\/[^\s/?#]+\/messages\/[^\s/?#]+$/.test(message)) {
    throw new Error(
      `Invalid message name: expected "spaces/<space>/messages/<message>", got ${JSON.stringify(message)}.`,
    );
  }
  return message;
}

/** Requires the full thread resource name from a message's thread.name. */
export function asThreadName(thread: string): string {
  if (!/^spaces\/[^\s/?#]+\/threads\/[^\s/?#]+$/.test(thread)) {
    throw new Error(
      `Invalid thread name: expected "spaces/<space>/threads/<thread>", got ${JSON.stringify(thread)}.`,
    );
  }
  return thread;
}

/** Requires the full membership resource name from list_members. */
export function asMemberName(member: string): string {
  if (!/^spaces\/[^\s/?#]+\/members\/[^\s/?#]+$/.test(member)) {
    throw new Error(
      `Invalid membership name: expected "spaces/<space>/members/<member>", got ${JSON.stringify(member)}.`,
    );
  }
  return member;
}

/** Requires the full reaction resource name from manage_reactions list. */
export function asReactionName(reaction: string): string {
  if (!/^spaces\/[^\s/?#]+\/messages\/[^\s/?#]+\/reactions\/[^\s/?#]+$/.test(reaction)) {
    throw new Error(
      `Invalid reaction name: expected "spaces/<space>/messages/<message>/reactions/<reaction>", got ${JSON.stringify(reaction)}.`,
    );
  }
  return reaction;
}

/** Requires the full attachment resource name from a message's attachment[].name. */
export function asAttachmentName(attachment: string): string {
  if (!/^spaces\/[^\s/?#]+\/messages\/[^\s/?#]+\/attachments\/[^\s/?#]+$/.test(attachment)) {
    throw new Error(
      `Invalid attachment name: expected "spaces/<space>/messages/<message>/attachments/<attachment>", got ${JSON.stringify(attachment)}.`,
    );
  }
  return attachment;
}

// ---- Wire enum mapping ------------------------------------------------------

/** Maps a normalized space type to the API's wire value. */
function mapSpaceType(type: SpaceType): string {
  return { space: "SPACE", group_chat: "GROUP_CHAT", direct_message: "DIRECT_MESSAGE" }[type];
}

/** Maps a normalized reply option to the API's messageReplyOption wire value. */
function mapReplyOption(option: ReplyOption): string {
  return {
    fallback_to_new_thread: "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD",
    or_fail: "REPLY_MESSAGE_OR_FAIL",
  }[option];
}

/** Maps a normalized membership role to the API's wire value. */
function mapMemberRole(role: MemberRole): string {
  return { member: "ROLE_MEMBER", manager: "ROLE_MANAGER" }[role];
}

/** Normalized inputs for send_message. */
export interface CreateMessageParams {
  space: string;
  text: string;
  /** Reply into this thread (full name from a message's thread.name). */
  threadName?: string;
  /** Reply into (or start) the thread with this app/user-chosen key. */
  threadKey?: string;
  /** What to do when the targeted thread does not exist; defaults to fallback when a thread is set. */
  replyOption?: ReplyOption;
  /** Custom id ("client-..."), letting the caller retrieve/update the message without storing the server id. */
  messageId?: string;
}

/** Normalized inputs for list_messages. */
export interface ListMessagesParams {
  space: string;
  /** Only messages in this thread (full thread resource name). */
  threadName?: string;
  /** RFC3339 timestamp; becomes `createTime > "X"`. */
  createdAfter?: string;
  orderBy?: MessageOrder;
  showDeleted?: boolean;
  pageSize?: number;
  pageToken?: string;
}

/** Normalized inputs for list_members. */
export interface ListMembersParams {
  space: string;
  /** Filter by role; the API also supports member.type filters via raw_request. */
  role?: MemberRole;
  showGroups?: boolean;
  showInvited?: boolean;
  pageSize?: number;
  pageToken?: string;
}

export class GoogleChatClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  /** Cached access token from the refresh flow, with its expiry. */
  private cachedToken?: { value: string; expiresAt: number };
  /** In-flight refresh, deduping concurrent token requests. */
  private refreshInFlight?: Promise<string>;

  constructor(private readonly config: GoogleChatConfig) {
    this.base = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  private canRefresh(): boolean {
    return Boolean(this.config.refreshToken && this.config.clientId && this.config.clientSecret);
  }

  /**
   * Returns a valid Bearer token. With the refresh triple configured, mints an
   * access token from the refresh token and caches it until shortly before it
   * expires (concurrent callers share one in-flight refresh); otherwise the
   * static GOOGLE_CHAT_ACCESS_TOKEN is used as-is. With neither configured,
   * throws {@link CredentialsError} BEFORE any fetch — a missing setup must
   * never enter the retry/backoff loop or trigger the 401 re-mint, because no
   * amount of retrying mints credentials.
   */
  private async accessToken(forceRefresh = false): Promise<string> {
    if (!this.canRefresh()) {
      if (!this.config.accessToken) throw new CredentialsError();
      return this.config.accessToken;
    }
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAccessToken().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  /** Exchanges the refresh token for a fresh access token at Google's token endpoint. */
  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId as string,
      client_secret: this.config.clientSecret as string,
      refresh_token: this.config.refreshToken as string,
      grant_type: "refresh_token",
    }).toString();

    const { res, text } = await this.fetchWithTimeout(
      TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "oauth2 token refresh",
    );

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) throw new GoogleChatError(res.status, data);

    const token = (data as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) {
      throw new Error("OAuth2 token endpoint returned no access_token.");
    }
    const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    // Refresh 60s ahead of the real expiry so requests never race a dying token.
    this.cachedToken = { value: token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 };
    return token;
  }

  /** Verifies the OAuth credentials by minting a fresh access token (refresh flow only). */
  async authCheck(): Promise<unknown> {
    if (!this.canRefresh()) {
      throw new Error(
        "authCheck needs the refresh flow (GOOGLE_CHAT_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN); with a static GOOGLE_CHAT_ACCESS_TOKEN list spaces instead.",
      );
    }
    await this.accessToken(true);
    return { ok: true, auth: "refresh_token" };
  }

  /** Backoff before a retry: honors Retry-After when present, else exponential (capped at 30s). */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = res ? Number(res.headers.get("Retry-After")) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers, and returns the text alongside the response.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { res, text };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Low-level request to a Google Chat API path (e.g. "v1/spaces/AAA"). Auth is
   * a Bearer token (refreshed transparently; a 401 forces one re-mint + retry).
   * 429 is always retried with backoff; 5xx and network errors/timeouts are
   * retried only for GET — Chat writes are real messages and memberships, and
   * replaying one after an ambiguous failure would duplicate the send or hit a
   * different target. Any other non-2xx throws a {@link GoogleChatError}.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    // Guard method !== "GET" keeps undici from crashing on a GET-with-body.
    const hasBody = body !== undefined && method !== "GET";

    // Resolve the path against the API base, then reject anything that escaped
    // to a foreign origin (an absolute "https://evil/x" or a "\\evil/x" slipped
    // through raw_request) so the Bearer token can never leak to another host.
    const url = new URL(path.replace(/^\//, ""), this.base);
    if (url.origin !== new URL(this.base).origin) {
      throw new Error(`path must be a relative Google Chat API path like "v1/spaces/AAA" (resolved to foreign origin ${url.origin})`);
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const target = url.toString();

    // Writes must not be replayed on ambiguous failures (see the retry gate below).
    const idempotent = method === "GET";
    let refreshedOn401 = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (hasBody) headers["Content-Type"] = "application/json";

      let res: Response;
      let text: string;
      try {
        ({ res, text } = await this.fetchWithTimeout(
          target,
          { method, headers, body: hasBody ? JSON.stringify(body) : undefined },
          path,
        ));
      } catch (err) {
        // Network error or timeout: the request may or may not have reached the
        // API, so only reads are retried; writes rethrow immediately.
        if (idempotent && attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // An expired/revoked access token: re-mint once and replay. The request
      // never executed, so this is safe for writes too.
      if (res.status === 401 && this.canRefresh() && !refreshedOn401) {
        refreshedOn401 = true;
        await this.accessToken(true);
        continue;
      }

      // 429 means the request was rejected before executing — safe to retry for
      // any method. 5xx is ambiguous (the write may have committed), so it is
      // gated to idempotent requests.
      const transient = res.status === 429 || (idempotent && res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new GoogleChatError(res.status, data);
      return data as T;
    }
  }

  // ---- Spaces ----

  /** Lists spaces the caller is a member of, optionally filtered by space type. */
  async listSpaces(p: { spaceType?: SpaceType; pageSize?: number; pageToken?: string } = {}): Promise<unknown> {
    return this.request(
      "GET",
      "v1/spaces",
      undefined,
      compact({
        filter: p.spaceType ? `spaceType = "${mapSpaceType(p.spaceType)}"` : undefined,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
      }),
    );
  }

  /** One space (details, spaceType, membership counts) by name or bare id. */
  async getSpace(space: string): Promise<unknown> {
    return this.request("GET", `v1/${asSpaceName(space)}`);
  }

  /**
   * Server-side space search across the Workspace organization. Admin-only:
   * the call always sets useAdminAccess=true and needs a Workspace admin with
   * the chat.admin.spaces (or .readonly) scope. The query syntax is the API's
   * own (e.g. `customer = "customers/my_customer" AND spaceType = "SPACE" AND
   * displayName:"onboarding"`) and is passed through verbatim.
   */
  async searchSpaces(p: { query: string; pageSize?: number; pageToken?: string; orderBy?: string }): Promise<unknown> {
    return this.request(
      "GET",
      "v1/spaces:search",
      undefined,
      compact({
        useAdminAccess: true,
        query: p.query,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
        orderBy: p.orderBy,
      }),
    );
  }

  /** Finds the caller's existing direct-message space with another user (404 if none exists). */
  async findDirectMessage(user: string): Promise<unknown> {
    return this.request("GET", "v1/spaces:findDirectMessage", undefined, { name: asUserName(user) });
  }

  // ---- Messages ----

  /** Builds the messages.list filter from the normalized params (the API's only filters). */
  private static messagesFilter(p: ListMessagesParams): string | undefined {
    const parts: string[] = [];
    if (p.createdAfter) parts.push(`createTime > "${p.createdAfter}"`);
    if (p.threadName) parts.push(`thread.name = ${asThreadName(p.threadName)}`);
    return parts.length ? parts.join(" AND ") : undefined;
  }

  /** Lists messages in a space, optionally per thread / after a timestamp. */
  async listMessages(p: ListMessagesParams): Promise<unknown> {
    return this.request(
      "GET",
      `v1/${asSpaceName(p.space)}/messages`,
      undefined,
      compact({
        filter: GoogleChatClient.messagesFilter(p),
        orderBy: p.orderBy ? `createTime ${p.orderBy === "asc" ? "ASC" : "DESC"}` : undefined,
        showDeleted: p.showDeleted,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
      }),
    );
  }

  /** One message by its full resource name (text, sender, thread, attachments, reactions summary). */
  async getMessage(message: string): Promise<unknown> {
    return this.request("GET", `v1/${asMessageName(message)}`);
  }

  /**
   * Sends a text message. Targeting a thread (threadName or threadKey) defaults
   * messageReplyOption to REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD — without it the
   * API silently ignores the thread and starts a new one, which reads like a
   * lost reply. messageId lets the caller address the message later without
   * storing the server-assigned name (must start with "client-").
   */
  async createMessage(p: CreateMessageParams): Promise<unknown> {
    const thread = compact({
      name: p.threadName ? asThreadName(p.threadName) : undefined,
      threadKey: p.threadKey,
    });
    const targetsThread = Object.keys(thread).length > 0;
    if (p.messageId !== undefined && !/^client-[a-z0-9-]{1,56}$/.test(p.messageId)) {
      throw new Error('message_id must start with "client-" followed by 1-56 chars of [a-z0-9-].');
    }
    return this.request(
      "POST",
      `v1/${asSpaceName(p.space)}/messages`,
      compact({
        text: p.text,
        thread: targetsThread ? thread : undefined,
      }),
      compact({
        messageReplyOption: targetsThread ? mapReplyOption(p.replyOption ?? "fallback_to_new_thread") : undefined,
        messageId: p.messageId,
      }),
    );
  }

  /** Replaces the message text (updateMask=text). User auth can only edit the user's own messages. */
  async updateMessage(p: { message: string; text: string }): Promise<unknown> {
    return this.request(
      "PATCH",
      `v1/${asMessageName(p.message)}`,
      { text: p.text },
      { updateMask: "text" },
    );
  }

  /** Deletes a message. force=true also deletes threaded replies (app auth only). */
  async deleteMessage(message: string, force?: boolean): Promise<unknown> {
    return this.request("DELETE", `v1/${asMessageName(message)}`, undefined, compact({ force }));
  }

  // ---- Reactions ----

  /** Adds a unicode emoji reaction to a message (custom emoji go through raw_request). */
  async createReaction(message: string, emoji: string): Promise<unknown> {
    return this.request("POST", `v1/${asMessageName(message)}/reactions`, { emoji: { unicode: emoji } });
  }

  /** Lists reactions on a message, optionally only one emoji's. */
  async listReactions(p: {
    message: string;
    emoji?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<unknown> {
    return this.request(
      "GET",
      `v1/${asMessageName(p.message)}/reactions`,
      undefined,
      compact({
        filter: p.emoji ? `emoji.unicode = "${p.emoji}"` : undefined,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
      }),
    );
  }

  /** Removes a reaction by its full resource name (only the caller's own reactions). */
  async deleteReaction(reaction: string): Promise<unknown> {
    return this.request("DELETE", `v1/${asReactionName(reaction)}`);
  }

  // ---- Attachments ----

  /** Attachment metadata (contentName, contentType, download/thumbnail URIs) by resource name. */
  async getAttachment(attachment: string): Promise<unknown> {
    return this.request("GET", `v1/${asAttachmentName(attachment)}`);
  }

  // ---- Memberships ----

  /** Lists memberships in a space (humans, and groups/invited when requested). */
  async listMembers(p: ListMembersParams): Promise<unknown> {
    return this.request(
      "GET",
      `v1/${asSpaceName(p.space)}/members`,
      undefined,
      compact({
        filter: p.role ? `role = "${mapMemberRole(p.role)}"` : undefined,
        showGroups: p.showGroups,
        showInvited: p.showInvited,
        pageSize: p.pageSize,
        pageToken: p.pageToken,
      }),
    );
  }

  /** One membership by its full resource name. */
  async getMember(member: string): Promise<unknown> {
    return this.request("GET", `v1/${asMemberName(member)}`);
  }

  /** Adds (invites) a user to a space, optionally as a manager. */
  async createMember(p: { space: string; user: string; role?: MemberRole }): Promise<unknown> {
    return this.request(
      "POST",
      `v1/${asSpaceName(p.space)}/members`,
      compact({
        member: { name: asUserName(p.user), type: "HUMAN" },
        role: p.role ? mapMemberRole(p.role) : undefined,
      }),
    );
  }

  /** Changes a membership's role (member <-> manager). */
  async updateMemberRole(p: { member: string; role: MemberRole }): Promise<unknown> {
    return this.request(
      "PATCH",
      `v1/${asMemberName(p.member)}`,
      { role: mapMemberRole(p.role) },
      { updateMask: "role" },
    );
  }

  /** Removes a membership (kicks the user from the space). */
  async deleteMember(member: string): Promise<unknown> {
    return this.request("DELETE", `v1/${asMemberName(member)}`);
  }
}

/** Drops keys whose value is `undefined` so they are not sent to the API. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
