import { supabase } from '../lib/supabase';
import type { Application, Candidate, Vacancy, ScreeningQuestion, ScreeningResponse } from '../lib/supabase';
import { AI_SCORE } from '../utils/constants';

export type Dimension = 'qualifications' | 'experience' | 'skills' | 'competencies' | 'industry_experience' | 'screening_responses' | 'video_assessment';

export interface EvaluationScore {
  dimension: Dimension;
  weight: number;
  score: number;
  weighted_score: number;
  reasoning: string;
  evidence: string[];
}

export interface EvaluationSummary {
  overall_score: number;
  suitability_level: 'highly_suitable' | 'suitable' | 'moderately_suitable' | 'needs_review';
  strengths: string[];
  gaps: string[];
  salary_summary: string;
  interview_recommendation: string;
  interview_priority: 'high' | 'medium' | 'low';
  key_questions: string[];
}

export interface FullEvaluation {
  id: string;
  application_id: string;
  scores: EvaluationScore[];
  summary: EvaluationSummary;
  evaluated_at: string;
}

const WEIGHTS: Record<Dimension, number> = {
  qualifications: 0.18,
  experience: 0.27,
  skills: 0.18,
  competencies: 0.13,
  industry_experience: 0.09,
  screening_responses: 0.05,
  video_assessment: 0.10,
};

interface CandidateData {
  application: Application;
  applicationId?: string;
  candidate: Candidate;
  vacancy: Vacancy;
  screeningResponses: ScreeningResponse[];
  screeningQuestions: ScreeningQuestion[];
}

/**
 * Scoring algorithms for each dimension
 */
function scoreQualifications(vacancy: Vacancy, candidate: Candidate, responses: { [key: string]: any }): EvaluationScore {
  const evidence: string[] = [];
  let score = 50;
  let reasoning = 'Qualification assessment based on provided information.';

  if (vacancy.qualifications) {
    const qualText = vacancy.qualifications.toLowerCase();
    const qResponse = responses['highest_qualification']?.toString()?.toLowerCase() || '';

    const degreeMatch = qualText.includes('degree') || qualText.includes('diploma');
    const hasDegree = qResponse.includes('degree') || qResponse.includes('diploma') || qResponse.includes('bachelor') || qResponse.includes('master');

    if (degreeMatch && hasDegree) {
      score = 85;
      reasoning = 'Candidate meets the qualification requirements.';
      evidence.push(`Highest qualification: ${responses['highest_qualification']}`);
    } else if (hasDegree) {
      score = 70;
      reasoning = 'Candidate has relevant qualifications.';
      evidence.push(`Highest qualification: ${responses['highest_qualification']}`);
    } else if (qResponse) {
      score = 50;
      reasoning = 'Candidate has qualifications that may need assessment.';
      evidence.push(`Highest qualification: ${qResponse}`);
    } else {
      score = 40;
      reasoning = 'Unable to assess qualifications from provided information.';
    }
  }

  return {
    dimension: 'qualifications',
    weight: WEIGHTS.qualifications,
    score,
    weighted_score: score * WEIGHTS.qualifications,
    reasoning,
    evidence,
  };
}

