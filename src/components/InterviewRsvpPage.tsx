import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Spinner } from './ui';
import {
  Calendar,
  Clock,
  MapPin,
  Monitor,
  Video,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface InterviewRsvpData {
  interview_id: string;
  interview_type: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  teams_meeting_url: string | null;
  status: string;
  job_title: string;
  department: string;
  first_name: string;
  last_name: string;
  organiser_email: string | null;
}

function resolveMeetingUrl(data: InterviewRsvpData): string | null {
  return data.meeting_url ?? data.teams_meeting_url ?? null;
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    teams: 'Microsoft Teams', zoom: 'Zoom', google_meet: 'Google Meet',
    video: 'Video Call', phone: 'Phone Call', in_person: 'In Person',
  };
  return map[t] ?? t;
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'in_person') return <MapPin className={className} />;
  if (type === 'phone')     return <Phone className={className} />;
  if (type === 'teams')     return <Monitor className={className} />;
  return <Video className={className} />;
}

type PageState = 'loading' | 'ready' | 'submitting' | 'accepted' | 'declined' | 'already_responded' | 'invalid';

export function InterviewRsvpPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [interview, setInterview] = useState<InterviewRsvpData | null>(null);
  const [message, setMessage] = useState('');

  const searchParams = new URLSearchParams(window.location.search);
  const preResponse  = searchParams.get('response');

  useEffect(() => {
    const load = async () => {
      if (!token) { setPageState('invalid'); return; }

      const { data, error } = await supabase.rpc('get_interview_by_rsvp_token', { p_token: token });
      if (error || !data?.length) { setPageState('invalid'); return; }

      const record = data[0] as InterviewRsvpData;
      setInterview(record);

      if (['accepted', 'declined', 'completed', 'cancelled'].includes(record.status)) {
        setPageState('already_responded');
      } else if (preResponse === 'accepted') {
        handleRespond('accepted', record);
      } else {
        setPageState('ready');
      }
    };
    load();
  }, [token]);

  const handleRespond = async (response: 'accepted' | 'declined', _data?: InterviewRsvpData) => {
    if (!token) return;
    setPageState('submitting');

    const { data: result, error } = await supabase.rpc('process_interview_rsvp', {
      p_token:   token,
      p_status:  response,
      p_message: message || null,
    });

    if (error || !result?.ok) { setPageState('invalid'); return; }
    setPageState(response === 'accepted' ? 'accepted' : 'declined');
  };

  if (pageState === 'loading') return <FullScreenLayout><Spinner size="lg" /></FullScreenLayout>;

  if (pageState === 'invalid') {
    return (
      <FullScreenLayout>
        <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Invalid or Expired Link</h2>
        <p className="text-gray-600 mt-2">This interview RSVP link is not valid or has already expired.</p>
      </FullScreenLayout>
    );
  }

  if (pageState === 'accepted') {
    const meetingUrl = interview ? resolveMeetingUrl(interview) : null;
    return (
      <FullScreenLayout>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Interview Accepted</h2>
        <p className="text-gray-600 mt-2">You have confirmed your attendance. We look forward to seeing you!</p>
        {meetingUrl && (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-5 h-5" /> Join Meeting
          </a>
        )}
      </FullScreenLayout>
    );
  }

  if (pageState === 'declined') {
    return (
      <FullScreenLayout>
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Interview Declined</h2>
        <p className="text-gray-600 mt-2">Thank you for letting us know. We will be in touch regarding next steps.</p>
      </FullScreenLayout>
    );
  }

  if (pageState === 'already_responded') {
    const isAccepted = interview?.status === 'accepted';
    const meetingUrl = interview ? resolveMeetingUrl(interview) : null;
    return (
      <FullScreenLayout>
        {isAccepted
          ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          : <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
        <h2 className="text-xl font-bold text-gray-900">Already Responded</h2>
        <p className="text-gray-600 mt-2">You have already {interview?.status} this interview invitation.</p>
        {isAccepted && meetingUrl && (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-5 h-5" /> Join Meeting
          </a>
        )}
      </FullScreenLayout>
    );
  }

  if (!interview) return null;

  const meetingUrl = resolveMeetingUrl(interview);
  const isVideo    = !['in_person', 'phone'].includes(interview.interview_type);

  const startDt = new Date(interview.scheduled_at);
  const dateStr = startDt.toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
  const timeStr = startDt.toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg',
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-primary-700 to-dark-800 px-4 py-6 text-center">
        <h1 className="text-white text-xl font-bold">LaunchPad Recruit</h1>
        <p className="text-white/70 text-sm mt-1">Interview Invitation</p>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Greeting */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Dear {interview.first_name},</h2>
            <p className="text-gray-600">
              You have been invited to interview for the{' '}
              <strong>{interview.job_title}</strong> position at{' '}
              <strong>{interview.department}</strong>.
            </p>
          </div>

          {/* Interview details */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Interview Details</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <DetailRow icon={<Calendar className="w-4 h-4 text-gray-400" />} label="Date"     value={dateStr} />
              <DetailRow icon={<Clock    className="w-4 h-4 text-gray-400" />} label="Time"     value={`${timeStr} (SAST)`} />
              <DetailRow icon={<Clock    className="w-4 h-4 text-gray-400" />} label="Duration" value={`${interview.duration_minutes} minutes`} />
              <DetailRow
                icon={<TypeIcon type={interview.interview_type} className="w-4 h-4 text-gray-400" />}
                label="Format"
                value={typeLabel(interview.interview_type)}
              />
              {interview.location && !isVideo && (
                <DetailRow icon={<MapPin className="w-4 h-4 text-gray-400" />} label="Location" value={interview.location} />
              )}
            </div>
          </div>

          {/* Meeting link (video types) */}
          {isVideo && meetingUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
              <TypeIcon type={interview.interview_type} className="w-8 h-8 text-blue-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Meeting Link</p>
                <p className="text-xs text-gray-500 mt-0.5">Click to join at the time of your interview</p>
              </div>
              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Join Meeting
              </a>
            </div>
          )}

          {/* RSVP form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Please confirm your attendance</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                Message (optional — e.g. reason for declining or special requirements)
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a message…"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={pageState === 'submitting'}
                onClick={() => handleRespond('accepted')}
                className="flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" /> Accept
              </button>
              <button
                disabled={pageState === 'submitting'}
                onClick={() => handleRespond('declined')}
                className="flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" /> Decline
              </button>
            </div>
            {pageState === 'submitting' && <div className="flex justify-center"><Spinner size="sm" /></div>}
          </div>

          {interview.organiser_email && (
            <p className="text-center text-xs text-gray-500">
              Questions? Contact{' '}
              <a href={`mailto:${interview.organiser_email}`} className="text-primary-600 hover:underline">
                {interview.organiser_email}
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function FullScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3.5">
      <div className="flex-shrink-0">{icon}</div>
      <span className="text-sm text-gray-500 w-20">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
