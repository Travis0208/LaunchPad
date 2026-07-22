import { useState, useEffect } from 'react';
import { useAuth, useNotifications } from '../hooks';
import { Card, CardBody, Badge, Button, Input, Spinner } from './ui';
import { User, Shield, Bell, Building, Save, Check, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CompanySettings, NotificationPreferences, EmailSettings } from '../lib/supabase';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile',       label: 'Profile',       icon: User     },
  { id: 'company',       label: 'Company',       icon: Building },
  { id: 'notifications', label: 'Notifications', icon: Bell     },
  { id: 'email',         label: 'Email',         icon: Mail,  adminOnly: true },
  { id: 'team',          label: 'Team',          icon: Shield, adminOnly: true },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const visibleTabs = TABS.filter(t => !('adminOnly' in t) || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <Card className="lg:col-span-1 h-fit">
          <nav className="p-2">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Panel */}
        <Card className="lg:col-span-3">
          {activeTab === 'profile'       && <ProfilePanel />}
          {activeTab === 'company'       && <CompanyPanel />}
          {activeTab === 'notifications' && <NotificationsPanel />}
          {activeTab === 'email'  && isAdmin && <EmailPanel />}
          {activeTab === 'team'   && isAdmin && <TeamPanel />}
        </Card>
      </div>
    </div>
  );
}

// ─── Profile panel ────────────────────────────────────────────────────────────

