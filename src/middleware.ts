import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/adminAuth";
import { refreshPartnerSession } from "@/lib/parceiro/middlewareSession";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];
const PUBLIC_PARTNER_PATHS = ["/parceiro/entrar", "/parceiro/auth/callback", "/api/parceiro/login"];

function isPartnerPath(pathname: string): boolean {
  return pathname === "/parceiro" || pathname.startsWith("/parceiro/") || pathname.startsWith("/api/parceiro/");
}

function adminGate(request: NextRequest): NextResponse {
  if (PUBLIC_ADMIN_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (isValidAdminSession(cookie)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

async function partnerGate(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PARTNER_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  let session: Awaited<ReturnType<typeof refreshPartnerSession>>;
  try {
    session = await refreshPartnerSession(request);
  } catch (error) {
    // Most likely SUPABASE_ANON_KEY is missing — fail closed, but visibly.
    console.error("Partner session check failed", error);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Portal indisponível" }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/parceiro/entrar?erro=config", request.url));
  }
  const { userId, response } = session;
  if (userId) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const login = new URL("/parceiro/entrar", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export async function middleware(request: NextRequest) {
  return isPartnerPath(request.nextUrl.pathname) ? partnerGate(request) : adminGate(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/parceiro/:path*", "/api/parceiro/:path*"],
  // adminAuth.ts uses Node's `crypto` (createHash/timingSafeEqual), which
  // the default Edge Runtime doesn't support — run this middleware on the
  // Node.js runtime instead.
  runtime: "nodejs",
};
