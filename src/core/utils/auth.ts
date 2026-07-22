/**
 * Extracts the expiration instant from a Bearer JWT *without* verifying its
 * signature. We never trust this token — DataForSEO remains the authoritative
 * validator — we only peek at `exp` to detect an honestly expired token and
 * turn it into a 401 + WWW-Authenticate challenge so the MCP client refreshes.
 *
 * JWT `exp` is a NumericDate: seconds since the Unix epoch, UTC (RFC 7519).
 * It is converted here to a JS `Date`, which is an absolute UTC instant and
 * is safe to compare directly with `new Date()` / `Date.now()`.
 *
 * Returns `null` when expiry cannot be determined locally:
 *   - header is missing or not a Bearer token
 *   - token is opaque (not a three-segment JWT)
 *   - payload has no numeric `exp` claim
 *   - payload is not valid base64url JSON
 */
export function getTokenExpiration(authHeader: string | undefined): Date | null {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null; // opaque token, not a JWT
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8'),
    ) as { exp?: unknown };

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }

    // `exp` is in seconds; Date expects milliseconds.
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

function isJwtBearerToken(token: string): boolean {
  return token.split('.').length === 3;
}

/**
 * OpenAI forwards `Authorization: Basic <DATAFORSEO_ACCESS_TOKEN>` directly.
 * Anthropic's MCP connector sends the same credential via `authorization_token`,
 * which arrives as `Authorization: Bearer <DATAFORSEO_ACCESS_TOKEN>`.
 * DataForSEO's API only accepts Basic auth, so rewrite opaque Bearer tokens.
 */
export function normalizeDataForSEOAuthHeader(authHeader: string): string {
  if (authHeader.startsWith('Basic ')) {
    return authHeader;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return authHeader;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || isJwtBearerToken(token)) {
    return authHeader;
  }

  return `Basic ${token}`;
}
