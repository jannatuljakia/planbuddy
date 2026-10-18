import { NextResponse } from 'next/server';

// Simple shared-password gate for the whole site.
// Only SITE_USER + SITE_PASSWORD (set in Vercel env vars) can get in.
// After a successful login a long-lived cookie is set, so the same device
// is not asked for the username/password on every visit.
// Cookie value is a SHA-256 of the credentials, so changing SITE_PASSWORD
// automatically logs everyone out.
// Cron endpoints are excluded (they're already protected by CRON_SECRET,
// and Vercel's cron / an external scheduler can't answer a browser login prompt).

export const config = {
  matcher: [
    '/((?!api/send-reminders|api/send-weekly-summary|_next/static|_next/image|favicon.ico).*)',
  ],
};

const COOKIE_NAME = 'pb_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

async function sessionToken(user, pass) {
  const data = new TextEncoder().encode(`${user}:${pass}:planbuddy-session`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="planbuddy"' },
  });
}

export async function middleware(req) {
  const siteUser = process.env.SITE_USER;
  const sitePass = process.env.SITE_PASSWORD;
  if (!siteUser || !sitePass) return unauthorized(); // fail closed

  const expected = await sessionToken(siteUser, sitePass);

  // 1) Already logged in on this device (cookie)
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && cookie === expected) {
    return NextResponse.next();
  }

  // 2) Basic Auth header -> on success, remember this device with a cookie
  const auth = req.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      let decoded = '';
      try {
        decoded = atob(encoded);
      } catch (e) {
        return unauthorized();
      }
      const sepIndex = decoded.indexOf(':');
      const user = decoded.slice(0, sepIndex);
      const pass = decoded.slice(sepIndex + 1);

      if (user === siteUser && pass === sitePass) {
        const res = NextResponse.next();
        res.cookies.set(COOKIE_NAME, expected, {
          httpOnly: true,
          secure: req.nextUrl.protocol === 'https:',
          sameSite: 'lax',
          path: '/',
          maxAge: COOKIE_MAX_AGE,
        });
        return res;
      }
    }
  }

  return unauthorized();
}
