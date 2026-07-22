import test from "node:test";
import assert from "node:assert/strict";

import { normalizeDataForSEOAuthHeader } from "./auth.js";

test("normalizeDataForSEOAuthHeader keeps Basic credentials unchanged", () => {
  assert.equal(
    normalizeDataForSEOAuthHeader("Basic dGVzdDpzZWNyZXQ="),
    "Basic dGVzdDpzZWNyZXQ=",
  );
});

test("normalizeDataForSEOAuthHeader rewrites opaque Bearer tokens to Basic", () => {
  assert.equal(
    normalizeDataForSEOAuthHeader("Bearer dGVzdDpzZWNyZXQ="),
    "Basic dGVzdDpzZWNyZXQ=",
  );
});

test("normalizeDataForSEOAuthHeader keeps JWT Bearer tokens unchanged", () => {
  const jwt =
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  assert.equal(normalizeDataForSEOAuthHeader(jwt), jwt);
});
