import { Request as ExpressRequest, Response, NextFunction } from "express";
import {
  enforceProviderToolRateLimit,
  extractToolsCallName,
  meteredToolKeyForCall,
  resolveAccountId,
} from "./provider-tool-rate-limit.js";
import {
  logProviderToolRateLimit,
  resolveAccountIdSource,
} from "./provider-tool-rate-limit-log.js";

type RateLimitRequest = ExpressRequest & {
  sessionAccountId?: string;
};

export function providerToolRateLimitMiddleware(
  req: RateLimitRequest,
  res: Response,
  next: NextFunction,
) {
  void runProviderToolRateLimit(req, res, next);
}

async function runProviderToolRateLimit(
  req: RateLimitRequest,
  res: Response,
  next: NextFunction,
) {
  const toolName = extractToolsCallName(req.body);
  if (!toolName) {
    next();
    return;
  }

  const meteredKey = meteredToolKeyForCall(toolName);
  if (!meteredKey) {
    next();
    return;
  }

  const accountId = resolveAccountId(
    req.headers,
    req.query as Record<string, unknown>,
    req.sessionAccountId,
  );
  const accountIdSource = resolveAccountIdSource(
    req.headers,
    req.query as Record<string, unknown>,
    req.sessionAccountId,
  );
  if (!accountId) {
    logProviderToolRateLimit("account_id_missing", {
      tool_name: toolName,
      metered_tool_key: meteredKey,
      account_id_source: accountIdSource,
      has_x_account_id_header: typeof req.headers["x-account-id"] === "string",
      has_account_id_query:
        typeof (req.query as Record<string, unknown>).account_id === "string",
      has_session_account_id: Boolean(req.sessionAccountId),
      request_path: req.path,
    });
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "account_id query parameter or X-Account-Id header is required for billable provider tool calls",
      },
      id: (req.body as { id?: unknown } | undefined)?.id ?? null,
    });
    return;
  }

  const result = await enforceProviderToolRateLimit(accountId, toolName, {
    accountIdSource,
  });
  if (!result.allowed) {
    logProviderToolRateLimit("request_blocked", {
      account_id: accountId,
      account_id_source: accountIdSource,
      tool_name: toolName,
      metered_tool_key: meteredKey,
      http_status: result.status,
      error_message:
        typeof result.body.error === "object" &&
        result.body.error &&
        typeof (result.body.error as Record<string, unknown>).message === "string"
          ? ((result.body.error as Record<string, unknown>).message as string)
          : undefined,
      request_path: req.path,
    });
    res.status(result.status).json({
      ...result.body,
      id: (req.body as { id?: unknown } | undefined)?.id ?? null,
    });
    return;
  }

  next();
}
