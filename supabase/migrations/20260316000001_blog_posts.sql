-- Blog posts table for auto-generated weekly content
CREATE TABLE IF NOT EXISTS distraction.blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT,
  body_markdown TEXT NOT NULL,
  week_id TEXT REFERENCES distraction.weekly_snapshots(week_id),
  keywords TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  word_count INTEGER,
  generation_model TEXT,
  generation_tokens INTEGER
);

-- Index for blog listing and sitemap
CREATE INDEX idx_blog_posts_published ON distraction.blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_week ON distraction.blog_posts(week_id);

-- RLS: public read, admin write
ALTER TABLE distraction.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog posts are publicly readable"
  ON distraction.blog_posts FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage blog posts"
  ON distraction.blog_posts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
