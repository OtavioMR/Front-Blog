import { NextResponse, type NextRequest } from "next/server";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
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

export const config = { matcher: "/api/v1/:path*" };
