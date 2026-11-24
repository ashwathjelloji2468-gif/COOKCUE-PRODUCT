import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isContractorCode } from "@/lib/domain/identifiers";
import { verifySessionToken } from "@/lib/auth/token";
import type { SessionUser } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public assets and public routes
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const cookcueToken = request.cookies.get("cookcue_session")?.value;
  const messwiseToken = request.cookies.get("messwise_session")?.value;

  // If no session cookie, redirect to /login
  if (!cookcueToken && !messwiseToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 1. Verify Cryptographic HMAC-SHA256 signature via Web Crypto API (Edge compliant)
  // Try cookcue_session first; fall back to legacy messwise_session if cookcue_session is absent or invalid
  let session = cookcueToken ? await verifySessionToken<SessionUser>(cookcueToken) : null;
  if (!session && messwiseToken) {
    session = await verifySessionToken<SessionUser>(messwiseToken);
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid_session");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("cookcue_session");
    response.cookies.delete("messwise_session");
    return response;
  }

  // 2. Check expiration timestamp
  if (Date.now() > session.expiresAt) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "session_expired");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("cookcue_session");
    response.cookies.delete("messwise_session");
    return response;
  }

  // 3. Role-based route authorization
  // /founder/* strictly requires FOUNDER role, except account self-inspection (/profile, /permissions, /preferences)
  if (pathname.startsWith("/founder")) {
    const isAccountRoute =
      pathname === "/founder/profile" ||
      pathname === "/founder/permissions" ||
      pathname === "/founder/preferences";

    if (!isAccountRoute && session.role !== "FOUNDER") {
      if (session.contractorId) {
        return NextResponse.redirect(
          new URL(`/contractor/${session.contractorId}`, request.url)
        );
      }
      if (session.kitchenId) {
        const homeSubpath = session.role === "KITCHEN_STAFF" ? "staff-board" : "morning";
        return NextResponse.redirect(
          new URL(`/kitchen/${session.kitchenId}/${homeSubpath}`, request.url)
        );
      }
      return NextResponse.redirect(new URL("/login?error=missing_assignment", request.url));
    }
  }

  // /kitchen/:kitchenId/* requires access to that specific facility
  if (pathname.startsWith("/kitchen/")) {
    const parts = pathname.split("/");
    const targetKitchenId = parts[2];

    const isContractorStaff =
      (session.role === "CONTRACTOR_ADMIN" || session.role === "CONTRACTOR_MANAGER") &&
      Boolean(session.contractorId);

    if (session.role !== "FOUNDER" && session.kitchenId !== targetKitchenId && !isContractorStaff) {
      if (session.kitchenId) {
        const homeSubpath = session.role === "KITCHEN_STAFF" ? "staff-board" : "morning";
        return NextResponse.redirect(
          new URL(`/kitchen/${session.kitchenId}/${homeSubpath}`, request.url)
        );
      }
      if (session.contractorId) {
        return NextResponse.redirect(
          new URL(`/contractor/${session.contractorId}`, request.url)
        );
      }
      return NextResponse.redirect(new URL("/login?error=missing_assignment", request.url));
    }
  }

  // /contractor/:contractorId/* requires access to that contractor organization
  if (pathname.startsWith("/contractor/")) {
    const parts = pathname.split("/");
    const targetContractorId = parts[2];

    const isContractorUser = Boolean(session.contractorId);
    const isCode = isContractorCode(targetContractorId);

    if (
      session.role !== "FOUNDER" &&
      session.contractorId !== targetContractorId &&
      !(isContractorUser && isCode)
    ) {
      if (session.contractorId) {
        return NextResponse.redirect(
          new URL(`/contractor/${session.contractorId}`, request.url)
        );
      }
      if (session.kitchenId) {
        const homeSubpath = session.role === "KITCHEN_STAFF" ? "staff-board" : "morning";
        return NextResponse.redirect(
          new URL(`/kitchen/${session.kitchenId}/${homeSubpath}`, request.url)
        );
      }
      return NextResponse.redirect(new URL("/login?error=missing_assignment", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/founder/:path*",
    "/kitchen/:path*",
    "/contractor/:path*",
  ],
};
