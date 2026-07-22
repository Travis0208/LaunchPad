import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { useVacancies, useNotifications } from '../hooks';
import {
  usePipelineBoard,
  useStageHistory,
  useCandidateNotes,
  useMoveToStage,
  useAddCandidateNote,
  useDeleteCandidateNote,
  PIPELINE_STAGES,
} from '../hooks/usePipeline';
import type { PipelineCard, PipelineStage, StageHistory, CandidateNote } from '../hooks/usePipeline';
import { useAuth } from '../hooks/useAuth';
import { Modal, Badge, Button, Spinner, EmptyState } from './ui';
import {
  Brain,
  Video,
  CheckCircle,
  Calendar,
  FileText,
  Star,
  X,
  Inbox,
  MessageSquare,
  Clock,
  ChevronDown,
  Trash2,
  Lock,
  Plus,
  GripVertical,
  History,
  User,
} from 'lucide-react';
import { formatRelativeTime } from '../utils';

// ─── Stage configuration ──────────────────────────────────────────────────────

const STAGE_META: Record<
  string,
  { bg: string; border: string; header: string; dot: string; icon: React.ElementType }
> = {
  applied:                    { bg: 'bg-gray-50',    border: 'border-gray-200',   header: 'bg-gray-100',    dot: 'bg-gray-400',    icon: Inbox },
  ai_ranked:                  { bg: 'bg-purple-50',  border: 'border-purple-200', header: 'bg-purple-100',  dot: 'bg-purple-500',  icon: Brain },
  video_assessment_sent:      { bg: 'bg-blue-50',    border: 'border-blue-200',   header: 'bg-blue-100',    dot: 'bg-blue-500',    icon: Video },
  video_assessment_completed: { bg: 'bg-teal-50',    border: 'border-teal-200',   header: 'bg-teal-100',    dot: 'bg-teal-500',    icon: CheckCircle },
  interview_invited:          { bg: 'bg-orange-50',  border: 'border-orange-200', header: 'bg-orange-100',  dot: 'bg-orange-500',  icon: Calendar },
  interview_confirmed:        { bg: 'bg-amber-50',   border: 'border-amber-200',  header: 'bg-amber-100',   dot: 'bg-amber-500',   icon: Calendar },
  offer_issued:               { bg: 'bg-lime-50',    border: 'border-lime-200',   header: 'bg-lime-100',    dot: 'bg-lime-500',    icon: FileText },
  offer_accepted:             { bg: 'bg-green-50',   border: 'border-green-200',  header: 'bg-green-100',   dot: 'bg-green-500',   icon: CheckCircle },
  hired:                      { bg: 'bg-emerald-50', border: 'border-emerald-200',header: 'bg-emerald-100', dot: 'bg-emerald-500', icon: Star },
  regret:                     { bg: 'bg-red-50',     border: 'border-red-200',    header: 'bg-red-100',     dot: 'bg-red-500',     icon: X },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PipelinePage() {
  const [vacancyId, setVacancyId] = useState('');
  const { data: vacancies, isLoading: vacanciesLoading } = useVacancies();
  const { data: cards, isLoading: cardsLoading } = usePipelineBoard(vacancyId);
  const moveToStage = useMoveToStage();
  const { profile } = useAuth();
  const { success, error } = useNotifications();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [detailTab, setDetailTab] = useState<'notes' | 'history'>('notes');

  const grouped = useCallback(() => {
    const map: Record<string, PipelineCard[]> = {};
    PIPELINE_STAGES.forEach(s => { map[s.id] = []; });
    (cards || []).forEach(c => {
      if (map[c.pipeline_stage]) {
        map[c.pipeline_stage].push(c);
      }
    });
    return map;
  }, [cards]);

  const handleDrop = async (toStage: PipelineStage) => {
    if (!draggingId || !cards) return;
    const card = cards.find(c => c.application_id === draggingId);
    if (!card || card.pipeline_stage === toStage) return;
    setDraggingId(null);
    setDragOverStage(null);
    try {
      await moveToStage.mutateAsync({
        applicationId: draggingId,
        toStage,
        vacancyId,
        changedBy: profile?.id,
        changedByName: profile?.full_name,
      });
      success(`Moved to "${PIPELINE_STAGES.find(s => s.id === toStage)?.label}"`);
    } catch {
      error('Failed to move candidate');
    }
  };

  if (vacanciesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const stageMap = grouped();
  const totalCards = cards?.length ?? 0;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruitment Pipeline</h1>
          <p className="text-gray-600 mt-1">
            {vacancyId
              ? `${totalCards} candidate${totalCards !== 1 ? 's' : ''} across all stages`
              : 'Select a vacancy to view the pipeline'}
          </p>
        </div>
        <div className="w-full sm:w-80">
          <select
            value={vacancyId}
            onChange={e => { setVacancyId(e.target.value); setSelectedCard(null); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
          >
            <option value="">Select vacancy…</option>
            {(vacancies || []).map(v => (
              <option key={v.id} value={v.id}>
                {v.job_title} — {v.department}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No vacancy selected */}
      {!vacancyId && (
        <EmptyState
          icon={Inbox}
          title="No vacancy selected"
          description="Select a vacancy above to see the recruitment pipeline"
        />
      )}

      {/* Loading */}
      {vacancyId && cardsLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Board */}
      {vacancyId && !cardsLoading && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_STAGES.map(stage => {
              const meta = STAGE_META[stage.id];
              const StageIcon = meta.icon;
              const columnCards = stageMap[stage.id] || [];
              const isOver = dragOverStage === stage.id;

              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  meta={meta}
                  cards={columnCards}
                  isOver={isOver}
                  draggingId={draggingId}
                  onDragStart={setDraggingId}
                  onDragOver={() => setDragOverStage(stage.id)}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={() => handleDrop(stage.id as PipelineStage)}
                  onCardClick={setSelectedCard}
                  selectedId={selectedCard?.application_id ?? null}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedCard && (
        <CandidateDetailModal
          card={selectedCard}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelectedCard(null)}
          onMoved={(toStage) => {
            moveToStage.mutateAsync({
              applicationId: selectedCard.application_id,
              toStage,
              vacancyId,
              changedBy: profile?.id,
              changedByName: profile?.full_name,
            }).then(() => success(`Moved to "${PIPELINE_STAGES.find(s => s.id === toStage)?.label}"`))
              .catch(() => error('Failed to move candidate'));
          }}
        />
      )}
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  meta,
  cards,
  isOver,
  draggingId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardClick,
  selectedId,
}: {
  stage: typeof PIPELINE_STAGES[number];
  meta: typeof STAGE_META[string];
  cards: PipelineCard[];
  isOver: boolean;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onCardClick: (c: PipelineCard) => void;
  selectedId: string | null;
}) {
  const StageIcon = meta.icon;

  return (
    <div
      className={`flex flex-col w-60 rounded-xl border-2 transition-all duration-150 ${meta.border} ${
        isOver ? 'ring-2 ring-primary-400 scale-[1.01] shadow-lg' : ''
      }`}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
    >
      {/* Column Header */}
      <div className={`px-3 py-3 rounded-t-xl ${meta.header} flex items-center gap-2`}>
        <StageIcon className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{stage.label}</span>
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white ${meta.dot}`}>
          {cards.length}
        </span>
      </div>

      {/* Drop Zone / Cards */}
      <div
        className={`flex-1 p-2 space-y-2 min-h-[120px] rounded-b-xl transition-colors ${
          isOver ? 'bg-primary-50' : meta.bg
        }`}
      >
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-xs text-gray-400">Drop here</p>
          </div>
        )}
        {cards.map(card => (
          <CandidateCard
            key={card.application_id}
            card={card}
            isSelected={selectedId === card.application_id}
            isDragging={draggingId === card.application_id}
            onDragStart={() => onDragStart(card.application_id)}
            onDragEnd={() => onDragStart('')}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Candidate Card ────────────────────────────────────────────────────────────

function CandidateCard({
  card,
  isSelected,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  card: PipelineCard;
  isSelected: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all duration-150 group ${
        isSelected ? 'border-primary-500 ring-1 ring-primary-400 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${isDragging ? 'opacity-40 scale-95' : ''}`}
    >
      <div className="p-3">
        {/* Drag handle + name */}
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0 group-hover:text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {card.first_name} {card.last_name}
            </p>
            <p className="text-xs text-gray-500 truncate">{card.email}</p>
          </div>
        </div>

        {/* Scores row */}
        <div className="flex items-center gap-2 mt-2.5">
          {card.has_ai_eval && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
              <Brain className="w-3 h-3" />
              {card.ai_score}
            </span>
          )}
          {card.video_score > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
              <Video className="w-3 h-3" />
              {card.video_score}
            </span>
          )}
          {card.note_count > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400">
              <MessageSquare className="w-3 h-3" />
              {card.note_count}
            </span>
          )}
        </div>

        {/* Applied time */}
        <p className="text-xs text-gray-400 mt-1.5">{formatRelativeTime(card.applied_at)}</p>
      </div>
    </div>
  );
}

// ─── Candidate Detail Modal ────────────────────────────────────────────────────

function CandidateDetailModal({
  card,
  tab,
  onTabChange,
  onClose,
  onMoved,
}: {
  card: PipelineCard;
  tab: 'notes' | 'history';
  onTabChange: (t: 'notes' | 'history') => void;
  onClose: () => void;
  onMoved: (s: PipelineStage) => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const { data: notes } = useCandidateNotes(card.application_id);
  const { data: history } = useStageHistory(card.application_id);
  const addNote = useAddCandidateNote();
  const deleteNote = useDeleteCandidateNote();
  const { profile } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { error } = useNotifications();

  const stageMeta = STAGE_META[card.pipeline_stage];
  const StageIcon = stageMeta.icon;

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      await addNote.mutateAsync({
        applicationId: card.application_id,
        note: noteText.trim(),
        isPrivate,
        createdBy: profile?.id,
        createdByName: profile?.full_name,
      });
      setNoteText('');
    } catch {
      error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote.mutateAsync({ id: noteId, applicationId: card.application_id });
    } catch {
      error('Failed to delete note');
    }
  };

  const currentStageLabel = PIPELINE_STAGES.find(s => s.id === card.pipeline_stage)?.label;

  return (
    <Modal open onClose={onClose} title="Candidate Details" size="lg">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto">

        {/* Candidate header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary-700">
              {card.first_name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">
              {card.first_name} {card.last_name}
            </h3>
            <p className="text-sm text-gray-500">{card.email}</p>
            <p className="text-sm text-gray-500">{card.mobile_number}</p>
            <p className="text-xs text-gray-400 mt-1 font-mono">{card.reference_number}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${stageMeta.header} border ${stageMeta.border}`}>
              <StageIcon className="w-3.5 h-3.5" />
              {currentStageLabel}
            </div>
          </div>
        </div>

        {/* Scores */}
        {(card.has_ai_eval || card.video_score > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {card.has_ai_eval && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <Brain className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-purple-600 font-medium">AI Score</p>
                  <p className="text-xl font-bold text-purple-800">{card.ai_score}</p>
                </div>
              </div>
            )}
            {card.video_score > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Video className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-blue-600 font-medium">Video Score</p>
                  <p className="text-xl font-bold text-blue-800">{card.video_score}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Move stage */}
        <div>
          <button
            onClick={() => setMoveOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>Move to stage</span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${moveOpen ? 'rotate-180' : ''}`} />
          </button>
          {moveOpen && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              {PIPELINE_STAGES.filter(s => s.id !== card.pipeline_stage).map(s => {
                const m = STAGE_META[s.id];
                const Ic = m.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => { onMoved(s.id as PipelineStage); setMoveOpen(false); onClose(); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors hover:opacity-90 ${m.header} border ${m.border}`}
                  >
                    <Ic className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['notes', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'notes' ? <MessageSquare className="w-4 h-4" /> : <History className="w-4 h-4" />}
              {t === 'notes' ? `Notes (${notes?.length ?? 0})` : 'Audit Trail'}
            </button>
          ))}
        </div>

        {/* Notes tab */}
        {tab === 'notes' && (
          <div className="space-y-4">
            {/* Add note */}
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a recruiter note…"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 resize-none"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={e => setIsPrivate(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Private note
                  </span>
                </label>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  loading={submitting}
                  disabled={!noteText.trim()}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Note
                </Button>
              </div>
            </div>

            {/* Notes list */}
            {!notes?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map(note => (
                  <NoteCard key={note.id} note={note} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div className="space-y-3">
            {!history?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">No history yet</p>
            ) : (
              history.map((h, i) => (
                <HistoryRow key={h.id} entry={h} isFirst={i === 0} />
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note, onDelete }: { note: CandidateNote; onDelete: (id: string) => void }) {
  return (
    <div className={`p-3 rounded-lg border ${note.is_private ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">
                {note.created_by_name || 'Unknown'}
              </span>
              {note.is_private && (
                <span className="inline-flex items-center gap-0.5 text-xs text-amber-700">
                  <Lock className="w-3 h-3" /> Private
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(note.created_at)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.note}</p>
          </div>
        </div>
        <button
          onClick={() => onDelete(note.id)}
          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({ entry, isFirst }: { entry: StageHistory; isFirst: boolean }) {
  const toMeta = STAGE_META[entry.to_stage] ?? STAGE_META['applied'];
  const ToIcon = toMeta.icon;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toMeta.header} border ${toMeta.border} flex-shrink-0`}>
          <ToIcon className="w-3.5 h-3.5 text-gray-700" />
        </div>
        {!isFirst && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {PIPELINE_STAGES.find(s => s.id === entry.to_stage)?.label ?? entry.to_stage}
            </p>
            {entry.from_stage && (
              <p className="text-xs text-gray-500">
                from {PIPELINE_STAGES.find(s => s.id === entry.from_stage)?.label ?? entry.from_stage}
              </p>
            )}
            {entry.note && (
              <p className="mt-1 text-xs text-gray-600 italic">"{entry.note}"</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">{formatRelativeTime(entry.changed_at)}</p>
            {entry.changed_by_name && (
              <p className="text-xs text-gray-500 mt-0.5">{entry.changed_by_name}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
