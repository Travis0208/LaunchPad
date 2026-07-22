-- Add generic meeting_url column to interviews (platform-agnostic video link)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS meeting_url TEXT;

-- Expand interview_type to include zoom and google_meet
-- Drop old constraint and replace with updated one
ALTER TABLE interviews
  DROP CONSTRAINT IF EXISTS interviews_interview_type_check;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_interview_type_check
  CHECK (interview_type IN ('in_person', 'video', 'phone', 'teams', 'zoom', 'google_meet'));

-- Email settings table (replaces Microsoft Graph / SMTP env-var-only config)
CREATE TABLE IF NOT EXISTS email_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL DEFAULT 'smtp'
                 CHECK (provider IN ('smtp', 'resend', 'sendgrid', 'mailgun')),
  smtp_host    TEXT,
  smtp_port    INTEGER DEFAULT 587,
  smtp_secure  BOOLEAN DEFAULT FALSE,
  smtp_username TEXT,
  smtp_password TEXT,
  from_email   TEXT NOT NULL DEFAULT 'recruitment@company.co.za',
  from_name    TEXT NOT NULL DEFAULT 'Recruitment Team',
  reply_to     TEXT,
  resend_api_key   TEXT,
  sendgrid_api_key TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- Only administrators can manage email settings (contains credentials)
CREATE POLICY "admins_select_email_settings" ON email_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'administrator'
  ));

CREATE POLICY "admins_insert_email_settings" ON email_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'administrator'
  ));

CREATE POLICY "admins_update_email_settings" ON email_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'administrator'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'administrator'
  ));
