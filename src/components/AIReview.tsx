import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVacancies, useRankedCandidates, useAIEvaluation, useEvaluateApplication, useApplications, useScreeningQuestions, useNotifications } from '../hooks';
import { Card, CardHeader, CardBody, Badge, Button, Select, Modal, Spinner, EmptyState, StatCard } from './ui';
import { Brain, TrendingUp, User, ChevronRight, Star, AlertTriangle, CheckCircle, Clock, RefreshCw, MessageSquare, FileText } from 'lucide-react';
import { formatRelativeTime } from '../utils';
import type { EvaluationScore, EvaluationSummary } from '../lib/aiEvaluation';

export function AIReviewPage() {
  const [selectedVacancy, setSelectedVacancy] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const { data: vacancies, isLoading: vacanciesLoading } = useVacancies({ status: 'published' });
  const { data: rankedCandidates, isLoading: candidatesLoading } = useRankedCandidates(selectedVacancy);
  const { success, error } = useNotifications();

  const evaluateMutation = useEvaluateApplication();

  const handleEvaluate = async (applicationId: string, candidateId: string) => {
    try {
      await evaluateMutation.mutateAsync({
        applicationId,
        vacancyId: selectedVacancy,
        candidateId,
      });
      success('Candidate evaluated successfully');
    } catch (err) {
      error('Failed to evaluate candidate');
    }
  };

  const handleEvaluateAll = async () => {
    if (!rankedCandidates?.length) return;
    for (const candidate of rankedCandidates) {
      if (!candidate.has_evaluation) {
        await handleEvaluate(candidate.application_id, candidate.candidate_id);
      }
    }
  };

  if (vacanciesLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">AI Candidate Review</h1>
          <p className="text-gray-600 mt-1">AI-powered candidate ranking and recommendations</p>
        </div>
        {selectedVacancy && rankedCandidates?.length && (
          <Button
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleEvaluateAll}
            loading={evaluateMutation.isPending}
          >
            Evaluate All Candidates
          </Button>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Vacancy to Review
          </label>
          <select
            value={selectedVacancy}
            onChange={(e) => {
              setSelectedVacancy(e.target.value);
              setSelectedCandidate(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select a vacancy...</option>
            {(vacancies || []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.job_title} - {v.department}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {selectedVacancy && candidatesLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {selectedVacancy && !candidatesLoading && (
        <>
          <CandidateRankingSummary
            candidates={rankedCandidates || []}
            onEvaluate={handleEvaluate}
            onSelect={(id) => setSelectedCandidate(id)}
            selectedId={selectedCandidate}
          />

          {rankedCandidates && rankedCandidates.length > 0 && (
            <div className="grid gap-4">
              {rankedCandidates.map((candidate: any, index: number) => (
                <CandidateCard
                  key={candidate.application_id}
                  candidate={candidate}
                  rank={index + 1}
                  onEvaluate={() => handleEvaluate(candidate.application_id, candidate.candidate_id)}
                  evaluating={evaluateMutation.isPending}
                  onClick={() => setSelectedCandidate(candidate.application_id)}
                  isSelected={selectedCandidate === candidate.application_id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedVacancy && selectedCandidate && (
        <EvaluationDetailModal
          applicationId={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}

function CandidateRankingSummary({
  candidates,
  onSelect,
  selectedId,
}: {
  candidates: any[];
  onEvaluate: (appId: string, candId: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const evaluatedCount = candidates.filter((c) => c.has_evaluation).length;
  const highPriorityCount = candidates.filter((c) => c.interview_priority === 'high').length;

  if (!candidates.length) {
    return (
      <EmptyState
        icon={User}
        title="No candidates yet"
        description="Candidates will appear here once they apply"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <StatCard
        icon={User}
        label="Total Applicants"
        value={candidates.length}
        color="blue"
      />
      <StatCard
        icon={CheckCircle}
        label="Evaluated"
        value={evaluatedCount}
        color="green"
      />
      <StatCard
        icon={Star}
        label="High Priority"
        value={highPriorityCount}
        color="orange"
      />
      <StatCard
        icon={Clock}
        label="Pending Review"
        value={candidates.length - evaluatedCount}
        color="purple"
      />
    </div>
  );
}

function CandidateCard({
  candidate,
  rank,
  onEvaluate,
  evaluating,
  onClick,
  isSelected,
}: {
  candidate: any;
  rank: number;
  onEvaluate: () => void;
  evaluating: boolean;
  onClick: () => void;
  isSelected: boolean;
}) {
  const getSuitabilityBadge = (level: string) => {
    const variants: Record<string, 'success' | 'primary' | 'warning' | 'gray'> = {
      highly_suitable: 'success',
      suitable: 'primary',
      moderately_suitable: 'warning',
      needs_review: 'gray',
    };
    return variants[level] || 'gray';
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') return 'text-red-600 bg-red-50 border-red-200';
    if (priority === 'medium') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <Card
      hover
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary-500' : ''}`}
    >
      <div className="p-4" onClick={onClick}>
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold">
            {rank}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-700 font-semibold">
                  {candidate.first_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {candidate.first_name} {candidate.last_name}
                </p>
                <p className="text-sm text-gray-500">{candidate.email}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {candidate.has_evaluation ? (
              <>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{candidate.overall_score}</p>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
                <Badge variant={getSuitabilityBadge(candidate.suitability_level)}>
                  {candidate.suitability_level?.replace(/_/g, ' ')}
                </Badge>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityBadge(candidate.interview_priority)}`}>
                  {candidate.interview_priority} priority
                </span>
              </>
            ) : (
              <Button
                size="sm"
                icon={<Brain className="w-4 h-4" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEvaluate();
                }}
                loading={evaluating}
              >
                Evaluate
              </Button>
            )}

            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function EvaluationDetailModal({
  applicationId,
  onClose,
}: {
  applicationId: string;
  onClose: () => void;
}) {
  const { data: evaluation, isLoading } = useAIEvaluation(applicationId);

  if (isLoading || !evaluation) {
    return (
      <Modal open={true} onClose={onClose} title="AI Evaluation" size="xl">
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={true} onClose={onClose} title="AI Evaluation Report" size="xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-600 to-dark-800 rounded-lg text-white">
          <div>
            <p className="text-3xl font-bold">{evaluation.summary.overall_score}</p>
            <p className="text-sm opacity-90">Overall Score</p>
          </div>
          <div className="text-right">
            <Badge
              variant={evaluation.summary.suitability_level === 'highly_suitable' ? 'success' : evaluation.summary.suitability_level === 'suitable' ? 'primary' : 'warning'}
              className="text-sm"
            >
              {evaluation.summary.suitability_level?.replace(/_/g, ' ')}
            </Badge>
            <p className="text-sm mt-1 opacity-90">
              {evaluation.summary.interview_priority} interview priority
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-4">Score Breakdown</h4>
          <div className="space-y-3">
            {evaluation.scores.map((score) => (
              <ScoreBar key={score.dimension} score={score} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h4 className="font-semibold">Strengths</h4>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {evaluation.summary.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h4 className="font-semibold">Areas to Explore</h4>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {evaluation.summary.gaps.map((g, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <h4 className="font-semibold">Salary Summary</h4>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-gray-600">{evaluation.summary.salary_summary}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-500" />
              <h4 className="font-semibold">Interview Recommendation</h4>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-gray-600">{evaluation.summary.interview_recommendation}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <h4 className="font-semibold">Key Interview Questions</h4>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {evaluation.summary.key_questions.map((q, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  {q}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This AI evaluation provides recommendations only. Candidates are never
            automatically rejected. Use this as a guide for interview preparation.
          </p>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">Close</Button>
      </div>
    </Modal>
  );
}

function ScoreBar({ score }: { score: EvaluationScore }) {
  const getBarColor = (score: number) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const dimensionLabels: Record<string, string> = {
    qualifications: 'Qualifications',
    experience: 'Experience',
    skills: 'Skills',
    competencies: 'Competencies',
    industry_experience: 'Industry Experience',
    screening_responses: 'Screening Responses',
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-gray-900">{dimensionLabels[score.dimension]}</span>
          <span className="text-sm text-gray-500 ml-2">({Math.round(score.weight * 100)}%)</span>
        </div>
        <span className="font-bold text-gray-900">{Math.round(score.score)}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor(score.score)} rounded-full transition-all`}
          style={{ width: `${score.score}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">{score.reasoning}</p>
      {score.evidence?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {score.evidence.map((e, i) => (
            <li key={i} className="text-xs text-gray-400">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
