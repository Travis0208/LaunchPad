import { useState } from 'react';
import { useInterviews, useUpdateInterview, useCreateInterview, useApplications, useNotifications } from '../hooks';
import { useAuth } from '../hooks/useAuth';
import { Card, Badge, Button, Textarea, Modal, Spinner, EmptyState, StatCard } from './ui';
import {
  Calendar,
  Clock,
  MapPin,
  Monitor,
  Video,
  Phone,
  Plus,
  Check,
  Mail,
  ExternalLink,
  CheckCircle,
  Send,
  Link,
} from 'lucide-react';
import { formatDateTime, formatDate, formatTime } from '../utils';
import { INTERVIEW_DURATION_OPTIONS } from '../utils/constants';
import { supabase } from '../lib/supabase';
import type { Interview } from '../lib/supabase';

// ─── Interview type config (no auto-creation — all links are manual) ──────────

const VIDEO_TYPES = new Set(['teams', 'zoom', 'google_meet', 'video']);

const INTERVIEW_TYPES_CONFIG = [
  { value: 'teams',       label: 'Microsoft Teams', icon: Monitor, description: 'Paste a Teams link'      },
  { value: 'zoom',        label: 'Zoom',            icon: Video,   description: 'Paste a Zoom link'       },
  { value: 'google_meet', label: 'Google Meet',     icon: Video,   description: 'Paste a Meet link'       },
  { value: 'video',       label: 'Video (other)',   icon: Video,   description: 'Any video platform'      },
  { value: 'in_person',   label: 'In Person',       icon: MapPin,  description: 'Physical location'       },
  { value: 'phone',       label: 'Phone Call',      icon: Phone,   description: 'Telephone interview'     },
];

