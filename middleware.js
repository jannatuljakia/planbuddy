import { NextResponse } from 'next/server';

// Simple shared-password gate for the whole site.
// Only SITE_USER + SITE_PASSWORD (set in Vercel env vars) can get in.
// Cron endpoints are excluded (they're already protected by CRON_SECRET,
// and Vercel's cron / an external scheduler can't answer a browser login prompt).

export const config = {
  matcher: [
    '/((?!api/send-reminders|api/send-weekly-summary|_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(req) {
  const auth = req.headers.get('authorization');

  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const sepIndex = decoded.indexOf(':');
      const user = decoded.slice(0, sepIndex);
      const pass = decoded.slice(sepIndex + 1);

      if (
        user === process.env.SITE_USER &&
        pass === process.env.SITE_PASSWORD &&
        process.env.SITE_USER &&
        process.env.SITE_PASSWORD
      ) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="planbuddy"' },
  });
}
