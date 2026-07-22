export const APP_NAME    = 'LaunchPad Recruit';
export const COMPANY_NAME = 'LaunchPad';
export const PLATFORM_NAME = 'LaunchPad';

// ─── AI Evaluation Thresholds ─────────────────────────────────────────────────
// Centralised so scoring logic and UI display stay in sync.
export const AI_SCORE = {
  HIGHLY_SUITABLE:    75,
  SUITABLE:           60,
  MODERATELY_SUITABLE:40,
  INTERVIEW_PRIORITY_HIGH: 70,
  STRENGTH_THRESHOLD: 75,
  GAP_THRESHOLD:      50,
  QUESTION_THRESHOLD: 70,
} as const;

// ─── Query defaults ────────────────────────────────────────────────────────────
export const STALE_TIMES = {
  STATIC:  10 * 60_000,   // rarely-changing data (vacancies, templates)
  NORMAL:   2 * 60_000,   // typical lookups
  LIVE:        30_000,    // pipeline boards, real-time states
} as const;

// ─── Pagination ───────────────────────────────────────────────────────────────
export const PAGE_SIZE = 25;

export const EMPLOYMENT_TYPES = [
  { value: 'full_time',  label: 'Full Time' },
  { value: 'part_time',  label: 'Part Time' },
  { value: 'contract',   label: 'Contract' },
  { value: 'temporary',  label: 'Temporary' },
] as const;

export const VACANCY_STATUSES = [
  { value: 'draft',     label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'closed',    label: 'Closed' },
  { value: 'archived',  label: 'Archived' },
] as const;

export const APPLICATION_STATUSES = [
  { value: 'applied',             label: 'Applied' },
  { value: 'screening',           label: 'Screening' },
  { value: 'shortlisted',         label: 'Shortlisted' },
  { value: 'video_pending',       label: 'Video Pending' },
  { value: 'video_completed',     label: 'Video Completed' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'interview_completed', label: 'Interview Completed' },
  { value: 'offer_pending',       label: 'Offer Pending' },
  { value: 'offer_sent',          label: 'Offer Sent' },
  { value: 'offer_accepted',      label: 'Offer Accepted' },
  { value: 'offer_declined',      label: 'Offer Declined' },
  { value: 'rejected',            label: 'Rejected' },
  { value: 'withdrawn',           label: 'Withdrawn' },
] as const;

/** Interview types. Video types require a manually entered meeting link. */
export const INTERVIEW_TYPES = [
  { value: 'teams',       label: 'Microsoft Teams' },
  { value: 'zoom',        label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'video',       label: 'Video Call (other)' },
  { value: 'in_person',   label: 'In Person' },
  { value: 'phone',       label: 'Phone Call' },
] as const;

/** All interview statuses including RSVP flow. */
export const INTERVIEW_STATUSES = [
  { value: 'scheduled',       label: 'Scheduled' },
  { value: 'invitation_sent', label: 'Invited' },
  { value: 'accepted',        label: 'Accepted' },
  { value: 'declined',        label: 'Declined' },
  { value: 'completed',       label: 'Completed' },
  { value: 'cancelled',       label: 'Cancelled' },
  { value: 'no_show',         label: 'No Show' },
] as const;

export const OFFER_STATUSES = [
  { value: 'draft',     label: 'Draft' },
  { value: 'sent',      label: 'Sent' },
  { value: 'accepted',  label: 'Accepted' },
  { value: 'declined',  label: 'Declined' },
  { value: 'expired',   label: 'Expired' },
  { value: 'withdrawn', label: 'Withdrawn' },
] as const;

export const VIDEO_ASSESSMENT_TRIGGERS = [
  {
    value: 'not_required',
    label: 'Not Required',
    description: 'No video assessment for this vacancy',
  },
  {
    value: 'during_application',
    label: 'During Application',
    description: 'Candidates record video as part of application',
  },
  {
    value: 'after_ai_shortlisting',
    label: 'After AI Shortlisting',
    description: 'Only shortlisted candidates complete video assessment',
  },
] as const;

export const VIDEO_SELECTION_OPTIONS = [
  { value: 'top_5',   label: 'Top 5 Candidates' },
  { value: 'top_10',  label: 'Top 10 Candidates' },
  { value: 'top_15',  label: 'Top 15 Candidates' },
  { value: 'custom',  label: 'Custom Number' },
] as const;

export const QUESTION_TYPES = [
  { value: 'yes_no',          label: 'Yes/No' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'numeric',         label: 'Numeric' },
  { value: 'free_text',       label: 'Free Text' },
] as const;

export const DURATION_OPTIONS = [
  { value: 30,  label: '30 seconds' },
  { value: 60,  label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 180, label: '3 minutes' },
  { value: 300, label: '5 minutes' },
] as const;

export const INTERVIEW_DURATION_OPTIONS = [
  { value: 30,  label: '30 minutes' },
  { value: 45,  label: '45 minutes' },
  { value: 60,  label: '1 hour' },
  { value: 90,  label: '1.5 hours' },
  { value: 120, label: '2 hours' },
] as const;

export const POPIA_DECLARATION =
  'In terms of the Protection of Personal Information Act (POPIA), I consent to the processing and ' +
  'storage of my personal information for recruitment and selection purposes. I understand that my ' +
  'information will be handled in accordance with applicable data protection laws and will only be ' +
  'used for the purposes of assessing my suitability for employment.';
