import type { BadgeVariant } from '../components/ui/Badge';

// ─── Generic status→variant lookup ────────────────────────────────────────────

function statusVariant(
  map: Record<string, BadgeVariant>,
  status: string,
  fallback: BadgeVariant = 'gray'
): BadgeVariant {
  return map[status] ?? fallback;
}

// ─── Per-entity maps ───────────────────────────────────────────────────────────

const APPLICATION_VARIANTS: Record<string, BadgeVariant> = {
  applied:             'gray',
  screening:           'primary',
  shortlisted:         'success',
  video_pending:       'warning',
  video_completed:     'primary',
  interview_scheduled: 'primary',
  interview_completed: 'primary',
  offer_pending:       'warning',
  offer_sent:          'primary',
  offer_accepted:      'success',
  offer_declined:      'danger',
  rejected:            'danger',
  withdrawn:           'gray',
};

const VACANCY_VARIANTS: Record<string, BadgeVariant> = {
  draft:     'gray',
  published: 'success',
  closed:    'danger',
  archived:  'warning',
};

const OFFER_VARIANTS: Record<string, BadgeVariant> = {
  draft:     'gray',
  pending:   'warning',
  sent:      'primary',
  accepted:  'success',
  declined:  'danger',
  expired:   'gray',
  withdrawn: 'gray',
};

const INTERVIEW_VARIANTS: Record<string, BadgeVariant> = {
  scheduled:       'primary',
  invitation_sent: 'warning',
  accepted:        'success',
  declined:        'danger',
  completed:       'success',
  cancelled:       'gray',
  no_show:         'danger',
};

// ─── Public helpers ────────────────────────────────────────────────────────────

export function getApplicationStatusVariant(status: string): BadgeVariant {
  return statusVariant(APPLICATION_VARIANTS, status);
}
export function getVacancyStatusVariant(status: string): BadgeVariant {
  return statusVariant(VACANCY_VARIANTS, status);
}
export function getOfferStatusVariant(status: string): BadgeVariant {
  return statusVariant(OFFER_VARIANTS, status);
}
export function getInterviewStatusVariant(status: string): BadgeVariant {
  return statusVariant(INTERVIEW_VARIANTS, status);
}
