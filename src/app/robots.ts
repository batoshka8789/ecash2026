import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecash.kz';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /news стали публичными и индексируются; /admin — закрытый раздел
        disallow: ['/api/', '/profile', '/notifications', '/requests', '/admin'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
