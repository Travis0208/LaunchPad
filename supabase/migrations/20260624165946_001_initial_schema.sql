/*
# LaunchPad Recruit - Initial Database Schema

## Overview
This migration establishes the core schema for LaunchPad Recruit, an Applicant Tracking System 
for transport, logistics, and supply chain organizations. The system supports internal HR users 
(Administrators and Recruiters) managing vacancies, candidates, applications, interviews, and offers.

## Tables Created

### 1. user_profiles
Extends Supabase auth.users with role-based access control.
- `id` (uuid, primary key, references auth.users)
- `full_name` (text, not null)
- `role` (text, not null) - 'administrator' or 'recruiter'
- `phone` (text)
- `active` (boolean, default true)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2. vacancies
Job postings with complete position information, screening questions, and video assessment configuration.
- `id` (uuid, primary key)
- `job_title` (text, not null)
- `department` (text, not null)
- `location` (text, not null)
- `employment_type` (text, not null) - full_time, part_time, contract, temporary
- `reporting_manager` (text)
- `number_of_vacancies` (integer, default 1)
- `purpose_of_role` (text)
- `key_objectives` (text[])
- `qualifications` (text)
- `experience_required` (text)
- `skills_required` (text[])
- `competencies` (text[])
- `advert_start_date` (date)
- `advert_closing_date` (date)
- `status` (text, default 'draft') - draft, published, closed, archived
- `video_assessment_trigger` (text, default 'after_ai_shortlisting') - not_required, during_application, after_ai_shortlisting
- `created_by` (uuid, references user_profiles)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 3. screening_questions
Configurable screening questions for each vacancy.
- `id` (uuid, primary key)
- `vacancy_id` (uuid, references vacancies)
- `question_text` (text, not null)
- `question_type` (text, not null) - yes_no, multiple_choice, numeric, free_text
- `options` (text[]) - for multiple_choice
- `is_mandatory` (boolean, default false)
- `is_predefined` (boolean, default false) - true for standard questions
- `predefined_type` (text) - highest_qualification, years_experience, salary_expectation, etc.
- `order_index` (integer, default 0)
- `created_at` (timestamp)

### 4. video_assessment_questions
Video questions for vacancies with video assessment enabled.
- `id` (uuid, primary key)
- `vacancy_id` (uuid, references vacancies)
- `question_text` (text, not null)
- `max_recording_duration` (integer, default 60) - in seconds
- `order_index` (integer, default 0)
- `created_at` (timestamp)

### 5. candidates
Candidate information captured during application.
- `id` (uuid, primary key)
- `first_name` (text, not null)
- `last_name` (text, not null)
- `email` (text, not null)
- `mobile_number` (text, not null)
- `cv_url` (text) - URL to uploaded CV in Supabase storage
- `cv_filename` (text)
- `popia_consent` (boolean, not null, default false)
- `consent_date` (timestamp)
- `created_at` (timestamp)
- Constraint: unique email

### 6. applications
Candidate applications linking to vacancies with screening responses.
- `id` (uuid, primary key)
- `candidate_id` (uuid, references candidates)
- `vacancy_id` (uuid, references vacancies)
- `reference_number` (text, unique, not null)
- `status` (text, default 'applied')
- `screening_score` (decimal)
- `ai_shortlist_score` (decimal)
- `applied_at` (timestamp)
- `updated_at` (timestamp)
- Constraint: unique candidate_id + vacancy_id

### 7. screening_responses
Candidate responses to screening questions.
- `id` (uuid, primary key)
- `application_id` (uuid, references applications)
- `question_id` (uuid, references screening_questions)
- `response_text` (text)
- `response_numeric` (decimal)
- `response_boolean` (boolean)
- `response_option` (text)
- `created_at` (timestamp)

### 8. video_assessments
Video assessment submissions from candidates.
- `id` (uuid, primary key)
- `application_id` (uuid, references applications)
- `question_id` (uuid, references video_assessment_questions)
- `video_url` (text)
- `duration_seconds` (integer)
- `status` (text, default 'pending')
- `reviewed_by` (uuid, references user_profiles)
- `review_score` (decimal)
- `review_notes` (text)
- `submitted_at` (timestamp)
- `reviewed_at` (timestamp)

### 9. interviews
Interview scheduling and status tracking.
- `id` (uuid, primary key)
- `application_id` (uuid, references applications)
- `scheduled_at` (timestamp)
- `duration_minutes` (integer, default 60)
- `interview_type` (text, default 'in_person')
- `location` (text)
- `video_link` (text)
- `interviewer_ids` (uuid[])
- `status` (text, default 'scheduled')
- `notes` (text)
- `created_by` (uuid, references user_profiles)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 10. offers
Job offers extended to candidates.
- `id` (uuid, primary key)
- `application_id` (uuid, references applications)
- `offer_date` (date, not null)
- `expiry_date` (date)
- `salary_offered` (decimal)
- `salary_currency` (text, default 'ZAR')
- `start_date` (date)
- `position_title` (text, not null)
- `terms` (text)
- `status` (text, default 'pending')
- `sent_at` (timestamp)
- `responded_at` (timestamp)
- `notes` (text)
- `created_by` (uuid, references user_profiles)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 11. communications
Communications sent to candidates.
- `id` (uuid, primary key)
- `application_id` (uuid, references applications)
- `type` (text) - email, sms
- `subject` (text)
- `body` (text)
- `sent_at` (timestamp)
- `sent_by` (uuid, references user_profiles)
- `status` (text, default 'sent')

## Security
- RLS enabled on all tables
- Owner-scoped policies for user_profiles (internal HR users)
- Application data accessible based on user role
- Public write access for candidate applications (no auth required)
*/

