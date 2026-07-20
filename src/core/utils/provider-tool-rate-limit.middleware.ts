import { Request as ExpressRequest, Response, NextFunction } from "express";
import {
  enforceProviderToolRateLimit,
  extractToolsCallName,
  meteredToolKeyForCall,
  resolveAccountId,
} from "./provider-tool-rate-limit.js";

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
  if (!accountId) {
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

  const result = await enforceProviderToolRateLimit(accountId, toolName);
  if (!result.allowed) {
    res.status(result.status).json({
      ...result.body,
      id: (req.body as { id?: unknown } | undefined)?.id ?? null,
    });
    return;
  }

  next();
}
