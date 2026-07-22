import { useMemo } from 'react';
import { useDashboardStats, useApplications } from '../hooks';
import { Card, CardHeader, StatCard, Badge, EmptyState, Spinner } from './ui';
import { Briefcase, Users, Calendar, FileText, Clock, Video, TrendingUp } from 'lucide-react';
import { formatRelativeTime } from '../utils';
import { Link } from 'react-router-dom';
import type { Application, Candidate, Vacancy } from '../lib/supabase';

type RecentApp = Application & { candidate: Candidate; vacancy: Vacancy };

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: rawApps, isLoading: appsLoading } = useApplications({ limit: 10 });

  const applications = useMemo(
    () => (rawApps as RecentApp[] | undefined) ?? [],
    [rawApps]
  );

  if (statsLoading || appsLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your recruitment overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={Briefcase}
          label="Active Vacancies"
          value={stats?.activeVacancies || 0}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Applications"
          value={stats?.applicationsReceived || 0}
          color="green"
        />
        <StatCard
          icon={Calendar}
          label="Interviews"
          value={stats?.interviewsScheduled || 0}
          color="purple"
        />
        <StatCard
          icon={FileText}
          label="Offers Out"
          value={stats?.offersOutstanding || 0}
          color="orange"
        />
        <StatCard
          icon={Clock}
          label="Avg. Time to Fill"
          value={`${stats?.avgTimeToFill || 21}d`}
          color="teal"
        />
        <StatCard
          icon={Video}
          label="Video Reviews"
          value={stats?.videoAssessmentsPending || 0}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </CardHeader>
            {!applications.length ? (
              <EmptyState
                icon={TrendingUp}
                title="No recent activity"
                description="New applications will appear here"
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-semibold text-sm">
                        {app.candidate?.first_name?.charAt(0) ?? 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {app.candidate?.first_name} {app.candidate?.last_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        Applied for {app.vacancy?.job_title}
                      </p>
                    </div>
                    <Badge variant="gray">{formatRelativeTime(app.applied_at)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </CardHeader>
          <div className="p-6 space-y-3">
            <Link to="/vacancies/new" className="btn-primary w-full">
              <Briefcase className="w-4 h-4 mr-2" />
              Create New Vacancy
            </Link>
            <Link to="/candidates" className="btn-secondary w-full">
              <Users className="w-4 h-4 mr-2" />
              View Candidates
            </Link>
            <Link to="/interviews" className="btn-outline w-full">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Interview
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
