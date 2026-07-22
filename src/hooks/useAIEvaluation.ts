import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getEvaluation, getRankedCandidates, evaluateCandidate, saveEvaluation } from '../lib/aiEvaluation';
import { QUERY_KEYS } from './queryKeys';

export function useAIEvaluation(applicationId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.aiEvaluation(applicationId),
    queryFn: () => getEvaluation(applicationId),
    enabled: !!applicationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRankedCandidates(vacancyId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.rankedCandidates(vacancyId),
    queryFn: () => getRankedCandidates(vacancyId),
    enabled: !!vacancyId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useEvaluateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      vacancyId,
    }: {
      applicationId: string;
      vacancyId: string;
      candidateId: string;
    }) => {
      const [appResult, questionsResult, responsesResult] = await Promise.all([
        supabase
          .from('applications')
          .select(`*, candidate:candidates(*), vacancy:vacancies(*)`)
          .eq('id', applicationId)
          .single(),
        supabase
          .from('screening_questions')
          .select('*')
          .eq('vacancy_id', vacancyId),
        supabase
          .from('screening_responses')
          .select('*')
          .eq('application_id', applicationId),
      ]);

      if (appResult.error) throw appResult.error;
      const application = appResult.data;
      if (!application) throw new Error('Application not found');

      const { scores, summary } = await evaluateCandidate({
        application,
        applicationId,
        candidate: application.candidate,
        vacancy: application.vacancy,
        screeningResponses: responsesResult.data ?? [],
        screeningQuestions: questionsResult.data ?? [],
      });

      return saveEvaluation(applicationId, vacancyId, scores, summary);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.aiEvaluation(variables.applicationId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rankedCandidates(variables.vacancyId) });
    },
  });
}

export function useBulkEvaluate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vacancyId }: { vacancyId: string }) => {
      const { data: applications, error } = await supabase
        .from('applications')
        .select(`
          id, candidate_id, vacancy_id,
          candidate:candidates(*),
          vacancy:vacancies(*)
        `)
        .eq('vacancy_id', vacancyId);

      if (error) throw error;
      if (!applications?.length) return [];

      const { data: existing } = await supabase
        .from('ai_evaluations')
        .select('application_id')
        .in('application_id', applications.map(a => a.id));

      const evaluatedIds = new Set((existing ?? []).map((e: any) => e.application_id));

      const toEvaluate = applications.filter(a => !evaluatedIds.has(a.id));

      const [questionsResult, responsesResult] = await Promise.all([
        supabase
          .from('screening_questions')
          .select('*')
          .eq('vacancy_id', vacancyId),
        supabase
          .from('screening_responses')
          .select('*')
          .in('application_id', toEvaluate.map(a => a.id)),
      ]);

      const screeningQuestions = questionsResult.data ?? [];
      const allResponses = responsesResult.data ?? [];

      const results = await Promise.allSettled(
        toEvaluate.map(async app => {
          const screeningResponses = allResponses.filter((r: any) => r.application_id === app.id);
          const { scores, summary } = await evaluateCandidate({
            application: app as any,
            applicationId: app.id,
            candidate: (app as any).candidate,
            vacancy: (app as any).vacancy,
            screeningResponses,
            screeningQuestions,
          });
          return saveEvaluation(app.id, vacancyId, scores, summary);
        })
      );

      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rankedCandidates(variables.vacancyId) });
    },
  });
}
