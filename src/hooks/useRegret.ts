import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { QUERY_KEYS } from './queryKeys';

export interface RegretLog {
  id: string;
  application_id: string;
  vacancy_id: string;
  candidate_id: string;
  sent_by: string | null;
  sent_by_name: string | null;
  subject: string;
  body: string;
  sent_at: string;
  candidate: { first_name: string; last_name: string; email: string } | null;
  vacancy: { job_title: string; department: string } | null;
}

export function useRegretLogs(opts?: { vacancyId?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.regretLogs(opts),
    queryFn: async () => {
      let q = supabase
        .from('regret_communications')
        .select(`
          *,
          candidate:candidates(first_name, last_name, email),
          vacancy:vacancies(job_title, department)
        `)
        .order('sent_at', { ascending: false });
      if (opts?.vacancyId) q = q.eq('vacancy_id', opts.vacancyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RegretLog[];
    },
    staleTime: 30_000,
  });
}

export function useSendBulkRegret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationIds,
      subject,
      body,
      sentBy,
      sentByName,
    }: {
      applicationIds: string[];
      subject: string;
      body: string;
      sentBy?: string;
      sentByName?: string;
    }) => {
      const { data, error } = await supabase.rpc('send_bulk_regret', {
        p_application_ids: applicationIds,
        p_subject:         subject,
        p_body:            body,
        p_sent_by:         sentBy      ?? null,
        p_sent_by_name:    sentByName  ?? null,
      });
      if (error) throw error;
      return data as { application_id: string; success: boolean; error_msg: string | null }[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.regretLogs() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications() });
      // Invalidate all pipeline boards since stage moved
      queryClient.invalidateQueries({ queryKey: ['pipelineBoard'] });
    },
  });
}
