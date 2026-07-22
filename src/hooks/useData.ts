import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Vacancy, Candidate, Application, Interview, Offer, OfferTemplate, ScreeningQuestion, VideoAssessmentQuestion } from '../lib/supabase';
import { QUERY_KEYS } from './queryKeys';
import { STALE_TIMES } from '../utils/constants';

const WITH_CANDIDATE_VACANCY = `
  *,
  candidate:candidates(*),
  vacancy:vacancies(*)
`;

// ─── Vacancies ────────────────────────────────────────────────────────────────

export function useVacancies(options?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.vacancies(options),
    queryFn: async () => {
      let query = supabase
        .from('vacancies')
        .select('*')
        .order('created_at', { ascending: false });
      if (options?.status) query = query.eq('status', options.status);
      if (options?.search) {
        query = query.or(
          `job_title.ilike.%${options.search}%,department.ilike.%${options.search}%`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Vacancy[];
    },
    staleTime: STALE_TIMES.STATIC,
  });
}

export function useVacancy(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.vacancy(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vacancies')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Vacancy | null;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.STATIC,
  });
}

// ─── Applications ─────────────────────────────────────────────────────────────

export function useApplications(options?: {
  status?: string;
  vacancyId?: string;
  search?: string;
  limit?: number;
  includeCandidate?: boolean;
}) {
  const select = options?.includeCandidate !== false ? WITH_CANDIDATE_VACANCY : '*';
  return useQuery({
    queryKey: QUERY_KEYS.applications(options),
    queryFn: async () => {
      let query = supabase
        .from('applications')
        .select(select)
        .order('applied_at', { ascending: false });
      if (options?.status)    query = query.eq('status', options.status);
      if (options?.vacancyId) query = query.eq('vacancy_id', options.vacancyId);
      if (options?.limit)     query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIMES.NORMAL,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.application(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(WITH_CANDIDATE_VACANCY)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.NORMAL,
  });
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export function useCandidates(search?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.candidates(search),
    queryFn: async () => {
      let query = supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Candidate[];
    },
    staleTime: STALE_TIMES.NORMAL,
  });
}

// ─── Interviews ───────────────────────────────────────────────────────────────

export function useInterviews(status?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.interviews(status),
    queryFn: async () => {
      let query = supabase
        .from('interviews')
        .select(`
          *,
          application:applications(
            *,
            candidate:candidates(*),
            vacancy:vacancies(*)
          )
        `)
        .order('scheduled_at', { ascending: true });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIMES.LIVE,
  });
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export function useOffers(status?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.offers(status),
    queryFn: async () => {
      let query = supabase
        .from('offers')
        .select(`
          *,
          application:applications(
            *,
            candidate:candidates(*),
            vacancy:vacancies(*)
          )
        `)
        .order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIMES.LIVE,
  });
}

// ─── Questions ────────────────────────────────────────────────────────────────

export function useScreeningQuestions(vacancyId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.screeningQuestions(vacancyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_questions')
        .select('*')
        .eq('vacancy_id', vacancyId)
        .order('order_index');
      if (error) throw error;
      return data as ScreeningQuestion[];
    },
    enabled: !!vacancyId,
    staleTime: STALE_TIMES.STATIC,
  });
}

export function useVideoQuestions(vacancyId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.videoQuestions(vacancyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_assessment_questions')
        .select('*')
        .eq('vacancy_id', vacancyId)
        .order('order_index');
      if (error) throw error;
      return data as VideoAssessmentQuestion[];
    },
    enabled: !!vacancyId,
    staleTime: STALE_TIMES.STATIC,
  });
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardStats(),
    queryFn: async () => {
      const [vacancies, applications, interviews, offers, videoSessions] = await Promise.all([
        supabase.from('vacancies').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'applied'),
        supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        supabase.from('offers').select('id', { count: 'exact', head: true }).in('status', ['pending', 'sent']),
        supabase.from('video_assessment_sessions').select('id', { count: 'exact', head: true }).eq('status', 'invitation_sent'),
      ]);

      return {
        activeVacancies:         vacancies.count     ?? 0,
        applicationsReceived:    applications.count  ?? 0,
        interviewsScheduled:     interviews.count    ?? 0,
        offersOutstanding:       offers.count        ?? 0,
        videoAssessmentsPending: videoSessions.count ?? 0,
        avgTimeToFill:           21,
      };
    },
    staleTime: STALE_TIMES.NORMAL,
    gcTime:    5 * 60_000,
  });
}

