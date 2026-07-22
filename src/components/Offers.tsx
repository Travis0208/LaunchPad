import { useState, useRef, useCallback } from 'react';
import { safeHtml } from '../lib/sanitize';
import {
  useOffers,
  useUpdateOffer,
  useCreateOffer,
  useApplications,
  useOfferTemplates,
  useCreateOfferTemplate,
  useUpdateOfferTemplate,
  useDeleteOfferTemplate,
} from '../hooks';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { Card, CardHeader, CardBody, Badge, Button, Modal, Spinner, EmptyState, StatCard } from './ui';
import {
  Plus,
  FileText,
  Clock,
  Check,
  Send,
  Eye,
  Download,
  Mail,
  Settings,
  Edit2,
  Trash2,
  ChevronLeft,
  X,
  Printer,
  Save,
  LayoutTemplate,
  DollarSign,
} from 'lucide-react';
import { formatDate, formatCurrency } from '../utils';
import { OFFER_STATUSES } from '../utils/constants';
import { getOfferStatusVariant } from '../utils/helpers';
import type { Offer, OfferTemplate, OfferTemplateField } from '../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderTemplate(html: string, fields: Record<string, string>): string {
  return html.replace(/\[([^\]]+)\]/g, (_, key) => fields[key] ?? `[${key}]`);
}

function buildEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { margin:0; padding:0; background:#f4f4f5; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .wrapper { max-width:680px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .header { background:#1e40af; padding:28px 32px; }
  .header h1 { margin:0; color:#fff; font-size:20px; font-weight:700; }
  .header p  { margin:4px 0 0; color:#bfdbfe; font-size:13px; }
  .body  { padding:32px; color:#374151; font-size:15px; line-height:1.6; }
  .body h3   { color:#1e40af; margin-top:28px; margin-bottom:8px; font-size:16px; }
  .body ul   { padding-left:20px; }
  .body li   { margin-bottom:4px; }
  .footer    { background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; font-size:12px; color:#9ca3af; text-align:center; }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>LaunchPad Recruit</h1>
    <p>Offer of Employment</p>
  </div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">This email was sent by LaunchPad Recruit. Please do not reply directly to this email.</div>
</div>
</body></html>`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type OffersView = 'list' | 'templates';

export function OffersPage() {
  const [view, setView] = useState<OffersView>('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [previewOffer, setPreviewOffer] = useState<any | null>(null);
  const [previewMode, setPreviewMode] = useState<'pdf' | 'email'>('pdf');

  const { data: offers, isLoading } = useOffers(statusFilter === 'all' ? undefined : statusFilter);
  const updateOffer = useUpdateOffer();
  const { success, error } = useNotifications();

  const sendOffer = async (offer: any) => {
    try {
      await updateOffer.mutateAsync({
        id: offer.id,
        data: { status: 'sent', sent_at: new Date().toISOString() } as any,
      });
      success('Offer marked as sent');
    } catch {
      error('Failed to update offer');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateOffer.mutateAsync({
        id,
        data: {
          status,
          responded_at: ['accepted', 'declined'].includes(status) ? new Date().toISOString() : undefined,
        } as any,
      });
      success(`Offer ${status}`);
    } catch {
      error('Failed to update offer status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const stats = {
    total:    offers?.length || 0,
    draft:    offers?.filter((o: any) => o.status === 'draft').length || 0,
    pending:  offers?.filter((o: any) => o.status === 'sent').length || 0,
    accepted: offers?.filter((o: any) => o.status === 'accepted').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
          <p className="text-gray-600 mt-1">Manage and send employment offers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'templates' ? 'outline' : 'ghost'}
            icon={<LayoutTemplate className="w-4 h-4" />}
            onClick={() => setView(v => v === 'templates' ? 'list' : 'templates')}
          >
            Templates
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Create Offer
          </Button>
        </div>
      </div>

      {view === 'templates' ? (
        <TemplatesView />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard icon={FileText} label="Total Offers"      value={stats.total}    color="blue" />
            <StatCard icon={Edit2}   label="Drafts"             value={stats.draft}    color="gray" />
            <StatCard icon={Clock}   label="Awaiting Response"  value={stats.pending}  color="orange" />
            <StatCard icon={Check}   label="Accepted"           value={stats.accepted} color="green" />
          </div>

          <Card>
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                {OFFER_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {!offers?.length ? (
              <EmptyState
                icon={FileText}
                title="No offers found"
                description="Create an offer using a template to get started"
                action={<Button onClick={() => setShowCreateModal(true)}>Create Offer</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offer Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(offers as any[]).map(offer => (
                      <tr key={offer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary-700 font-semibold text-sm">
                                {offer.application?.candidate?.first_name?.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {offer.application?.candidate?.first_name} {offer.application?.candidate?.last_name}
                              </p>
                              <p className="text-xs text-gray-500">{offer.application?.candidate?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{offer.position_title}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(offer.salary_offered)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(offer.offer_date)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={getOfferStatusVariant(offer.status)}>
                            {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost" size="sm"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => { setPreviewOffer(offer); setPreviewMode('pdf'); }}
                            >
                              PDF
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              icon={<Mail className="w-3.5 h-3.5" />}
                              onClick={() => { setPreviewOffer(offer); setPreviewMode('email'); }}
                            >
                              Email
                            </Button>
                            {offer.status === 'draft' && (
                              <>
                                <Button
                                  variant="ghost" size="sm"
                                  icon={<Edit2 className="w-3.5 h-3.5" />}
                                  onClick={() => setSelectedOffer(offer)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  icon={<Send className="w-3.5 h-3.5" />}
                                  onClick={() => sendOffer(offer)}
                                >
                                  Send
                                </Button>
                              </>
                            )}
                            {offer.status === 'sent' && (
                              <>
                                <Button size="sm" variant="outline"
                                  icon={<Check className="w-3.5 h-3.5" />}
                                  onClick={() => updateStatus(offer.id, 'accepted')}
                                >
                                  Accept
                                </Button>
                                <Button size="sm" variant="ghost"
                                  onClick={() => updateStatus(offer.id, 'declined')}
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {showCreateModal && (
        <CreateOfferModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); success('Offer created'); }}
        />
      )}

      {selectedOffer && (
        <EditOfferModal
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
          onSuccess={() => { setSelectedOffer(null); success('Offer saved'); }}
        />
      )}

      {previewOffer && (
        <OfferPreviewModal
          offer={previewOffer}
          mode={previewMode}
          onModeChange={setPreviewMode}
          onClose={() => setPreviewOffer(null)}
        />
      )}
    </div>
  );
}

// ─── Templates View ────────────────────────────────────────────────────────────

function TemplatesView() {
  const { data: templates, isLoading } = useOfferTemplates();
  const deleteTemplate = useDeleteOfferTemplate();
  const [editing, setEditing] = useState<OfferTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const { success, error } = useNotifications();

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      success('Template deleted');
    } catch {
      error('Cannot delete template');
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Offer Templates</h2>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
          New Template
        </Button>
      </div>

      {!templates?.length ? (
        <EmptyState icon={LayoutTemplate} title="No templates" description="Create a template to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="group hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                    {t.is_default && (
                      <span className="inline-flex items-center text-xs text-blue-600 font-medium mt-0.5">
                        Default template
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(t)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!t.is_default && (
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3 truncate">{t.subject}</p>
                <div className="flex flex-wrap gap-1">
                  {(t.fields || []).slice(0, 6).map(f => (
                    <span key={f.id} className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-mono">
                      [{f.field_key}]
                    </span>
                  ))}
                  {(t.fields?.length || 0) > 6 && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                      +{(t.fields?.length || 0) - 6} more
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TemplateEditorModal
          template={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSuccess={() => { setCreating(false); setEditing(null); success(editing ? 'Template updated' : 'Template created'); }}
        />
      )}
    </div>
  );
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

type FieldDraft = { field_key: string; field_label: string; field_type: string; order_index: number };

function TemplateEditorModal({
  template,
  onClose,
  onSuccess,
}: {
  template?: OfferTemplate;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createTemplate = useCreateOfferTemplate();
  const updateTemplate = useUpdateOfferTemplate();
  const { error } = useNotifications();

  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? 'Your Job Offer – [position_title]');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? '');
  const [fields, setFields] = useState<FieldDraft[]>(
    template?.fields?.map(f => ({ field_key: f.field_key, field_label: f.field_label, field_type: f.field_type, order_index: f.order_index }))
    ?? []
  );

  const addField = () => setFields(f => [...f, { field_key: '', field_label: '', field_type: 'text', order_index: f.length }]);
  const removeField = (i: number) => setFields(f => f.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order_index: idx })));
  const updateField = (i: number, patch: Partial<FieldDraft>) =>
    setFields(f => f.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const handleSave = async () => {
    if (!name.trim()) { error('Template name is required'); return; }
    try {
      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, template: { name, subject, body_html: bodyHtml }, fields });
      } else {
        await createTemplate.mutateAsync({ template: { name, subject, body_html: bodyHtml }, fields });
      }
      onSuccess();
    } catch {
      error('Failed to save template');
    }
  };

  return (
    <Modal open onClose={onClose} title={template ? 'Edit Template' : 'New Template'} size="xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Basic info */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Standard Offer Letter"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Body HTML */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Body HTML
            <span className="ml-2 text-xs font-normal text-gray-400">Use [field_key] for placeholders</span>
          </label>
          <textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
            placeholder="<p>Dear <strong>[candidate_name]</strong>,</p>..."
          />
        </div>

        {/* Fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Editable Fields</label>
            <button
              onClick={addField}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={f.field_key}
                  onChange={e => updateField(i, { field_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="field_key"
                  className="col-span-3 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <input
                  value={f.field_label}
                  onChange={e => updateField(i, { field_label: e.target.value })}
                  placeholder="Label"
                  className="col-span-4 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <select
                  value={f.field_type}
                  onChange={e => updateField(i, { field_type: e.target.value })}
                  className="col-span-4 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="date">Date</option>
                  <option value="currency">Currency</option>
                  <option value="number">Number</option>
                </select>
                <button onClick={() => removeField(i)} className="col-span-1 p-1 text-gray-400 hover:text-red-500 flex justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-xs text-gray-400 italic">No fields yet. Add fields that map to [key] placeholders in the body.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} loading={isPending} className="flex-1" icon={<Save className="w-4 h-4" />}>
          {template ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Create Offer Modal ────────────────────────────────────────────────────────

function CreateOfferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const createOffer = useCreateOffer();
  const { data: applications } = useApplications({ includeCandidate: true });
  const { data: templates } = useOfferTemplates();
  const { error } = useNotifications();

  const [step, setStep] = useState<'select' | 'fields'>('select');
  const [applicationId, setApplicationId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const selectedApp = (applications as any[])?.find((a: any) => a.id === applicationId);
  const selectedTemplate = templates?.find(t => t.id === templateId);

  const handleTemplateSelect = (tid: string) => {
    const tmpl = templates?.find(t => t.id === tid);
    if (!tmpl) return;
    setTemplateId(tid);
    // Pre-fill from application data
    const app = (applications as any[])?.find((a: any) => a.id === applicationId);
    const pre: Record<string, string> = {};
    tmpl.fields?.forEach(f => {
      if (f.field_key === 'candidate_name') pre[f.field_key] = `${app?.candidate?.first_name ?? ''} ${app?.candidate?.last_name ?? ''}`.trim();
      if (f.field_key === 'position_title') pre[f.field_key] = app?.vacancy?.job_title ?? '';
      if (f.field_key === 'department')     pre[f.field_key] = app?.vacancy?.department ?? '';
      if (f.field_key === 'location')       pre[f.field_key] = app?.vacancy?.location ?? '';
      if (f.field_key === 'expiry_date') {
        const d = new Date(); d.setDate(d.getDate() + 7);
        pre[f.field_key] = d.toISOString().split('T')[0];
      }
    });
    setFieldValues(pre);
    setStep('fields');
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;
    const rendered = renderTemplate(selectedTemplate.body_html, fieldValues);
    const emailBody = buildEmailHtml(rendered);
    const emailSubject = renderTemplate(selectedTemplate.subject, fieldValues);
    try {
      await createOffer.mutateAsync({
        application_id: applicationId,
        template_id: templateId,
        template_fields: fieldValues,
        position_title: fieldValues['position_title'] || selectedApp?.vacancy?.job_title || '',
        salary_offered: fieldValues['salary_amount'] ? parseFloat(fieldValues['salary_amount'].replace(/[^0-9.]/g, '')) : null,
        start_date: fieldValues['start_date'] || null,
        offer_date: new Date().toISOString().split('T')[0],
        expiry_date: fieldValues['expiry_date'] || null,
        email_subject: emailSubject,
        email_body: emailBody,
        status: 'draft',
        created_by: user?.id,
      } as any);
      onSuccess();
    } catch {
      error('Failed to create offer');
    }
  };

  return (
    <Modal open onClose={onClose} title="Create Offer" size="lg">
      {step === 'select' ? (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidate</label>
            <select
              value={applicationId}
              onChange={e => { setApplicationId(e.target.value); setTemplateId(''); setStep('select'); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select candidate…</option>
              {((applications as any[]) || []).map((app: any) => (
                <option key={app.id} value={app.id}>
                  {app.candidate?.first_name} {app.candidate?.last_name} — {app.vacancy?.job_title}
                </option>
              ))}
            </select>
          </div>

          {applicationId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choose Template</label>
              <div className="space-y-2">
                {(templates || []).map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelect(t.id)}
                    className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100">
                        <FileText className="w-4 h-4 text-blue-600 group-hover:text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{(t.fields?.length || 0)} editable fields</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <button onClick={() => setStep('select')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft className="w-4 h-4" /> Back to template selection
          </button>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">{selectedTemplate?.name}</p>
            <p className="text-xs text-blue-600 mt-0.5">Fill in the fields below — they will be inserted into the offer document</p>
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {selectedTemplate?.fields?.map(f => (
              <FieldInput
                key={f.field_key}
                field={f}
                value={fieldValues[f.field_key] ?? ''}
                onChange={v => setFieldValues(prev => ({ ...prev, [f.field_key]: v }))}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} loading={createOffer.isPending} className="flex-1" icon={<Save className="w-4 h-4" />}>
              Create Offer (Draft)
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Edit Offer Modal ──────────────────────────────────────────────────────────

function EditOfferModal({ offer, onClose, onSuccess }: { offer: any; onClose: () => void; onSuccess: () => void }) {
  const { data: templates } = useOfferTemplates();
  const updateOffer = useUpdateOffer();
  const { error } = useNotifications();

  const template = templates?.find(t => t.id === offer.template_id);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(offer.template_fields ?? {});

  const handleSave = async () => {
    if (!template) return;
    const rendered = renderTemplate(template.body_html, fieldValues);
    const emailBody = buildEmailHtml(rendered);
    const emailSubject = renderTemplate(template.subject, fieldValues);
    try {
      await updateOffer.mutateAsync({
        id: offer.id,
        data: {
          template_fields: fieldValues,
          position_title: fieldValues['position_title'] || offer.position_title,
          salary_offered: fieldValues['salary_amount'] ? parseFloat(fieldValues['salary_amount'].replace(/[^0-9.]/g, '')) : offer.salary_offered,
          start_date: fieldValues['start_date'] || offer.start_date,
          expiry_date: fieldValues['expiry_date'] || offer.expiry_date,
          email_subject: emailSubject,
          email_body: emailBody,
        } as any,
      });
      onSuccess();
    } catch {
      error('Failed to save offer');
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit Offer" size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {template ? (
          template.fields?.map(f => (
            <FieldInput
              key={f.field_key}
              field={f}
              value={fieldValues[f.field_key] ?? ''}
              onChange={v => setFieldValues(prev => ({ ...prev, [f.field_key]: v }))}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500">No template associated with this offer.</p>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} loading={updateOffer.isPending} className="flex-1">Save Changes</Button>
      </div>
    </Modal>
  );
}

// ─── Field Input ───────────────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: OfferTemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.field_label}
        <span className="ml-1.5 text-xs font-mono text-gray-400">[{field.field_key}]</span>
      </label>
      {field.field_type === 'textarea' ? (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} className={`${base} resize-y`} />
      ) : field.field_type === 'date' ? (
        <input type="date" value={value} onChange={e => onChange(e.target.value)} className={base} />
      ) : field.field_type === 'currency' ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
          <input type="number" value={value} onChange={e => onChange(e.target.value)} className={`${base} pl-7`} placeholder="0.00" />
        </div>
      ) : field.field_type === 'number' ? (
        <input type="number" value={value} onChange={e => onChange(e.target.value)} className={base} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={base} />
      )}
    </div>
  );
}

// ─── Offer Preview Modal ───────────────────────────────────────────────────────

function OfferPreviewModal({
  offer,
  mode,
  onModeChange,
  onClose,
}: {
  offer: any;
  mode: 'pdf' | 'email';
  onModeChange: (m: 'pdf' | 'email') => void;
  onClose: () => void;
}) {
  const { data: templates } = useOfferTemplates();
  const printRef = useRef<HTMLDivElement>(null);

  const template = templates?.find(t => t.id === offer.template_id);
  const fields: Record<string, string> = offer.template_fields ?? {};
  const renderedBody = template ? renderTemplate(template.body_html, fields) : offer.email_body ?? '<p>No content available.</p>';
  const subject = offer.email_subject || offer.position_title || 'Job Offer';

  const handlePrint = useCallback(() => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${subject}</title>
      <style>
        @page { margin: 20mm 25mm; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 14px; line-height: 1.7; }
        .letterhead { display:flex; align-items:center; justify-content:space-between; border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 28px; }
        .company-name { font-size: 22px; font-weight: 700; color: #1e40af; }
        .doc-title { font-size: 12px; color: #6b7280; text-align: right; }
        h3 { color: #1e40af; font-size: 15px; margin-top: 24px; margin-bottom: 8px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; }
        .footer { margin-top: 48px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #9ca3af; }
      </style>
    </head><body>
      <div class="letterhead">
        <div class="company-name">LaunchPad Recruit</div>
        <div class="doc-title">Offer of Employment<br/>${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      ${renderedBody}
      <div class="footer">This document is confidential and intended only for the named recipient.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }, [renderedBody, subject]);

  return (
    <Modal open onClose={onClose} title="Offer Preview" size="xl">
      <div className="flex flex-col h-full">
        {/* Mode toggle + actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['pdf', 'email'] as const).map(m => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                {m === 'pdf' ? 'PDF / Print' : 'Email Preview'}
              </button>
            ))}
          </div>
          {mode === 'pdf' && (
            <Button size="sm" icon={<Printer className="w-3.5 h-3.5" />} onClick={handlePrint}>
              Print / Save PDF
            </Button>
          )}
        </div>

        {/* Preview pane */}
        <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ height: '60vh' }}>
          {mode === 'pdf' ? (
            <div ref={printRef} className="h-full overflow-y-auto bg-white p-8 md:p-12">
              {/* Letterhead */}
              <div className="flex items-start justify-between border-b-2 border-blue-700 pb-4 mb-8">
                <div>
                  <p className="text-2xl font-bold text-blue-700 tracking-tight">LaunchPad Recruit</p>
                  <p className="text-xs text-gray-400 mt-0.5">Talent Acquisition Platform</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">Offer of Employment</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400">Ref: {offer.application?.reference_number ?? '—'}</p>
                </div>
              </div>

              {/* Body */}
              <div
                className="prose prose-sm max-w-none text-gray-800 [&_h3]:text-blue-700 [&_h3]:font-semibold [&_strong]:font-semibold"
                dangerouslySetInnerHTML={safeHtml(renderedBody)}
              />

              {/* Signature block */}
              <div className="mt-12 pt-6 border-t border-gray-200 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs text-gray-500 mb-6">Recruiter Signature</p>
                  <div className="border-b border-gray-300 w-full" />
                  <p className="text-xs text-gray-400 mt-1">Date: _______________</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-6">Candidate Acceptance Signature</p>
                  <div className="border-b border-gray-300 w-full" />
                  <p className="text-xs text-gray-400 mt-1">Date: _______________</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-8 text-center">
                This document is confidential and intended only for the named recipient.
              </p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto bg-gray-100 p-4">
              <div className="max-w-2xl mx-auto">
                {/* Email meta */}
                <div className="bg-white border border-gray-200 rounded-t-lg px-4 py-3 space-y-1">
                  <p className="text-xs text-gray-500"><span className="font-medium">To:</span> {offer.application?.candidate?.email ?? '—'}</p>
                  <p className="text-xs text-gray-500"><span className="font-medium">Subject:</span> {subject}</p>
                </div>
                {/* Email body */}
                <div className="bg-white rounded-b-lg shadow-sm overflow-hidden">
                  <div className="bg-blue-700 px-6 py-5">
                    <p className="text-white font-bold text-lg">LaunchPad Recruit</p>
                    <p className="text-blue-200 text-xs mt-0.5">Offer of Employment</p>
                  </div>
                  <div
                    className="px-6 py-6 text-sm text-gray-700 leading-relaxed [&_h3]:text-blue-700 [&_h3]:font-semibold [&_h3]:mt-5 [&_ul]:list-disc [&_ul]:pl-4"
                    dangerouslySetInnerHTML={safeHtml(renderedBody)}
                  />
                  <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-xs text-gray-400 text-center">
                    This email was sent by LaunchPad Recruit. Please do not reply directly.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
