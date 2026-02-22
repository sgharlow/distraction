import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: [
      'https://distractionindex.org/sitemap.xml',
      'https://distractionindex.org/news-sitemap.xml',
    ],
  };
}
