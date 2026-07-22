/**
 * Centralised React Query key factory.
 * Using factory functions prevents typo mismatches across hooks and
 * makes targeted cache invalidation straightforward.
 */
export const QUERY_KEYS = {
  // Vacancies
  vacancies:         (opts?: object)    => opts ? ['vacancies', opts] : ['vacancies'],
  vacancy:           (id: string)       => ['vacancy', id],

  // Applications
  applications:      (opts?: object)    => opts ? ['applications', opts] : ['applications'],
  application:       (id: string)       => ['application', id],

  // Candidates
  candidates:        (search?: string)  => ['candidates', search],

  // Interviews
  interviews:        (status?: string)  => status ? ['interviews', status] : ['interviews'],

  // Offers
  offers:            (status?: string)  => status ? ['offers', status] : ['offers'],

  // Screening
  screeningQuestions:(vacancyId: string) => ['screeningQuestions', vacancyId],
  videoQuestions:    (vacancyId: string) => ['videoQuestions', vacancyId],

  // Dashboard
  dashboardStats:    ()                 => ['dashboardStats'],

  // AI evaluation
  aiEvaluation:      (applicationId: string) => ['aiEvaluation', applicationId],
  rankedCandidates:  (vacancyId: string)     => ['rankedCandidates', vacancyId],

  // Video assessment
  videoConfig:       (vacancyId: string)     => ['videoConfig', vacancyId],
  videoSessions:     (vacancyId: string)     => ['videoSessions', vacancyId],
  videoSessionDetail:(sessionId: string)     => ['videoSessionDetail', sessionId],
  videoResponses:    (sessionId: string)     => ['videoResponses', sessionId],
  verifyVideoSession:(v: string, c: string, t: string) => ['verifyVideoSession', v, c, t],
  expiringSessions:  ()                      => ['expiringSessions'],

  // Offer templates
  offerTemplates:    ()                      => ['offerTemplates'],
  offerTemplate:     (id: string)            => ['offerTemplate', id],

  // Regret communications
  regretLogs:        (opts?: object)         => opts ? ['regretLogs', opts] : ['regretLogs'],

  // Pipeline
  pipelineBoard:     (vacancyId: string)     => ['pipelineBoard', vacancyId],
  stageHistory:      (applicationId: string) => ['stageHistory', applicationId],
  candidateNotes:    (applicationId: string) => ['candidateNotes', applicationId],
} as const;
