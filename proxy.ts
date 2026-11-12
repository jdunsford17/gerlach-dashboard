import { NextResponse, type NextRequest } from 'next/server';
import { adminCookie, sessionSeconds, stationAuthorized, stationBasic, stationSession } from './lib/station-auth';

export function proxy(request: NextRequest) {
 if (!stationAuthorized(request.headers)) {
  return new NextResponse('Station manager sign-in required.', {
   status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Gerlach Station Manager", charset="UTF-8"', 'Cache-Control': 'no-store' }
  });
 }
 const response = NextResponse.next();
 response.headers.set('Cache-Control','private, no-store');
 if (stationBasic(request.headers)) response.cookies.set(adminCookie, stationSession(), {
  httpOnly: true, secure: !process.env.STATION_ORIGIN?.startsWith('http://'), sameSite: 'strict', path: '/', maxAge: sessionSeconds
 });
 return response;
}
export const config={matcher:['/manage/:path*']};
