/**
 * Google Indexing API Integration
 *
 * Uses the Google Indexing API to notify Google when URLs are updated or removed.
 * Requires a Google Cloud service account with the Indexing API enabled,
 * and the service account email added as an owner in Google Search Console.
 *
 * Env: GOOGLE_INDEXING_KEY — base64-encoded Google service account JSON key file
 */
import { createSign } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

type IndexingAction = 'URL_UPDATED' | 'URL_DELETED';

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
  statusCode?: number;
}

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ─── JWT Generation ─────────────────────────────────────────────────────────

/**
 * Base64url encode (no padding, URL-safe).
 */
function base64url(input: string | Buffer): string {
  const b64 = typeof input === 'string'
    ? Buffer.from(input, 'utf-8').toString('base64')
    : input.toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create a signed JWT for Google OAuth2 service account authentication.
 * Uses RS256 (RSA + SHA-256) as required by Google.
 */
function createServiceAccountJWT(serviceAccount: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(serviceAccount.private_key);
  const encodedSignature = base64url(signature);

  return `${signingInput}.${encodedSignature}`;
}

// ─── Token Cache ────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get an access token from Google OAuth2, caching for reuse within expiry.
 */
async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const jwt = createServiceAccountJWT(serviceAccount);

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth2 token request failed (${response.status}): ${errorText}`);
  }

  const data: AccessTokenResponse = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ─── Service Account Loader ─────────────────────────────────────────────────

/**
 * Load and parse the service account key from GOOGLE_INDEXING_KEY env var.
 * Returns null if the env var is not set.
 */
function loadServiceAccountKey(): ServiceAccountKey | null {
  const encoded = process.env.GOOGLE_INDEXING_KEY;
  if (!encoded) return null;

  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    const key = JSON.parse(json) as ServiceAccountKey;

    if (!key.client_email || !key.private_key || !key.token_uri) {
      console.error('[google-indexing] Service account key missing required fields');
      return null;
    }

    return key;
  } catch (err) {
    console.error('[google-indexing] Failed to parse GOOGLE_INDEXING_KEY:', err);
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

const INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

/**
 * Notify Google about a single URL update or deletion.
 * Returns a result object; never throws — errors are captured gracefully.
 */
export async function notifyGoogleIndexing(
  url: string,
  action: IndexingAction = 'URL_UPDATED',
): Promise<IndexingResult> {
  const serviceAccount = loadServiceAccountKey();
  if (!serviceAccount) {
    return { url, success: false, error: 'GOOGLE_INDEXING_KEY not configured' };
  }

  try {
    const accessToken = await getAccessToken(serviceAccount);

    const response = await fetch(INDEXING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type: action,
      }),
    });

    if (response.ok) {
      console.log(`[google-indexing] ${action} notification sent for: ${url}`);
      return { url, success: true, statusCode: response.status };
    }

    const errorBody = await response.text();
    console.error(`[google-indexing] API error (${response.status}) for ${url}: ${errorBody}`);
    return {
      url,
      success: false,
      error: `HTTP ${response.status}: ${errorBody}`,
      statusCode: response.status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[google-indexing] Failed to notify for ${url}: ${message}`);
    return { url, success: false, error: message };
  }
}

/**
 * Notify Google about multiple URLs. Processes sequentially to respect rate limits.
 * Never throws — all errors are captured in the results array.
 */
export async function notifyGoogleIndexingBatch(
  urls: string[],
  action: IndexingAction = 'URL_UPDATED',
): Promise<IndexingResult[]> {
  const results: IndexingResult[] = [];

  for (const url of urls) {
    const result = await notifyGoogleIndexing(url, action);
    results.push(result);
  }

  return results;
}

/**
 * Check if Google Indexing is configured (env var is present).
 */
export function isGoogleIndexingConfigured(): boolean {
  return !!process.env.GOOGLE_INDEXING_KEY;
}
