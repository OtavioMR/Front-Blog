// Only fixed backend paths are accepted; request headers and credentials are never forwarded.
export async function proxyPublicXml(path: "sitemap.xml" | "feed.xml" | "feed/rss" | "feed/atom"): Promise<Response> {
  try {
    const origin = process.env.API_ORIGIN || "http://localhost:3001";
    const upstream = await fetch(`${origin}/api/v1/${path}`, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    const location = upstream.headers.get("location");
    if (location) headers.set("Location", location);
    const noBody = [204, 205, 304].includes(upstream.status);
    return new Response(noBody ? null : await upstream.arrayBuffer(), { status: upstream.status, headers });
  } catch {
    return new Response("Serviço temporariamente indisponível.\n", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
