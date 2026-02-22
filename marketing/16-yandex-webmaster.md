# Item 16: Yandex Webmaster Tools

**Submit at:** https://webmaster.yandex.com
**Account:** Free Yandex account required

---

## Setup Steps

1. Go to https://webmaster.yandex.com
2. Sign in (create Yandex account if needed)
3. Click "Add Site"
4. Enter: https://distractionindex.org
5. Verify ownership via HTML meta tag (add to layout.tsx metadata):
   ```typescript
   verification: {
     google: 'dzOvcZvrc0WdbHUBcUGh9ZwGZzxJrnIGk8RsFzov3F8',
     yandex: 'VERIFICATION_CODE_HERE',  // Add after setup
   },
   ```
6. Submit sitemap: https://distractionindex.org/sitemap.xml
7. Wait for indexing (typically 1-3 days)

## Why Yandex Matters
- Third largest search engine globally
- Dominant in Russia (~60% market share) and CIS countries
- 130M+ Russian internet users
- International visibility for a civic tech project
- Additional crawl data and diagnostics beyond Google/Bing
