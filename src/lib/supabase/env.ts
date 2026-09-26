// Is there a database to talk to in THIS process?
//
// Every Vercel env var on this project is Production-scoped, so a preview build has no Supabase
// URL or key — and `next build` prerenders feed.xml, news-sitemap.xml and sitemap.ts, each of
// which constructed the admin client unconditionally. Result, until 2026-09-25: every preview
// deployment died at the first of them ("supabaseUrl is required"), which put a red Vercel check
// on every PR, Dependabot's included. Those routes now ask this ONE question and return their
// valid empty form when the answer is no. Production, which has the env, is unchanged.
//
// Guard the build-time consumers, never the client factories: a client that silently returns
// nothing would turn a misconfigured production into an empty site instead of a loud failure.
export function hasDatabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
