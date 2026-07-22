-- Extend user_profiles with richer profile fields
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Company settings (shared singleton for the LaunchPad instance)
CREATE TABLE IF NOT EXISTS company_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  industry    TEXT,
  website     TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  city        TEXT,
  country     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_company" ON company_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_company" ON company_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_company" ON company_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Notification preferences (one row per user)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id),
  new_application    BOOLEAN NOT NULL DEFAULT TRUE,
  interview_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  offer_response     BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_report      BOOLEAN NOT NULL DEFAULT FALSE,
  pipeline_updates   BOOLEAN NOT NULL DEFAULT TRUE,
  video_assessments  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_notif" ON notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_notif" ON notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_notif" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_notif" ON notification_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
