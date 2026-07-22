import { useState, useMemo } from 'react';
import { useApplications, useVacancies, useNotifications } from '../hooks';
import { useAuth } from '../hooks/useAuth';
import { useRegretLogs, useSendBulkRegret } from '../hooks/useRegret';
import { Card, CardHeader, CardBody, Badge, Button, Modal, Spinner, EmptyState, StatCard } from './ui';
import {
  Search,
  Users,
  Send,
  CheckSquare,
  Square,
  XCircle,
  CheckCircle,
  MailX,
  Filter,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../utils';

const DEFAULT_SUBJECT = 'Thank you for your application – [position_title]';
const DEFAULT_BODY = `Dear [candidate_name],

Thank you sincerely for taking the time to apply for the [position_title] position at LaunchPad Recruit and for your interest in joining our team.

After careful consideration of all applications received, we regret to inform you that we will not be progressing with your application at this time. This was a difficult decision given the high calibre of candidates who applied.

We appreciate the effort you put into your application and encourage you to apply for future opportunities that match your skills and experience.

We wish you every success in your career search.

Kind regards,
The Recruitment Team
LaunchPad Recruit`;

function renderMessage(template: string, fields: Record<string, string>): string {
  return template.replace(/\[([^\]]+)\]/g, (_, key) => fields[key] ?? `[${key}]`);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type PageTab = 'send' | 'log';

export function RegretPage() {
  const [tab, setTab] = useState<PageTab>('send');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regret Communications</h1>
          <p className="text-gray-600 mt-1">Send regret emails to unsuccessful candidates</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['send', 'Send Regrets'], ['log', 'Communication Log']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {key === 'send' ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {label}
          </button>
        ))}
      </div>

      {tab === 'send' ? <SendRegretView /> : <RegretLogView />}
    </div>
  );
}

// ─── Send Regret View ──────────────────────────────────────────────────────────

