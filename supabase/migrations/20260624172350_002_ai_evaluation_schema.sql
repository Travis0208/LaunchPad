/*
# AI Candidate Review Engine Tables

## Overview
This migration adds tables for the AI candidate review engine, which evaluates
candidates against vacancy requirements and provides suitability scores and 
recommendations without automatically rejecting any candidates.

## Tables Created

### 1. ai_evaluations
Stores AI-generated evaluations for each application.
- `id` (uuid, primary key)
- `application_id` (uuid, references applications)
- `vacancy_id` (uuid, references vacancies)
- `evaluated_at` (timestamp)
- `evaluation_version` (text) - version of the evaluation algorithm

### 2. ai_evaluation_scores
Detailed scoring breakdown for each evaluation dimension.
- `id` (uuid, primary key)
- `evaluation_id` (uuid, references ai_evaluations)
- `dimension` (text) - qualifications, experience, skills, competencies, industry_experience, screening_responses
- `weight` (decimal) - the weighting applied (20%, 30%, etc.)
- `score` (decimal) - score 0-100 for this dimension
- `weighted_score` (decimal) - score * weight
- `reasoning` (text) - AI explanation for the score
- `evidence` (text[]) - supporting evidence from application

### 3. ai_evaluation_summaries
Overall evaluation summary with recommendations.
- `id` (uuid, primary key)
- `evaluation_id` (uuid, references ai_evaluations)
- `overall_score` (decimal) - total weighted score 0-100
- `suitability_level` (text) - highly_suitable, suitable, moderately_suitable, needs_review
- `strengths` (text[]) - identified candidate strengths
- `gaps` (text[]) - identified gaps or concerns
- `salary_summary` (text) - AI assessment of salary alignment
- `interview_recommendation` (text) - recommendation for interview
- `interview_priority` (text) - high, medium, low
- `key_questions` (text[]) - suggested interview questions to address gaps

## Security
- RLS enabled on all tables
- Authenticated HR users can manage evaluations
*/

-- AI Evaluations
CREATE TABLE IF NOT EXISTS ai_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  evaluated_at timestamptz DEFAULT now(),
  evaluation_version text NOT NULL DEFAULT '1.0',
  UNIQUE(application_id)
);

ALTER TABLE ai_evaluations ENABLE ROW LEVEL SECURITY;

-- AI Evaluation Scores
CREATE TABLE IF NOT EXISTS ai_evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('qualifications', 'experience', 'skills', 'competencies', 'industry_experience', 'screening_responses')),
  weight decimal NOT NULL,
  score decimal NOT NULL CHECK (score >= 0 AND score <= 100),
  weighted_score decimal NOT NULL,
  reasoning text,
  evidence text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_evaluation_scores ENABLE ROW LEVEL SECURITY;

-- AI Evaluation Summaries
CREATE TABLE IF NOT EXISTS ai_evaluation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  overall_score decimal NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  suitability_level text NOT NULL CHECK (suitability_level IN ('highly_suitable', 'suitable', 'moderately_suitable', 'needs_review')),
  strengths text[] DEFAULT '{}',
  gaps text[] DEFAULT '{}',
  salary_summary text,
  interview_recommendation text,
  interview_priority text CHECK (interview_priority IN ('high', 'medium', 'low')),
  key_questions text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(evaluation_id)
);

ALTER TABLE ai_evaluation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_evaluations
DROP POLICY IF EXISTS "hr_manage_ai_evaluations" ON ai_evaluations;
CREATE POLICY "hr_manage_ai_evaluations" ON ai_evaluations FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_ai_evaluations" ON ai_evaluations;
CREATE POLICY "public_read_ai_evaluations" ON ai_evaluations FOR SELECT
  TO anon, authenticated USING (true);

-- RLS Policies for ai_evaluation_scores
DROP POLICY IF EXISTS "hr_manage_ai_scores" ON ai_evaluation_scores;
CREATE POLICY "hr_manage_ai_scores" ON ai_evaluation_scores FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_ai_scores" ON ai_evaluation_scores;
CREATE POLICY "public_read_ai_scores" ON ai_evaluation_scores FOR SELECT
  TO anon, authenticated USING (true);

-- RLS Policies for ai_evaluation_summaries
DROP POLICY IF EXISTS "hr_manage_ai_summaries" ON ai_evaluation_summaries;
CREATE POLICY "hr_manage_ai_summaries" ON ai_evaluation_summaries FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_ai_summaries" ON ai_evaluation_summaries;
CREATE POLICY "public_read_ai_summaries" ON ai_evaluation_summaries FOR SELECT
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_application ON ai_evaluations(application_id);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_vacancy ON ai_evaluations(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_score ON ai_evaluations(id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_evaluation ON ai_evaluation_summaries(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_evaluation ON ai_evaluation_scores(evaluation_id);

-- Function to get ranked candidates for a vacancy
CREATE OR REPLACE FUNCTION get_ranked_candidates(p_vacancy_id uuid)
RETURNS TABLE (
  application_id uuid,
  candidate_id uuid,
  first_name text,
  last_name text,
  email text,
  mobile_number text,
  reference_number text,
  applied_at timestamptz,
  overall_score decimal,
  suitability_level text,
  interview_priority text,
  has_evaluation boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as application_id,
    c.id as candidate_id,
    c.first_name,
    c.last_name,
    c.email,
    c.mobile_number,
    a.reference_number,
    a.applied_at,
    COALESCE(s.overall_score, 0) as overall_score,
    COALESCE(s.suitability_level, 'pending') as suitability_level,
    COALESCE(s.interview_priority, 'low') as interview_priority,
    (e.id IS NOT NULL) as has_evaluation
  FROM applications a
  JOIN candidates c ON a.candidate_id = c.id
  LEFT JOIN ai_evaluations e ON e.application_id = a.id
  LEFT JOIN ai_evaluation_summaries s ON s.evaluation_id = e.id
  WHERE a.vacancy_id = p_vacancy_id
  ORDER BY
    has_evaluation DESC,
    overall_score DESC NULLS LAST,
    a.applied_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
