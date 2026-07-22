/*
# Recruitment Pipeline Schema

## Overview
Adds the recruitment pipeline (Kanban) system with stage tracking, full audit trail,
and recruiter notes per candidate-vacancy application.

## Tables

### pipeline_stages
Defines the 10 ordered stages for every vacancy.
One row per vacancy is seeded automatically on vacancy creation.

### pipeline_stage_history
Immutable audit log of every stage transition.

### candidate_notes
Recruiter notes attached to an application.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend applications with a pipeline_stage column
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'pipeline_stage'
  ) THEN
    ALTER TABLE applications
      ADD COLUMN pipeline_stage text NOT NULL DEFAULT 'applied'
        CHECK (pipeline_stage IN (
          'applied',
          'ai_ranked',
          'video_assessment_sent',
          'video_assessment_completed',
          'interview_invited',
          'interview_confirmed',
          'offer_issued',
          'offer_accepted',
          'hired',
          'regret'
        ));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pipeline_stage_history  (immutable audit log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stage_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_stage    text,
  to_stage      text NOT NULL,
  changed_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  changed_by_name text,
  note          text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stage_history_application
  ON pipeline_stage_history(application_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at
  ON pipeline_stage_history(changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. candidate_notes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  note           text NOT NULL,
  is_private     boolean NOT NULL DEFAULT false,
  created_by     uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by_name text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_candidate_notes_application
  ON candidate_notes(application_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- pipeline_stage_history: HR can read/insert; nobody can update or delete
CREATE POLICY "hr_read_stage_history" ON pipeline_stage_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hr_insert_stage_history" ON pipeline_stage_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- candidate_notes: full CRUD for authenticated HR
CREATE POLICY "hr_manage_notes" ON candidate_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Function: move_to_stage
--    Atomically updates the application stage and inserts an audit row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION move_to_stage(
  p_application_id uuid,
  p_to_stage        text,
  p_changed_by      uuid DEFAULT NULL,
  p_changed_by_name text DEFAULT NULL,
  p_note            text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_from_stage text;
BEGIN
  SELECT pipeline_stage INTO v_from_stage
    FROM applications WHERE id = p_application_id;

  IF v_from_stage IS DISTINCT FROM p_to_stage THEN
    UPDATE applications
      SET pipeline_stage = p_to_stage,
          updated_at     = now()
      WHERE id = p_application_id;

    INSERT INTO pipeline_stage_history
      (application_id, from_stage, to_stage, changed_by, changed_by_name, note)
    VALUES
      (p_application_id, v_from_stage, p_to_stage, p_changed_by, p_changed_by_name, p_note);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Function: get_pipeline_board
--    Returns all applications for a vacancy, grouped for the Kanban board.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pipeline_board(p_vacancy_id uuid)
RETURNS TABLE (
  application_id  uuid,
  reference_number text,
  pipeline_stage  text,
  applied_at      timestamptz,
  candidate_id    uuid,
  first_name      text,
  last_name       text,
  email           text,
  mobile_number   text,
  ai_score        decimal,
  video_score     decimal,
  note_count      bigint,
  has_ai_eval     boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id                          AS application_id,
    a.reference_number,
    a.pipeline_stage,
    a.applied_at,
    c.id                          AS candidate_id,
    c.first_name,
    c.last_name,
    c.email,
    c.mobile_number,
    COALESCE(s.overall_score, 0)  AS ai_score,
    COALESCE(vs.score, 0)         AS video_score,
    (SELECT COUNT(*) FROM candidate_notes n WHERE n.application_id = a.id) AS note_count,
    (ev.id IS NOT NULL)           AS has_ai_eval
  FROM applications a
  JOIN candidates c ON c.id = a.candidate_id
  LEFT JOIN ai_evaluations ev ON ev.application_id = a.id
  LEFT JOIN ai_evaluation_summaries s ON s.evaluation_id = ev.id
  LEFT JOIN video_assessment_sessions vs
    ON vs.application_id = a.id AND vs.status = 'completed'
  WHERE a.vacancy_id = p_vacancy_id
  ORDER BY
    a.pipeline_stage,
    COALESCE(s.overall_score, 0) DESC,
    a.applied_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Seed history row for every existing application (initial position)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO pipeline_stage_history (application_id, from_stage, to_stage, note)
SELECT id, NULL, pipeline_stage, 'Initial stage on pipeline creation'
FROM applications
ON CONFLICT DO NOTHING;
