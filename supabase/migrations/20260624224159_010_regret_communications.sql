-- Regret communications log
CREATE TABLE regret_communications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  vacancy_id      uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  candidate_id    uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sent_by         uuid REFERENCES auth.users(id),
  sent_by_name    text,
  subject         text NOT NULL DEFAULT 'Thank you for your application',
  body            text NOT NULL DEFAULT '',
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)   -- one regret per application
);

ALTER TABLE regret_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_regret_communications" ON regret_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_regret_communications" ON regret_communications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_regret_communications" ON regret_communications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_regret_communications" ON regret_communications FOR DELETE TO authenticated USING (true);

-- Indexes for look-ups the tracking view will use
CREATE INDEX idx_regret_comm_vacancy  ON regret_communications (vacancy_id);
CREATE INDEX idx_regret_comm_sent_at  ON regret_communications (sent_at DESC);

-- Atomic bulk-regret RPC: moves each application to 'regret' stage,
-- writes pipeline_stage_history, and inserts a regret_communications row.
CREATE OR REPLACE FUNCTION send_bulk_regret(
  p_application_ids  uuid[],
  p_subject          text,
  p_body             text,
  p_sent_by          uuid DEFAULT NULL,
  p_sent_by_name     text DEFAULT NULL
)
RETURNS TABLE (
  application_id  uuid,
  candidate_id    uuid,
  vacancy_id      uuid,
  success         boolean,
  error_msg       text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_app_id    uuid;
  v_cand_id   uuid;
  v_vac_id    uuid;
  v_old_stage text;
BEGIN
  FOREACH v_app_id IN ARRAY p_application_ids LOOP
    BEGIN
      SELECT a.candidate_id, a.vacancy_id, a.pipeline_stage
        INTO v_cand_id, v_vac_id, v_old_stage
        FROM applications a
        WHERE a.id = v_app_id;

      IF NOT FOUND THEN
        RETURN QUERY SELECT v_app_id, NULL::uuid, NULL::uuid, false, 'Application not found';
        CONTINUE;
      END IF;

      -- Move to regret stage
      UPDATE applications SET pipeline_stage = 'regret', updated_at = now() WHERE id = v_app_id;

      -- Audit trail
      INSERT INTO pipeline_stage_history (application_id, from_stage, to_stage, changed_by, changed_by_name, note)
        VALUES (v_app_id, v_old_stage, 'regret', p_sent_by, p_sent_by_name, 'Regret communication sent');

      -- Log the communication (upsert in case re-sending)
      INSERT INTO regret_communications (application_id, vacancy_id, candidate_id, sent_by, sent_by_name, subject, body)
        VALUES (v_app_id, v_vac_id, v_cand_id, p_sent_by, p_sent_by_name, p_subject, p_body)
        ON CONFLICT (application_id) DO UPDATE
          SET subject = EXCLUDED.subject,
              body    = EXCLUDED.body,
              sent_by = EXCLUDED.sent_by,
              sent_by_name = EXCLUDED.sent_by_name,
              sent_at = now();

      RETURN QUERY SELECT v_app_id, v_cand_id, v_vac_id, true, NULL::text;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_app_id, v_cand_id, v_vac_id, false, SQLERRM;
    END;
  END LOOP;
END;
$$;