function scoreExperience(vacancy: Vacancy, candidate: Candidate, responses: { [key: string]: any }): EvaluationScore {
  const evidence: string[] = [];
  let score = 50;
  let reasoning = 'Experience assessment based on provided information.';

  const yearsExp = parseFloat(responses['years_experience']) || 0;

  if (vacancy.experience_required) {
    const expText = vacancy.experience_required.toLowerCase();
    const requiredYears = parseInt(expText.match(/\d+/)?.[0] || '0');

    if (yearsExp >= requiredYears) {
      score = 90;
      reasoning = `Candidate meets the experience requirement of ${requiredYears}+ years.`;
      evidence.push(`Years of experience: ${yearsExp} (required: ${requiredYears}+)`);
    } else if (yearsExp >= requiredYears * 0.7) {
      score = 70;
      reasoning = `Candidate has close to the required experience level.`;
      evidence.push(`Years of experience: ${yearsExp} (required: ${requiredYears}+)`);
    } else if (yearsExp > 0) {
      score = 40;
      reasoning = `Candidate has less experience than required.`;
      evidence.push(`Years of experience: ${yearsExp} (required: ${requiredYears}+)`);
    } else {
      score = 30;
      reasoning = 'Experience level could not be verified.';
    }
  } else {
    if (yearsExp >= 5) {
      score = 80;
      reasoning = 'Candidate has substantial experience.';
      evidence.push(`Years of experience: ${yearsExp}`);
    } else if (yearsExp >= 2) {
      score = 60;
      reasoning = 'Candidate has moderate experience.';
      evidence.push(`Years of experience: ${yearsExp}`);
    } else if (yearsExp > 0) {
      score = 40;
      reasoning = 'Candidate has limited experience.';
      evidence.push(`Years of experience: ${yearsExp}`);
    }
  }

  return {
    dimension: 'experience',
    weight: WEIGHTS.experience,
    score,
    weighted_score: score * WEIGHTS.experience,
    reasoning,
    evidence,
  };
}

function scoreSkills(vacancy: Vacancy, candidate: Candidate): EvaluationScore {
  const evidence: string[] = [];
  let score = 50;
  let reasoning = 'Skills assessment based on vacancy requirements.';

  const requiredSkills = vacancy.skills_required?.filter(s => s) || [];

  if (requiredSkills.length > 0) {
    score = 60;
    reasoning = `${requiredSkills.length} key skills required for this role. Assessment pending CV review.`;
    evidence.push(`Required skills: ${requiredSkills.join(', ')}`);
  } else {
    score = 70;
    reasoning = 'No specific skills listed as required.';
  }

  return {
    dimension: 'skills',
    weight: WEIGHTS.skills,
    score,
    weighted_score: score * WEIGHTS.skills,
    reasoning,
    evidence,
  };
}

function scoreCompetencies(vacancy: Vacancy, candidate: Candidate): EvaluationScore {
  const evidence: string[] = [];
  let score = 50;
  let reasoning = 'Competencies assessment based on role requirements.';

  const requiredCompetencies = vacancy.competencies?.filter(c => c) || [];

  if (requiredCompetencies.length > 0) {
    score = 60;
    reasoning = `${requiredCompetencies.length} competencies required. Assessment pending interview.`;
    evidence.push(`Required competencies: ${requiredCompetencies.join(', ')}`);
  } else {
    score = 70;
    reasoning = 'No specific competencies listed as required.';
  }

  return {
    dimension: 'competencies',
    weight: WEIGHTS.competencies,
    score,
    weighted_score: score * WEIGHTS.competencies,
    reasoning,
    evidence,
  };
}

function scoreIndustryExperience(vacancy: Vacancy, responses: { [key: string]: any }): EvaluationScore {
  const evidence: string[] = [];
  let score = 50;
  let reasoning = 'Industry experience assessment.';

  if (vacancy.department?.toLowerCase().includes('logistics') ||
      vacancy.department?.toLowerCase().includes('transport') ||
      vacancy.department?.toLowerCase().includes('supply')) {
    const crossBorder = responses['cross_border_experience'];
    if (crossBorder === 'yes' || crossBorder === true) {
      score = 85;
      reasoning = 'Candidate has relevant cross-border/transport industry experience.';
      evidence.push('Cross-border experience: Yes');
    } else {
      score = 55;
      reasoning = 'Industry experience to be assessed during interview.';
    }
  } else {
    score = 65;
    reasoning = 'Industry relevance to be assessed.';
  }

  return {
    dimension: 'industry_experience',
    weight: WEIGHTS.industry_experience,
    score,
    weighted_score: score * WEIGHTS.industry_experience,
    reasoning,
    evidence,
  };
}

