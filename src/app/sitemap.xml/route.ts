import { proxyPublicXml } from "@/lib/public-xml";

export function GET() { return proxyPublicXml("sitemap.xml"); }
