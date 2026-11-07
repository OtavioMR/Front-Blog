import { NextResponse, type NextRequest } from "next/server";
import { cookieName, loginCookieName, randomSecret } from "@/lib/admin-security";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const loginPath = "/gestao-editorial/entrar";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

// Primeira barreira da administração: só verifica a presença do cookie de sessão. A validação real
// (sessão, cargo e permissões) ocorre no servidor Next e, em última instância, na API Nest.
function administration(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (process.env.ENABLE_ADMIN_BFF !== "true") return NextResponse.next();
  const entering = pathname === loginPath || pathname === `${loginPath}/`;
  if (entering && request.method === "GET") {
    const csrf = randomSecret();
    const headers = new Headers(request.headers);
    headers.set("x-admin-login-csrf", csrf);
    const response = NextResponse.next({ request: { headers } });
    response.cookies.set(loginCookieName, csrf, { ...cookieOptions, maxAge: 600 });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
  const open = entering || pathname.startsWith(`${loginPath}/`) || pathname === "/gestao-editorial/sair";
  if (!open && safeMethods.has(request.method) && !request.cookies.get(cookieName)?.value) {
    return NextResponse.redirect(new URL(loginPath, request.url), { status: 307, headers: { "Cache-Control": "no-store, private" } });
  }
  return NextResponse.next();
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/gestao-editorial")) return administration(request);
  if (safeMethods.has(request.method)) return NextResponse.next();

  // Nunca confie em Host ou X-Forwarded-Host fornecidos pelo cliente.
  const configured = process.env.SITE_ORIGIN || "http://localhost:3000";
  try {
    const site = new URL(configured);
    if (!["http:", "https:"].includes(site.protocol) || site.username || site.password
      || site.pathname !== "/" || site.search || site.hash
      || request.headers.get("origin") !== site.origin) {
      return new NextResponse("Origem não autorizada.", { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return new NextResponse("Origem não autorizada.", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/v1/:path*", "/gestao-editorial/:path*"] };
