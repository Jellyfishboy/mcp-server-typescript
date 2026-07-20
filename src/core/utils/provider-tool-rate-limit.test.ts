import test from "node:test";
import assert from "node:assert/strict";

import {
  extractToolsCallName,
  meteredToolKeyForCall,
  mintRailsInternalJwt,
  resolveAccountId,
} from "./provider-tool-rate-limit.js";

test("meteredToolKeyForCall maps billable SERP tools", () => {
  assert.equal(meteredToolKeyForCall("serp_organic_live_advanced"), "google_search");
  assert.equal(meteredToolKeyForCall("kw_data_google_trends_explore"), "dataforseo");
});

test("meteredToolKeyForCall skips utility metadata tools", () => {
  assert.equal(meteredToolKeyForCall("serp_locations"), null);
  assert.equal(meteredToolKeyForCall("serp_youtube_locations"), null);
  assert.equal(meteredToolKeyForCall("kw_data_google_trends_categories"), null);
  assert.equal(meteredToolKeyForCall("merchant_amazon_locations"), null);
});

test("resolveAccountId prefers header then query then session", () => {
  assert.equal(
    resolveAccountId({ "x-account-id": "from-header" }, {}),
    "from-header",
  );
  assert.equal(
    resolveAccountId({}, { account_id: "from-query" }),
    "from-query",
  );
  assert.equal(
    resolveAccountId({}, {}, "from-session"),
    "from-session",
  );
  assert.equal(resolveAccountId({}, {}), null);
});

test("extractToolsCallName reads MCP tools/call payload", () => {
  assert.equal(
    extractToolsCallName({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "serp_organic_live_advanced" },
      id: 1,
    }),
    "serp_organic_live_advanced",
  );
  assert.equal(extractToolsCallName({ method: "tools/list" }), null);
});

test("mintRailsInternalJwt matches rails-internal contract", () => {
  const token = mintRailsInternalJwt("test-secret");
  const [, payloadB64] = token.split(".");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  assert.equal(payload.iss, "auth-service");
  assert.equal(payload.aud, "rails-internal");
});
