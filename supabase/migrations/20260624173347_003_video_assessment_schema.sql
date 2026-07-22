/*
# Video Assessment System Tables

## Overview
This migration adds tables for video assessments after AI shortlisting. Each video 
assessment session is unique to a vacancy and candidate with secure tokens, expiry dates,
and supports video recording, upload, and AI transcription.

## Tables Created

### 1. video_assessment_config
Stores vacancy-specific video assessment configuration for "after_ai_shortlisting" trigger.
- `id` (uuid, primary key)
- `vacancy_id` (uuid, references vacancies)
- `selection_type` (text) - top_5, top_10, top_15, custom
- `custom_number` (integer) - for custom selection
- `expiry_days` (integer) - days before link expires
- `reminder_days` (integer) - days remaining reminder
- `created_at` (timestamp)

### 2. video_assessment_sessions
Secure video assessment sessions for candidates.
- `id` (uuid, primary key)
- `vacancy_id` (uuid, references vacancies)
- `candidate_id` (uuid, references candidates)
- `application_id` (uuid, references applications)
- `secure_token` (text, unique) - cryptographic token for URL
- `status` (text) - invitation_sent, started, completed, expired
- `invited_at` (timestamptz)
- `started_at` (timestamptz)
- `completed_at` (timestamptz)
- `expires_at` (timestamptz)
- `reminder_sent` (boolean)
- `score` (decimal, 0-100)
- `ai_insights` (jsonb)

### 3. video_responses
Individual video responses to questions.
- `id` (uuid, primary key)
- `session_id` (uuid, references video_assessment_sessions)
- `question_id` (uuid, references video_assessment_questions)
- `video_url` (text) - storage URL
- `duration_seconds` (integer)
- `file_format` (text) - mp4, mov, webm
- `file_size_bytes` (bigint)
- `uploaded_at` (timestamptz)
- `transcript_status` (text) - pending, processing, completed, failed
- `transcript_text` (text)
- `reviewed` (boolean)
- `review_score` (decimal)
- `review_notes` (text)

### 4. video_transcripts
AI-generated transcripts with insights.
- `id` (uuid, primary key)
- `response_id` (uuid, references video_responses)
- `transcript_text` (text)
- `communication_score` (decimal)
- `industry_terminology_score` (decimal)
- `role_understanding_score` (decimal)
- `insights` (jsonb)
- `created_at` (timestamptz)

## Security
- RLS enabled on all tables
- Secure tokens generated with crypto_random_uuid
- Public access for candidate video submission
*/

-- Video Assessment Configuration
CREATE TABLE IF NOT EXISTS video_assessment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE UNIQUE,
  selection_type text NOT NULL DEFAULT 'top_10' CHECK (selection_type IN ('top_5', 'top_10', 'top_15', 'custom')),
  custom_number integer DEFAULT null,
  expiry_days integer NOT NULL DEFAULT 7,
  reminder_days integer NOT NULL DEFAULT 2,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_assessment_config ENABLE ROW LEVEL SECURITY;

-- Video Assessment Sessions
CREATE TABLE IF NOT EXISTS video_assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  secure_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'invitation_sent' CHECK (status IN ('invitation_sent', 'started', 'completed', 'expired')),
  invited_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  reminder_sent boolean DEFAULT false,
  score decimal CHECK (score >= 0 AND score <= 100),
  ai_insights jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_vacancy_candidate UNIQUE (vacancy_id, candidate_id)
);

ALTER TABLE video_assessment_sessions ENABLE ROW LEVEL SECURITY;

-- Video Responses
CREATE TABLE IF NOT EXISTS video_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES video_assessment_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES video_assessment_questions(id) ON DELETE CASCADE,
  video_url text,
  duration_seconds integer,
  file_format text CHECK (file_format IN ('mp4', 'mov', 'webm')),
  file_size_bytes bigint,
  uploaded_at timestamptz,
  transcript_status text DEFAULT 'pending' CHECK (transcript_status IN ('pending', 'processing', 'completed', 'failed')),
  transcript_text text,
  reviewed boolean DEFAULT false,
  review_score decimal CHECK (review_score >= 0 AND review_score <= 100),
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_session_question UNIQUE (session_id, question_id)
);

ALTER TABLE video_responses ENABLE ROW LEVEL SECURITY;

-- Video Transcripts
CREATE TABLE IF NOT EXISTS video_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES video_responses(id) ON DELETE CASCADE,
  transcript_text text,
  communication_score decimal CHECK (communication_score >= 0 AND communication_score <= 100),
  industry_terminology_score decimal CHECK (industry_terminology_score >= 0 AND industry_terminology_score <= 100),
  role_understanding_score decimal CHECK (role_understanding_score >= 0 AND role_understanding_score <= 100),
  insights jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(response_id)
);

