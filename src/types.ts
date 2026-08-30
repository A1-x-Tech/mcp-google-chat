/**
 * The server talks to the Google Chat API v1 (https://chat.googleapis.com,
 * REST over JSON). Auth is Google OAuth 2.0: a Bearer access token, minted
 * on demand from a refresh token via https://oauth2.googleapis.com/token
 * (or a static short-lived access token — e.g. one minted for a service
 * account acting as a Chat app, or for testing).
 *
 * User credentials vs Chat app configuration: with the refresh triple the
 * server always acts AS THE SIGNED-IN USER (messages send under their name;
 * only their own messages can be edited/deleted). Acting as a Chat app is a
 * separate Google Cloud configuration (service account + Chat app settings in
 * the Cloud console); the only bridge this server offers is a static
 * GOOGLE_CHAT_ACCESS_TOKEN minted externally for that service account.
 */

/** Normalized space types; the client maps them to SPACE / GROUP_CHAT / DIRECT_MESSAGE. */
export type SpaceType = "space" | "group_chat" | "direct_message";

/**
 * Normalized reply behavior for send_message when a thread is targeted; the
 * client maps them to REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD / REPLY_MESSAGE_OR_FAIL.
 * When a thread is given and no option is chosen, the client defaults to the
 * fallback — the API's own default silently ignores the thread otherwise.
 */
export type ReplyOption = "fallback_to_new_thread" | "or_fail";

/** Normalized membership roles; mapped to ROLE_MEMBER / ROLE_MANAGER by the client. */
export type MemberRole = "member" | "manager";

/** Normalized message ordering for list_messages; mapped to `createTime ASC|DESC`. */
export type MessageOrder = "asc" | "desc";

export interface GoogleChatConfig {
  /** OAuth2 client id (refresh flow). */
  clientId?: string;
  /** OAuth2 client secret (refresh flow). Treated as a secret. */
  clientSecret?: string;
  /** OAuth2 refresh token, exchanged for access tokens. Treated as a secret. */
  refreshToken?: string;
  /** Static access token (short-lived, ~1h). Used only when the refresh triple is absent. Treated as a secret. */
  accessToken?: string;
  /** API root. Defaults to https://chat.googleapis.com. */
  apiBase: string;
  /** Per-request timeout in milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
  /** Max retries for transient errors (429 always; 5xx/network for reads). Defaults to 3. */
  maxRetries?: number;
  /** Base backoff in milliseconds, doubled each retry. Defaults to 500. */
  retryBaseMs?: number;
}

/**
 * Google APIs report failures as a non-2xx HTTP status with a JSON envelope
 * ({ error: { code, message, status, details } }); the OAuth token endpoint
 * uses { error, error_description }. The parsed body is kept alongside the
 * status and a short readable message is derived.
 */
export class GoogleChatError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}: ${formatErrorBody(body)}`);
    this.name = "GoogleChatError";
    this.status = status;
    this.body = body;
  }
}

/** Turns a parsed Google API error body into a short, readable message. */
function formatErrorBody(body: unknown): string {
  if (body == null) return "(no body)";
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body !== "object") return String(body);
  const obj = body as Record<string, unknown>;

  // OAuth token endpoint style: { error: "invalid_grant", error_description: "..." }
  if (typeof obj.error === "string") {
    const description = typeof obj.error_description === "string" ? `: ${obj.error_description}` : "";
    return `${obj.error}${description}`.slice(0, 500);
  }

  // Google API envelope: { error: { code, message, status, details } }
  const err = (typeof obj.error === "object" && obj.error !== null ? obj.error : obj) as Record<string, unknown>;
  if (typeof err.message === "string") {
    const status = typeof err.status === "string" ? `[${err.status}] ` : "";
    return `${status}${err.message}`.slice(0, 500);
  }

  return JSON.stringify(obj).slice(0, 500);
}