function ProfilePanel() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name:  '',
    job_title:  '',
    phone:      '',
  });

  useEffect(() => {
    if (!profile) return;
    const parts = (profile.full_name ?? '').trim().split(' ');
    const last  = parts.length > 1 ? parts.slice(1).join(' ') : '';
    setForm({
      first_name: parts[0] ?? '',
      last_name:  last,
      job_title:  profile.job_title  ?? '',
      phone:      profile.phone      ?? '',
    });
  }, [profile]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!user) return;
    if (!form.first_name.trim()) {
      notifyError('First name is required');
      return;
    }
    setSaving(true);
    try {
      const full_name = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ');
      const payload = {
        full_name,
        job_title:  form.job_title.trim() || null,
        phone:      form.phone.trim()     || null,
        updated_at: new Date().toISOString(),
      };

      if (profile) {
        const { error } = await supabase.from('user_profiles').update(payload).eq('id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_profiles').insert({
          ...payload,
          id:     user.id,
          role:   'recruiter',
          active: true,
        });
        if (error) throw error;
      }

      await refreshProfile();
      success('Profile saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      notifyError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <CardBody className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </CardBody>
    );
  }

  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ') || 'Your Name';
  const initials    = [form.first_name[0], form.last_name[0]].filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <CardBody className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
        <p className="text-sm text-gray-500 mt-1">Update your personal details and contact information</p>
      </div>

      {/* Avatar row */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md flex-shrink-0">
          <span className="text-xl font-bold text-white">{initials}</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{displayName}</p>
          <div className="flex items-center gap-2 mt-1">
            {profile && <Badge variant="primary" className="capitalize">{profile.role}</Badge>}
            {form.job_title && <span className="text-sm text-gray-500">{form.job_title}</span>}
          </div>
        </div>
      </div>

      {!profile && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700">Complete your profile to get started.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <Input
          label="First Name"
          value={form.first_name}
          onChange={set('first_name')}
          placeholder="Jane"
        />
        <Input
          label="Surname"
          value={form.last_name}
          onChange={set('last_name')}
          placeholder="Smith"
        />
        <div className="sm:col-span-2">
          <Input
            label="Position Title"
            value={form.job_title}
            onChange={set('job_title')}
            placeholder="HR Manager"
          />
        </div>
        <Input
          label="Phone Number"
          value={form.phone}
          onChange={set('phone')}
          placeholder="+27 XX XXX XXXX"
        />
        {/* Email is read-only — managed by auth */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-600 truncate">{user?.email ?? '—'}</span>
            <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">read only</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <Button
          icon={saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={saving}
          className={saved ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Profile'}
        </Button>
      </div>
    </CardBody>
  );
}
// ─── Company panel ────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Transport & Logistics',
  'Manufacturing',
  'Construction',
  'Mining & Resources',
  'Retail & FMCG',
  'Financial Services',
  'Healthcare',
  'Technology',
  'Government & Public Sector',
  'Education',
  'Hospitality & Tourism',
  'Agriculture',
  'Other',
];

const COUNTRIES = [
  'South Africa', 'Australia', 'United Kingdom', 'United States',
  'Canada', 'New Zealand', 'Kenya', 'Nigeria', 'Zimbabwe', 'Botswana',
  'Namibia', 'Zambia', 'Tanzania', 'Uganda', 'Other',
];

type CompanyForm = {
  company_name: string;
  industry: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
};

const EMPTY_COMPANY: CompanyForm = {
  company_name: '',
  industry: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  country: '',
};

function CompanyPanel() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_COMPANY);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setForm({
          company_name: data.company_name ?? '',
          industry:     data.industry     ?? '',
          website:      data.website      ?? '',
          phone:        data.phone        ?? '',
          email:        data.email        ?? '',
          address:      data.address      ?? '',
          city:         data.city         ?? '',
          country:      data.country      ?? '',
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const set = (field: keyof CompanyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        industry:     form.industry  || null,
        website:      form.website.trim()  || null,
        phone:        form.phone.trim()    || null,
        email:        form.email.trim()    || null,
        address:      form.address.trim()  || null,
        city:         form.city.trim()     || null,
        country:      form.country        || null,
        updated_at:   new Date().toISOString(),
        updated_by:   user?.id ?? null,
      };

      if (rowId) {
        const { error } = await supabase.from('company_settings').update(payload).eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('company_settings').insert(payload).select().single();
        if (error) throw error;
        setRowId(data.id);
      }
      success('Company information saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      notifyError('Failed to save company information');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CardBody className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </CardBody>
    );
  }

  return (
    <CardBody className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
        <p className="text-sm text-gray-500 mt-1">Details used on job postings, offers, and reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="sm:col-span-2">
          <Input
            label="Company Name"
            value={form.company_name}
            onChange={set('company_name')}
            placeholder="Acme Logistics Ltd"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
          <select
            value={form.industry}
            onChange={set('industry')}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select industry…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select
            value={form.country}
            onChange={set('country')}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select country…</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <Input
          type="email"
          label="Company Email"
          value={form.email}
          onChange={set('email')}
          placeholder="recruitment@company.com"
        />

        <Input
          label="Company Phone"
          value={form.phone}
          onChange={set('phone')}
          placeholder="+27 11 XXX XXXX"
        />

        <Input
          type="url"
          label="Website"
          value={form.website}
          onChange={set('website')}
          placeholder="https://company.com"
        />

        <Input
          label="City"
          value={form.city}
          onChange={set('city')}
          placeholder="Johannesburg"
        />

        <div className="sm:col-span-2">
          <Input
            label="Street Address"
            value={form.address}
            onChange={set('address')}
            placeholder="123 Main Street, Business Park"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <Button
          icon={saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={saving}
          className={saved ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>
    </CardBody>
  );
}

// ─── Notifications panel ──────────────────────────────────────────────────────

type NotifForm = Omit<NotificationPreferences, 'user_id' | 'updated_at'>;

const DEFAULT_NOTIF: NotifForm = {
  new_application:    true,
  interview_reminder: true,
  offer_response:     true,
  weekly_report:      false,
  pipeline_updates:   true,
  video_assessments:  false,
};

const NOTIF_ITEMS: { key: keyof NotifForm; label: string; desc: string }[] = [
  { key: 'new_application',    label: 'New Applications',     desc: 'Get notified when a candidate applies to a vacancy' },
  { key: 'pipeline_updates',   label: 'Pipeline Updates',     desc: 'Status changes and stage movements for candidates' },
  { key: 'interview_reminder', label: 'Interview Reminders',  desc: 'Reminders before scheduled interviews' },
  { key: 'offer_response',     label: 'Offer Responses',      desc: 'When candidates accept or decline an offer' },
  { key: 'video_assessments',  label: 'Video Assessments',    desc: 'When candidates complete video assessments' },
  { key: 'weekly_report',      label: 'Weekly Summary',       desc: 'Recruitment activity digest every Monday morning' },
];

function NotificationsPanel() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasRow, setHasRow] = useState(false);
  const [prefs, setPrefs] = useState<NotifForm>(DEFAULT_NOTIF);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setHasRow(true);
        setPrefs({
          new_application:    data.new_application,
          interview_reminder: data.interview_reminder,
          offer_response:     data.offer_response,
          weekly_report:      data.weekly_report,
          pipeline_updates:   data.pipeline_updates,
          video_assessments:  data.video_assessments,
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const toggle = (key: keyof NotifForm) =>
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...prefs, user_id: user.id, updated_at: new Date().toISOString() };
      const { error } = hasRow
        ? await supabase.from('notification_preferences').update(payload).eq('user_id', user.id)
        : await supabase.from('notification_preferences').insert(payload);
      if (error) throw error;
      setHasRow(true);
      success('Notification preferences saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      notifyError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CardBody className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </CardBody>
    );
  }

  return (
    <CardBody className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
        <p className="text-sm text-gray-500 mt-1">Choose which notifications you receive in-app</p>
      </div>

      <div className="space-y-2 max-w-xl">
        {NOTIF_ITEMS.map(item => (
          <div
            key={item.key}
            className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              aria-checked={prefs[item.key]}
              role="switch"
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                prefs[item.key] ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  prefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {!hasRow && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-xl">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">These are your default preferences. Save to personalise them.</p>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <Button
          icon={saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={saving}
          className={saved ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Preferences'}
        </Button>
      </div>
    </CardBody>
  );
}

// ─── Team panel ───────────────────────────────────────────────────────────────

function TeamPanel() {
  const { success, error: notifyError } = useNotifications();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at');
    if (data) setUsers(data as UserProfile[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (userId: string, active: boolean) => {
    try {
      await supabase.from('user_profiles').update({ active }).eq('id', userId);
      success(`User ${active ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch {
      notifyError('Failed to update user');
    }
  };

  if (loading) {
    return (
      <CardBody className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </CardBody>
    );
  }

  return (
    <CardBody className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
        <p className="text-sm text-gray-500 mt-1">Manage your recruitment team</p>
      </div>

      <div className="space-y-2">
        {users.map(u => {
          const initials = u.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
          return (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-white">{initials}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={u.role === 'administrator' ? 'primary' : 'gray'} className="capitalize">{u.role}</Badge>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-500">{u.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleActive(u.id, !u.active)}
                className={u.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
              >
                {u.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          );
        })}
      </div>
    </CardBody>
  );
}

// ─── Email panel ──────────────────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { value: 'smtp',     label: 'SMTP (any mail server)' },
  { value: 'resend',   label: 'Resend'                 },
  { value: 'sendgrid', label: 'SendGrid'               },
  { value: 'mailgun',  label: 'Mailgun'                },
] as const;

type EmailForm = {
  provider: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  resend_api_key: string;
  sendgrid_api_key: string;
};

const EMPTY_EMAIL: EmailForm = {
  provider: 'smtp', from_email: '', from_name: 'Recruitment Team',
  reply_to: '', smtp_host: '', smtp_port: '587', smtp_secure: false,
  smtp_username: '', smtp_password: '', resend_api_key: '', sendgrid_api_key: '',
};

function EmailPanel() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [form, setForm] = useState<EmailForm>(EMPTY_EMAIL);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('email_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setRowId(data.id);
        setForm({
          provider:        data.provider        ?? 'smtp',
          from_email:      data.from_email       ?? '',
          from_name:       data.from_name        ?? 'Recruitment Team',
          reply_to:        data.reply_to         ?? '',
          smtp_host:       data.smtp_host        ?? '',
          smtp_port:       String(data.smtp_port ?? 587),
          smtp_secure:     data.smtp_secure      ?? false,
          smtp_username:   data.smtp_username    ?? '',
          smtp_password:   data.smtp_password    ?? '',
          resend_api_key:  data.resend_api_key   ?? '',
          sendgrid_api_key:data.sendgrid_api_key ?? '',
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const set = (field: keyof EmailForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.from_email.trim()) { notifyError('From email is required'); return; }
    setSaving(true);
    try {
      const payload = {
        provider:         form.provider,
        from_email:       form.from_email.trim(),
        from_name:        form.from_name.trim() || 'Recruitment Team',
        reply_to:         form.reply_to.trim()  || null,
        smtp_host:        form.smtp_host.trim() || null,
        smtp_port:        parseInt(form.smtp_port) || 587,
        smtp_secure:      form.smtp_secure,
        smtp_username:    form.smtp_username.trim()    || null,
        smtp_password:    form.smtp_password.trim()    || null,
        resend_api_key:   form.resend_api_key.trim()   || null,
        sendgrid_api_key: form.sendgrid_api_key.trim() || null,
        updated_at:       new Date().toISOString(),
        updated_by:       user?.id ?? null,
      };

      if (rowId) {
        const { error } = await supabase.from('email_settings').update(payload).eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('email_settings').insert(payload).select().single();
        if (error) throw error;
        setRowId(data.id);
      }
      success('Email settings saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      notifyError('Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CardBody className="flex items-center justify-center py-12"><Spinner size="lg" /></CardBody>;
  }

  const showSmtp     = form.provider === 'smtp';
  const showResend   = form.provider === 'resend';
  const showSendgrid = form.provider === 'sendgrid';

  return (
    <CardBody className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Email Configuration</h3>
        <p className="text-sm text-gray-500 mt-1">Configure outbound email for invitations, offers, and candidate communications</p>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl">
        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          No Microsoft integration required. All emails are sent via your configured provider using the recruitment mailbox (e.g. recruitment@company.co.za).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {/* Provider */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Provider</label>
          <select value={form.provider} onChange={set('provider')}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {EMAIL_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* From email + name */}
        <Input label="From Email (recruitment mailbox)" type="email" value={form.from_email} onChange={set('from_email')}
          placeholder="recruitment@company.co.za" />
        <Input label="From Name" value={form.from_name} onChange={set('from_name')} placeholder="Recruitment Team" />
        <div className="sm:col-span-2">
          <Input label="Reply-To (optional)" type="email" value={form.reply_to} onChange={set('reply_to')}
            placeholder="hr@company.co.za" />
        </div>

        {/* SMTP fields */}
        {showSmtp && <>
          <Input label="SMTP Host" value={form.smtp_host} onChange={set('smtp_host')} placeholder="smtp.gmail.com" />
          <Input label="SMTP Port" type="number" value={form.smtp_port} onChange={set('smtp_port')} placeholder="587" />
          <Input label="SMTP Username" value={form.smtp_username} onChange={set('smtp_username')} placeholder="username or email" />
          <Input label="SMTP Password" type="password" value={form.smtp_password} onChange={set('smtp_password')} placeholder="••••••••" />
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="smtp_secure" checked={form.smtp_secure}
              onChange={e => setForm(prev => ({ ...prev, smtp_secure: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label htmlFor="smtp_secure" className="text-sm text-gray-700">Use SSL/TLS (port 465)</label>
          </div>
        </>}

        {/* Resend */}
        {showResend && (
          <div className="sm:col-span-2">
            <Input label="Resend API Key" type="password" value={form.resend_api_key} onChange={set('resend_api_key')} placeholder="re_…" />
            <p className="text-xs text-gray-400 mt-1">Get your API key from resend.com — free tier sends 3,000 emails/month.</p>
          </div>
        )}

        {/* SendGrid */}
        {showSendgrid && (
          <div className="sm:col-span-2">
            <Input label="SendGrid API Key" type="password" value={form.sendgrid_api_key} onChange={set('sendgrid_api_key')} placeholder="SG.…" />
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <Button
          icon={saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={saving}
          className={saved ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Email Settings'}
        </Button>
      </div>
    </CardBody>
  );
}
