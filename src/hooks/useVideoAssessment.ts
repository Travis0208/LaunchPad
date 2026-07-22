import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  createVideoAssessmentConfig,
  createSessionsForTopCandidates,
  verifyVideoSession,
  startVideoSession,
  completeVideoSession,
  uploadVideo,
  uploadVideoToStorage,
  getVideoResponses,
  getSessionWithDetails,
} from '../lib/videoAssessment';
import { QUERY_KEYS } from './queryKeys';

export function useVideoConfig(vacancyId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.videoConfig(vacancyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_assessment_config')
        .select('*')
        .eq('vacancy_id', vacancyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!vacancyId,
    staleTime: 5 * 60_000,
  });
}

export function useVideoSessions(vacancyId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.videoSessions(vacancyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_assessment_sessions')
        .select(`
          *,
          candidate:candidates(*),
          application:applications(*, vacancy:vacancies(job_title))
        `)
        .eq('vacancy_id', vacancyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vacancyId,
    staleTime: 30_000,
  });
}

export function useVideoSessionDetails(sessionId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.videoSessionDetail(sessionId),
    queryFn: () => getSessionWithDetails(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

export function useVideoSessionResponses(sessionId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.videoResponses(sessionId),
    queryFn: () => getVideoResponses(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

export function useVerifyVideoSession(vacancyId: string, candidateId: string, token: string) {
  return useQuery({
    queryKey: QUERY_KEYS.verifyVideoSession(vacancyId, candidateId, token),
    queryFn: () => verifyVideoSession(vacancyId, candidateId, token),
    enabled: !!vacancyId && !!candidateId && !!token,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useCreateVideoConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vacancyId, config }: { vacancyId: string; config: any }) =>
      createVideoAssessmentConfig(vacancyId, config),
    onSuccess: (_, { vacancyId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.videoConfig(vacancyId) });
    },
  });
}

export function useCreateVideoSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vacancyId: string) => createSessionsForTopCandidates(vacancyId),
    onSuccess: (_, vacancyId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.videoSessions(vacancyId) });
    },
  });
}

export function useUploadVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      questionId,
      file,
    }: {
      sessionId: string;
      questionId: string;
      file: File;
    }) => {
      const url = await uploadVideoToStorage(sessionId, questionId, file);
      return uploadVideo(sessionId, questionId, file, url);
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.videoResponses(sessionId) });
    },
  });
}

export function useStartVideoSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startVideoSession,
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.videoSessionDetail(sessionId) });
    },
  });
}

export function useCompleteVideoSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeVideoSession,
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.videoSessionDetail(sessionId) });
    },
  });
}

export function useExpiringSessions() {
  return useQuery({
    queryKey: QUERY_KEYS.expiringSessions(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_assessment_sessions')
        .select(`
          *,
          candidate:candidates(*),
          vacancy:vacancies(job_title, department)
        `)
        .in('status', ['invitation_sent', 'started'])
        .order('expires_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
