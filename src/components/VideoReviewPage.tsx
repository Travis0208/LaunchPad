import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideoSessionDetails, useVideoSessionResponses, useNotifications } from '../hooks';
import { Card, CardHeader, CardBody, Badge, Button, Modal, Spinner, EmptyState } from './ui';
import { Video, Play, Pause, Download, FileText, ChevronRight, ChevronLeft, Check, AlertTriangle, Star, MessageSquare, Brain, Clock, User } from 'lucide-react';
import { formatDate, formatDateTime, formatRelativeTime } from '../utils';
import { supabase } from '../lib/supabase';

export function VideoReviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { error, success } = useNotifications();

  const { data: session, isLoading, isError } = useVideoSessionDetails(sessionId || '');
  const [currentVideo, setCurrentVideo] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const loadReviewData = async () => {
      if (session?.responses?.[currentVideo]) {
        const { data } = await supabase
          .from('video_responses')
          .select('review_score, review_notes')
          .eq('id', session.responses[currentVideo].id)
          .single();
        if (data) {
          setScore(data.review_score);
          setNotes(data.review_notes || '');
        }
      }
    };
    loadReviewData();
  }, [session, currentVideo]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <EmptyState
        icon={Video}
        title="Session not found"
        action={<Button onClick={() => navigate(-1)}>Go Back</Button>}
      />
    );
  }

  const videos = session.responses?.filter((r: any) => r.video_url) || [];
  const questions = session.vacancy?.video_questions || session.vacancy?.video_assessment_questions || [];
  const currentResponse = videos[currentVideo];

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSaveReview = async () => {
    if (!currentResponse || score === null) return;

    try {
      await supabase
        .from('video_responses')
        .update({
          review_score: score,
          review_notes: notes,
          reviewed: true,
        })
        .eq('id', currentResponse.id);
      success('Review saved');
    } catch (err) {
      error('Failed to save review');
    }
  };

  const handlePrevious = () => {
    if (currentVideo > 0) {
      setCurrentVideo(currentVideo - 1);
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (currentVideo < videos.length - 1) {
      setCurrentVideo(currentVideo + 1);
      setIsPlaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost">
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Assessment Review</h1>
          <p className="text-gray-600 mt-1">
            {session.candidate?.first_name} {session.candidate?.last_name} - {session.vacancy?.job_title}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardBody className="p-0">
              {currentResponse?.video_url ? (
                <div className="relative aspect-video bg-black">
                  <video
                    ref={videoRef}
                    src={currentResponse.video_url}
                    controls
                    className="w-full h-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Video className="w-16 h-16 mx-auto mb-2" />
                    <p>No video uploaded for this question</p>
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      Question {currentVideo + 1} of {videos.length}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {(questions.find((q: any) => q.id === currentResponse?.question_id) as any)?.question_text || 'Video response'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" disabled={currentVideo === 0} onClick={handlePrevious}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Badge variant="gray">{currentVideo + 1} / {videos.length}</Badge>
                    <Button variant="ghost" disabled={currentVideo === videos.length - 1} onClick={handleNext}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {currentResponse?.video_url && (
                    <a
                      href={currentResponse.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  )}
                  <Button variant="outline" onClick={() => setShowTranscript(!showTranscript)}>
                    <FileText className="w-4 h-4 mr-2" />
                    {showTranscript ? 'Hide' : 'Show'} Transcript
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {showTranscript && currentResponse?.transcript_text && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  <h3 className="font-semibold">Transcript</h3>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-gray-700 leading-relaxed">{currentResponse.transcript_text}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold">Review Notes</h3>
              </div>
            </CardHeader>
            <CardBody>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this video response..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[120px]"
              />

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4">
                  <label className="block text-sm font-medium text-gray-700">Score:</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setScore(s * 20)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          score !== null && s <= score / 20
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${score !== null && s <= score / 20 ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                    <span className="text-sm font-medium text-gray-700 ml-2">
                      {score !== null ? `${Math.round(score)}/100` : 'Not rated'}
                    </span>
                  </div>
                </div>

                <Button onClick={handleSaveReview}>
                  <Check className="w-4 h-4 mr-2" />
                  Save Review
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Candidate Info</h3>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-bold text-lg">
                    {session.candidate?.first_name?.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {session.candidate?.first_name} {session.candidate?.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{session.candidate?.email}</p>
                </div>
              </div>

              <div className="space-y-3 mt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invited:</span>
                  <span className="text-gray-900">{formatRelativeTime(session.invited_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Started:</span>
                  <span className="text-gray-900">
                    {session.started_at ? formatRelativeTime(session.started_at) : 'Not started'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed:</span>
                  <span className="text-gray-900">
                    {session.completed_at ? formatRelativeTime(session.completed_at) : 'In progress'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <Badge
                    variant={
                      session.status === 'completed' ? 'success' :
                      session.status === 'started' ? 'warning' : 'gray'
                    }
                  >
                    {session.status}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold">AI Assessment</h3>
              </div>
            </CardHeader>
            <CardBody>
              {session.ai_insights ? (
                <div className="space-y-4">
                  {typeof session.ai_insights?.communication === 'number' && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Communication</span>
                        <span className="font-medium">{session.ai_insights.communication}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${session.ai_insights.communication}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {typeof session.ai_insights?.industry_knowledge === 'number' && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Industry Knowledge</span>
                        <span className="font-medium">{session.ai_insights.industry_knowledge}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${session.ai_insights.industry_knowledge}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {typeof session.ai_insights?.role_understanding === 'number' && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Role Understanding</span>
                        <span className="font-medium">{session.ai_insights.role_understanding}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${session.ai_insights.role_understanding}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {session.score !== null && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">Overall Video Score</p>
                      <p className="text-2xl font-bold text-gray-900">{Math.round(session.score)}/100</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">AI analysis pending</p>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              Video assessments contribute a maximum of 10% to the candidate recommendation. They cannot automatically reject candidates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
