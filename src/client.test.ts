import { test } from "node:test";
import assert from "node:assert/strict";
import {
  asAttachmentName,
  asMemberName,
  asMessageName,
  asReactionName,
  asSpaceName,
  asThreadName,
  asUserName,
  GoogleChatClient,
} from "./client.js";
import { CredentialsError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleChatConfig } from "./types.js";

const BASE = "https://chat.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Call = { url: string; method: string; auth: unknown; body: string | undefined };

/** A client on a static access token — no token-endpoint traffic expected. */
function staticConfig(extra: Partial<GoogleChatConfig> = {}): GoogleChatConfig {
  return { accessToken: "STATIC", apiBase: BASE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** A client on the refresh flow. */
function refreshConfig(extra: Partial<GoogleChatConfig> = {}): GoogleChatConfig {
  return {
    clientId: "cid",
    clientSecret: "csec",
    refreshToken: "rtok",
    apiBase: BASE,
    maxRetries: 0,
    retryBaseMs: 0,
    ...extra,
  };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({
      url: String(url),
      method: String(i.method),
      auth: i.headers?.Authorization,
      body: typeof i.body === "string" ? i.body : undefined,
    });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** Default handler: token endpoint mints TOK-1, everything else returns { ok: true }. */
function defaultHandler(url: string): Response {
  if (url === TOKEN_URL) return okJson({ access_token: "TOK-1", expires_in: 3600 });
  return okJson({ ok: true });
}

// ---- Resource-name normalization ----

test("asSpaceName accepts bare ids and full names, rejects malformed input", () => {
  assert.equal(asSpaceName("AAA"), "spaces/AAA");
  assert.equal(asSpaceName("spaces/AAA"), "spaces/AAA");
  for (const bad of ["", "spaces/", "spaces/a/b", "a b", "spaces/a?x=1", "spaces/a#f"]) {
    assert.throws(() => asSpaceName(bad), /Invalid space/, JSON.stringify(bad));
  }
});

test("asUserName accepts ids, emails and full names, rejects malformed input", () => {
  assert.equal(asUserName("123"), "users/123");
  assert.equal(asUserName("a@b.example"), "users/a@b.example");
  assert.equal(asUserName("users/123"), "users/123");
  for (const bad of ["", "users/", "users/a/b", "a b"]) {
    assert.throws(() => asUserName(bad), /Invalid user/, JSON.stringify(bad));
  }
});

test("full-name-only resources reject bare ids and traversal attempts", () => {
  assert.equal(asMessageName("spaces/A/messages/B.C"), "spaces/A/messages/B.C");
  assert.throws(() => asMessageName("B.C"), /Invalid message name/);
  assert.throws(() => asMessageName("spaces/A/messages/../../evil"), /Invalid message name/);

  assert.equal(asThreadName("spaces/A/threads/T"), "spaces/A/threads/T");
  assert.throws(() => asThreadName("T"), /Invalid thread name/);

  assert.equal(asMemberName("spaces/A/members/111"), "spaces/A/members/111");
  assert.throws(() => asMemberName("111"), /Invalid membership name/);

  assert.equal(asReactionName("spaces/A/messages/B/reactions/R"), "spaces/A/messages/B/reactions/R");
  assert.throws(() => asReactionName("spaces/A/messages/B"), /Invalid reaction name/);

  assert.equal(asAttachmentName("spaces/A/messages/B/attachments/AT"), "spaces/A/messages/B/attachments/AT");
  assert.throws(() => asAttachmentName("AT"), /Invalid attachment name/);
});

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * and the forced 401 re-mint alike (maxRetries is deliberately non-zero here).
 */
test("no credentials at all: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.getSpace("AAA"),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        // The historical startup error, verbatim — the message is the product.
        assert.ok(
          err.message.startsWith(
            "Google OAuth credentials are required: set GOOGLE_CHAT_CLIENT_ID + " +
              "GOOGLE_CHAT_CLIENT_SECRET + GOOGLE_CHAT_REFRESH_TOKEN (recommended), " +
              "or GOOGLE_CHAT_ACCESS_TOKEN with a short-lived access token.",
          ),
          "the message must open with the historical startup error, verbatim",
        );
        assert.match(err.message, /restart the server/, "the fix must mention the restart");
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no token mint, no replay");
  } finally {
    mock.restore();
  }
});

test("static access token: Bearer header, no token-endpoint traffic", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).getSpace("AAA");
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, `${BASE}/v1/spaces/AAA`);
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("refresh flow: mints a token first, then caches it across requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(refreshConfig());
    await client.getSpace("AAA");
    await client.getSpace("BBB");

    const tokenCalls = mock.calls.filter((c) => c.url === TOKEN_URL);
    assert.equal(tokenCalls.length, 1, "the second request must reuse the cached token");
    assert.equal(tokenCalls[0].method, "POST");
    const params = new URLSearchParams(tokenCalls[0].body);
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("client_id"), "cid");
    assert.equal(params.get("client_secret"), "csec");
    assert.equal(params.get("refresh_token"), "rtok");

    const apiCalls = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) assert.equal(call.auth, "Bearer TOK-1");
  } finally {
    mock.restore();
  }
});

