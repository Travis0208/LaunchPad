import { supabase } from '../lib/supabase';

export interface VideoAssessmentSession {
  id: string;
  vacancy_id: string;
  candidate_id: string;
  application_id: string;
  secure_token: string;
  status: 'invitation_sent' | 'started' | 'completed' | 'expired';
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  reminder_sent: boolean;
  score: number | null;
  ai_insights: Record<string, any>;
}

export interface VideoResponse {
  id: string;
  session_id: string;
  question_id: string;
  video_url: string | null;
  duration_seconds: number | null;
  file_format: 'mp4' | 'mov' | 'webm' | null;
  file_size_bytes: number | null;
  uploaded_at: string | null;
  transcript_status: 'pending' | 'processing' | 'completed' | 'failed';
  transcript_text: string | null;
  reviewed: boolean;
  review_score: number | null;
  review_notes: string | null;
}

export interface VideoTranscript {
  id: string;
  response_id: string;
  transcript_text: string;
  communication_score: number;
  industry_terminology_score: number;
  role_understanding_score: number;
  insights: Record<string, any>;
}

export interface VideoAssessmentConfig {
  id: string;
  vacancy_id: string;
  selection_type: 'top_5' | 'top_10' | 'top_15' | 'custom';
  custom_number: number | null;
  expiry_days: number;
  reminder_days: number;
}

export interface CreateSessionResult {
  id: string;
  candidate_id: string;
  secure_token: string;
  application_id: string;
}

export async function createVideoAssessmentConfig(
  vacancyId: string,
  config: {
    selection_type: 'top_5' | 'top_10' | 'top_15' | 'custom';
    custom_number?: number;
    expiry_days?: number;
    reminder_days?: number;
  }
): Promise<VideoAssessmentConfig> {
  const { data, error } = await supabase
    .from('video_assessment_config')
    .upsert({
      vacancy_id: vacancyId,
      ...config,
      custom_number: config.selection_type === 'custom' ? config.custom_number : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createSessionsForTopCandidates(vacancyId: string): Promise<CreateSessionResult[]> {
  const { data, error } = await supabase.rpc('create_video_sessions_for_top_candidates', {
    p_vacancy_id: vacancyId,
  });

  if (error) throw error;
  return data || [];
}

export async function verifyVideoSession(
  vacancyId: string,
  candidateId: string,
  token: string
): Promise<{
  id: string;
  status: string;
  expires_at: string;
  vacancy: any;
  questions: any[];
  is_valid: boolean;
} | null> {
  const { data, error } = await supabase.rpc('verify_video_session', {
    p_vacancy_id: vacancyId,
    p_candidate_id: candidateId,
    p_token: token,
  });

  if (error || !data?.length) return null;
  return data[0];
}

export async function startVideoSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('video_assessment_sessions')
    .update({
      status: 'started',
      started_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function completeVideoSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('video_assessment_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function uploadVideo(
  sessionId: string,
  questionId: string,
  file: File,
  videoUrl: string
): Promise<VideoResponse> {
  const { data: existing } = await supabase
    .from('video_responses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('video_responses')
      .update({
        video_url: videoUrl,
        file_format: file.type.split('/')[1] as 'mp4' | 'mov' | 'webm',
        file_size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
        transcript_status: 'pending',
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('video_responses')
    .insert({
      session_id: sessionId,
      question_id: questionId,
      video_url: videoUrl,
      file_format: file.type.split('/')[1] as 'mp4' | 'mov' | 'webm',
      file_size_bytes: file.size,
      uploaded_at: new Date().toISOString(),
      transcript_status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadVideoToStorage(
  sessionId: string,
  questionId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'mp4';
  const fileName = `${sessionId}/${questionId}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('videos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('videos').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function getVideoResponses(sessionId: string): Promise<VideoResponse[]> {
  const { data, error } = await supabase
    .from('video_responses')
    .select('*')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data || [];
}

export async function getSessionWithDetails(sessionId: string) {
  const { data, error } = await supabase
    .from('video_assessment_sessions')
    .select(`
      *,
      candidate:candidates(*),
      vacancy:vacancies(*),
      application:applications(*),
      responses:video_responses(*)
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

export function getVideoSessionUrl(vacancyId: string, candidateId: string, token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/video/${vacancyId}/${candidateId}/${token}`;
}
