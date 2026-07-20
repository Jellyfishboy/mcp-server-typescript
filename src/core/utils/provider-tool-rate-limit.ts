import crypto from "crypto";

const GOOGLE_SEARCH_TOOL_NAMES = new Set(["serp_organic_live_advanced"]);

const UNMETERED_TOOL_NAMES = new Set([
  "serp_locations",
  "serp_youtube_locations",
  "merchant_amazon_locations",
  "kw_data_google_trends_categories",
]);

export function resolveAccountId(
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, unknown>,
  sessionAccountId?: string | null,
): string | null {
  const header = headers["x-account-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }

  const queryAccountId = query.account_id;
  if (typeof queryAccountId === "string" && queryAccountId.trim()) {
    return queryAccountId.trim();
  }

  if (sessionAccountId?.trim()) {
    return sessionAccountId.trim();
  }

  return null;
}

export function meteredToolKeyForCall(toolName: string): string | null {
  if (UNMETERED_TOOL_NAMES.has(toolName)) {
    return null;
  }
  if (GOOGLE_SEARCH_TOOL_NAMES.has(toolName)) {
    return "google_search";
  }
  if (
    toolName.endsWith("_locations") ||
    toolName.endsWith("_categories") ||
    toolName.endsWith("_languages")
  ) {
    return null;
  }
  return "dataforseo";
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function mintRailsInternalJwt(secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: "auth-service",
      aud: "rails-internal",
      iat: now,
      exp: now + 300,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signingInput}.${signature}`;
}

export async function enforceProviderToolRateLimit(
  accountId: string,
  toolName: string,
): Promise<
  | { allowed: true }
  | { allowed: false; status: number; body: Record<string, unknown> }
> {
  const meteredKey = meteredToolKeyForCall(toolName);
  if (!meteredKey) {
    return { allowed: true };
  }

  const publicApiUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
  const secret = process.env.MCP_SECRET_TOKEN;
  if (!publicApiUrl || !secret) {
    return {
      allowed: false,
      status: 503,
      body: {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Provider tool rate limiting is not configured",
        },
        id: null,
      },
    };
  }

  const token = mintRailsInternalJwt(secret);
  const url = `${publicApiUrl}/internal/accounts/${accountId}/provider_tool_calls`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool_key: meteredKey, mode: "guard" }),
  });

  if (response.status === 429) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      allowed: false,
      status: 429,
      body: {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            (typeof body.details === "string" && body.details) ||
            (typeof body.message === "string" && body.message) ||
            "Provider tool daily limit reached",
        },
        id: null,
      },
    };
  }

  if (!response.ok) {
    const body = (await response.text().catch(() => "")) || "Upstream rate-limit check failed";
    return {
      allowed: false,
      status: 502,
      body: {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: body,
        },
        id: null,
      },
    };
  }

  return { allowed: true };
}

export function extractToolsCallName(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (record.method !== "tools/call") {
    return null;
  }
  const params = record.params;
  if (!params || typeof params !== "object") {
    return null;
  }
  const name = (params as Record<string, unknown>).name;
  return typeof name === "string" ? name : null;
}
