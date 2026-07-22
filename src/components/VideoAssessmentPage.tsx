import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVerifyVideoSession, useVideoSessionResponses, useStartVideoSession, useUploadVideo, useCompleteVideoSession, useNotifications } from '../hooks';
import { Button, Spinner } from './ui';
import { Video, Upload, Check, X, AlertTriangle, Clock, ChevronRight, ChevronLeft, Camera, RotateCcw, Send } from 'lucide-react';
import { formatDate, formatTime } from '../utils';
import { supabase } from '../lib/supabase';

type VideoState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'uploaded';

export function VideoAssessmentPage() {
  const { vacancyId, candidateId, token } = useParams();
  const navigate = useNavigate();
  const { error, success } = useNotifications();

  const { data: sessionData, isLoading, isError } = useVerifyVideoSession(
    vacancyId || '',
    candidateId || '',
    token || ''
  );

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [videoState, setVideoState] = useState<VideoState>('idle');
  const [uploadedResponses, setUploadedResponses] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startSession = useStartVideoSession();
  const uploadVideo = useUploadVideo();
  const completeSession = useCompleteVideoSession();

  const questions = sessionData?.questions || [];
  const vacancy = sessionData?.vacancy;
  const isExpired = sessionData && new Date(sessionData.expires_at) < new Date();

  useEffect(() => {
    const loadResponses = async () => {
      const { data } = await supabase
        .from('video_responses')
        .select('question_id')
        .eq('session_id', getSessionId())
        .not('video_url', 'is', null);
      if (data) {
        setUploadedResponses(new Set(data.map((r: any) => r.question_id)));
      }
    };
    loadResponses();
  }, [sessionData]);

  const getSessionId = () => {
    return sessionData?.id || '';
  };

  const handleStart = async () => {
    try {
      await startSession.mutateAsync(getSessionId());
    } catch (err) {
      error('Failed to start session');
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(blob);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setVideoState('recording');
    } catch (err) {
      error('Failed to access camera. Please allow camera permissions.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && videoState === 'recording') {
      mediaRecorderRef.current.stop();
      setVideoState('recorded');
    }
  };

  const handleRetake = () => {
    if (videoRef.current) {
      videoRef.current.src = '';
    }
    setVideoState('idle');
  };

  const handleUpload = async () => {
    if (!videoRef.current?.src) return;

    setVideoState('uploading');

    try {
      const response = await fetch(videoRef.current.src);
      const blob = await response.blob();
      const file = new File([blob], 'video.webm', { type: 'video/webm' });

      await uploadVideo.mutateAsync({
        sessionId: getSessionId(),
        questionId: questions[currentQuestion].id,
        file,
      });

      setUploadedResponses((prev) => new Set(prev).add(questions[currentQuestion].id));
      setVideoState('uploaded');
      success('Video uploaded successfully');
    } catch (err) {
      error('Failed to upload video');
      setVideoState('recorded');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      error('Invalid file format. Please use MP4, MOV, or WEBM.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      error('File too large. Maximum size is 100MB.');
      return;
    }

    setVideoState('uploading');

    try {
      await uploadVideo.mutateAsync({
        sessionId: getSessionId(),
        questionId: questions[currentQuestion].id,
        file,
      });

      setUploadedResponses((prev) => new Set(prev).add(questions[currentQuestion].id));
      setVideoState('uploaded');
      success('Video uploaded successfully');
    } catch (err) {
      error('Failed to upload video');
      setVideoState('idle');
    }
  };

  const handleSubmit = async () => {
    try {
      await completeSession.mutateAsync(getSessionId());
      success('Assessment submitted successfully');
    } catch (err) {
      error('Failed to submit assessment');
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setVideoState('idle');
      if (videoRef.current) {
        videoRef.current.src = '';
      }
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setVideoState('idle');
      if (videoRef.current) {
        videoRef.current.src = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !sessionData?.is_valid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-600">
            This video assessment link is invalid, has expired, or has already been used.
            Please contact the recruiter if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <Clock className="w-16 h-16 mx-auto text-orange-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment Expired</h1>
          <p className="text-gray-600">
            The deadline for this video assessment has passed on{' '}
            {new Date(sessionData.expires_at).toLocaleDateString()}.
          </p>
        </div>
      </div>
    );
  }

  if (sessionData?.status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 to-dark-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted</h1>
          <p className="text-gray-600">
            Thank you for completing your video assessment. We will review your responses and be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  if (sessionData?.status === 'invitation_sent' && !startSession.isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-600 to-dark-800 rounded-xl flex items-center justify-center">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Video Assessment</h1>
          <p className="text-gray-600 mb-4">
            {vacancy?.company_name || 'LaunchPad'} has invited you to complete a video assessment
            for the position of <strong>{vacancy?.job_title}</strong>.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">Instructions:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>- {questions.length} video questions to answer</li>
              <li>- Record or upload your responses</li>
              <li>- Deadline: {new Date(sessionData.expires_at).toLocaleDateString()}</li>
            </ul>
          </div>
          <Button onClick={handleStart} loading={startSession.isPending}>
            Begin Assessment
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const current = questions[currentQuestion];
  const isUploaded = uploadedResponses.has(current?.id);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-2 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-dark-800 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{vacancy?.job_title}</h1>
              <p className="text-sm text-gray-500">Video Assessment</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Question {currentQuestion + 1} of {questions.length}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {questions.map((_: any, i: number) => (
                <div
                  key={i}
                  className={`w-${currentQuestion === i ? 'w-4' : 'w-2'} h-2 rounded-full ${
                    uploadedResponses.has(questions[i]?.id)
                      ? 'bg-green-500'
                      : currentQuestion === i
                      ? 'bg-primary-500'
                      : 'bg-gray-300'
                  } transition-all duration-200`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <p className="text-gray-500 text-sm mb-2">Question {currentQuestion + 1}</p>
            <h2 className="text-xl font-semibold text-gray-900">{current?.question_text}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <Clock className="w-4 h-4" />
              Maximum recording: {current || current?.max_recording_duration || 60} seconds
            </div>
          </div>

          <div className="p-6">
            <div className="aspect-video bg-gray-900 rounded-lg mb-6 flex items-center justify-center overflow-hidden">
              {videoState === 'idle' && !isUploaded && (
                <div className="text-center">
                  <Camera className="w-16 h-16 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">Camera preview will appear here</p>
                </div>
              )}
              {(videoState === 'recording' || videoState === 'recorded') && (
                <video
                  ref={videoRef}
                  autoPlay
                  muted={videoState === 'recording'}
                  className="w-full h-full object-cover"
                />
              )}
              {videoState === 'uploaded' && (
                <div className="text-center">
                  <Check className="w-16 h-16 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-400">Video uploaded successfully</p>
                </div>
              )}
              {videoState === 'uploading' && (
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-gray-400">Uploading video...</p>
                </div>
              )}
            </div>

            {isUploaded ? (
              <div className="flex justify-end">
                <Button onClick={nextQuestion} disabled={currentQuestion === questions.length - 1}>
                  Next Question
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {videoState === 'idle' && (
                    <>
                      <Button onClick={handleStartRecording} className="flex-1">
                        <Camera className="w-4 h-4 mr-2" />
                        Record Video
                      </Button>
                      <span className="text-gray-500">or</span>
                      <label className="flex-1">
                        <Button variant="outline" as="span">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload File
                        </Button>
                        <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </>
                  )}

                  {videoState === 'recording' && (
                    <Button variant="danger" onClick={handleStopRecording} className="w-full">
                      <div className="w-3 h-3 rounded-full bg-white mr-2 animate-pulse" />
                      Stop Recording
                    </Button>
                  )}

                  {videoState === 'recorded' && (
                    <>
                      <Button variant="ghost" onClick={handleRetake}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retake
                      </Button>
                      <Button onClick={handleUpload} loading={videoState === 'uploading'} className="flex-1">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Video
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex justify-between pt-4 border-t border-gray-200">
                  <Button variant="ghost" onClick={prevQuestion} disabled={currentQuestion === 0}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <Button variant="outline" onClick={nextQuestion} disabled={currentQuestion === questions.length - 1}>
                    Skip
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {uploadedResponses.size === questions.length && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Questions Answered</h3>
            <p className="text-gray-600 mb-4">
              You have uploaded videos for all {questions.length} questions.
            </p>
            <Button onClick={handleSubmit} loading={completeSession.isPending}>
              <Send className="w-4 h-4 mr-2" />
              Submit Assessment
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
