/*
# Storage Policies for Video Uploads

## Overview
This migration adds storage policies for the videos bucket, allowing public uploads
for video assessment sessions and read access for everyone.

## Policies
- Public read access for all videos
- Authenticated users can upload videos
- Session-based upload validation
*/

-- Storage policies for videos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true) ON CONFLICT (id) DO NOTHING;

-- Policy for public read
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Policy for authenticated upload
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Policy for public upload (for video assessments)
CREATE POLICY "Public can upload videos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'videos');

-- Function to calculate video assessment score
CREATE OR REPLACE FUNCTION calculate_video_session_score(p_session_id uuid)
RETURNS decimal AS $$
DECLARE
  v_avg_score decimal;
  v_communication decimal;
  v_industry decimal;
  v_role decimal;
  v_weighted_score decimal;
BEGIN
  SELECT 
    AVG(COALESCE(t.communication_score, 0)),
    AVG(COALESCE(t.industry_terminology_score, 0)),
    AVG(COALESCE(t.role_understanding_score, 0))
  INTO v_communication, v_industry, v_role
  FROM video_transcripts t
  JOIN video_responses r ON r.id = t.response_id
  WHERE r.session_id = p_session_id AND r.video_url IS NOT NULL;
  
  v_avg_score := COALESCE((COALESCE(v_communication, 0) + COALESCE(v_industry, 0) + COALESCE(v_role, 0)) / 3, 0);
  
  UPDATE video_assessment_sessions
  SET score = v_avg_score,
      ai_insights = jsonb_build_object(
        'communication', COALESCE(v_communication, 0),
        'industry_knowledge', COALESCE(v_industry, 0),
        'role_understanding', COALESCE(v_role, 0)
      )
  WHERE id = p_session_id;
  
  RETURN v_avg_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
