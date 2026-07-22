-- Offer letter templates with editable fields

CREATE TABLE offer_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  subject        text NOT NULL DEFAULT '',
  body_html      text NOT NULL DEFAULT '',
  is_default     boolean NOT NULL DEFAULT false,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offer_template_fields (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES offer_templates(id) ON DELETE CASCADE,
  field_key    text NOT NULL,
  field_label  text NOT NULL,
  field_type   text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','date','currency','textarea')),
  order_index  int  NOT NULL DEFAULT 0,
  UNIQUE (template_id, field_key)
);

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS template_id      uuid REFERENCES offer_templates(id),
  ADD COLUMN IF NOT EXISTS template_fields  jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_subject    text,
  ADD COLUMN IF NOT EXISTS email_body       text,
  ADD COLUMN IF NOT EXISTS pdf_url          text;

ALTER TABLE offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_offer_templates" ON offer_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_offer_templates" ON offer_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_offer_templates" ON offer_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_offer_templates" ON offer_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_offer_template_fields" ON offer_template_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_offer_template_fields" ON offer_template_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_offer_template_fields" ON offer_template_fields FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_offer_template_fields" ON offer_template_fields FOR DELETE TO authenticated USING (true);

-- Seed default template using a fixed UUID so it is idempotent
INSERT INTO offer_templates (id, name, subject, body_html, is_default) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Standard Offer Letter',
  'Your Job Offer',
  '<p>Dear <strong>[candidate_name]</strong>,</p><p>We are delighted to offer you the position of <strong>[position_title]</strong> within the <strong>[department]</strong> department, reporting to <strong>[reporting_manager]</strong>.</p><h3>Offer Details</h3><ul><li><strong>Start Date:</strong> [start_date]</li><li><strong>Salary:</strong> [salary_amount] per annum</li><li><strong>Employment Type:</strong> [employment_type]</li><li><strong>Location:</strong> [location]</li></ul><h3>Terms &amp; Conditions</h3><p>[terms_and_conditions]</p><p>This offer is subject to satisfactory reference checks and is valid until <strong>[expiry_date]</strong>.</p><p>Please confirm your acceptance by signing and returning this letter.</p><p>We look forward to welcoming you to our team.</p><p>Warm regards,<br/><strong>[recruiter_name]</strong><br/>[recruiter_title]</p>',
  true
);

INSERT INTO offer_template_fields (template_id, field_key, field_label, field_type, order_index) VALUES
  ('00000000-0000-0000-0000-000000000001', 'candidate_name',       'Candidate Name',       'text',     0),
  ('00000000-0000-0000-0000-000000000001', 'position_title',       'Position Title',       'text',     1),
  ('00000000-0000-0000-0000-000000000001', 'department',           'Department',           'text',     2),
  ('00000000-0000-0000-0000-000000000001', 'reporting_manager',    'Reporting Manager',    'text',     3),
  ('00000000-0000-0000-0000-000000000001', 'start_date',           'Start Date',           'date',     4),
  ('00000000-0000-0000-0000-000000000001', 'salary_amount',        'Salary Amount',        'currency', 5),
  ('00000000-0000-0000-0000-000000000001', 'employment_type',      'Employment Type',      'text',     6),
  ('00000000-0000-0000-0000-000000000001', 'location',             'Location',             'text',     7),
  ('00000000-0000-0000-0000-000000000001', 'terms_and_conditions', 'Terms & Conditions',   'textarea', 8),
  ('00000000-0000-0000-0000-000000000001', 'expiry_date',          'Expiry Date',          'date',     9),
  ('00000000-0000-0000-0000-000000000001', 'recruiter_name',       'Recruiter Name',       'text',     10),
  ('00000000-0000-0000-0000-000000000001', 'recruiter_title',      'Recruiter Title',      'text',     11);
