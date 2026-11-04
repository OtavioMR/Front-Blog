import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const configured = process.env.SITE_ORIGIN || "http://localhost:3000";
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_ORIGIN deve ser a origem pública do site.");
  }
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${url.origin}/sitemap.xml` };
}
