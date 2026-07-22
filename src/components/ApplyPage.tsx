import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Vacancy, ScreeningQuestion, VideoAssessmentQuestion } from '../lib/supabase';
import {
  ChevronRight,
  Upload,
  FileText,
  Check,
  AlertCircle,
  Building,
  MapPin,
  Clock,
  Briefcase,
  Rocket,
} from 'lucide-react';

export function ApplyPage() {
  const { vacancyId } = useParams();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([]);
  const [videoQuestions, setVideoQuestions] = useState<VideoAssessmentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    cv_file: null as File | null,
    popia_consent: false,
    screening_responses: {} as Record<string, any>,
  });

  useEffect(() => {
    fetchVacancyData();
  }, [vacancyId]);

  const fetchVacancyData = async () => {
    try {
      const { data: vacancyData } = await supabase
        .from('vacancies')
        .select('*')
        .eq('id', vacancyId)
        .eq('status', 'published')
        .maybeSingle();

      if (vacancyData) {
        setVacancy(vacancyData);

        const { data: questions } = await supabase
          .from('screening_questions')
          .select('*')
          .eq('vacancy_id', vacancyData.id)
          .order('order_index');
        setScreeningQuestions(questions || []);

        if (vacancyData.video_assessment_trigger === 'during_application') {
          const { data: vQuestions } = await supabase
            .from('video_assessment_questions')
            .select('*')
            .eq('vacancy_id', vacancyData.id)
            .order('order_index');
          setVideoQuestions(vQuestions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching vacancy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!vacancy || !form.popia_consent) return;

    try {
      let cvUrl = null;
      let cvFilename = null;

      if (form.cv_file) {
        const fileExt = form.cv_file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('cvs')
          .upload(fileName, form.cv_file);

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('cvs').getPublicUrl(uploadData.path);
          cvUrl = urlData.publicUrl;
          cvFilename = form.cv_file.name;
        }
      }

      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          mobile_number: form.mobile_number,
          cv_url: cvUrl,
          cv_filename: cvFilename,
          popia_consent: true,
          consent_date: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (candidateError || !candidate) {
        if (candidateError?.code === '23505') {
          const { data: existingCandidate } = await supabase
            .from('candidates')
            .select()
            .eq('email', form.email)
            .maybeSingle();

          if (existingCandidate) {
            const { data: appData, error: appError } = await supabase
              .from('applications')
              .insert({
                candidate_id: existingCandidate.id,
                vacancy_id: vacancy.id,
                status: 'applied',
              })
              .select()
              .maybeSingle();

            if (appData) {
              setReferenceNumber(appData.reference_number);
              setSubmitted(true);
              return;
            }
          }
        }
        return;
      }

      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
          candidate_id: candidate.id,
          vacancy_id: vacancy.id,
          status: 'applied',
        })
        .select()
        .maybeSingle();

      if (application) {
        setReferenceNumber(application.reference_number);

        const responses = Object.entries(form.screening_responses).map(([questionId, response]) => {
          const question = screeningQuestions.find((q) => q.id === questionId);
          return {
            application_id: application.id,
            question_id: questionId,
            response_text: question?.question_type === 'free_text' ? response : null,
            response_numeric: question?.question_type === 'numeric' ? response : null,
            response_boolean: question?.question_type === 'yes_no' ? response === 'yes' || response === true : null,
            response_option: question?.question_type === 'multiple_choice' ? response : null,
          };
        });

        if (responses.length > 0) {
          await supabase.from('screening_responses').insert(responses);
        }

        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('An error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vacancy Not Found</h1>
          <p className="text-gray-600">
            This job posting is no longer available or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 to-dark-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for applying. We have received your application and will be in touch.
          </p>
          <div className="p-4 bg-gray-50 rounded-lg mb-6">
            <p className="text-sm text-gray-500 mb-1">Your Reference Number</p>
            <p className="text-xl font-mono font-bold text-primary-600">{referenceNumber}</p>
          </div>
          <p className="text-sm text-gray-500">
            A confirmation email has been sent to <strong>{form.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-dark-800 rounded-xl flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">LaunchPad Recruit</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-dark-800 p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">{vacancy.job_title}</h1>
            <div className="flex flex-wrap gap-4 text-sm opacity-90">
              <span className="flex items-center gap-1">
                <Building className="w-4 h-4" />
                {vacancy.department}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {vacancy.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {vacancy.employment_type.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 ${
                    s < step ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          {step === 1 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">First Name *</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Last Name *</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Email Address *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="input-label">Mobile Number *</label>
                  <input
                    type="tel"
                    value={form.mobile_number}
                    onChange={(e) => setForm({ ...form, mobile_number: e.target.value })}
                    className="input-field"
                    placeholder="+27 XX XXX XXXX"
                    required
                  />
                </div>

                <div>
                  <label className="input-label">Upload CV / Resume</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) =>
                        e.target.files && setForm({ ...form, cv_file: e.target.files[0] })
                      }
                      className="hidden"
                      id="cv-upload"
                    />
                    <label htmlFor="cv-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      {form.cv_file ? (
                        <p className="text-primary-600 font-medium">{form.cv_file.name}</p>
                      ) : (
                        <>
                          <p className="text-gray-600">Click to upload your CV</p>
                          <p className="text-sm text-gray-400 mt-1">PDF, DOC, DOCX up to 10MB</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!form.first_name || !form.last_name || !form.email || !form.mobile_number}
                  className="btn-primary"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Screening Questions</h2>

              <div className="space-y-6">
                {screeningQuestions.map((question) => (
                  <div key={question.id}>
                    <label className="input-label">
                      {question.question_text}
                      {question.is_mandatory && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {question.question_type === 'yes_no' && (
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={question.id}
                            value="yes"
                            checked={form.screening_responses[question.id] === 'yes'}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                screening_responses: {
                                  ...form.screening_responses,
                                  [question.id]: 'yes',
                                },
                              })
                            }
                            className="w-4 h-4 text-primary-600"
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={question.id}
                            value="no"
                            checked={form.screening_responses[question.id] === 'no'}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                screening_responses: {
                                  ...form.screening_responses,
                                  [question.id]: 'no',
                                },
                              })
                            }
                            className="w-4 h-4 text-primary-600"
                          />
                          No
                        </label>
                      </div>
                    )}
                    {question.question_type === 'multiple_choice' && (
                      <select
                        value={form.screening_responses[question.id] || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            screening_responses: {
                              ...form.screening_responses,
                              [question.id]: e.target.value,
                            },
                          })
                        }
                        className="input-field"
                      >
                        <option value="">Select an option</option>
                        {question.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                    {question.question_type === 'numeric' && (
                      <input
                        type="number"
                        value={form.screening_responses[question.id] || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            screening_responses: {
                              ...form.screening_responses,
                              [question.id]: e.target.value,
                            },
                          })
                        }
                        className="input-field"
                      />
                    )}
                    {question.question_type === 'free_text' && (
                      <textarea
                        value={form.screening_responses[question.id] || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            screening_responses: {
                              ...form.screening_responses,
                              [question.id]: e.target.value,
                            },
                          })
                        }
                        className="input-field"
                        rows={3}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(1)} className="btn-ghost">
                  Back
                </button>
                <button onClick={() => setStep(3)} className="btn-primary">
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">POPIA Consent</h2>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-gray-600 text-sm leading-relaxed">
                  In terms of the{' '}
                  <strong>Protection of Personal Information Act (POPIA)</strong>, I consent to
                  the processing and storage of my personal information for recruitment and
                  selection purposes. I understand that my information will be handled in
                  accordance with applicable data protection laws and will only be used for the
                  purposes of assessing my suitability for employment.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.popia_consent}
                  onChange={(e) => setForm({ ...form, popia_consent: e.target.checked })}
                  className="w-5 h-5 mt-0.5 text-primary-600 rounded"
                />
                <span className="text-gray-700">
                  I consent to the processing and storage of my personal information for
                  recruitment and selection purposes in accordance with POPIA. *
                </span>
              </label>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="btn-ghost">
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.popia_consent}
                  className="btn-primary"
                >
                  Submit Application
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