function scoreScreeningResponses(vacancy: Vacancy, screeningResponses: ScreeningResponse[], screeningQuestions: ScreeningQuestion[]): EvaluationScore {
  const evidence: string[] = [];
  let score = 50;
  let reasoning = 'Screening responses assessment.';

  const mandatoryQuestions = screeningQuestions.filter(q => q.is_mandatory);
  const totalMandatory = mandatoryQuestions.length;

  if (totalMandatory > 0) {
    let matchCount = 0;
    // Pre-build O(1) lookup to avoid O(n×m) linear scans in the loop below.
    const questionById = new Map(screeningQuestions.map(q => [q.id, q]));

    for (const response of screeningResponses) {
      const question = questionById.get(response.question_id);
      if (!question) continue;

      if (response.response_boolean === true || response.response_option === 'yes') {
        matchCount++;
        evidence.push(`${question.question_text}: Yes`);
      } else if (response.response_text || response.response_numeric) {
        matchCount += 0.8;
        evidence.push(`${question.question_text}: ${response.response_text || response.response_numeric || response.response_option}`);
      }
    }

    score = Math.min(100, Math.round((matchCount / totalMandatory) * 100));

    if (score >= AI_SCORE.HIGHLY_SUITABLE) {
      reasoning = 'Candidate meets most screening criteria.';
    } else if (score >= AI_SCORE.SUITABLE) {
      reasoning = 'Candidate meets key screening criteria with some areas to discuss.';
    } else {
      reasoning = 'Some screening criteria require further assessment.';
    }
  } else {
    score = 70;
    reasoning = 'No mandatory screening questions configured.';
  }

  return {
    dimension: 'screening_responses',
    weight: WEIGHTS.screening_responses,
    score,
    weighted_score: score * WEIGHTS.screening_responses,
    reasoning,
    evidence,
  };
}

function determineSuitabilityLevel(overallScore: number): 'highly_suitable' | 'suitable' | 'moderately_suitable' | 'needs_review' {
  if (overallScore >= AI_SCORE.HIGHLY_SUITABLE)     return 'highly_suitable';
  if (overallScore >= AI_SCORE.SUITABLE)            return 'suitable';
  if (overallScore >= AI_SCORE.MODERATELY_SUITABLE) return 'moderately_suitable';
  return 'needs_review';
}

function determineInterviewPriority(scores: EvaluationScore[]): 'high' | 'medium' | 'low' {
  const scoreOf = (dim: EvaluationScore['dimension']) =>
    scores.find(s => s.dimension === dim)?.score ?? 0;
  const expScore  = scoreOf('experience');
  const qualScore = scoreOf('qualifications');

  if (expScore >= AI_SCORE.INTERVIEW_PRIORITY_HIGH && qualScore >= AI_SCORE.INTERVIEW_PRIORITY_HIGH) return 'high';
  if (expScore >= AI_SCORE.MODERATELY_SUITABLE     && qualScore >= AI_SCORE.MODERATELY_SUITABLE)     return 'medium';
  return 'low';
}

function generateStrengths(scores: EvaluationScore[], vacancy: Vacancy): string[] {
  const strengths: string[] = [];

  for (const score of scores) {
    if (score.score >= AI_SCORE.STRENGTH_THRESHOLD) {
      if (score.dimension === 'qualifications') {
        strengths.push('Strong educational background relevant to the role');
      } else if (score.dimension === 'experience') {
        strengths.push('Meets or exceeds experience requirements');
      } else if (score.dimension === 'skills') {
        strengths.push('Demonstrates relevant technical skills');
      } else if (score.dimension === 'industry_experience') {
        strengths.push('Has valuable transport/logistics industry experience');
      }
    }
  }

  if (strengths.length === 0) {
    strengths.push('Application shows potential for further assessment');
  }

  return strengths;
}

function generateGaps(scores: EvaluationScore[], vacancy: Vacancy): string[] {
  const gaps: string[] = [];

  for (const score of scores) {
    if (score.score < AI_SCORE.GAP_THRESHOLD) {
      if (score.dimension === 'qualifications') {
        gaps.push('Qualification alignment should be verified');
      } else if (score.dimension === 'experience') {
        gaps.push(`Experience below stated requirements - ${score.reasoning}`);
      } else if (score.dimension === 'skills') {
        gaps.push('Technical skills require verification');
      }
    }
  }

  if (gaps.length === 0) {
    gaps.push('Minor areas to explore during interview');
  }

  return gaps;
}