function SendRegretView() {
  const { profile } = useAuth();
  const { data: applications, isLoading: appsLoading } = useApplications({ includeCandidate: true });
  const { data: vacancies } = useVacancies();
  const sendBulkRegret = useSendBulkRegret();
  const { success, error } = useNotifications();

  const [search, setSearch] = useState('');
  const [vacancyFilter, setVacancyFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);

  // Exclude already-regretted and hired
  const eligible = useMemo(() => {
    return ((applications as any[]) ?? []).filter((a: any) =>
      a.pipeline_stage !== 'regret' && a.pipeline_stage !== 'hired'
    );
  }, [applications]);

  const filtered = useMemo(() => {
    return eligible.filter((a: any) => {
      const matchSearch = !search ||
        `${a.candidate?.first_name} ${a.candidate?.last_name} ${a.candidate?.email} ${a.reference_number}`
          .toLowerCase().includes(search.toLowerCase());
      const matchVacancy = vacancyFilter === 'all' || a.vacancy_id === vacancyFilter;
      const matchStage = stageFilter === 'all' || a.pipeline_stage === stageFilter;
      return matchSearch && matchVacancy && matchStage;
    });
  }, [eligible, search, vacancyFilter, stageFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((a: any) => selected.has(a.id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach((a: any) => next.delete(a.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach((a: any) => next.add(a.id));
        return next;
      });
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedApps = (applications as any[] ?? []).filter((a: any) => selected.has(a.id));

  // Unique stages present in eligible
  const stages = useMemo(() => {
    const s = new Set(eligible.map((a: any) => a.pipeline_stage as string));
    return Array.from(s).sort();
  }, [eligible]);

  if (appsLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users}        label="Eligible Candidates" value={eligible.length}   color="blue" />
        <StatCard icon={CheckSquare}  label="Selected"            value={selected.size}      color="orange" />
        <StatCard icon={MailX}        label="Not Yet Regretted"   value={eligible.length}    color="red" />
      </div>

      <Card>
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, reference…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={vacancyFilter}
              onChange={e => setVacancyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Vacancies</option>
              {((vacancies as any[]) ?? []).map((v: any) => (
                <option key={v.id} value={v.id}>{v.job_title}</option>
              ))}
            </select>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Stages</option>
              {stages.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <p className="text-sm font-medium text-red-800">
                {selected.size} candidate{selected.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  icon={<Send className="w-3.5 h-3.5" />}
                  onClick={() => setShowCompose(true)}
                  className="!bg-red-600 hover:!bg-red-700 text-white"
                >
                  Send Regret to {selected.size}
                </Button>
              </div>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No eligible candidates"
            description="All candidates have already been regretted or hired"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                      {allVisibleSelected
                        ? <CheckSquare className="w-4 h-4 text-primary-600" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vacancy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((app: any) => {
                  const isSelected = selected.has(app.id);
                  return (
                    <tr
                      key={app.id}
                      onClick={() => toggle(app.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggle(app.id); }}>
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-primary-600" />
                          : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-red-100' : 'bg-primary-100'
                          }`}>
                            <span className={`font-semibold text-sm ${isSelected ? 'text-red-700' : 'text-primary-700'}`}>
                              {app.candidate?.first_name?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {app.candidate?.first_name} {app.candidate?.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{app.candidate?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">{app.vacancy?.job_title}</p>
                        <p className="text-xs text-gray-500">{app.vacancy?.department}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {(app.pipeline_stage ?? 'applied').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatRelativeTime(app.applied_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCompose && (
        <ComposeRegretModal
          selectedApps={selectedApps}
          onClose={() => setShowCompose(false)}
          onSent={(count) => {
            setShowCompose(false);
            setSelected(new Set());
            success(`Regret communication sent to ${count} candidate${count !== 1 ? 's' : ''}`);
          }}
          sentBy={profile?.id}
          sentByName={profile?.full_name}
        />
      )}
    </>
  );
}

// ─── Compose Regret Modal ──────────────────────────────────────────────────────

function ComposeRegretModal({
  selectedApps,
  onClose,
  onSent,
  sentBy,
  sentByName,
}: {
  selectedApps: any[];
  onClose: () => void;
  onSent: (count: number) => void;
  sentBy?: string;
  sentByName?: string;
}) {
  const sendBulkRegret = useSendBulkRegret();
  const { error } = useNotifications();

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [previewApp, setPreviewApp] = useState<any | null>(selectedApps[0] ?? null);
  const [showPreview, setShowPreview] = useState(false);
  const [results, setResults] = useState<{ application_id: string; success: boolean; error_msg: string | null }[] | null>(null);

  const getPreviewFields = (app: any) => ({
    candidate_name: `${app?.candidate?.first_name ?? ''} ${app?.candidate?.last_name ?? ''}`.trim(),
    position_title: app?.vacancy?.job_title ?? '',
    company_name: 'LaunchPad Recruit',
  });

  const handleSend = async () => {
    try {
      const res = await sendBulkRegret.mutateAsync({
        applicationIds: selectedApps.map(a => a.id),
        subject,
        body,
        sentBy,
        sentByName,
      });
      setResults(res);
      const successCount = res.filter(r => r.success).length;
      if (successCount > 0) onSent(successCount);
    } catch {
      error('Failed to send regret communications');
    }
  };

  // Results screen
  if (results) {
    const succeeded = results.filter(r => r.success);
    const failed    = results.filter(r => !r.success);
    return (
      <Modal open onClose={onClose} title="Regret Communications Sent" size="md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">{succeeded.length} sent successfully</p>
              <p className="text-sm text-green-700">Candidates moved to Regret stage</p>
            </div>
          </div>
          {failed.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">{failed.length} failed</p>
                <ul className="text-xs text-red-700 mt-1 space-y-0.5">
                  {failed.map(f => (
                    <li key={f.application_id}>{f.error_msg ?? 'Unknown error'}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Compose Regret Communication" size="xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Recipients summary */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Sending to {selectedApps.length} candidate{selectedApps.length !== 1 ? 's' : ''}:
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {selectedApps.map(a => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white border border-gray-200 text-gray-700"
              >
                <span className="w-4 h-4 rounded-full bg-primary-100 inline-flex items-center justify-center text-primary-700 font-bold text-[9px]">
                  {a.candidate?.first_name?.charAt(0)}
                </span>
                {a.candidate?.first_name} {a.candidate?.last_name}
                <span className="text-gray-400">· {a.vacancy?.job_title}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Placeholder hint */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Available placeholders:</strong>{' '}
            <code className="bg-blue-100 px-1 rounded">[candidate_name]</code>{' '}
            <code className="bg-blue-100 px-1 rounded">[position_title]</code>{' '}
            — these are replaced per candidate when previewing.
          </p>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Message Body</label>
            {selectedApps.length > 0 && (
              <button
                onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            )}
          </div>
          {showPreview ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Preview candidate selector */}
              {selectedApps.length > 1 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs text-gray-500">Preview for:</span>
                  <select
                    value={previewApp?.id ?? ''}
                    onChange={e => setPreviewApp(selectedApps.find(a => a.id === e.target.value) ?? null)}
                    className="text-xs border-0 bg-transparent focus:outline-none text-gray-700 font-medium"
                  >
                    {selectedApps.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.candidate?.first_name} {a.candidate?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="p-4 text-sm text-gray-800 whitespace-pre-wrap bg-white leading-relaxed">
                {renderMessage(body, getPreviewFields(previewApp))}
              </div>
            </div>
          ) : (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y font-mono"
            />
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button
          onClick={handleSend}
          loading={sendBulkRegret.isPending}
          className="flex-1 !bg-red-600 hover:!bg-red-700 text-white"
          icon={<Send className="w-4 h-4" />}
        >
          Send to {selectedApps.length} Candidate{selectedApps.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Regret Log View ───────────────────────────────────────────────────────────

function RegretLogView() {
  const { data: vacancies } = useVacancies();
  const [vacancyFilter, setVacancyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs, isLoading } = useRegretLogs(
    vacancyFilter !== 'all' ? { vacancyId: vacancyFilter } : undefined
  );

  const filtered = useMemo(() => {
    if (!search) return logs ?? [];
    const q = search.toLowerCase();
    return (logs ?? []).filter(l =>
      `${l.candidate?.first_name} ${l.candidate?.last_name} ${l.candidate?.email} ${l.vacancy?.job_title}`
        .toLowerCase().includes(q)
    );
  }, [logs, search]);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by candidate or position…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={vacancyFilter}
          onChange={e => setVacancyFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Vacancies</option>
          {((vacancies as any[]) ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>{v.job_title}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={MailX}
          title="No regret communications yet"
          description="Regret emails you send will appear here for tracking"
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Communication Log</h2>
              <span className="text-sm text-gray-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {filtered.map(log => {
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-red-700 font-semibold text-sm">
                          {log.candidate?.first_name?.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {log.candidate?.first_name} {log.candidate?.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{log.candidate?.email}</p>
                      </div>
                    </div>

                    <div className="hidden sm:block flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{log.vacancy?.job_title}</p>
                      <p className="text-xs text-gray-500">{log.vacancy?.department}</p>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-gray-500">{formatDate(log.sent_at)}</p>
                      {log.sent_by_name && (
                        <p className="text-xs text-gray-400 mt-0.5">by {log.sent_by_name}</p>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 ml-12 space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
                        <p className="text-sm text-gray-800">{log.subject}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Message</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{log.body}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
