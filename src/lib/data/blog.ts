import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  body_markdown: string;
  week_id: string | null;
  keywords: string[];
  published_at: string;
  updated_at: string;
  word_count: number | null;
}

/** Get all published blog posts, newest first */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false });
  return (data ?? []) as BlogPost[];
}

/** Get a single blog post by slug */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();
  return data as BlogPost | null;
}

/** Get blog post by week_id (for checking if one already exists) */
export async function getBlogPostByWeek(weekId: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('week_id', weekId)
    .single();
  return data as BlogPost | null;
}

/** Insert a new blog post (admin/service role) */
export async function insertBlogPost(post: {
  slug: string;
  title: string;
  meta_description: string;
  body_markdown: string;
  week_id: string;
  keywords: string[];
  word_count: number;
  generation_model?: string;
  generation_tokens?: number;
  published_at?: string;
}): Promise<BlogPost> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .insert(post)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert blog post: ${error.message}`);
  return data as BlogPost;
}