// ─── Mutations — Vacancies ────────────────────────────────────────────────────

export function useCreateVacancy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vacancy: Partial<Vacancy>) => {
      const { data, error } = await supabase.from('vacancies').insert(vacancy).select().single();
      if (error) throw error;
      return data as Vacancy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardStats() });
    },
  });
}

export function useUpdateVacancy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Vacancy> }) => {
      const { data: result, error } = await supabase
        .from('vacancies')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as Vacancy;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancies() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vacancy(id) });
    },
  });
}

// ─── Mutations — Applications ─────────────────────────────────────────────────

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Application> }) => {
      const { data: result, error } = await supabase
        .from('applications')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.applications() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.application(id) });
    },
  });
}

// ─── Mutations — Interviews ───────────────────────────────────────────────────

export function useCreateInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (interview: Partial<Interview>) => {
      const { data, error } = await supabase.from('interviews').insert(interview).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews() });
    },
  });
}

export function useUpdateInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Interview> }) => {
      const { data: result, error } = await supabase
        .from('interviews')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interviews() });
    },
  });
}

// ─── Mutations — Offers ───────────────────────────────────────────────────────

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (offer: Partial<Offer>) => {
      const { data, error } = await supabase.from('offers').insert(offer).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers() });
    },
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Offer> }) => {
      const { data: result, error } = await supabase
        .from('offers')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offers() });
    },
  });
}

// ─── Offer Templates ──────────────────────────────────────────────────────────

export function useOfferTemplates() {
  return useQuery({
    queryKey: QUERY_KEYS.offerTemplates(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_templates')
        .select('*, fields:offer_template_fields(*)')
        .order('is_default', { ascending: false })
        .order('created_at');
      if (error) throw error;
      return data as OfferTemplate[];
    },
    staleTime: STALE_TIMES.STATIC,
  });
}

export function useOfferTemplate(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.offerTemplate(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_templates')
        .select('*, fields:offer_template_fields(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as OfferTemplate;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.STATIC,
  });
}

export function useCreateOfferTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      template,
      fields,
    }: {
      template: Partial<OfferTemplate>;
      fields: { field_key: string; field_label: string; field_type: string; order_index: number }[];
    }) => {
      const { data, error } = await supabase
        .from('offer_templates')
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      if (fields.length) {
        const { error: fErr } = await supabase
          .from('offer_template_fields')
          .insert(fields.map(f => ({ ...f, template_id: data.id })));
        if (fErr) throw fErr;
      }
      return data as OfferTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerTemplates() });
    },
  });
}

export function useUpdateOfferTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      template,
      fields,
    }: {
      id: string;
      template: Partial<OfferTemplate>;
      fields: { field_key: string; field_label: string; field_type: string; order_index: number }[];
    }) => {
      const { error } = await supabase.from('offer_templates').update(template).eq('id', id);
      if (error) throw error;
      // Replace fields: delete existing then re-insert
      await supabase.from('offer_template_fields').delete().eq('template_id', id);
      if (fields.length) {
        const { error: fErr } = await supabase
          .from('offer_template_fields')
          .insert(fields.map(f => ({ ...f, template_id: id })));
        if (fErr) throw fErr;
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerTemplates() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerTemplate(id) });
    },
  });
}

export function useDeleteOfferTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('offer_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.offerTemplates() });
    },
  });
}
