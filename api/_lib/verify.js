import { jwtVerify, createRemoteJWKSet } from "jose";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

// Verifies the caller is a real signed-in Firebase user for this project --
// checked against Google's public keys, so no service-account secret is needed.
export async function verifyFirebaseToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

// In-memory, per-instance limiter -- resets on cold start and isn't shared
// across concurrent Vercel instances. That's fine here: the goal is blunting
// casual abuse of a paid/rate-sensitive API, not perfect global enforcement.
export function makeRateLimiter(maxPerWindow, windowMs) {
  const requestLog = new Map(); // uid -> timestamps[]
  return function isRateLimited(uid) {
    const now = Date.now();
    const recent = (requestLog.get(uid) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    requestLog.set(uid, recent);
    return recent.length > maxPerWindow;
  };
}
