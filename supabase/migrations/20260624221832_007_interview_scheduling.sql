/*
# Interview Scheduling — Teams, Outlook & RSVP

## Overview
Extends the interviews table to support:
- Teams and In-Person interview types
- Outlook calendar invitation tracking
- Teams meeting auto-creation (via MS Graph edge function)
- Candidate RSVP with secure token
- Status: invitation_sent → accepted | declined → completed

## Changes
1. interviews table: new columns for Teams, RSVP, and calendar data
2. interview_invitations: per-invite log (send history, RSVP tokens)
3. Helper functions: create RSVP token, update RSVP status
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.  Extend interviews table
-- ─────────────────────────────────────────────────────────────────────────────

-- Update interview_type to include 'teams' (keep backward compat)
ALTER TABLE interviews
  DROP CONSTRAINT IF EXISTS interviews_interview_type_check;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_interview_type_check
  CHECK (interview_type IN ('in_person', 'video', 'phone', 'teams'));

-- Update status to include rsvp states
ALTER TABLE interviews
  DROP CONSTRAINT IF EXISTS interviews_status_check;

ALTER TABLE interviews
  ADD CONSTRAINT interviews_status_check
  CHECK (status IN ('scheduled', 'invitation_sent', 'accepted', 'declined', 'completed', 'cancelled', 'no_show'));

-- New columns
DO $$
BEGIN
  -- Organiser / recruiter who is sending
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='organiser_email') THEN
    ALTER TABLE interviews ADD COLUMN organiser_email text;
  END IF;

  -- Teams meeting data (returned by MS Graph)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='teams_meeting_url') THEN
    ALTER TABLE interviews ADD COLUMN teams_meeting_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='teams_meeting_id') THEN
    ALTER TABLE interviews ADD COLUMN teams_meeting_id text;
  END IF;

  -- Outlook calendar event ID (so we can update/cancel it later)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='calendar_event_id') THEN
    ALTER TABLE interviews ADD COLUMN calendar_event_id text;
  END IF;

  -- RSVP state
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='invitation_sent_at') THEN
    ALTER TABLE interviews ADD COLUMN invitation_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='rsvp_token') THEN
    ALTER TABLE interviews ADD COLUMN rsvp_token uuid DEFAULT gen_random_uuid() UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='rsvp_responded_at') THEN
    ALTER TABLE interviews ADD COLUMN rsvp_responded_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='interviews' AND column_name='rsvp_message') THEN
    ALTER TABLE interviews ADD COLUMN rsvp_message text;
  END IF;
END $$;

-- Backfill rsvp_token for existing rows that might have null
UPDATE interviews SET rsvp_token = gen_random_uuid() WHERE rsvp_token IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.  interview_invitations — send log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  sent_to_email   text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent','delivered','failed')),
  error_message   text,
  ms_message_id   text
);

ALTER TABLE interview_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_manage_invitations" ON interview_invitations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_interview_invitations_interview
  ON interview_invitations(interview_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.  Helper: process RSVP response from candidate
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_interview_rsvp(
  p_token   uuid,
  p_status  text,   -- 'accepted' or 'declined'
  p_message text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_id  uuid;
  v_cur text;
BEGIN
  SELECT id, status INTO v_id, v_cur
    FROM interviews WHERE rsvp_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid token');
  END IF;

  IF v_cur NOT IN ('scheduled', 'invitation_sent') THEN
    RETURN json_build_object('ok', false, 'error', 'Interview is no longer awaiting a response');
  END IF;

  IF p_status NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid status');
  END IF;

  UPDATE interviews
    SET status           = p_status,
        rsvp_responded_at = now(),
        rsvp_message      = p_message,
        updated_at        = now()
  WHERE id = v_id;

  -- Append to pipeline audit trail
  INSERT INTO pipeline_stage_history (application_id, from_stage, to_stage, note)
  SELECT application_id,
         pipeline_stage,
         CASE WHEN p_status = 'accepted' THEN 'interview_confirmed' ELSE 'interview_invited' END,
         CASE WHEN p_status = 'accepted'
              THEN 'Candidate accepted interview invitation'
              ELSE COALESCE('Candidate declined: ' || p_message, 'Candidate declined interview invitation')
         END
  FROM applications a
  JOIN interviews i ON i.application_id = a.id
  WHERE i.id = v_id;

  -- Also update application pipeline_stage
  UPDATE applications
    SET pipeline_stage = CASE WHEN p_status = 'accepted' THEN 'interview_confirmed' ELSE 'interview_invited' END,
        updated_at     = now()
  WHERE id = (SELECT application_id FROM interviews WHERE id = v_id);

  RETURN json_build_object('ok', true, 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public RSVP function (called by the edge function without auth)
GRANT EXECUTE ON FUNCTION process_interview_rsvp(uuid, text, text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.  Helper: get interview by RSVP token (public safe read)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_interview_by_rsvp_token(p_token uuid)
RETURNS TABLE (
  interview_id     uuid,
  interview_type   text,
  scheduled_at     timestamptz,
  duration_minutes int,
  location         text,
  teams_meeting_url text,
  status           text,
  job_title        text,
  department       text,
  first_name       text,
  last_name        text,
  organiser_email  text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.interview_type,
    i.scheduled_at,
    i.duration_minutes,
    i.location,
    i.teams_meeting_url,
    i.status,
    v.job_title,
    v.department,
    c.first_name,
    c.last_name,
    i.organiser_email
  FROM interviews i
  JOIN applications a ON a.id = i.application_id
  JOIN candidates c ON c.id = a.candidate_id
  JOIN vacancies v ON v.id = a.vacancy_id
  WHERE i.rsvp_token = p_token
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_interview_by_rsvp_token(uuid) TO anon, authenticated;
