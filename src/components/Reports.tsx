import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardBody, Button, StatCard, Spinner, EmptyState } from './ui';
import {
  Download,
  FileText,
  Briefcase,
  Users,
  Clock,
  Brain,
  Video,
  Calendar,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart2,
  PieChart,
  Printer,
  FileSpreadsheet,
  MailX,
  Filter,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Metrics {
  active_vacancies: number;
  total_applications: number;
  avg_time_to_fill_days: number | null;
  ai_shortlist_total: number;
  ai_shortlisted_count: number;
  video_sessions_sent: number;
  video_sessions_completed: number;
  interviews_held: number;
  offers_created: number;
  offers_sent: number;
  offers_accepted: number;
  offers_declined: number;
  regrets_sent: number;
  applications_per_vacancy: { vacancy_id: string; job_title: string; department: string; vacancy_status: string; application_count: number }[];
  pipeline_stage_breakdown: { stage: string; count: number }[];
  applications_by_month: { month: string; count: number }[];
  applications_by_department: { department: string; count: number }[];
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

function useRecruitmentMetrics(start: string, end: string) {
  return useQuery({
    queryKey: ['recruitmentMetrics', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recruitment_metrics', {
        p_start_date: start,
        p_end_date: end,
      });
      if (error) throw error;
      return data as Metrics;
    },
    staleTime: 2 * 60_000,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pct(num: number, denom: number): string {
  if (!denom) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

function pctNum(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

const STAGE_LABELS: Record<string, string> = {
  applied:                    'Applied',
  ai_ranked:                  'AI Ranked',
  video_assessment_sent:      'Video Sent',
  video_assessment_completed: 'Video Completed',
  interview_invited:          'Interview Invited',
  interview_confirmed:        'Interview Confirmed',
  offer_issued:               'Offer Issued',
  offer_accepted:             'Offer Accepted',
  hired:                      'Hired',
  regret:                     'Regret',
};

const STAGE_COLORS: Record<string, string> = {
  applied:                    'bg-gray-400',
  ai_ranked:                  'bg-purple-500',
  video_assessment_sent:      'bg-blue-500',
  video_assessment_completed: 'bg-teal-500',
  interview_invited:          'bg-orange-500',
  interview_confirmed:        'bg-amber-500',
  offer_issued:               'bg-lime-500',
  offer_accepted:             'bg-green-500',
  hired:                      'bg-emerald-600',
  regret:                     'bg-red-500',
};

const DEPT_COLORS = [
  'bg-blue-500', 'bg-orange-500', 'bg-teal-500', 'bg-purple-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500',
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [start, setStart] = useState(
    new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [end, setEnd] = useState(new Date().toISOString().split('T')[0]);
  const [pendingStart, setPendingStart] = useState(start);
  const [pendingEnd, setPendingEnd] = useState(end);

  const { data: metrics, isLoading, refetch } = useRecruitmentMetrics(start, end);

  const applyFilter = () => { setStart(pendingStart); setEnd(pendingEnd); };

  const handleExcelExport = useCallback(() => {
    if (!metrics) return;
    exportToCSV(metrics, start, end);
  }, [metrics, start, end]);

  const handlePdfPrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruitment Analytics</h1>
          <p className="text-gray-600 mt-1">Transport &amp; Logistics workforce insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={handleExcelExport}
            disabled={!metrics}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePdfPrint}
          >
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block border-b-2 border-blue-700 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-700">LaunchPad Recruit</h1>
            <p className="text-gray-500 text-sm">Transport &amp; Logistics Recruitment Analytics</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Period: {start} to {end}</p>
            <p>Generated: {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Date filter */}
      <Card className="print:hidden">
        <CardBody>
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={pendingStart}
                onChange={e => setPendingStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={pendingEnd}
                onChange={e => setPendingEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2">
              {(['1M','3M','6M','12M'] as const).map(label => {
                const months = { '1M':1,'3M':3,'6M':6,'12M':12 }[label];
                return (
                  <button
                    key={label}
                    onClick={() => {
                      const s = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      const e2 = new Date().toISOString().split('T')[0];
                      setPendingStart(s); setPendingEnd(e2);
                      setStart(s); setEnd(e2);
                    }}
                    className="px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {label}
                  </button>
                );
              })}
              <Button icon={<Filter className="w-4 h-4" />} onClick={applyFilter}>
                Apply
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : !metrics ? (
        <EmptyState icon={BarChart2} title="No data available" description="Adjust the date range and try again" />
      ) : (
        <MetricsDashboard metrics={metrics} />
      )}
    </div>
  );
}

// ─── Metrics Dashboard ─────────────────────────────────────────────────────────

function MetricsDashboard({ metrics }: { metrics: Metrics }) {
  const aiConvRate   = pctNum(metrics.ai_shortlisted_count, metrics.ai_shortlist_total);
  const videoCompRate = pctNum(metrics.video_sessions_completed, metrics.video_sessions_sent);
  const interviewOfferRate = pctNum(metrics.offers_created, metrics.interviews_held);
  const offerAcceptRate = pctNum(metrics.offers_accepted, metrics.offers_sent);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Briefcase}    label="Active Vacancies"      value={metrics.active_vacancies}               color="blue" />
        <StatCard icon={Users}        label="Applications"          value={metrics.total_applications}             color="green" />
        <StatCard icon={Clock}        label="Avg. Days to Fill"     value={metrics.avg_time_to_fill_days ?? '—'}   color="orange" />
        <StatCard icon={MailX}        label="Regrets Sent"          value={metrics.regrets_sent}                   color="red" />
      </div>

      {/* Conversion funnel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Recruitment Funnel</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FunnelStep
              icon={<Brain className="w-5 h-5 text-purple-600" />}
              label="AI Shortlist Conversion"
              value={`${aiConvRate}%`}
              sub={`${metrics.ai_shortlisted_count} of ${metrics.ai_shortlist_total}`}
              color="purple"
              pct={aiConvRate}
            />
            <FunnelStep
              icon={<Video className="w-5 h-5 text-blue-600" />}
              label="Video Completion Rate"
              value={`${videoCompRate}%`}
              sub={`${metrics.video_sessions_completed} of ${metrics.video_sessions_sent}`}
              color="blue"
              pct={videoCompRate}
            />
            <FunnelStep
              icon={<Calendar className="w-5 h-5 text-orange-600" />}
              label="Interview-to-Offer Ratio"
              value={`${interviewOfferRate}%`}
              sub={`${metrics.offers_created} offers from ${metrics.interviews_held} interviews`}
              color="orange"
              pct={interviewOfferRate}
            />
            <FunnelStep
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
              label="Offer Acceptance Rate"
              value={`${offerAcceptRate}%`}
              sub={`${metrics.offers_accepted} accepted · ${metrics.offers_declined} declined`}
              color="green"
              pct={offerAcceptRate}
            />
          </div>
        </CardBody>
      </Card>

      {/* Middle row: trends + pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application trends */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Application Trends</h2>
            </div>
          </CardHeader>
          <CardBody>
            <BarChart data={metrics.applications_by_month} labelKey="month" valueKey="count" color="bg-blue-500" />
          </CardBody>
        </Card>

        {/* Pipeline stage breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Pipeline Stage Breakdown</h2>
            </div>
          </CardHeader>
          <CardBody>
            <HorizontalBarChart
              data={(metrics.pipeline_stage_breakdown ?? []).map(d => ({
                label: STAGE_LABELS[d.stage] ?? d.stage,
                value: d.count,
                colorClass: STAGE_COLORS[d.stage] ?? 'bg-gray-400',
              }))}
            />
          </CardBody>
        </Card>
      </div>

      {/* Bottom row: per vacancy + departments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications per vacancy */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-600" />
              <h2 className="font-semibold text-gray-900">Applications per Vacancy</h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {!metrics.applications_per_vacancy?.length ? (
              <p className="text-sm text-gray-400 text-center py-8">No vacancy data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Dept</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Apps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.applications_per_vacancy.map(v => (
                      <tr key={v.vacancy_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900 truncate max-w-[160px]">{v.job_title}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{v.department}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            v.vacancy_status === 'published' ? 'bg-green-100 text-green-700' :
                            v.vacancy_status === 'closed'    ? 'bg-gray-100 text-gray-600' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {v.vacancy_status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-bold text-gray-900">{v.application_count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Source of hire / department */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-900">Applications by Department</h2>
            </div>
          </CardHeader>
          <CardBody>
            <HorizontalBarChart
              data={(metrics.applications_by_department ?? []).map((d, i) => ({
                label: d.department,
                value: d.count,
                colorClass: DEPT_COLORS[i % DEPT_COLORS.length],
              }))}
            />
          </CardBody>
        </Card>
      </div>

      {/* Offer detail row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile
          icon={<FileText className="w-5 h-5 text-lime-600" />}
          label="Offers Created"
          value={metrics.offers_created}
          sub="in period"
          bg="bg-lime-50"
          border="border-lime-200"
        />
        <MetricTile
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Accepted"
          value={metrics.offers_accepted}
          sub={pct(metrics.offers_accepted, metrics.offers_sent) + ' acceptance rate'}
          bg="bg-green-50"
          border="border-green-200"
        />
        <MetricTile
          icon={<TrendingDown className="w-5 h-5 text-red-600" />}
          label="Declined"
          value={metrics.offers_declined}
          sub={pct(metrics.offers_declined, metrics.offers_sent) + ' decline rate'}
          bg="bg-red-50"
          border="border-red-200"
        />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FunnelStep({
  icon, label, value, sub, color, pct,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'purple' | 'blue' | 'orange' | 'green';
  pct: number;
}) {
  const trackColors: Record<string, string> = {
    purple: 'bg-purple-500',
    blue:   'bg-blue-500',
    orange: 'bg-orange-500',
    green:  'bg-green-500',
  };
  const bgColors: Record<string, string> = {
    purple: 'bg-purple-50 border-purple-200',
    blue:   'bg-blue-50 border-blue-200',
    orange: 'bg-orange-50 border-orange-200',
    green:  'bg-green-50 border-green-200',
  };

  return (
    <div className={`p-4 rounded-xl border ${bgColors[color]} flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-medium text-gray-600 leading-tight">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <div>
        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden mb-1">
          <div className={`h-full rounded-full ${trackColors[color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  );
}

function MetricTile({
  icon, label, value, sub, bg, border,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  bg: string;
  border: string;
}) {
  return (
    <div className={`p-5 rounded-xl border ${bg} ${border} flex items-center gap-4`}>
      <div className="w-11 h-11 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function BarChart({
  data,
  labelKey,
  valueKey,
  color,
}: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color: string;
}) {
  if (!data?.length) return <p className="text-sm text-gray-400 text-center py-8">No data</p>;
  const max = Math.max(...data.map(d => d[valueKey] as number), 1);

  return (
    <div className="h-48 flex items-end gap-1.5">
      {data.map((d, i) => {
        const h = ((d[valueKey] as number) / max) * 100;
        const label = String(d[labelKey]).length === 7
          ? new Date(d[labelKey] + '-01').toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
          : String(d[labelKey]);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {d[valueKey]}
            </div>
            <div
              className={`w-full ${color} rounded-t-md transition-all`}
              style={{ height: `${Math.max(h, 4)}%` }}
            />
            <p className="text-[10px] text-gray-400 truncate w-full text-center">{label}</p>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBarChart({ data }: { data: { label: string; value: number; colorClass: string }[] }) {
  if (!data?.length) return <p className="text-sm text-gray-400 text-center py-8">No data</p>;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 truncate max-w-[200px]">{d.label}</span>
            <span className="text-sm font-semibold text-gray-900 ml-2">{d.value}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${d.colorClass} rounded-full transition-all`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CSV Export ────────────────────────────────────────────────────────────────

function exportToCSV(metrics: Metrics, start: string, end: string) {
  const rows: (string | number)[][] = [
    ['LaunchPad Recruit – Recruitment Analytics Report'],
    [`Period: ${start} to ${end}`],
    [`Generated: ${new Date().toLocaleDateString('en-ZA')}`],
    [],

    ['SUMMARY METRICS'],
    ['Metric', 'Value'],
    ['Active Vacancies',           metrics.active_vacancies],
    ['Total Applications',         metrics.total_applications],
    ['Avg. Time to Fill (days)',   metrics.avg_time_to_fill_days ?? 'N/A'],
    ['Regrets Sent',               metrics.regrets_sent],
    [],

    ['CONVERSION FUNNEL'],
    ['Stage',                         'Count', 'Rate'],
    ['AI Shortlisted',                metrics.ai_shortlisted_count,     pct(metrics.ai_shortlisted_count,     metrics.ai_shortlist_total)],
    ['Video Assessments Completed',   metrics.video_sessions_completed, pct(metrics.video_sessions_completed, metrics.video_sessions_sent)],
    ['Interviews → Offers',           metrics.offers_created,           pct(metrics.offers_created,           metrics.interviews_held)],
    ['Offers Accepted',               metrics.offers_accepted,          pct(metrics.offers_accepted,          metrics.offers_sent)],
    ['Offers Declined',               metrics.offers_declined,          pct(metrics.offers_declined,          metrics.offers_sent)],
    [],

    ['APPLICATIONS PER VACANCY'],
    ['Position', 'Department', 'Status', 'Applications'],
    ...(metrics.applications_per_vacancy ?? []).map(v => [
      v.job_title, v.department, v.vacancy_status, v.application_count,
    ]),
    [],

    ['PIPELINE STAGE BREAKDOWN'],
    ['Stage', 'Count'],
    ...(metrics.pipeline_stage_breakdown ?? []).map(d => [
      STAGE_LABELS[d.stage] ?? d.stage, d.count,
    ]),
    [],

    ['APPLICATIONS BY DEPARTMENT'],
    ['Department', 'Count'],
    ...(metrics.applications_by_department ?? []).map(d => [d.department, d.count]),
    [],

    ['APPLICATION TRENDS BY MONTH'],
    ['Month', 'Applications'],
    ...(metrics.applications_by_month ?? []).map(d => [d.month, d.count]),
  ];

  const csv = rows
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recruitment-report-${start}-to-${end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