export async function getVideoScore(applicationId: string): Promise<number> {
  const { data: session } = await supabase
    .from('video_assessment_sessions')
    .select('score, status, ai_insights')
    .eq('application_id', applicationId)
    .eq('status', 'completed')
    .maybeSingle();

  if (!session || session.score === null) return 0;
  return Math.round(session.score);
}

function generateSalarySummary(responses: { [key: string]: any }): string {
  const salaryExp = parseFloat(responses['salary_expectation']) || 0;

  if (salaryExp > 0) {
    return salaryExp < 500000
      ? `Candidate's expectation (R${salaryExp.toLocaleString()}) is in the entry-level range.`
      : salaryExp < 800000
      ? `Candidate's expectation (R${salaryExp.toLocaleString()}) is in the mid-range.`
      : `Candidate's expectation (R${salaryExp.toLocaleString()}) is in the senior range.`;
  }

  return 'Salary expectation not provided. Recommend discussing during interview.';
}

function generateKeyQuestions(scores: EvaluationScore[], vacancy: Vacancy): string[] {
  const questions: string[] = [];
  const scoreOf = (dim: EvaluationScore['dimension']) =>
    scores.find(s => s.dimension === dim)?.score ?? 0;

  if (scoreOf('experience') < AI_SCORE.QUESTION_THRESHOLD) {
    questions.push('Can you describe your most relevant experience for this role?');
  }

  if (scoreOf('qualifications') < AI_SCORE.QUESTION_THRESHOLD) {
    questions.push('How does your educational background prepare you for this position?');
  }

  questions.push('What interests you about this role in the transport/logistics sector?');

  const skillsRequired = vacancy.skills_required?.filter(s => s) || [];
  if (skillsRequired.length > 0) {
    questions.push(`Describe your experience with: ${skillsRequired.slice(0, 3).join(', ')}`);
  }

  return questions;
}

function buildResponseMap(screeningResponses: ScreeningResponse[], screeningQuestions: ScreeningQuestion[]): Record<string, unknown> {
  // Build O(1) lookup map first to avoid O(n×m) linear scans.
  const questionById = new Map(screeningQuestions.map(q => [q.id, q]));
  const map: Record<string, unknown> = {};

  for (const response of screeningResponses) {
    const question = questionById.get(response.question_id);
    if (question?.predefined_type) {
      map[question.predefined_type] =
        response.response_text ??
        response.response_numeric ??
        response.response_boolean?.toString() ??
        response.response_option;
    }
  }

  return map;
}

/**
 * Main evaluation function
 */
export async function evaluateCandidate(data: CandidateData): Promise<{ scores: EvaluationScore[]; summary: EvaluationSummary }> {
  const { vacancy, candidate, screeningResponses, screeningQuestions, applicationId } = data;

  const responseMap = buildResponseMap(screeningResponses, screeningQuestions);

  const videoScore = vacancy.video_assessment_trigger === 'after_ai_shortlisting' && applicationId
    ? await getVideoScore(applicationId)
    : 0;

  const scores: EvaluationScore[] = [
    scoreQualifications(vacancy, candidate, responseMap),
    scoreExperience(vacancy, candidate, responseMap),
    scoreSkills(vacancy, candidate),
    scoreCompetencies(vacancy, candidate),
    scoreIndustryExperience(vacancy, responseMap),
    scoreScreeningResponses(vacancy, screeningResponses, screeningQuestions),
    {
      dimension: 'video_assessment',
      weight: 0.10,
      score: videoScore || 70,
      weighted_score: (videoScore || 70) * 0.10,
      reasoning: vacancy.video_assessment_trigger === 'after_ai_shortlisting'
        ? videoScore > 0
          ? `Video assessment score: ${videoScore}/100`
          : 'Video assessment pending or not completed.'
        : 'Video assessment not required for this vacancy.',
      evidence: videoScore > 0 ? [`Video score: ${videoScore}/100`] : [],
    },
  ];

  const overallScore = Math.round(scores.reduce((sum, s) => sum + s.weighted_score, 0));

  const summary: EvaluationSummary = {
    overall_score: overallScore,
    suitability_level: determineSuitabilityLevel(overallScore),
    strengths: generateStrengths(scores, vacancy),
    gaps: generateGaps(scores, vacancy),
    salary_summary: generateSalarySummary(responseMap),
    interview_recommendation: overallScore >= AI_SCORE.SUITABLE
      ? 'Candidate recommended for interview. Review strengths and gaps before scheduling.'
      : 'Candidate should be assessed further. Consider role requirements alignment.',
    interview_priority: determineInterviewPriority(scores),
    key_questions: generateKeyQuestions(scores, vacancy),
  };

  return { scores, summary };
}

