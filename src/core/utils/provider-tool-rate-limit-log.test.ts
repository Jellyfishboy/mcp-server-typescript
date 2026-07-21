import test from "node:test";
import assert from "node:assert/strict";

import {
  describePublicApiUrl,
  parseProviderToolRateLimitBody,
  resolveAccountIdSource,
} from "./provider-tool-rate-limit-log.js";

test("resolveAccountIdSource reports header, query, and session precedence", () => {
  assert.equal(
    resolveAccountIdSource({ "x-account-id": "from-header" }, {}),
    "x-account-id",
  );
  assert.equal(
    resolveAccountIdSource({}, { account_id: "from-query" }),
    "account_id_query",
  );
  assert.equal(resolveAccountIdSource({}, {}, "from-session"), "session");
  assert.equal(resolveAccountIdSource({}, {}), "missing");
});

test("describePublicApiUrl flags missing config and /v1 prefix", () => {
  assert.deepEqual(describePublicApiUrl(undefined), {
    configured: false,
    hasV1Prefix: false,
  });
  assert.deepEqual(describePublicApiUrl("https://api.fetchhive.com/v1"), {
    configured: true,
    host: "api.fetchhive.com",
    hasV1Prefix: true,
  });
  assert.deepEqual(describePublicApiUrl("https://api.fetchhive.com"), {
    configured: true,
    host: "api.fetchhive.com",
    hasV1Prefix: false,
  });
});

test("parseProviderToolRateLimitBody reads guard success and 429 payloads", () => {
  assert.deepEqual(
    parseProviderToolRateLimitBody({
      allowed: true,
      limit: 15,
      current: 3,
      mode: "guard",
    }),
    {
      allowed: true,
      limit: 15,
      current: 3,
      mode: "guard",
      errorCode: undefined,
      message: undefined,
    },
  );

  assert.deepEqual(
    parseProviderToolRateLimitBody({
      error_code: "provider_tool_rate_limit_exceeded",
      message: "You have reached your daily limit of 15 provider tool calls (15 used). Resets at midnight UTC.",
      limit: 15,
      current: 15,
    }),
    {
      errorCode: "provider_tool_rate_limit_exceeded",
      message:
        "You have reached your daily limit of 15 provider tool calls (15 used). Resets at midnight UTC.",
      limit: 15,
      current: 15,
      allowed: undefined,
      mode: undefined,
    },
  );
});