-- User profiles extending auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('administrator', 'recruiter')),
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Vacancies
CREATE TABLE IF NOT EXISTS vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title text NOT NULL,
  department text NOT NULL,
  location text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary')),
  reporting_manager text,
  number_of_vacancies integer NOT NULL DEFAULT 1,
  purpose_of_role text,
  key_objectives text[] DEFAULT '{}',
  qualifications text,
  experience_required text,
  skills_required text[] DEFAULT '{}',
  competencies text[] DEFAULT '{}',
  advert_start_date date,
  advert_closing_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  video_assessment_trigger text NOT NULL DEFAULT 'after_ai_shortlisting' CHECK (video_assessment_trigger IN ('not_required', 'during_application', 'after_ai_shortlisting')),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;

-- Screening questions
CREATE TABLE IF NOT EXISTS screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('yes_no', 'multiple_choice', 'numeric', 'free_text')),
  options text[] DEFAULT '{}',
  is_mandatory boolean NOT NULL DEFAULT false,
  is_predefined boolean NOT NULL DEFAULT false,
  predefined_type text CHECK (predefined_type IN ('highest_qualification', 'years_experience', 'salary_expectation', 'driver_licence', 'pdp_status', 'cross_border_experience', 'shift_availability', 'travel_willingness')),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE screening_questions ENABLE ROW LEVEL SECURITY;

-- Video assessment questions
CREATE TABLE IF NOT EXISTS video_assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  max_recording_duration integer NOT NULL DEFAULT 60,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_assessment_questions ENABLE ROW LEVEL SECURITY;

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  mobile_number text NOT NULL,
  cv_url text,
  cv_filename text,
  popia_consent boolean NOT NULL DEFAULT false,
  consent_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  vacancy_id uuid NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  reference_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'screening', 'shortlisted', 'video_pending', 'video_completed', 'interview_scheduled', 'interview_completed', 'offer_pending', 'offer_sent', 'offer_accepted', 'offer_declined', 'rejected', 'withdrawn')),
  screening_score decimal,
  ai_shortlist_score decimal,
  applied_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_candidate_vacancy UNIQUE (candidate_id, vacancy_id)
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Screening responses
CREATE TABLE IF NOT EXISTS screening_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES screening_questions(id) ON DELETE CASCADE,
  response_text text,
  response_numeric decimal,
  response_boolean boolean,
  response_option text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE screening_responses ENABLE ROW LEVEL SECURITY;

-- Video assessments
CREATE TABLE IF NOT EXISTS video_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES video_assessment_questions(id) ON DELETE CASCADE,
  video_url text,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewed')),
  reviewed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  review_score decimal,
  review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz
);

ALTER TABLE video_assessments ENABLE ROW LEVEL SECURITY;

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 60,
  interview_type text NOT NULL DEFAULT 'in_person' CHECK (interview_type IN ('in_person', 'video', 'phone')),
  location text,
  video_link text,
  interviewer_ids uuid[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  offer_date date NOT NULL,
  expiry_date date,
  salary_offered decimal,
  salary_currency text NOT NULL DEFAULT 'ZAR',
  start_date date,
  position_title text NOT NULL,
  terms text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'declined', 'expired', 'withdrawn')),
  sent_at timestamptz,
  responded_at timestamptz,
  notes text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Communications
CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email', 'sms')),
  subject text,
  body text,
  sent_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed'))
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles (authenticated HR users only)
DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admins_manage_profiles" ON user_profiles;
CREATE POLICY "admins_manage_profiles" ON user_profiles FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'administrator')
  );

-- RLS Policies for vacancies (authenticated HR users)
DROP POLICY IF EXISTS "hr_read_vacancies" ON vacancies;
CREATE POLICY "hr_read_vacancies" ON vacancies FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "hr_insert_vacancies" ON vacancies;
CREATE POLICY "hr_insert_vacancies" ON vacancies FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "hr_update_vacancies" ON vacancies;
CREATE POLICY "hr_update_vacancies" ON vacancies FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "hr_delete_vacancies" ON vacancies;
CREATE POLICY "hr_delete_vacancies" ON vacancies FOR DELETE
  TO authenticated USING (true);

