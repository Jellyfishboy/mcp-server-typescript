export type AccountIdSource =
  | "x-account-id"
  | "account_id_query"
  | "session"
  | "missing";

export type ProviderToolRateLimitLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

export function logProviderToolRateLimit(
  event: string,
  fields: ProviderToolRateLimitLogFields = {},
): void {
  console.error(
    JSON.stringify({
      component: "provider_tool_rate_limit",
      event,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}

export function resolveAccountIdSource(
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, unknown>,
  sessionAccountId?: string | null,
): AccountIdSource {
  const header = headers["x-account-id"];
  if (typeof header === "string" && header.trim()) {
    return "x-account-id";
  }

  const queryAccountId = query.account_id;
  if (typeof queryAccountId === "string" && queryAccountId.trim()) {
    return "account_id_query";
  }

  if (sessionAccountId?.trim()) {
    return "session";
  }

  return "missing";
}

export function describePublicApiUrl(publicApiUrl?: string): {
  configured: boolean;
  host?: string;
  hasV1Prefix: boolean;
} {
  if (!publicApiUrl?.trim()) {
    return { configured: false, hasV1Prefix: false };
  }

  try {
    const parsed = new URL(publicApiUrl);
    return {
      configured: true,
      host: parsed.host,
      hasV1Prefix: parsed.pathname.replace(/\/$/, "").endsWith("/v1"),
    };
  } catch {
    return {
      configured: true,
      host: "invalid-url",
      hasV1Prefix: publicApiUrl.replace(/\/$/, "").endsWith("/v1"),
    };
  }
}

export function parseProviderToolRateLimitBody(
  body: unknown,
): {
  errorCode?: string;
  message?: string;
  limit?: number;
  current?: number;
  allowed?: boolean;
  mode?: string;
} {
  if (!body || typeof body !== "object") {
    return {};
  }

  const record = body as Record<string, unknown>;
  const limit = typeof record.limit === "number" ? record.limit : undefined;
  const current = typeof record.current === "number" ? record.current : undefined;
  const allowed =
    typeof record.allowed === "boolean" ? record.allowed : undefined;
  const mode = typeof record.mode === "string" ? record.mode : undefined;
  const errorCode =
    typeof record.error_code === "string" ? record.error_code : undefined;
  const message =
    (typeof record.message === "string" && record.message) ||
    (typeof record.error === "string" && record.error) ||
    (typeof record.details === "string" && record.details) ||
    undefined;

  return { errorCode, message, limit, current, allowed, mode };
}