test("a 401 forces one re-mint and replays the request", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleChatClient(refreshConfig()).getSpace("AAA");
    assert.deepEqual(result, { ok: true });
    assert.equal(minted, 2, "the 401 must force a second mint");
    const lastApi = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`)).at(-1);
    assert.equal(lastApi?.auth, "Bearer TOK-2");
  } finally {
    mock.restore();
  }
});

test("a persistent 401 throws instead of looping", async () => {
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) return okJson({ access_token: "TOK", expires_in: 3600 });
    apiHits++;
    return new Response('{"error":{"message":"nope","status":"UNAUTHENTICATED"}}', { status: 401 });
  });
  try {
    await assert.rejects(
      () => new GoogleChatClient(refreshConfig()).getSpace("AAA"),
      /HTTP 401: \[UNAUTHENTICATED\] nope/,
    );
    assert.equal(apiHits, 2, "exactly one replay after the forced re-mint");
  } finally {
    mock.restore();
  }
});

test("a failed token exchange surfaces the OAuth error", async () => {
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      return new Response('{"error":"invalid_grant","error_description":"Token has been revoked."}', {
        status: 400,
      });
    }
    return okJson({ ok: true });
  });
  try {
    await assert.rejects(
      () => new GoogleChatClient(refreshConfig()).getSpace("AAA"),
      /HTTP 400: invalid_grant: Token has been revoked\./,
    );
  } finally {
    mock.restore();
  }
});

// ---- Spaces endpoint mapping ----

test("listSpaces maps the normalized space type into the wire filter", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(staticConfig());
    await client.listSpaces({ spaceType: "direct_message", pageSize: 50, pageToken: "tok" });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces");
    assert.equal(url.searchParams.get("filter"), 'spaceType = "DIRECT_MESSAGE"');
    assert.equal(url.searchParams.get("pageSize"), "50");
    assert.equal(url.searchParams.get("pageToken"), "tok");

    await client.listSpaces();
    const bare = new URL(mock.calls[1].url);
    assert.equal(bare.search, "", "no filter when no space type is given");
  } finally {
    mock.restore();
  }
});

test("searchSpaces always sets useAdminAccess and passes the query verbatim", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).searchSpaces({
      query: 'customer = "customers/my_customer" AND spaceType = "SPACE"',
      orderBy: "create_time DESC",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces:search");
    assert.equal(url.searchParams.get("useAdminAccess"), "true");
    assert.equal(url.searchParams.get("query"), 'customer = "customers/my_customer" AND spaceType = "SPACE"');
    assert.equal(url.searchParams.get("orderBy"), "create_time DESC");
  } finally {
    mock.restore();
  }
});

test("findDirectMessage normalizes a bare email into users/<email>", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).findDirectMessage("a@b.example");
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces:findDirectMessage");
    assert.equal(url.searchParams.get("name"), "users/a@b.example");
  } finally {
    mock.restore();
  }
});

// ---- Messages endpoint mapping ----

test("listMessages builds the createTime/thread filter and orderBy", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).listMessages({
      space: "AAA",
      createdAfter: "2026-08-01T00:00:00Z",
      threadName: "spaces/AAA/threads/TTT",
      orderBy: "desc",
      showDeleted: true,
      pageSize: 100,
      pageToken: "tok",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces/AAA/messages");
    assert.equal(
      url.searchParams.get("filter"),
      'createTime > "2026-08-01T00:00:00Z" AND thread.name = spaces/AAA/threads/TTT',
    );
    assert.equal(url.searchParams.get("orderBy"), "createTime DESC");
    assert.equal(url.searchParams.get("showDeleted"), "true");
    assert.equal(url.searchParams.get("pageSize"), "100");
    assert.equal(url.searchParams.get("pageToken"), "tok");
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].body, undefined);
  } finally {
    mock.restore();
  }
});

test("createMessage posts plain text with no thread noise", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).createMessage({ space: "AAA", text: "hi" });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces/AAA/messages");
    assert.equal(url.search, "", "no messageReplyOption when no thread is targeted");
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { text: "hi" });
  } finally {
    mock.restore();
  }
});

test("createMessage targeting a thread defaults to fallback and honors or_fail", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(staticConfig());
    await client.createMessage({ space: "AAA", text: "hi", threadKey: "deploy-42" });
    const first = new URL(mock.calls[0].url);
    assert.equal(first.searchParams.get("messageReplyOption"), "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { text: "hi", thread: { threadKey: "deploy-42" } });

    await client.createMessage({
      space: "AAA",
      text: "hi",
      threadName: "spaces/AAA/threads/TTT",
      replyOption: "or_fail",
    });
    const second = new URL(mock.calls[1].url);
    assert.equal(second.searchParams.get("messageReplyOption"), "REPLY_MESSAGE_OR_FAIL");
    assert.deepEqual(JSON.parse(mock.calls[1].body!), {
      text: "hi",
      thread: { name: "spaces/AAA/threads/TTT" },
    });
  } finally {
    mock.restore();
  }
});

test("createMessage forwards a valid custom id and rejects a malformed one before fetch", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(staticConfig());
    await client.createMessage({ space: "AAA", text: "hi", messageId: "client-deploy-42" });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.searchParams.get("messageId"), "client-deploy-42");

    await assert.rejects(
      () => client.createMessage({ space: "AAA", text: "hi", messageId: "deploy-42" }),
      /message_id must start with "client-"/,
    );
    assert.equal(mock.calls.length, 1, "the malformed id must not reach the API");
  } finally {
    mock.restore();
  }
});

test("updateMessage PATCHes text with updateMask=text", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).updateMessage({
      message: "spaces/AAA/messages/BBB",
      text: "new",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces/AAA/messages/BBB");
    assert.equal(url.searchParams.get("updateMask"), "text");
    assert.equal(mock.calls[0].method, "PATCH");
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { text: "new" });
  } finally {
    mock.restore();
  }
});

test("deleteMessage maps to DELETE, with force only when asked", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(staticConfig());
    await client.deleteMessage("spaces/AAA/messages/BBB");
    assert.equal(mock.calls[0].method, "DELETE");
    assert.equal(mock.calls[0].url, `${BASE}/v1/spaces/AAA/messages/BBB`);

    await client.deleteMessage("spaces/AAA/messages/BBB", true);
    assert.equal(new URL(mock.calls[1].url).searchParams.get("force"), "true");
  } finally {
    mock.restore();
  }
});

// ---- Reactions / attachments endpoint mapping ----

test("reaction methods map to create/list/delete with the emoji filter", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(staticConfig());
    await client.createReaction("spaces/A/messages/B", "👍");
    assert.equal(mock.calls[0].method, "POST");
    assert.equal(mock.calls[0].url, `${BASE}/v1/spaces/A/messages/B/reactions`);
    assert.deepEqual(JSON.parse(mock.calls[0].body!), { emoji: { unicode: "👍" } });

    await client.listReactions({ message: "spaces/A/messages/B", emoji: "🎉", pageSize: 10 });
    const url = new URL(mock.calls[1].url);
    assert.equal(mock.calls[1].method, "GET");
    assert.equal(url.searchParams.get("filter"), 'emoji.unicode = "🎉"');
    assert.equal(url.searchParams.get("pageSize"), "10");

    await client.deleteReaction("spaces/A/messages/B/reactions/R");
    assert.equal(mock.calls[2].method, "DELETE");
    assert.equal(mock.calls[2].url, `${BASE}/v1/spaces/A/messages/B/reactions/R`);
  } finally {
    mock.restore();
  }
});

test("getAttachment hits the attachment metadata path", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).getAttachment("spaces/A/messages/B/attachments/AT");
    assert.equal(mock.calls[0].url, `${BASE}/v1/spaces/A/messages/B/attachments/AT`);
    assert.equal(mock.calls[0].method, "GET");
  } finally {
    mock.restore();
  }
});

// ---- Memberships endpoint mapping ----

test("listMembers maps the role filter and visibility flags", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleChatClient(staticConfig()).listMembers({
      space: "AAA",
      role: "manager",
      showGroups: true,
      showInvited: true,
      pageSize: 200,
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/spaces/AAA/members");
    assert.equal(url.searchParams.get("filter"), 'role = "ROLE_MANAGER"');
    assert.equal(url.searchParams.get("showGroups"), "true");
    assert.equal(url.searchParams.get("showInvited"), "true");
    assert.equal(url.searchParams.get("pageSize"), "200");
  } finally {
    mock.restore();
  }
});

test("member methods map to get/create/patch/delete with wire roles", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleChatClient(staticConfig());
    await client.getMember("spaces/A/members/111");
    assert.equal(mock.calls[0].url, `${BASE}/v1/spaces/A/members/111`);
    assert.equal(mock.calls[0].method, "GET");

    await client.createMember({ space: "A", user: "a@b.example", role: "manager" });
    assert.equal(mock.calls[1].method, "POST");
    assert.equal(mock.calls[1].url, `${BASE}/v1/spaces/A/members`);
    assert.deepEqual(JSON.parse(mock.calls[1].body!), {
      member: { name: "users/a@b.example", type: "HUMAN" },
      role: "ROLE_MANAGER",
    });

    await client.createMember({ space: "A", user: "users/123" });
    assert.deepEqual(JSON.parse(mock.calls[2].body!), {
      member: { name: "users/123", type: "HUMAN" },
    });

    await client.updateMemberRole({ member: "spaces/A/members/111", role: "member" });
    assert.equal(mock.calls[3].method, "PATCH");
    assert.equal(new URL(mock.calls[3].url).searchParams.get("updateMask"), "role");
    assert.deepEqual(JSON.parse(mock.calls[3].body!), { role: "ROLE_MEMBER" });

    await client.deleteMember("spaces/A/members/111");
    assert.equal(mock.calls[4].method, "DELETE");
    assert.equal(mock.calls[4].url, `${BASE}/v1/spaces/A/members/111`);
  } finally {
    mock.restore();
  }
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries a 429 for reads and writes alike", async () => {
  for (const run of [
    () => new GoogleChatClient(staticConfig({ maxRetries: 3 })).getSpace("AAA"),
    () => new GoogleChatClient(staticConfig({ maxRetries: 3 })).deleteMessage("spaces/A/messages/B"),
  ]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429 });
      return okJson({ ok: true });
    });
    try {
      assert.deepEqual(await run(), { ok: true });
      assert.equal(n, 2);
    } finally {
      mock.restore();
    }
  }
});

test("request() retries a 5xx only for GET — a write is never replayed", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("unavailable", { status: 503 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleChatClient(staticConfig({ maxRetries: 3 })).getSpace("AAA");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2, "the read is retried");
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("unavailable", { status: 503 });
  });
  try {
    await assert.rejects(
      () =>
        new GoogleChatClient(staticConfig({ maxRetries: 3 })).createMessage({ space: "AAA", text: "hi" }),
      /HTTP 503/,
    );
    assert.equal(n, 1, "a 503 on a send must not be replayed — the message may have been posted");
  } finally {
    mock2.restore();
  }
});

test("request() retries a network error only for GET", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleChatClient(staticConfig({ maxRetries: 2 })).getSpace("AAA");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    throw new Error("ECONNRESET");
  });
  try {
    await assert.rejects(
      () =>
        new GoogleChatClient(staticConfig({ maxRetries: 2 })).createMessage({ space: "AAA", text: "hi" }),
      /ECONNRESET/,
    );
    assert.equal(n, 1, "a network error on a send must not be replayed");
  } finally {
    mock2.restore();
  }
});

test("request() does not retry a 400 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleChatClient(staticConfig({ maxRetries: 3 })).getSpace("AAA"),
      /HTTP 400: \[INVALID_ARGUMENT\] bad/,
    );
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("slow down", { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleChatClient(staticConfig({ maxRetries: 2 })).getSpace("AAA"),
      /HTTP 429/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("request() aborts and reports a timeout when the request hangs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleChatClient(staticConfig({ timeoutMs: 10, maxRetries: 0 }));
    await client.getSpace("AAA").then(
      () => assert.fail("must reject"),
      (err) => assert.match(String(err), /timed out after 10ms/),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleChatClient(staticConfig()).request("GET", evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const result = await new GoogleChatClient(staticConfig()).request(
      "GET",
      "v1/spaces/AAA/members?showInvited=true",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls[0].url, `${BASE}/v1/spaces/AAA/members?showInvited=true`);
  } finally {
    mock.restore();
  }
});
