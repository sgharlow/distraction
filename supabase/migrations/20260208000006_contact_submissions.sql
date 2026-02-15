-- ═══════════════════════════════════════════════════════════════
-- Contact Submissions — Public contact form storage
-- Public: INSERT only (visitors can submit)
-- Admin: full access for management
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE distraction.contact_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for admin queries
CREATE INDEX idx_contact_submissions_submitted_at
    ON distraction.contact_submissions (submitted_at DESC);

-- Enable RLS
ALTER TABLE distraction.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Public INSERT (visitors can submit)
CREATE POLICY "Public insert contact_submissions"
    ON distraction.contact_submissions FOR INSERT
    WITH CHECK (true);

-- Admin read/delete
CREATE POLICY "Admin read contact_submissions"
    ON distraction.contact_submissions FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin delete contact_submissions"
    ON distraction.contact_submissions FOR DELETE
    USING (auth.role() = 'authenticated');
