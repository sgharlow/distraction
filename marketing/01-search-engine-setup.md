# Item 1: Search Engine Setup — Instructions

## Google Search Console

1. Go to: https://search.google.com/search-console
2. Click "Add Property" → Choose "Domain" → Enter: `distractionindex.org`
3. Verify via DNS TXT record (add to your domain registrar):
   - Type: TXT
   - Name: @ (or distractionindex.org)
   - Value: (Google will provide the verification string)
4. After verification, go to Sitemaps → Submit: `https://distractionindex.org/sitemap.xml`
5. Request indexing of your homepage: URL Inspection → Enter `https://distractionindex.org` → "Request Indexing"

## Bing Webmaster Tools

1. Go to: https://www.bing.com/webmasters
2. Sign in with Microsoft account
3. Click "Import from Google Search Console" (fastest — auto-verifies)
4. Or manually: Add site → Verify via DNS CNAME record
5. Submit sitemap: `https://distractionindex.org/sitemap.xml`

## What Was Added to the Codebase

- JSON-LD WebSite structured data added to root layout.tsx
- Includes SearchAction for Google Sitelinks search box
- Sitemap already has 800+ URLs (10 static + 56 weeks + 700+ events)
- robots.ts already configured correctly

## Verify Structured Data

After deploying, test at:
- https://search.google.com/test/rich-results?url=https://distractionindex.org
- https://validator.schema.org/?url=https://distractionindex.org
