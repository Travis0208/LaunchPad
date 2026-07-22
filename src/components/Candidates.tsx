import { useState } from 'react';
import { useApplications, useUpdateApplication, useNotifications } from '../hooks';
import { Card, CardBody, Badge, Button, Input, Select, Modal, Spinner, EmptyState } from './ui';
import { Search, Eye, Mail, Phone, Send, Calendar, User, Download } from 'lucide-react';
import { getApplicationStatusVariant } from '../utils/helpers';
import { formatDate, formatRelativeTime } from '../utils';
import { APPLICATION_STATUSES } from '../utils/constants';
import type { Application, Candidate, Vacancy } from '../lib/supabase';

type ApplicationWithDetails = Application & {
  candidate: Candidate;
  vacancy: Vacancy;
};

export function CandidatesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vacancyFilter, setVacancyFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(null);

  const { data: applications, isLoading } = useApplications({
    status: statusFilter === 'all' ? undefined : statusFilter,
    includeCandidate: true,
  });

  const updateApplication = useUpdateApplication();
  const { success, error } = useNotifications();

  const filteredApplications = applications?.filter((app: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      app.candidate?.first_name?.toLowerCase().includes(searchLower) ||
      app.candidate?.last_name?.toLowerCase().includes(searchLower) ||
      app.candidate?.email?.toLowerCase().includes(searchLower) ||
      app.reference_number?.toLowerCase().includes(searchLower)
    );
  });

  const vacancies = applications?.reduce((acc: any[], app: any) => {
    if (app.vacancy && !acc.find((v) => v.id === app.vacancy.id)) {
      acc.push({ id: app.vacancy.id, job_title: app.vacancy.job_title });
    }
    return acc;
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateApplication.mutateAsync({ id, data: { status } });
      success('Application status updated');
    } catch (err) {
      error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
        <p className="text-gray-600 mt-1">View and manage all applications</p>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, or reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-5 h-5" />}
              />
            </div>
            <div className="w-full lg:w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  ...APPLICATION_STATUSES,
                ]}
              />
            </div>
            <div className="w-full lg:w-48">
              <Select
                value={vacancyFilter}
                onChange={(e) => setVacancyFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Vacancies' },
                  ...(vacancies || []).map((v: any) => ({ value: v.id, label: v.job_title })),
                ]}
              />
            </div>
          </div>
        </div>

        {!filteredApplications?.length ? (
          <EmptyState
            icon={User}
            title="No applications found"
            description="Applications will appear here once candidates apply"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredApplications.map((app: any) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 font-semibold">
                            {app.candidate?.first_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {app.candidate?.first_name} {app.candidate?.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{app.candidate?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900">{app.vacancy?.job_title}</p>
                      <p className="text-sm text-gray-500">{app.vacancy?.department}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{app.reference_number}</td>
                    <td className="px-6 py-4">
                      <Badge variant={getApplicationStatusVariant(app.status)}>
                        {app.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatRelativeTime(app.applied_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedApp(app)}>
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedApp && (
        <ApplicationDetailModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

function ApplicationDetailModal({
  application,
  onClose,
  onStatusChange,
}: {
  application: ApplicationWithDetails;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const formatDateValue = (date: string | null | undefined): string => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  return (
    <Modal open={true} onClose={onClose} title="Application Details" size="xl">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-bold text-xl">
              {application.candidate?.first_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-gray-900">
              {application.candidate?.first_name} {application.candidate?.last_name}
            </h4>
            <p className="text-gray-600">{application.vacancy?.job_title}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {application.candidate?.email}
              </div>
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {application.candidate?.mobile_number}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Reference</p>
            <p className="font-mono text-gray-900">{application.reference_number}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Applied</p>
            <p className="text-gray-900">{formatDate(application.applied_at)}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={application.status}
            onChange={(e) => onStatusChange(application.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {application.candidate?.cv_url && (
          <div>
            <h5 className="font-semibold text-gray-900 mb-3">CV / Resume</h5>
            <a
              href={application.candidate.cv_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
            >
              <Download className="w-4 h-4" />
              {application.candidate.cv_filename || 'Download CV'}
            </a>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button icon={<Calendar className="w-4 h-4" />} className="flex-1">
            Schedule Interview
          </Button>
          <Button variant="secondary" icon={<Send className="w-4 h-4" />} className="flex-1">
            Send Message
          </Button>
        </div>
      </div>
    </Modal>
  );
}
