import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  ChevronLeft,
  Plus,
  Trash2,
  GripVertical,
  Video,
  Save,
  Eye,
} from 'lucide-react';

type Question = {
  id?: string;
  question_text: string;
  question_type: 'yes_no' | 'multiple_choice' | 'numeric' | 'free_text';
  options: string[];
  is_mandatory: boolean;
  is_predefined: boolean;
  predefined_type?: string;
};

type VideoQuestion = {
  id?: string;
  question_text: string;
  max_recording_duration: number;
};

export function VacancyForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('position');
  const [videoEnabled, setVideoEnabled] = useState<'not_required' | 'during_application' | 'after_ai_shortlisting'>('after_ai_shortlisting');

  const [form, setForm] = useState({
    job_title: '',
    department: '',
    location: '',
    employment_type: 'full_time',
    reporting_manager: '',
    number_of_vacancies: 1,
    purpose_of_role: '',
    key_objectives: [''],
    qualifications: '',
    experience_required: '',
    skills_required: [''],
    competencies: [''],
    advert_start_date: '',
    advert_closing_date: '',
  });

  const [mandatoryQuestions] = useState<Question[]>([
    { question_text: 'Highest completed qualification', question_type: 'free_text', options: [], is_mandatory: true, is_predefined: true, predefined_type: 'highest_qualification' },
    { question_text: 'Years of relevant experience', question_type: 'numeric', options: [], is_mandatory: true, is_predefined: true, predefined_type: 'years_experience' },
    { question_text: 'Salary expectation', question_type: 'numeric', options: [], is_mandatory: true, is_predefined: true, predefined_type: 'salary_expectation' },
  ]);

  const [optionalQuestions, setOptionalQuestions] = useState<Question[]>([
    { question_text: 'Driver licence code', question_type: 'free_text', options: [], is_mandatory: false, is_predefined: true, predefined_type: 'driver_licence' },
    { question_text: 'PDP status', question_type: 'yes_no', options: [], is_mandatory: false, is_predefined: true, predefined_type: 'pdp_status' },
    { question_text: 'Cross-border experience', question_type: 'yes_no', options: [], is_mandatory: false, is_predefined: true, predefined_type: 'cross_border_experience' },
    { question_text: 'Shift availability', question_type: 'yes_no', options: [], is_mandatory: false, is_predefined: true, predefined_type: 'shift_availability' },
    { question_text: 'Willingness to travel', question_type: 'yes_no', options: [], is_mandatory: false, is_predefined: true, predefined_type: 'travel_willingness' },
  ]);

  const [customQuestions, setCustomQuestions] = useState<Question[]>([]);
  const [videoQuestions, setVideoQuestions] = useState<VideoQuestion[]>([]);

  const tabs = [
    { id: 'position', label: 'Position Info' },
    { id: 'description', label: 'Job Description' },
    { id: 'screening', label: 'Screening Questions' },
    { id: 'video', label: 'Video Assessment' },
    { id: 'advertising', label: 'Advertising' },
  ];

  const handleSubmit = async () => {
    if (!user) return;

    if (videoEnabled !== 'not_required' && videoQuestions.length === 0) {
      alert('Please add at least one video question or disable video assessment.');
      return;
    }

    setLoading(true);
    try {
      const { data: vacancy, error: vacancyError } = await supabase
        .from('vacancies')
        .insert({
          ...form,
          video_assessment_trigger: videoEnabled,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (vacancyError) throw vacancyError;

      const allQuestions = [
        ...mandatoryQuestions,
        ...optionalQuestions.filter(q => q.is_mandatory),
        ...customQuestions,
      ].map((q, index) => ({
        ...q,
        vacancy_id: vacancy.id,
        order_index: index,
      }));

      if (allQuestions.length > 0) {
        const { error: questionsError } = await supabase
          .from('screening_questions')
          .insert(allQuestions);
        if (questionsError) throw questionsError;
      }

      if (videoEnabled !== 'not_required' && videoQuestions.length > 0) {
        const { error: videoError } = await supabase
          .from('video_assessment_questions')
          .insert(videoQuestions.map((q, index) => ({
            ...q,
            vacancy_id: vacancy.id,
            order_index: index,
          })));
        if (videoError) throw videoError;
      }

      navigate('/vacancies');
    } catch (error) {
      console.error('Error creating vacancy:', error);
      alert('Failed to create vacancy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Vacancy</h1>
          <p className="text-gray-600 mt-1">Add a new job opening</p>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'position' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="input-label">Job Title *</label>
                <input
                  type="text"
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Logistics Coordinator"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Department *</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Operations"
                  />
                </div>
                <div>
                  <label className="input-label">Location *</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Johannesburg, South Africa"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Employment Type *</label>
                  <select
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Number of Vacancies</label>
                  <input
                    type="number"
                    min={1}
                    value={form.number_of_vacancies}
                    onChange={(e) => setForm({ ...form, number_of_vacancies: parseInt(e.target.value) || 1 })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Reporting Manager</label>
                <input
                  type="text"
                  value={form.reporting_manager}
                  onChange={(e) => setForm({ ...form, reporting_manager: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Operations Director"
                />
              </div>
            </div>
          )}

          {activeTab === 'description' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <label className="input-label">Purpose of the Role</label>
                <textarea
                  value={form.purpose_of_role}
                  onChange={(e) => setForm({ ...form, purpose_of_role: e.target.value })}
                  className="input-field min-h-[100px]"
                  placeholder="Describe the main purpose and objectives of this position..."
                />
              </div>

              <div>
                <label className="input-label">Key Objectives</label>
                {form.key_objectives.map((obj, i) => (
                  <div key={i} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={obj}
                      onChange={(e) => {
                        const updated = [...form.key_objectives];
                        updated[i] = e.target.value;
                        setForm({ ...form, key_objectives: updated });
                      }}
                      className="input-field flex-1"
                      placeholder={`Objective ${i + 1}`}
                    />
                    {form.key_objectives.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = form.key_objectives.filter((_, idx) => idx !== i);
                          setForm({ ...form, key_objectives: updated });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setForm({ ...form, key_objectives: [...form.key_objectives, ''] })}
                  className="btn-ghost mt-2 text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Objective
                </button>
              </div>

              <div>
                <label className="input-label">Qualifications Required</label>
                <textarea
                  value={form.qualifications}
                  onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                  className="input-field min-h-[100px]"
                  placeholder="List required qualifications..."
                />
              </div>

              <div>
                <label className="input-label">Experience Required</label>
                <textarea
                  value={form.experience_required}
                  onChange={(e) => setForm({ ...form, experience_required: e.target.value })}
                  className="input-field min-h-[80px]"
                  placeholder="Describe required experience..."
                />
              </div>

              <div>
                <label className="input-label">Skills Required</label>
                {form.skills_required.map((skill, i) => (
                  <div key={i} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={skill}
                      onChange={(e) => {
                        const updated = [...form.skills_required];
                        updated[i] = e.target.value;
                        setForm({ ...form, skills_required: updated });
                      }}
                      className="input-field flex-1"
                      placeholder={`Skill ${i + 1}`}
                    />
                    {form.skills_required.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = form.skills_required.filter((_, idx) => idx !== i);
                          setForm({ ...form, skills_required: updated });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setForm({ ...form, skills_required: [...form.skills_required, ''] })}
                  className="btn-ghost mt-2 text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Skill
                </button>
              </div>
            </div>
          )}

          {activeTab === 'screening' && (
            <div className="space-y-8 max-w-3xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mandatory Questions</h3>
                <div className="space-y-3">
                  {mandatoryQuestions.map((q, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{q.question_text}</p>
                        <span className="badge badge-primary">Mandatory</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 capitalize">
                        Type: {q.question_type.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Optional Predefined Questions</h3>
                <p className="text-sm text-gray-500 mb-4">Enable any questions relevant to this position</p>
                <div className="space-y-3">
                  {optionalQuestions.map((q, i) => (
                    <div key={i} className="p-4 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={q.is_mandatory}
                            onChange={(e) => {
                              const updated = [...optionalQuestions];
                              updated[i].is_mandatory = e.target.checked;
                              setOptionalQuestions(updated);
                            }}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <p className="font-medium text-gray-900">{q.question_text}</p>
                        </div>
                        <span className="text-sm text-gray-500 capitalize">{q.question_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Custom Questions</h3>
                <div className="space-y-4">
                  {customQuestions.map((q, i) => (
                    <div key={i} className="p-4 bg-white rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          value={q.question_text}
                          onChange={(e) => {
                            const updated = [...customQuestions];
                            updated[i].question_text = e.target.value;
                            setCustomQuestions(updated);
                          }}
                          className="input-field"
                          placeholder="Question text"
                        />
                        <select
                          value={q.question_type}
                          onChange={(e) => {
                            const updated = [...customQuestions];
                            updated[i].question_type = e.target.value as any;
                            setCustomQuestions(updated);
                          }}
                          className="input-field"
                        >
                          <option value="yes_no">Yes/No</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="numeric">Numeric</option>
                          <option value="free_text">Free Text</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={q.is_mandatory}
                            onChange={(e) => {
                              const updated = [...customQuestions];
                              updated[i].is_mandatory = e.target.checked;
                              setCustomQuestions(updated);
                            }}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          Required
                        </label>
                        <button
                          onClick={() => setCustomQuestions(customQuestions.filter((_, idx) => idx !== i))}
                          className="text-red-500 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setCustomQuestions([...customQuestions, {
                      question_text: '',
                      question_type: 'free_text',
                      options: [],
                      is_mandatory: false,
                      is_predefined: false,
                    }])}
                    className="btn-outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom Question
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Assessment Configuration</h3>
                <div className="space-y-3">
                  {(['not_required', 'during_application', 'after_ai_shortlisting'] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        videoEnabled === option
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="video_trigger"
                        value={option}
                        checked={videoEnabled === option}
                        onChange={() => setVideoEnabled(option)}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div>
                        <p className="font-medium text-gray-900 capitalize">
                          {option.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {option === 'not_required' && 'No video assessment for this vacancy'}
                          {option === 'during_application' && 'Candidates record video as part of application'}
                          {option === 'after_ai_shortlisting' && 'Only shortlisted candidates complete video assessment'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {videoEnabled !== 'not_required' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Questions</h3>
                  {videoQuestions.length === 0 ? (
                    <div className="p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center">
                      <Video className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600">No video questions added yet</p>
                      <p className="text-sm text-gray-500 mt-1">Add questions for candidates to answer via video</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {videoQuestions.map((q, i) => (
                        <div key={i} className="p-4 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-start gap-3">
                            <GripVertical className="w-5 h-5 text-gray-400 mt-1" />
                            <div className="flex-1 space-y-3">
                              <textarea
                                value={q.question_text}
                                onChange={(e) => {
                                  const updated = [...videoQuestions];
                                  updated[i].question_text = e.target.value;
                                  setVideoQuestions(updated);
                                }}
                                className="input-field min-h-[80px]"
                                placeholder="Enter your video question..."
                              />
                              <div className="flex items-center gap-4">
                                <label className="text-sm text-gray-600">
                                  Max duration:
                                  <select
                                    value={q.max_recording_duration}
                                    onChange={(e) => {
                                      const updated = [...videoQuestions];
                                      updated[i].max_recording_duration = parseInt(e.target.value);
                                      setVideoQuestions(updated);
                                    }}
                                    className="ml-2 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value={30}>30 seconds</option>
                                    <option value={60}>1 minute</option>
                                    <option value={120}>2 minutes</option>
                                    <option value={180}>3 minutes</option>
                                  </select>
                                </label>
                                <button
                                  onClick={() => setVideoQuestions(videoQuestions.filter((_, idx) => idx !== i))}
                                  className="text-red-500 text-sm hover:underline ml-auto"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setVideoQuestions([...videoQuestions, { question_text: '', max_recording_duration: 60 }])}
                    className="btn-outline mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Video Question
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'advertising' && (
            <div className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Advert Start Date</label>
                  <input
                    type="date"
                    value={form.advert_start_date}
                    onChange={(e) => setForm({ ...form, advert_start_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="input-label">Advert Closing Date</label>
                  <input
                    type="date"
                    value={form.advert_closing_date}
                    onChange={(e) => setForm({ ...form, advert_closing_date: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Public vacancy URL (available after publishing):</p>
                <code className="text-sm text-primary-600 bg-primary-50 px-2 py-1 rounded">
                  launchpad.co.za/apply/{`{vacancy-id}`}
                </code>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => navigate('/vacancies')}
            className="btn-ghost"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab(tabs[Math.max(0, tabs.findIndex(t => t.id === activeTab) - 1)].id)}
              disabled={activeTab === tabs[0].id}
              className="btn-ghost disabled:opacity-50"
            >
              Previous
            </button>
            {activeTab !== tabs[tabs.length - 1].id ? (
              <button
                onClick={() => setActiveTab(tabs[tabs.findIndex(t => t.id === activeTab) + 1].id)}
                className="btn-primary"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save as Draft
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
