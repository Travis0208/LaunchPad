import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { QUERY_KEYS } from './queryKeys';

export const PIPELINE_STAGES = [
  { id: 'applied',                    label: 'Applied',             color: 'gray',    icon: 'inbox' },
  { id: 'ai_ranked',                  label: 'AI Ranked',           color: 'purple',  icon: 'brain' },
  { id: 'video_assessment_sent',      label: 'Video Sent',          color: 'blue',    icon: 'video' },
  { id: 'video_assessment_completed', label: 'Video Completed',     color: 'teal',    icon: 'check-circle' },
  { id: 'interview_invited',          label: 'Interview Invited',   color: 'orange',  icon: 'calendar' },
  { id: 'interview_confirmed',        label: 'Interview Confirmed', color: 'amber',   icon: 'calendar-check' },
  { id: 'offer_issued',               label: 'Offer Issued',        color: 'lime',    icon: 'file-text' },
  { id: 'offer_accepted',             label: 'Offer Accepted',      color: 'green',   icon: 'check' },
  { id: 'hired',                      label: 'Hired',               color: 'emerald', icon: 'star' },
  { id: 'regret',                     label: 'Regret',              color: 'red',     icon: 'x' },
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number]['id'];

export interface PipelineCard {
  application_id: string;
  reference_number: string;
  pipeline_stage: PipelineStage;
  applied_at: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  ai_score: number;
  video_score: number;
  note_count: number;
  has_ai_eval: boolean;
}

export interface StageHistory {
  id: string;
  application_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_by_name: string | null;
  note: string | null;
  changed_at: string;
}

export interface CandidateNote {
  id: string;
  application_id: string;
  note: string;
  is_private: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function usePipelineBoard(vacancyId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.pipelineBoard(vacancyId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pipeline_board', {
        p_vacancy_id: vacancyId,
      });
      if (error) throw error;
      return (data ?? []) as PipelineCard[];
    },
    enabled: !!vacancyId,
    staleTime: 30_000,
  });
}

export function useStageHistory(applicationId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.stageHistory(applicationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stage_history')
        .select('*')
        .eq('application_id', applicationId)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StageHistory[];
    },
    enabled: !!applicationId,
    staleTime: 30_000,
  });
}

export function useCandidateNotes(applicationId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.candidateNotes(applicationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_notes')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CandidateNote[];
    },
    enabled: !!applicationId,
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useMoveToStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      toStage,
      vacancyId,
      changedBy,
      changedByName,
      note,
    }: {
      applicationId: string;
      toStage: PipelineStage;
      vacancyId: string;
      changedBy?: string;
      changedByName?: string;
      note?: string;
    }) => {
      const { error } = await supabase.rpc('move_to_stage', {
        p_application_id:  applicationId,
        p_to_stage:        toStage,
        p_changed_by:      changedBy      ?? null,
        p_changed_by_name: changedByName  ?? null,
        p_note:            note           ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { vacancyId, applicationId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineBoard(vacancyId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stageHistory(applicationId) });
    },
  });
}

export function useAddCandidateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      note,
      isPrivate,
      createdBy,
      createdByName,
    }: {
      applicationId: string;
      note: string;
      isPrivate?: boolean;
      createdBy?: string;
      createdByName?: string;
    }) => {
      const { data, error } = await supabase
        .from('candidate_notes')
        .insert({
          application_id:   applicationId,
          note,
          is_private:       isPrivate      ?? false,
          created_by:       createdBy      ?? null,
          created_by_name:  createdByName  ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CandidateNote;
    },
    onSuccess: (_, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidateNotes(applicationId) });
    },
  });
}

export function useDeleteCandidateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; applicationId: string }) => {
      const { error } = await supabase.from('candidate_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.candidateNotes(applicationId) });
    },
  });
}
