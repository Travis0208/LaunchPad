-- Analytics RPC for recruitment metrics dashboard
CREATE OR REPLACE FUNCTION get_recruitment_metrics(
  p_start_date date DEFAULT (now() - interval '6 months')::date,
  p_end_date   date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(

    -- 1. Active vacancies
    'active_vacancies', (
      SELECT count(*) FROM vacancies
      WHERE status = 'published'
        AND (advert_start_date IS NULL OR advert_start_date <= p_end_date)
    ),

    -- 2. Total applications in range
    'total_applications', (
      SELECT count(*) FROM applications
      WHERE applied_at::date BETWEEN p_start_date AND p_end_date
    ),

    -- 3. Applications per vacancy (array of {vacancy_id, job_title, department, count})
    'applications_per_vacancy', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT v.id AS vacancy_id, v.job_title, v.department, v.status AS vacancy_status,
               count(a.id)::int AS application_count
        FROM vacancies v
        LEFT JOIN applications a ON a.vacancy_id = v.id
          AND a.applied_at::date BETWEEN p_start_date AND p_end_date
        GROUP BY v.id, v.job_title, v.department, v.status
        ORDER BY application_count DESC
        LIMIT 20
      ) r
    ),

    -- 4. Average time to fill (days from advert_start_date to offer accepted)
    'avg_time_to_fill_days', (
      SELECT round(avg(
        extract(epoch FROM (o.responded_at - v.advert_start_date)) / 86400
      ))::int
      FROM offers o
      JOIN applications a ON a.id = o.application_id
      JOIN vacancies v ON v.id = a.vacancy_id
      WHERE o.status = 'accepted'
        AND o.responded_at IS NOT NULL
        AND v.advert_start_date IS NOT NULL
        AND o.responded_at::date BETWEEN p_start_date AND p_end_date
    ),

    -- 5. AI shortlist conversion: applications -> ai shortlist score set
    'ai_shortlist_total',     (SELECT count(*) FROM applications WHERE applied_at::date BETWEEN p_start_date AND p_end_date),
    'ai_shortlisted_count',   (SELECT count(*) FROM applications WHERE ai_shortlist_score IS NOT NULL AND applied_at::date BETWEEN p_start_date AND p_end_date),

    -- 6. Video assessment completion
    'video_sessions_sent',      (SELECT count(*) FROM video_assessment_sessions WHERE created_at::date BETWEEN p_start_date AND p_end_date),
    'video_sessions_completed', (SELECT count(*) FROM video_assessment_sessions WHERE status = 'completed' AND created_at::date BETWEEN p_start_date AND p_end_date),

    -- 7. Interview-to-offer ratio
    'interviews_held',  (SELECT count(*) FROM interviews WHERE status IN ('completed') AND created_at::date BETWEEN p_start_date AND p_end_date),
    'offers_created',   (SELECT count(*) FROM offers WHERE created_at::date BETWEEN p_start_date AND p_end_date),

    -- 8. Offer acceptance
    'offers_sent',      (SELECT count(*) FROM offers WHERE status IN ('sent','accepted','declined') AND created_at::date BETWEEN p_start_date AND p_end_date),
    'offers_accepted',  (SELECT count(*) FROM offers WHERE status = 'accepted' AND created_at::date BETWEEN p_start_date AND p_end_date),
    'offers_declined',  (SELECT count(*) FROM offers WHERE status = 'declined' AND created_at::date BETWEEN p_start_date AND p_end_date),

    -- 9. Pipeline stage breakdown
    'pipeline_stage_breakdown', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT pipeline_stage AS stage, count(*)::int AS count
        FROM applications
        WHERE applied_at::date BETWEEN p_start_date AND p_end_date
        GROUP BY pipeline_stage
        ORDER BY count DESC
      ) r
    ),

    -- 10. Applications by month (for trend chart)
    'applications_by_month', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT to_char(date_trunc('month', applied_at), 'YYYY-MM') AS month,
               count(*)::int AS count
        FROM applications
        WHERE applied_at::date BETWEEN p_start_date AND p_end_date
        GROUP BY date_trunc('month', applied_at)
        ORDER BY date_trunc('month', applied_at)
      ) r
    ),

    -- 11. Regret communications sent in range
    'regrets_sent', (
      SELECT count(*) FROM regret_communications
      WHERE sent_at::date BETWEEN p_start_date AND p_end_date
    ),

    -- 12. Applications by department
    'applications_by_department', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT v.department, count(a.id)::int AS count
        FROM applications a
        JOIN vacancies v ON v.id = a.vacancy_id
        WHERE a.applied_at::date BETWEEN p_start_date AND p_end_date
        GROUP BY v.department
        ORDER BY count DESC
      ) r
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;