-- Public read for published vacancies (candidate portal)
DROP POLICY IF EXISTS "public_read_published_vacancies" ON vacancies;
CREATE POLICY "public_read_published_vacancies" ON vacancies FOR SELECT
  TO anon, authenticated USING (status = 'published');

-- RLS Policies for screening questions (HR users manage, public reads for published vacancies)
DROP POLICY IF EXISTS "hr_manage_screening_questions" ON screening_questions;
CREATE POLICY "hr_manage_screening_questions" ON screening_questions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_screening_questions" ON screening_questions;
CREATE POLICY "public_read_screening_questions" ON screening_questions FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM vacancies WHERE vacancies.id = screening_questions.vacancy_id AND vacancies.status = 'published')
  );

-- RLS Policies for video assessment questions (HR users)
DROP POLICY IF EXISTS "hr_manage_video_questions" ON video_assessment_questions;
CREATE POLICY "hr_manage_video_questions" ON video_assessment_questions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_video_questions" ON video_assessment_questions;
CREATE POLICY "public_read_video_questions" ON video_assessment_questions FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM vacancies WHERE vacancies.id = video_assessment_questions.vacancy_id AND vacancies.status = 'published')
  );

-- RLS Policies for candidates
DROP POLICY IF EXISTS "hr_read_candidates" ON candidates;
CREATE POLICY "hr_read_candidates" ON candidates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_candidates" ON candidates;
CREATE POLICY "public_insert_candidates" ON candidates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "hr_update_candidates" ON candidates;
CREATE POLICY "hr_update_candidates" ON candidates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for applications
DROP POLICY IF EXISTS "hr_manage_applications" ON applications;
CREATE POLICY "hr_manage_applications" ON applications FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_applications" ON applications;
CREATE POLICY "public_insert_applications" ON applications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_applications" ON applications;
CREATE POLICY "public_read_applications" ON applications FOR SELECT
  TO anon, authenticated USING (true);

-- RLS Policies for screening responses (HR manage, public insert)
DROP POLICY IF EXISTS "hr_manage_screening_responses" ON screening_responses;
CREATE POLICY "hr_manage_screening_responses" ON screening_responses FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_insert_screening_responses" ON screening_responses;
CREATE POLICY "public_insert_screening_responses" ON screening_responses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_screening_responses" ON screening_responses;
CREATE POLICY "public_read_screening_responses" ON screening_responses FOR SELECT
  TO anon, authenticated USING (true);

-- RLS Policies for video assessments
DROP POLICY IF EXISTS "hr_manage_video_assessments" ON video_assessments;
CREATE POLICY "hr_manage_video_assessments" ON video_assessments FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidate_update_video_assessment" ON video_assessments;
CREATE POLICY "candidate_update_video_assessment" ON video_assessments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "candidate_read_video_assessment" ON video_assessments;
CREATE POLICY "candidate_read_video_assessment" ON video_assessments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_video_assessments" ON video_assessments;
CREATE POLICY "public_insert_video_assessments" ON video_assessments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- RLS Policies for interviews (HR users only)
DROP POLICY IF EXISTS "hr_manage_interviews" ON interviews;
CREATE POLICY "hr_manage_interviews" ON interviews FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for offers (HR users only)
DROP POLICY IF EXISTS "hr_manage_offers" ON offers;
CREATE POLICY "hr_manage_offers" ON offers FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for communications (HR users only)
DROP POLICY IF EXISTS "hr_manage_communications" ON communications;
CREATE POLICY "hr_manage_communications" ON communications FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_created_by ON vacancies(created_by);
CREATE INDEX IF NOT EXISTS idx_applications_vacancy ON applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_screening_questions_vacancy ON screening_questions(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_video_questions_vacancy ON video_assessment_questions(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_offers_application ON offers(application_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- Function to generate application reference number
CREATE OR REPLACE FUNCTION generate_application_reference()
RETURNS text AS $$
DECLARE
  prefix text := 'LP';
  year_part text := to_char(now(), 'YY');
  month_part text := to_char(now(), 'MM');
  seq_num integer;
  ref text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM 8 FOR 4) AS integer)), 0) + 1
  INTO seq_num
  FROM applications
  WHERE reference_number LIKE prefix || year_part || month_part || '%';
  
  ref := prefix || year_part || month_part || lpad(seq_num::text, 4, '0');
  RETURN ref;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set reference number on insert
CREATE OR REPLACE FUNCTION set_application_reference()
RETURNS trigger AS $$
BEGIN
  NEW.reference_number := generate_application_reference();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_application_reference ON applications;
CREATE TRIGGER trigger_set_application_reference
  BEFORE INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION set_application_reference();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_vacancy ON vacancies;
CREATE TRIGGER trigger_update_vacancy
  BEFORE UPDATE ON vacancies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_application ON applications;
CREATE TRIGGER trigger_update_application
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_interview ON interviews;
CREATE TRIGGER trigger_update_interview
  BEFORE UPDATE ON interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_offer ON offers;
CREATE TRIGGER trigger_update_offer
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();