ALTER TABLE video_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_assessment_config
DROP POLICY IF EXISTS "hr_manage_video_config" ON video_assessment_config;
CREATE POLICY "hr_manage_video_config" ON video_assessment_config FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for video_assessment_sessions
DROP POLICY IF EXISTS "hr_manage_video_sessions" ON video_assessment_sessions;
CREATE POLICY "hr_manage_video_sessions" ON video_assessment_sessions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_own_session" ON video_assessment_sessions;
CREATE POLICY "public_read_own_session" ON video_assessment_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_video_sessions" ON video_assessment_sessions;
CREATE POLICY "public_insert_video_sessions" ON video_assessment_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_video_sessions" ON video_assessment_sessions;
CREATE POLICY "public_update_video_sessions" ON video_assessment_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for video_responses
DROP POLICY IF EXISTS "hr_manage_video_responses" ON video_responses;
CREATE POLICY "hr_manage_video_responses" ON video_responses FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_video_responses" ON video_responses;
CREATE POLICY "public_insert_video_responses" ON video_responses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_video_responses" ON video_responses;
CREATE POLICY "public_update_video_responses" ON video_responses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_video_responses" ON video_responses;
CREATE POLICY "public_read_video_responses" ON video_responses FOR SELECT
  TO anon, authenticated USING (true);

-- RLS Policies for video_transcripts
DROP POLICY IF EXISTS "hr_manage_video_transcripts" ON video_transcripts;
CREATE POLICY "hr_manage_video_transcripts" ON video_transcripts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_video_transcripts" ON video_transcripts;
CREATE POLICY "public_read_video_transcripts" ON video_transcripts FOR SELECT
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_config_vacancy ON video_assessment_config(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_vacancy ON video_assessment_sessions(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_candidate ON video_assessment_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_token ON video_assessment_sessions(secure_token);
CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_assessment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_expires ON video_assessment_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_responses_session ON video_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_response ON video_transcripts(response_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_video_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_video_session ON video_assessment_sessions;
CREATE TRIGGER trigger_update_video_session
  BEFORE UPDATE ON video_assessment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_video_timestamp();

DROP TRIGGER IF EXISTS trigger_update_video_response ON video_responses;
CREATE TRIGGER trigger_update_video_response
  BEFORE UPDATE ON video_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_video_timestamp();

-- Function to create video sessions for top candidates
CREATE OR REPLACE FUNCTION create_video_sessions_for_top_candidates(p_vacancy_id uuid)
RETURNS TABLE (
  id uuid,
  candidate_id uuid,
  secure_token uuid,
  application_id uuid
) AS $$
DECLARE
  v_selection_type text;
  v_custom_number integer;
  v_expiry_days integer;
  v_limit integer;
BEGIN
  SELECT selection_type, custom_number, expiry_days
  INTO v_selection_type, v_custom_number, v_expiry_days
  FROM video_assessment_config
  WHERE vacancy_id = p_vacancy_id;

  IF NOT FOUND THEN
    v_selection_type := 'top_10';
    v_expiry_days := 7;
  END IF;

  CASE v_selection_type
    WHEN 'top_5' THEN v_limit := 5;
    WHEN 'top_10' THEN v_limit := 10;
    WHEN 'top_15' THEN v_limit := 15;
    WHEN 'custom' THEN v_limit := COALESCE(v_custom_number, 10);
    ELSE v_limit := 10;
  END CASE;

  RETURN QUERY
  INSERT INTO video_assessment_sessions (
    vacancy_id, candidate_id, application_id, secure_token,
    status, invited_at, expires_at
  )
  SELECT
    p_vacancy_id,
    c.id,
    a.id,
    gen_random_uuid(),
    'invitation_sent',
    now(),
    now() + (v_expiry_days || ' days')::interval
  FROM applications a
  JOIN candidates c ON c.id = a.candidate_id
  JOIN ai_evaluation_summaries s ON s.evaluation_id = (
    SELECT id FROM ai_evaluations WHERE application_id = a.id
  )
  WHERE a.vacancy_id = p_vacancy_id
  AND s.overall_score IS NOT NULL
  ORDER BY s.overall_score DESC
  LIMIT v_limit
  ON CONFLICT (vacancy_id, candidate_id) DO NOTHING
  RETURNING
    video_assessment_sessions.id,
    video_assessment_sessions.candidate_id,
    video_assessment_sessions.secure_token,
    video_assessment_sessions.application_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify video session token
CREATE OR REPLACE FUNCTION verify_video_session(
  p_vacancy_id uuid,
  p_candidate_id uuid,
  p_token uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  expires_at timestamptz,
  vacancy jsonb,
  questions jsonb,
  is_valid boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.id,
    vs.status,
    vs.expires_at,
    to_jsonb(v.*) as vacancy,
    (
      SELECT jsonb_agg(to_jsonb(q.*))
      FROM video_assessment_questions q
      WHERE q.vacancy_id = p_vacancy_id
      ORDER BY q.order_index
    ) as questions,
    (vs.status IN ('invitation_sent', 'started') AND vs.expires_at > now() AND vs.candidate_id = p_candidate_id AND vs.secure_token = p_token)::boolean as is_valid
  FROM video_assessment_sessions vs
  JOIN vacancies v ON v.id = vs.vacancy_id
  WHERE vs.vacancy_id = p_vacancy_id
  AND vs.secure_token = p_token
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