function typeLabel(t: string): string {
  return INTERVIEW_TYPES_CONFIG.find(c => c.value === t)?.label ?? t;
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cfg = INTERVIEW_TYPES_CONFIG.find(c => c.value === type);
  const Icon = cfg?.icon ?? Calendar;
  return <Icon className={className} />;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function resolveMeetingUrl(interview: InterviewWithDetails): string | null {
  return interview.meeting_url ?? interview.teams_meeting_url ?? null;
}

const STATUS_STYLE: Record<string, string> = {
  scheduled:       'bg-blue-100 text-blue-700 border-blue-200',
  invitation_sent: 'bg-orange-100 text-orange-700 border-orange-200',
  accepted:        'bg-green-100 text-green-700 border-green-200',
  declined:        'bg-red-100 text-red-700 border-red-200',
  completed:       'bg-gray-100 text-gray-600 border-gray-200',
  cancelled:       'bg-gray-100 text-gray-400 border-gray-200',
  no_show:         'bg-red-100 text-red-600 border-red-200',
};

type InterviewWithDetails = Interview & {
  application: any;
  rsvp_token?: string | null;
  invitation_sent_at?: string | null;
  rsvp_responded_at?: string | null;
  rsvp_message?: string | null;
};

const INTERVIEW_STATUS_TABS = [
  { value: 'scheduled',       label: 'Scheduled' },
  { value: 'invitation_sent', label: 'Invited' },
  { value: 'accepted',        label: 'Accepted' },
  { value: 'declined',        label: 'Declined' },
  { value: 'completed',       label: 'Completed' },
  { value: 'all',             label: 'All' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function InterviewsPage() {
  const [statusFilter, setStatusFilter] = useState('scheduled');
  const [showModal, setShowModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<InterviewWithDetails | null>(null);

  const { data: interviews, isLoading } = useInterviews(statusFilter === 'all' ? undefined : statusFilter);
  const updateInterview = useUpdateInterview();
  const { success, error } = useNotifications();

  const all = (interviews ?? []) as InterviewWithDetails[];
  const stats = {
    scheduled:       all.filter(i => i.status === 'scheduled').length,
    invitation_sent: all.filter(i => i.status === 'invitation_sent').length,
    accepted:        all.filter(i => i.status === 'accepted').length,
    completed:       all.filter(i => i.status === 'completed').length,
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
          <p className="text-gray-600 mt-1">Schedule and manage candidate interviews</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
          Schedule Interview
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Calendar}    label="Scheduled" value={stats.scheduled}       color="blue" />
        <StatCard icon={Mail}        label="Invited"   value={stats.invitation_sent} color="orange" />
        <StatCard icon={CheckCircle} label="Accepted"  value={stats.accepted}        color="green" />
        <StatCard icon={Check}       label="Completed" value={stats.completed}       color="purple" />
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {INTERVIEW_STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!all.length ? (
        <EmptyState
          icon={Calendar}
          title="No interviews found"
          description="Schedule an interview to get started"
          action={<Button onClick={() => setShowModal(true)}>Schedule Interview</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {all.map(interview => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onView={() => setSelectedInterview(interview)}
              onComplete={async () => {
                try {
                  await updateInterview.mutateAsync({ id: interview.id, data: { status: 'completed' } as any });
                  success('Interview completed');
                } catch { error('Failed to update'); }
              }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ScheduleInterviewModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); success('Interview scheduled'); }}
        />
      )}

      {selectedInterview && (
        <InterviewDetailModal
          interview={selectedInterview}
          onClose={() => setSelectedInterview(null)}
          onUpdated={() => setSelectedInterview(null)}
        />
      )}
    </div>
  );
}

// ─── Interview Card ────────────────────────────────────────────────────────────

function InterviewCard({ interview, onView, onComplete }: {
  interview: InterviewWithDetails;
  onView: () => void;
  onComplete: () => void;
}) {
  const meetingUrl = resolveMeetingUrl(interview);

  return (
    <Card hover onClick={onView}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-primary-700 font-semibold text-sm">
              {interview.application?.candidate?.first_name?.charAt(0) ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 text-sm">
                {interview.application?.candidate?.first_name} {interview.application?.candidate?.last_name}
              </p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[interview.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {interview.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{interview.application?.vacancy?.job_title}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <TypeIcon type={interview.interview_type} className="w-4 h-4" />
            {typeLabel(interview.interview_type)}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {interview.scheduled_at ? formatDate(interview.scheduled_at) : '—'}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {interview.scheduled_at ? formatTime(interview.scheduled_at) : '—'}
          </span>
          <span className="text-gray-400">{interview.duration_minutes} min</span>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {interview.status === 'accepted' && (
            <Button size="sm" onClick={onComplete}>
              <Check className="w-3.5 h-3.5 mr-1" /> Complete
            </Button>
          )}
          {meetingUrl && (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Join
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────

function ScheduleInterviewModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const createInterview = useCreateInterview();
  const { error } = useNotifications();
  const { data: applications } = useApplications({ includeCandidate: true });
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    application_id:   '',
    date:             '',
    time:             '09:00',
    duration_minutes: 60,
    interview_type:   'teams',
    location:         '',
    meeting_url:      '',
    organiser_email:  '',
    notes:            '',
  });

  const selectedApp = (applications ?? []).find((a: any) => a.id === form.application_id);
  const isVideo = VIDEO_TYPES.has(form.interview_type);

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (sendNow: boolean) => {
    if (!form.application_id || !form.date) {
      error('Please select a candidate and date');
      return;
    }
    setSaving(true);
    try {
      const interview = await createInterview.mutateAsync({
        application_id:   form.application_id,
        scheduled_at:     `${form.date}T${form.time}:00`,
        duration_minutes: form.duration_minutes,
        interview_type:   form.interview_type as any,
        location:         form.location || null,
        meeting_url:      form.meeting_url || null,
        organiser_email:  form.organiser_email || null,
        notes:            form.notes || null,
        status:           'scheduled',
        created_by:       user?.id ?? null,
      } as any);

      if (sendNow && interview?.id) {
        const { error: fnErr } = await supabase.functions.invoke('send-interview-invitation', {
          body: { interview_id: interview.id },
        });
        if (fnErr) console.warn('Invitation send failed:', fnErr.message);
      }
      onSuccess();
    } catch (err: any) {
      error(err?.message ?? 'Failed to schedule interview');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Schedule Interview" size="lg">
      <div className="space-y-5">
        {/* Candidate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Candidate <span className="text-red-500">*</span>
          </label>
          <select
            value={form.application_id}
            onChange={setField('application_id')}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
          >
            <option value="">Select candidate…</option>
            {(applications ?? []).map((app: any) => (
              <option key={app.id} value={app.id}>
                {app.candidate?.first_name} {app.candidate?.last_name} — {app.vacancy?.job_title}
              </option>
            ))}
          </select>
          {selectedApp && (
            <p className="text-xs text-gray-400 mt-1">
              {(selectedApp as any).candidate?.email} · {(selectedApp as any).reference_number}
            </p>
          )}
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={setField('date')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
            <input
              type="time"
              value={form.time}
              onChange={setField('time')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        {/* Interview type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Interview Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INTERVIEW_TYPES_CONFIG.map(type => {
              const Icon = type.icon;
              const selected = form.interview_type === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, interview_type: type.value }))}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                    selected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-primary-600' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-xs leading-tight">{type.label}</p>
                    <p className="text-xs text-gray-400 leading-tight mt-0.5 truncate">{type.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Meeting link — shown for all video types */}
        {isVideo && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5" /> Meeting Link
            </label>
            <input
              type="url"
              value={form.meeting_url}
              onChange={setField('meeting_url')}
              placeholder={
                form.interview_type === 'teams'       ? 'https://teams.microsoft.com/l/meetup-join/…' :
                form.interview_type === 'zoom'        ? 'https://zoom.us/j/…' :
                form.interview_type === 'google_meet' ? 'https://meet.google.com/…' :
                'https://…'
              }
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Paste the meeting link — it will be included in the invitation email.</p>
          </div>
        )}

        {/* Physical location */}
        {form.interview_type === 'in_person' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={setField('location')}
              placeholder="e.g. Head Office — 3rd Floor, Boardroom A"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        )}

        {/* Duration + Organiser */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
            <select
              value={form.duration_minutes}
              onChange={e => setForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              {INTERVIEW_DURATION_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organiser Email</label>
            <input
              type="email"
              value={form.organiser_email}
              onChange={setField('organiser_email')}
              placeholder="recruitment@company.co.za"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={setField('notes')}
            placeholder="Preparation notes, panel members, topics…"
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button variant="outline" onClick={() => handleSubmit(false)} loading={saving} className="flex-1">
          Save Draft
        </Button>
        <Button onClick={() => handleSubmit(true)} loading={saving} icon={<Send className="w-4 h-4" />} className="flex-1">
          Schedule & Send
        </Button>
      </div>
    </Modal>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────

function InterviewDetailModal({ interview, onClose, onUpdated }: {
  interview: InterviewWithDetails;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [notes, setNotes] = useState(interview.notes ?? '');
  const updateInterview = useUpdateInterview();
  const { success, error } = useNotifications();
  const [sending, setSending] = useState(false);

  const meetingUrl = resolveMeetingUrl(interview);
  const isVideo    = VIDEO_TYPES.has(interview.interview_type);

  const handleSendNow = async () => {
    setSending(true);
    try {
      await supabase.functions.invoke('send-interview-invitation', {
        body: { interview_id: interview.id },
      });
      success('Invitation sent');
      onUpdated();
    } catch (err: any) {
      error(err?.message ?? 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateInterview.mutateAsync({ id: interview.id, data: { notes } as any });
      success('Notes saved');
      onClose();
    } catch { error('Failed to save notes'); }
  };

  const handleComplete = async () => {
    try {
      await updateInterview.mutateAsync({ id: interview.id, data: { status: 'completed' } as any });
      success('Interview completed');
      onUpdated();
    } catch { error('Failed to update'); }
  };

  const rsvpUrl = interview.rsvp_token
    ? `${window.location.origin}/interview-rsvp/${interview.rsvp_token}`
    : null;

  const statusStyle: Record<string, string> = {
    scheduled:       'bg-blue-100 text-blue-700',
    invitation_sent: 'bg-orange-100 text-orange-700',
    accepted:        'bg-green-100 text-green-700',
    declined:        'bg-red-100 text-red-700',
    completed:       'bg-gray-100 text-gray-700',
    no_show:         'bg-red-100 text-red-600',
  };

  return (
    <Modal open onClose={onClose} title="Interview Details" size="lg">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Candidate */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-bold text-lg">
              {interview.application?.candidate?.first_name?.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">
              {interview.application?.candidate?.first_name} {interview.application?.candidate?.last_name}
            </p>
            <p className="text-sm text-gray-500">{interview.application?.candidate?.email}</p>
            <p className="text-sm text-gray-500">{interview.application?.vacancy?.job_title}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusStyle[interview.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {interview.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Date',     value: interview.scheduled_at ? formatDate(interview.scheduled_at) : '—' },
            { label: 'Time',     value: interview.scheduled_at ? formatTime(interview.scheduled_at) : '—' },
            { label: 'Duration', value: `${interview.duration_minutes} minutes` },
            { label: 'Format',   value: typeLabel(interview.interview_type) },
          ].map(item => (
            <div key={item.label} className="p-3 bg-white border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Meeting link (any video type) */}
        {isVideo && meetingUrl && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <TypeIcon type={interview.interview_type} className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{typeLabel(interview.interview_type)} Meeting</p>
              <p className="text-xs text-blue-600 truncate">{meetingUrl}</p>
            </div>
            <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* In-person location */}
        {interview.location && interview.interview_type === 'in_person' && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Location</p>
              <p className="text-sm text-gray-600">{interview.location}</p>
            </div>
          </div>
        )}

        {/* RSVP tracking */}
        <div className="p-4 rounded-xl border border-gray-200 space-y-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Invitation & RSVP
          </p>
          <div className="space-y-2">
            <RsvpRow icon={<Send className="w-3.5 h-3.5" />}        label="Invitation sent"    value={interview.invitation_sent_at ? formatDateTime(interview.invitation_sent_at) : null} pending="Not sent yet" active={!!interview.invitation_sent_at} />
            <RsvpRow icon={<CheckCircle className="w-3.5 h-3.5" />} label="Candidate accepted" value={interview.status === 'accepted' && interview.rsvp_responded_at ? formatDateTime(interview.rsvp_responded_at) : null} pending={interview.status === 'accepted' ? undefined : 'Awaiting'} active={interview.status === 'accepted'} positive />
            <RsvpRow icon={<Check className="w-3.5 h-3.5" />}       label="Candidate declined" value={interview.status === 'declined' && interview.rsvp_responded_at ? formatDateTime(interview.rsvp_responded_at) : null} pending={interview.status === 'declined' ? undefined : '—'} active={interview.status === 'declined'} negative />
            <RsvpRow icon={<Check className="w-3.5 h-3.5" />}       label="Interview completed" value={interview.status === 'completed' ? 'Yes' : null} pending="Pending" active={interview.status === 'completed'} positive />
          </div>
          {interview.rsvp_message && (
            <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 italic">
              "{interview.rsvp_message}"
            </div>
          )}
          {rsvpUrl && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 truncate flex-1">{rsvpUrl}</span>
              <button
                onClick={() => navigator.clipboard.writeText(rsvpUrl!)}
                className="text-xs text-primary-600 hover:text-primary-700 whitespace-nowrap font-medium"
              >
                Copy link
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Interview notes, panel members, preparation topics…"
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {['scheduled', 'invitation_sent'].includes(interview.status) && (
          <Button variant="outline" onClick={handleSendNow} loading={sending} icon={<Send className="w-4 h-4" />}>
            {interview.status === 'invitation_sent' ? 'Resend' : 'Send Invitation'}
          </Button>
        )}
        {interview.status === 'accepted' && (
          <Button onClick={handleComplete} icon={<Check className="w-4 h-4" />}>
            Mark Completed
          </Button>
        )}
        <Button onClick={handleSaveNotes} className="ml-auto">Save Notes</Button>
      </div>
    </Modal>
  );
}

function RsvpRow({ icon, label, value, pending, active, positive, negative }: {
  icon: React.ReactNode; label: string; value: string | null;
  pending?: string; active?: boolean; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`flex items-center gap-1.5 ${active ? (positive ? 'text-green-700' : negative ? 'text-red-600' : 'text-primary-700') : 'text-gray-400'}`}>
        {icon}{label}
      </span>
      <span className={`text-xs font-medium ${value ? (positive ? 'text-green-600' : negative ? 'text-red-600' : 'text-gray-700') : 'text-gray-400'}`}>
        {value ?? pending ?? '—'}
      </span>
    </div>
  );
}
