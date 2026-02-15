-- ═══════════════════════════════════════════════════════════════
-- Email Subscribers — Newsletter collection table
-- Public: INSERT only (visitors can subscribe)
-- Admin: full access for management
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE distraction.email_subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    subscribed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    confirmed BOOLEAN DEFAULT false NOT NULL,
    unsubscribed_at TIMESTAMPTZ
);

-- Index for admin queries
CREATE INDEX idx_email_subscribers_subscribed_at
    ON distraction.email_subscribers (subscribed_at DESC);

-- Enable RLS
ALTER TABLE distraction.email_subscribers ENABLE ROW LEVEL SECURITY;

-- Public INSERT (visitors can subscribe)
CREATE POLICY "Public insert email_subscribers"
    ON distraction.email_subscribers FOR INSERT
    WITH CHECK (true);

-- Admin read/update/delete
CREATE POLICY "Admin read email_subscribers"
    ON distraction.email_subscribers FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin update email_subscribers"
    ON distraction.email_subscribers FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin delete email_subscribers"
    ON distraction.email_subscribers FOR DELETE
    USING (auth.role() = 'authenticated');
