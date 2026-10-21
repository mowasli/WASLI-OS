import { z } from 'zod';

export interface SupabaseAuthConfig { url: string; publishableKey: string }
export interface SupabaseIdentity { id: string; email: string; lifetimeSeconds: number; expiresAt: number }
export class SupabaseSignInError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function supabaseAuthConfig(env: Readonly<Record<string,string|undefined>> = process.env): SupabaseAuthConfig {
  const value = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
    // An elevated secret/service-role key is neither required nor accepted here.
    if (!publishableKey?.startsWith('sb_publishable_') || publishableKey.length < 24) throw new Error();
    return { url: url.origin, publishableKey };
  } catch {
    throw new SupabaseSignInError(503, 'Managed sign-in is not configured. Contact the administrator.');
  }
}

export function supabaseAuthConfigured(): boolean {
  try { supabaseAuthConfig(); return true; } catch { return false; }
}

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });
const userSchema = z.object({
  id: z.uuid(), email: z.email(), email_confirmed_at: z.iso.datetime({ offset: true }),
  is_anonymous: z.boolean().optional(), banned_until: z.iso.datetime({ offset: true }).nullable().optional(),
  factors: z.array(z.object({ status: z.string() })).optional(),
});

/** Verify credentials with Supabase and verify its access token using /user.
 * Tokens never reach the browser or database; app sessions expire within one hour.
 * Authentication grants no membership: immutable user IDs must be provisioned separately.
 */
export async function authenticateSupabase(
  credentials: { email: string; password: string },
  config = supabaseAuthConfig(),
  requester: typeof fetch = fetch,
): Promise<SupabaseIdentity> {
  const startedAt = Date.now();
  const call = async (endpoint: string, init: RequestInit): Promise<unknown> => {
    let response: Response;
    try {
      response = await requester(`${config.url}/auth/v1${endpoint}`, {
        ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000),
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...init.headers },
      });
    } catch { throw new SupabaseSignInError(503, 'The sign-in provider is unavailable. Try again later.'); }
    if (!response.ok) {
      if ([400, 401, 403, 422].includes(response.status)) throw new SupabaseSignInError(401, 'Email or password is incorrect, or the account is unavailable.');
      if (response.status === 429) throw new SupabaseSignInError(429, 'Too many sign-in attempts. Try again later.');
      throw new SupabaseSignInError(503, 'The sign-in provider is unavailable. Try again later.');
    }
    try { return await response.json(); }
    catch { throw new SupabaseSignInError(503, 'The sign-in provider returned an invalid response.'); }
  };
  const grant = tokenSchema.safeParse(await call('/token?grant_type=password', { method: 'POST', body: JSON.stringify(credentials) }));
  if (!grant.success) throw new SupabaseSignInError(503, 'The sign-in provider returned an invalid response.');
  // Decoding a JWT never authenticates a user. It can only shorten the expiry
  // after /user has verified that exact access token with the provider.
  let jwtExpiry = Infinity;
  try {
    const payload = JSON.parse(Buffer.from(grant.data.access_token.split('.')[1], 'base64url').toString());
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) jwtExpiry = payload.exp * 1000;
  } catch { /* The provider still verifies the token below. */ }
  const identity = userSchema.safeParse(await call('/user', { method: 'GET', headers: { Authorization: `Bearer ${grant.data.access_token}` } }));
  if (!identity.success || identity.data.is_anonymous || identity.data.email.toLowerCase() !== credentials.email.toLowerCase() ||
      (identity.data.banned_until && new Date(identity.data.banned_until).getTime() > Date.now())) {
    throw new SupabaseSignInError(401, 'The account is unavailable. Contact the administrator.');
  }
  if (identity.data.factors?.some(factor => factor.status === 'verified')) {
    throw new SupabaseSignInError(403, 'This account requires multi-factor sign-in. This sign-in flow does not yet support it.');
  }
  const expiresAt = Math.min(startedAt + Math.min(grant.data.expires_in, 3600) * 1000, jwtExpiry);
  const lifetimeSeconds = Math.floor((expiresAt - Date.now()) / 1000);
  if (lifetimeSeconds < 1) throw new SupabaseSignInError(401, 'The sign-in token expired. Please sign in again.');
  return { id: identity.data.id, email: identity.data.email.toLowerCase(), lifetimeSeconds, expiresAt };
}
