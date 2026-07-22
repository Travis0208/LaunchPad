import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserProfile = {
  id: string;
  full_name: string;
  role: 'administrator' | 'recruiter';
  phone: string | null;
  job_title: string | null;
  department: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanySettings = {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type NotificationPreferences = {
  user_id: string;
  new_application: boolean;
  interview_reminder: boolean;
  offer_response: boolean;
  weekly_report: boolean;
  pipeline_updates: boolean;
  video_assessments: boolean;
  updated_at: string;
};

export type Vacancy = {
  id: string;
  job_title: string;
  department: string;
  location: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'temporary';
  reporting_manager: string | null;
  number_of_vacancies: number;
  purpose_of_role: string | null;
  key_objectives: string[];
  qualifications: string | null;
  experience_required: string | null;
  skills_required: string[];
  competencies: string[];
  advert_start_date: string | null;
  advert_closing_date: string | null;
  status: 'draft' | 'published' | 'closed' | 'archived';
  video_assessment_trigger: 'not_required' | 'during_application' | 'after_ai_shortlisting';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ScreeningQuestion = {
  id: string;
  vacancy_id: string;
  question_text: string;
  question_type: 'yes_no' | 'multiple_choice' | 'numeric' | 'free_text';
  options: string[];
  is_mandatory: boolean;
  is_predefined: boolean;
  predefined_type: string | null;
  order_index: number;
  created_at: string;
};

export type VideoAssessmentQuestion = {
  id: string;
  vacancy_id: string;
  question_text: string;
  max_recording_duration: number;
  order_index: number;
  created_at: string;
};

export type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  cv_url: string | null;
  cv_filename: string | null;
  popia_consent: boolean;
  consent_date: string | null;
  created_at: string;
};

export type Application = {
  id: string;
  candidate_id: string;
  vacancy_id: string;
  reference_number: string;
  status: string;
  screening_score: number | null;
  ai_shortlist_score: number | null;
  applied_at: string;
  updated_at: string;
  candidate?: Candidate;
  vacancy?: Vacancy;
};

export type ScreeningResponse = {
  id: string;
  application_id: string;
  question_id: string;
  response_text: string | null;
  response_numeric: number | null;
  response_boolean: boolean | null;
  response_option: string | null;
  created_at: string;
};

export type VideoAssessment = {
  id: string;
  application_id: string;
  question_id: string;
  video_url: string | null;
  duration_seconds: number | null;
  status: 'pending' | 'submitted' | 'reviewed';
  reviewed_by: string | null;
  review_score: number | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

export type Interview = {
  id: string;
  application_id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  interview_type: 'in_person' | 'video' | 'phone' | 'teams' | 'zoom' | 'google_meet';
  location: string | null;
  meeting_url: string | null;
  video_link: string | null;
  interviewer_ids: string[];
  status: 'scheduled' | 'invitation_sent' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  organiser_email: string | null;
  teams_meeting_url: string | null;
  teams_meeting_id: string | null;
  calendar_event_id: string | null;
  invitation_sent_at: string | null;
  rsvp_token: string | null;
  rsvp_responded_at: string | null;
  rsvp_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSettings = {
  id: string;
  provider: 'smtp' | 'resend' | 'sendgrid' | 'mailgun';
  smtp_host: string | null;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string | null;
  smtp_password: string | null;
  from_email: string;
  from_name: string;
  reply_to: string | null;
  resend_api_key: string | null;
  sendgrid_api_key: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type Offer = {
  id: string;
  application_id: string;
  template_id: string | null;
  template_fields: Record<string, string>;
  offer_date: string;
  expiry_date: string | null;
  salary_offered: number | null;
  salary_currency: string;
  start_date: string | null;
  position_title: string;
  terms: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  email_subject: string | null;
  email_body: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  responded_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferTemplateField = {
  id: string;
  template_id: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'currency' | 'textarea';
  order_index: number;
};

export type OfferTemplate = {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  fields?: OfferTemplateField[];
};

export type RegretCommunication = {
  id: string;
  application_id: string;
  vacancy_id: string;
  candidate_id: string;
  sent_by: string | null;
  sent_by_name: string | null;
  subject: string;
  body: string;
  sent_at: string;
};

export type Communication = {
  id: string;
  application_id: string;
  type: 'email' | 'sms';
  subject: string | null;
  body: string | null;
  sent_at: string;
  sent_by: string | null;
  status: 'sent' | 'delivered' | 'failed';
};
