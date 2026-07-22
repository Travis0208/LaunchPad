/*
# Add Video Assessment Dimension to AI Evaluation

## Overview
This migration updates the dimension check constraint to include 'video_assessment' 
as a valid dimension for AI evaluation scores.
*/

ALTER TABLE ai_evaluation_scores 
DROP CONSTRAINT IF EXISTS ai_evaluation_scores_dimension_check;

ALTER TABLE ai_evaluation_scores 
ADD CONSTRAINT ai_evaluation_scores_dimension_check 
CHECK (dimension IN ('qualifications', 'experience', 'skills', 'competencies', 'industry_experience', 'screening_responses', 'video_assessment'));
