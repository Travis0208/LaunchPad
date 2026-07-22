import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVacancies, useUpdateVacancy, useNotifications } from '../hooks';
import { Card, Badge, Button, Input, Select, EmptyState, Spinner, Modal } from './ui';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Archive,
  ExternalLink,
  Users,
  Video,
  Briefcase,
} from 'lucide-react';
import { getVacancyStatusVariant } from '../utils/helpers';
import { formatDate } from '../utils';
import { VACANCY_STATUSES } from '../utils/constants';
import type { Vacancy } from '../lib/supabase';

export function VacanciesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: vacancies, isLoading } = useVacancies({ status: statusFilter === 'all' ? undefined : statusFilter, search });
  const updateVacancy = useUpdateVacancy();
  const { success, error } = useNotifications();

  const handleStatusChange = async (vacancyId: string, newStatus: string) => {
    try {
      await updateVacancy.mutateAsync({ id: vacancyId, data: { status: newStatus } });
      success(`Vacancy ${newStatus === 'published' ? 'published' : 'updated'} successfully`);
    } catch (err) {
      error('Failed to update vacancy');
    }
  };

  const handleClone = async (vacancy: Vacancy) => {
    try {
      const { id, created_at, updated_at, ...rest } = vacancy;
      const response = await fetch('/api/vacancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          job_title: `${vacancy.job_title} (Copy)`,
          status: 'draft',
        }),
      });
      if (!response.ok) throw new Error('Failed to clone');
      success('Vacancy cloned successfully');
    } catch (err) {
      error('Failed to clone vacancy');
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vacancies</h1>
          <p className="text-gray-600 mt-1">Manage job openings and positions</p>
        </div>
        <Link to="/vacancies/new">
          <Button icon={<Plus className="w-4 h-4" />}>New Vacancy</Button>
        </Link>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search vacancies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-5 h-5" />}
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  ...VACANCY_STATUSES,
                ]}
              />
            </div>
          </div>
        </div>

        {!vacancies?.length ? (
          <EmptyState
            icon={Briefcase}
            title="No vacancies found"
            description="Create your first vacancy to get started"
            action={
              <Link to="/vacancies/new">
                <Button icon={<Plus className="w-4 h-4" />}>Create Vacancy</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applications</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closing</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vacancies.map((vacancy) => (
                  <VacancyRow
                    key={vacancy.id}
                    vacancy={vacancy}
                    onStatusChange={handleStatusChange}
                    onClone={handleClone}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function VacancyRow({
  vacancy,
  onStatusChange,
  onClone,
}: {
  vacancy: Vacancy;
  onStatusChange: (id: string, status: string) => void;
  onClone: (vacancy: Vacancy) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [stats, setStats] = useState({ applications: 0, videoPending: 0 });

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div>
          <p className="font-medium text-gray-900">{vacancy.job_title}</p>
          <p className="text-sm text-gray-500 capitalize">{vacancy.employment_type.replace('_', ' ')}</p>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">{vacancy.department}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{vacancy.location}</td>
      <td className="px-6 py-4">
        <Badge variant={getVacancyStatusVariant(vacancy.status)}>{vacancy.status}</Badge>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Users className="w-4 h-4" />
            {stats.applications}
          </div>
          {stats.videoPending > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <Video className="w-4 h-4" />
              {stats.videoPending}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(vacancy.advert_closing_date)}</td>
      <td className="px-6 py-4 text-right">
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreHorizontal className="w-5 h-5 text-gray-500" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <Link
                  to={`/vacancies/${vacancy.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Eye className="w-4 h-4" /> View Details
                </Link>
                <Link
                  to={`/vacancies/${vacancy.id}/edit`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Edit className="w-4 h-4" /> Edit
                </Link>
                <button
                  onClick={() => {
                    onClone(vacancy);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                >
                  <Copy className="w-4 h-4" /> Clone
                </button>
                {vacancy.status === 'published' && (
                  <a
                    href={`/apply/${vacancy.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <ExternalLink className="w-4 h-4" /> View Public Page
                  </a>
                )}
                {vacancy.video_assessment_trigger === 'after_ai_shortlisting' && (
                  <Link
                    to={`/vacancies/${vacancy.id}/video-assessment`}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Video className="w-4 h-4" /> Video Assessment
                  </Link>
                )}
                <hr className="my-1 border-gray-200" />
                {vacancy.status === 'draft' && (
                  <button
                    onClick={() => {
                      onStatusChange(vacancy.id, 'published');
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 w-full"
                  >
                    Publish
                  </button>
                )}
                {vacancy.status === 'published' && (
                  <button
                    onClick={() => {
                      onStatusChange(vacancy.id, 'closed');
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={() => {
                    onStatusChange(vacancy.id, 'archived');
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                >
                  <Archive className="w-4 h-4" /> Archive
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
