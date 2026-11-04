import { publicAuthorPath, publicCoverPath, type PublicPost } from "./public-post";

function siteOrigin(): string {
  const url = new URL(process.env.SITE_ORIGIN || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_ORIGIN deve ser a origem pública do site.");
  }
  return url.origin;
}

export function postSeo(post: PublicPost) {
  const origin = siteOrigin();
  const url = `${origin}/posts/${post.slug}`;
  const cover = publicCoverPath(post.coverImage);
  const image = cover ? `${origin}${cover}` : undefined;
  const authorPath = publicAuthorPath(post.author?.id);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    mainEntityOfPage: url,
    ...(image && { image }),
    ...(post.publishedAt && { datePublished: post.publishedAt }),
    ...(post.updatedAt && { dateModified: post.updatedAt }),
    ...(post.author?.name && { author: { "@type": "Person", name: post.author.name, ...(authorPath && { url: `${origin}${authorPath}` }) } }),
  };
  return { url, image, jsonLd: JSON.stringify(jsonLd).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") };
}