/**
 * Save evaluation to database
 */
export async function saveEvaluation(
  applicationId: string,
  vacancyId: string,
  scores: EvaluationScore[],
  summary: EvaluationSummary
): Promise<FullEvaluation> {
  const { data: evaluation, error: evalError } = await supabase
    .from('ai_evaluations')
    .insert({
      application_id: applicationId,
      vacancy_id: vacancyId,
      evaluation_version: '1.0',
    })
    .select()
    .single();

  if (evalError) throw evalError;

  const scoreInserts = scores.map(score => ({
    evaluation_id: evaluation.id,
    dimension: score.dimension,
    weight: score.weight,
    score: score.score,
    weighted_score: score.weighted_score,
    reasoning: score.reasoning,
    evidence: score.evidence,
  }));

  const { error: scoresError } = await supabase
    .from('ai_evaluation_scores')
    .insert(scoreInserts);

  if (scoresError) throw scoresError;

  const { data: summaryData, error: summaryError } = await supabase
    .from('ai_evaluation_summaries')
    .insert({
      evaluation_id: evaluation.id,
      overall_score: summary.overall_score,
      suitability_level: summary.suitability_level,
      strengths: summary.strengths,
      gaps: summary.gaps,
      salary_summary: summary.salary_summary,
      interview_recommendation: summary.interview_recommendation,
      interview_priority: summary.interview_priority,
      key_questions: summary.key_questions,
    })
    .select()
    .single();

  if (summaryError) throw summaryError;

  return {
    id: evaluation.id,
    application_id: applicationId,
    scores,
    summary,
    evaluated_at: evaluation.evaluated_at,
  };
}

/**
 * Get existing evaluation for an application
 */
export async function getEvaluation(applicationId: string): Promise<FullEvaluation | null> {
  const { data: evaluation, error } = await supabase
    .from('ai_evaluations')
    .select(`
      *,
      scores:ai_evaluation_scores(*),
      summary:ai_evaluation_summaries(*)
    `)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (error || !evaluation) return null;

  return {
    id: evaluation.id,
    application_id: evaluation.application_id,
    scores: evaluation.scores.map((s: any) => ({
      dimension: s.dimension,
      weight: parseFloat(s.weight),
      score: parseFloat(s.score),
      weighted_score: parseFloat(s.weighted_score),
      reasoning: s.reasoning,
      evidence: s.evidence || [],
    })),
    summary: {
      overall_score: parseFloat(evaluation.summary?.overall_score || 0),
      suitability_level: evaluation.summary?.suitability_level || 'needs_review',
      strengths: evaluation.summary?.strengths || [],
      gaps: evaluation.summary?.gaps || [],
      salary_summary: evaluation.summary?.salary_summary || '',
      interview_recommendation: evaluation.summary?.interview_recommendation || '',
      interview_priority: evaluation.summary?.interview_priority || 'low',
      key_questions: evaluation.summary?.key_questions || [],
    },
    evaluated_at: evaluation.evaluated_at,
  };
}

/**
 * Get ranked candidates for a vacancy
 */
export async function getRankedCandidates(vacancyId: string) {
  const { data, error } = await supabase.rpc('get_ranked_candidates', { p_vacancy_id: vacancyId });
  if (error) throw error;
  return data;
}
