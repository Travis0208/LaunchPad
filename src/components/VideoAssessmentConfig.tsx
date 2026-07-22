import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVacancy, useVideoConfig, useVideoSessions, useVideoQuestions, useCreateVideoConfig, useCreateVideoSessions, useRankedCandidates, useNotifications } from '../hooks';
import { Card, CardHeader, CardBody, Badge, Button, Input, Select, Modal, Spinner, EmptyState, StatCard } from './ui';
import { Video, Users, Clock, Mail, Check, AlertTriangle, ExternalLink, Upload, RefreshCw, Brain } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils';
import { VIDEO_SELECTION_OPTIONS } from '../utils/constants';
import { getVideoSessionUrl } from '../lib/videoAssessment';

export function VideoAssessmentConfig() {
  const { id: vacancyId } = useParams();
  const navigate = useNavigate();
  const { success, error } = useNotifications();

  const { data: vacancy, isLoading: vacancyLoading } = useVacancy(vacancyId || '');
  const { data: config, isLoading: configLoading } = useVideoConfig(vacancyId || '');
  const { data: sessions, isLoading: sessionsLoading } = useVideoSessions(vacancyId || '');
  const { data: questions } = useVideoQuestions(vacancyId || '');
  const { data: rankedCandidates } = useRankedCandidates(vacancyId || '');

  const [selectionType, setSelectionType] = useState<'top_5' | 'top_10' | 'top_15' | 'custom'>('top_10');
  const [customNumber, setCustomNumber] = useState(10);
  const [expiryDays, setExpiryDays] = useState(7);
  const [reminderDays, setReminderDays] = useState(2);
  const [showInvitations, setShowInvitations] = useState(false);

  const createConfig = useCreateVideoConfig();
  const createSessions = useCreateVideoSessions();

  useEffect(() => {
    if (config) {
      setSelectionType(config.selection_type);
      setCustomNumber(config.custom_number || 10);
      setExpiryDays(config.expiry_days);
      setReminderDays(config.reminder_days);
    }
  }, [config]);

  if (vacancyLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <EmptyState
        icon={Video}
        title="Vacancy not found"
        action={<Button onClick={() => navigate('/vacancies')}>Back to Vacancies</Button>}
      />
    );
  }

  const handleSaveConfig = async () => {
    try {
      await createConfig.mutateAsync({
        vacancyId: vacancyId!,
        config: {
          selection_type: selectionType,
          custom_number: selectionType === 'custom' ? customNumber : undefined,
          expiry_days: expiryDays,
          reminder_days: reminderDays,
        },
      });
      success('Configuration saved');
    } catch (err) {
      error('Failed to save configuration');
    }
  };

  const handleSendInvitations = async () => {
    try {
      const result = await createSessions.mutateAsync(vacancyId!);
      success(`Sent ${result?.length || 0} video assessment invitations`);
      setShowInvitations(false);
    } catch (err) {
      error('Failed to send invitations');
    }
  };

  const getSelectionCount = () => {
    switch (selectionType) {
      case 'top_5': return 5;
      case 'top_10': return 10;
      case 'top_15': return 15;
      case 'custom': return customNumber;
      default: return 10;
    }
  };

  const stats = {
    totalCandidates: rankedCandidates?.filter((c: any) => c.has_evaluation).length || 0,
    selectedCount: getSelectionCount(),
    invited: sessions?.filter((s: any) => s.status === 'invitation_sent').length || 0,
    completed: sessions?.filter((s: any) => s.status === 'completed').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Assessment Setup</h1>
          <p className="text-gray-600 mt-1">Configure video assessments for {vacancy.job_title}</p>
        </div>
      </div>

      {vacancy.video_assessment_trigger !== 'after_ai_shortlisting' || !questions?.length ? (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Video Assessment Not Configured</h3>
              <p className="text-gray-600 mb-4">
                {vacancy.video_assessment_trigger !== 'after_ai_shortlisting'
                  ? 'This vacancy is not configured for video assessments after AI shortlisting.'
                  : 'No video questions have been added to this vacancy.'}
              </p>
              <Button onClick={() => navigate(`/vacancies/${vacancyId}/edit`)}>
                Configure Vacancy
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Evaluated Candidates" value={stats.totalCandidates} color="blue" />
            <StatCard icon={Brain} label="To Be Selected" value={stats.selectedCount} color="purple" />
            <StatCard icon={Mail} label="Invitations Sent" value={stats.invited} color="orange" />
            <StatCard icon={Check} label="Completed" value={stats.completed} color="green" />
          </div>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Selection Configuration</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Top Candidates
                  </label>
                  <select
                    value={selectionType}
                    onChange={(e) => setSelectionType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {VIDEO_SELECTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {selectionType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Candidates
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={customNumber}
                      onChange={(e) => setCustomNumber(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link Expiry Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Days Before
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={reminderDays}
                    onChange={(e) => setReminderDays(parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button onClick={handleSaveConfig} loading={createConfig.isPending}>
                  Save Configuration
                </Button>
              </div>
            </CardBody>
          </Card>

          {sessions?.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Video Assessment Sessions</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowInvitations(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Send More Invitations
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invited</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sessions.map((session: any) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-700 font-semibold">
                                {session.candidate?.first_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {session.candidate?.first_name} {session.candidate?.last_name}
                              </p>
                              <p className="text-sm text-gray-500">{session.candidate?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              session.status === 'completed' ? 'success' :
                              session.status === 'started' ? 'warning' :
                              session.status === 'expired' ? 'danger' : 'gray'
                            }
                          >
                            {session.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateTime(session.invited_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDateTime(session.expires_at)}
                        </td>
                        <td className="px-6 py-4">
                          <SessionProgress session={session} questions={questions || []} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const url = getVideoSessionUrl(
                                  vacancyId!,
                                  session.candidate_id,
                                  session.secure_token
                                );
                                setTimeout(() => {
                                  navigator.clipboard.writeText(url);
                                  success('Link copied to clipboard');
                                }, 100);
                              }}
                            >
                              Copy Link
                            </Button>
                            {session.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/video-review/${session.id}`)}
                              >
                                Review
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <Video className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Yet</h3>
                  <p className="text-gray-500 mb-4">
                    {stats.totalCandidates > 0
                      ? `AI evaluation complete for ${stats.totalCandidates} candidates. Send video invitations now.`
                      : 'Run AI evaluation first to rank candidates.'}
                  </p>
                  {stats.totalCandidates > 0 && (
                    <Button onClick={() => setShowInvitations(true)}>
                      Send Video Invitations
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      <Modal open={showInvitations} onClose={() => setShowInvitations(false)} title="Send Video Invitations">
        <div className="space-y-4">
          <p className="text-gray-600">
            This will send video assessment invitations to the top {getSelectionCount()} candidates
            based on AI evaluation scores. Links will expire in {expiryDays} days.
          </p>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              Only candidates without existing video sessions will receive invitations.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowInvitations(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSendInvitations} loading={createSessions.isPending} className="flex-1">
            Send Invitations
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SessionProgress({ session, questions }: { session: any; questions: any[] }) {
  const [responses, setResponses] = useState(0);
  const total = questions.length;

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('video_responses')
        .select('id')
        .eq('session_id', session.id)
        .not('video_url', 'is', null);
      setResponses(data?.length || 0);
    };
    fetch();
  }, [session.id]);

  if (session.status === 'invitation_sent') return <span className="text-gray-500">Not started</span>;
  if (session.status === 'expired') return <span className="text-red-600">Expired</span>;

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full"
          style={{ width: `${(responses / total) * 100}%` }}
        />
      </div>
      <span className="text-sm text-gray-600">{responses}/{total}</span>
    </div>
  );
}

export default VideoAssessmentConfig;
