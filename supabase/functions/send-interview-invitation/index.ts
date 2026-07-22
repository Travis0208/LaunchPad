import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Email sending ────────────────────────────────────────────────────────────

interface EmailPayload {
  to: string;
  toName: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  from: string;
  fromName: string;
  replyTo?: string;
}

interface EmailConfig {
  provider: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  resendApiKey?: string;
  sendgridApiKey?: string;
}

async function sendViaResend(config: EmailConfig, payload: EmailPayload): Promise<boolean> {
  const apiKey = config.resendApiKey ?? Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;

  const body: Record<string, unknown> = {
    from:    `${payload.fromName} <${payload.from}>`,
    to:      [payload.to],
    subject: payload.subject,
    html:    payload.html,
  };
  if (payload.replyTo) body.reply_to = payload.replyTo;
  if (payload.attachments?.length) {
    body.attachments = payload.attachments.map(a => ({
      filename: a.filename,
      content:  btoa(a.content),
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Resend error:", await res.text());
    return false;
  }
  return true;
}

async function sendViaSendGrid(config: EmailConfig, payload: EmailPayload): Promise<boolean> {
  const apiKey = config.sendgridApiKey ?? Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) return false;

  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: payload.to, name: payload.toName }] }],
    from:    { email: payload.from, name: payload.fromName },
    subject: payload.subject,
    content: [{ type: "text/html", value: payload.html }],
  };
  if (payload.replyTo) (body as any).reply_to = { email: payload.replyTo };
  if (payload.attachments?.length) {
    body.attachments = payload.attachments.map(a => ({
      content:     btoa(a.content),
      filename:    a.filename,
      type:        a.contentType,
      disposition: "attachment",
    }));
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("SendGrid error:", await res.text());
    return false;
  }
  return true;
}

async function sendViaSmtp(config: EmailConfig, payload: EmailPayload): Promise<boolean> {
  const host     = config.smtpHost     ?? Deno.env.get("SMTP_HOST");
  const port     = config.smtpPort     ?? parseInt(Deno.env.get("SMTP_PORT") ?? "587");
  const username = config.smtpUsername ?? Deno.env.get("SMTP_USERNAME");
  const password = config.smtpPassword ?? Deno.env.get("SMTP_PASSWORD");

  if (!host || !username || !password) return false;

  try {
    const { SMTPClient } = await import("npm:emailjs@4.0.3");
    const client = new SMTPClient({
      user:     username,
      password: password,
      host,
      port,
      tls:      config.smtpSecure ?? port === 465,
    });

    const attachmentParts = (payload.attachments ?? []).map(a => ({
      name:        a.filename,
      type:        a.contentType,
      data:        a.content,
      alternative: false,
    }));

    await client.sendAsync({
      from:        `${payload.fromName} <${payload.from}>`,
      to:          payload.to,
      subject:     payload.subject,
      attachment:  [
        { data: payload.html, alternative: true },
        ...attachmentParts,
      ],
    });
    return true;
  } catch (err) {
    console.error("SMTP error:", err);
    return false;
  }
}

async function sendEmail(config: EmailConfig, payload: EmailPayload): Promise<boolean> {
  // Try providers in priority order
  if (config.provider === "resend"   || config.resendApiKey   || Deno.env.get("RESEND_API_KEY")) {
    if (await sendViaResend(config, payload)) return true;
  }
  if (config.provider === "sendgrid" || config.sendgridApiKey || Deno.env.get("SENDGRID_API_KEY")) {
    if (await sendViaSendGrid(config, payload)) return true;
  }
  if (config.provider === "smtp"     || config.smtpHost       || Deno.env.get("SMTP_HOST")) {
    if (await sendViaSmtp(config, payload)) return true;
  }

  // No provider configured — log for dev, return gracefully
  console.warn("No email provider configured. Email not sent.");
  console.log("Would have sent to:", payload.to, "Subject:", payload.subject);
  return false;
}

// ─── ICS calendar attachment ──────────────────────────────────────────────────

function buildICS(params: {
  uid:           string;
  subject:       string;
  description:   string;
  location:      string;
  startIso:      string;
  endIso:        string;
  organiserEmail:string;
  attendeeEmail: string;
}): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LaunchPad Recruit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}@launchpad.recruit`,
    `DTSTART:${fmt(params.startIso)}`,
    `DTEND:${fmt(params.endIso)}`,
    `SUMMARY:${params.subject}`,
    `DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`,
    `LOCATION:${params.location}`,
    `ORGANIZER:mailto:${params.organiserEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${params.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function typeLabel(interviewType: string): string {
  const labels: Record<string, string> = {
    teams:       "Microsoft Teams",
    zoom:        "Zoom",
    google_meet: "Google Meet",
    video:       "Video Call",
    phone:       "Phone Call",
    in_person:   "In Person",
  };
  return labels[interviewType] ?? interviewType;
}

function buildEmailHtml(params: {
  candidateName:  string;
  jobTitle:       string;
  department:     string;
  interviewType:  string;
  startDt:        Date;
  durationMinutes:number;
  location?:      string | null;
  meetingUrl?:    string | null;
  rsvpUrl:        string;
  organiserEmail: string;
  fromName:       string;
}): string {
  const dateStr = params.startDt.toLocaleDateString("en-ZA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Africa/Johannesburg",
  });
  const timeStr = params.startDt.toLocaleTimeString("en-ZA", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
  });

  const formatLabel = typeLabel(params.interviewType);
  const locationLine = params.meetingUrl
    ? `<a href="${params.meetingUrl}" style="color:#2563eb">Join Meeting</a>`
    : (params.location ?? "Details to follow");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <div style="background:linear-gradient(135deg,#1a3c5e,#0f2231);padding:32px;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:24px">Interview Invitation</h1>
        <p style="color:#94a3b8;margin:8px 0 0">${params.jobTitle} — ${params.department}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px">Dear ${params.candidateName},</p>
        <p>We are pleased to invite you to an interview for the <strong>${params.jobTitle}</strong> position.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600;width:140px">Date</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${dateStr}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600">Time</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${timeStr} (SAST)</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600">Duration</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${params.durationMinutes} minutes</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:600">Format</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${formatLabel}</td></tr>
          <tr><td style="padding:12px 16px;font-weight:600">Location</td><td style="padding:12px 16px">${locationLine}</td></tr>
        </table>
        <p style="text-align:center;margin:32px 0">
          <a href="${params.rsvpUrl}?response=accepted" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:12px">Accept</a>
          <a href="${params.rsvpUrl}?response=declined" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Decline</a>
        </p>
        <p style="font-size:13px;color:#6b7280;text-align:center">
          Or visit: <a href="${params.rsvpUrl}" style="color:#2563eb">${params.rsvpUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="font-size:13px;color:#6b7280">
          If you have any questions, please contact us at
          <a href="mailto:${params.organiserEmail}" style="color:#2563eb">${params.organiserEmail}</a>.
        </p>
        <p style="font-size:12px;color:#9ca3af;margin-top:16px">
          Sent by ${params.fromName} via LaunchPad Recruit
        </p>
      </div>
    </div>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { interview_id } = await req.json();
    if (!interview_id) {
      return new Response(JSON.stringify({ error: "interview_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch interview + related data ────────────────────────────────────
    const { data: interview, error: fetchErr } = await supabase
      .from("interviews")
      .select(`
        *,
        application:applications(
          *,
          candidate:candidates(*),
          vacancy:vacancies(*)
        )
      `)
      .eq("id", interview_id)
      .single();

    if (fetchErr || !interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidate = interview.application?.candidate;
    const vacancy   = interview.application?.vacancy;

    if (!candidate || !vacancy) {
      return new Response(JSON.stringify({ error: "Missing candidate/vacancy data" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load email config from DB (service role bypasses RLS) ────────────
    const { data: emailSettings } = await supabase
      .from("email_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recruitmentEmail = Deno.env.get("RECRUITMENT_EMAIL")
      ?? emailSettings?.from_email
      ?? "recruitment@launchpad.co.za";

    const emailConfig: EmailConfig = {
      provider:        emailSettings?.provider         ?? "smtp",
      smtpHost:        emailSettings?.smtp_host        ?? Deno.env.get("SMTP_HOST"),
      smtpPort:        emailSettings?.smtp_port        ?? parseInt(Deno.env.get("SMTP_PORT") ?? "587"),
      smtpSecure:      emailSettings?.smtp_secure      ?? false,
      smtpUsername:    emailSettings?.smtp_username    ?? Deno.env.get("SMTP_USERNAME"),
      smtpPassword:    emailSettings?.smtp_password    ?? Deno.env.get("SMTP_PASSWORD"),
      fromEmail:       recruitmentEmail,
      fromName:        emailSettings?.from_name        ?? "Recruitment Team",
      replyTo:         emailSettings?.reply_to         ?? recruitmentEmail,
      resendApiKey:    emailSettings?.resend_api_key   ?? Deno.env.get("RESEND_API_KEY"),
      sendgridApiKey:  emailSettings?.sendgrid_api_key ?? Deno.env.get("SENDGRID_API_KEY"),
    };

    // ── Resolve meeting details ───────────────────────────────────────────
    const startDt        = new Date(interview.scheduled_at);
    const endDt          = new Date(startDt.getTime() + interview.duration_minutes * 60_000);
    const startIso       = startDt.toISOString();
    const endIso         = endDt.toISOString();

    // meeting_url is the new generic field; fall back to teams_meeting_url for older records
    const meetingUrl: string | null = interview.meeting_url ?? interview.teams_meeting_url ?? null;

    const organiserEmail = interview.organiser_email
      ?? Deno.env.get("RECRUITMENT_EMAIL")
      ?? emailConfig.fromEmail;

    const rsvpBase  = Deno.env.get("SITE_URL") ?? "https://launchpad.co.za";
    const rsvpUrl   = `${rsvpBase}/interview-rsvp/${interview.rsvp_token}`;
    const subject   = `Interview Invitation: ${vacancy.job_title}`;

    // ── Build email HTML ──────────────────────────────────────────────────
    const htmlBody = buildEmailHtml({
      candidateName:   `${candidate.first_name} ${candidate.last_name}`,
      jobTitle:        vacancy.job_title,
      department:      vacancy.department,
      interviewType:   interview.interview_type,
      startDt,
      durationMinutes: interview.duration_minutes,
      location:        interview.location,
      meetingUrl,
      rsvpUrl,
      organiserEmail,
      fromName:        emailConfig.fromName,
    });

    // ── Build ICS attachment ──────────────────────────────────────────────
    const icsContent = buildICS({
      uid:            interview.rsvp_token ?? interview.id,
      subject,
      description:    `Please confirm your attendance: ${rsvpUrl}`,
      location:       meetingUrl ?? interview.location ?? typeLabel(interview.interview_type),
      startIso,
      endIso,
      organiserEmail,
      attendeeEmail:  candidate.email,
    });

    // ── Send email ────────────────────────────────────────────────────────
    const emailSent = await sendEmail(emailConfig, {
      to:       candidate.email,
      toName:   `${candidate.first_name} ${candidate.last_name}`,
      subject,
      html:     htmlBody,
      from:     emailConfig.fromEmail,
      fromName: emailConfig.fromName,
      replyTo:  emailConfig.replyTo,
      attachments: [{
        filename:    "interview-invitation.ics",
        content:     icsContent,
        contentType: "text/calendar",
      }],
    });

    // ── Persist status update ─────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      status:             "invitation_sent",
      invitation_sent_at: new Date().toISOString(),
      organiser_email:    organiserEmail,
    };

    await supabase.from("interviews").update(updatePayload).eq("id", interview_id);

    // Log delivery
    await supabase.from("interview_invitations").insert({
      interview_id,
      sent_to_email:   candidate.email,
      delivery_status: emailSent ? "sent" : "no_provider",
    });

    // Advance pipeline
    await supabase.rpc("move_to_stage", {
      p_application_id:  interview.application_id,
      p_to_stage:        "interview_invited",
      p_changed_by_name: "System",
      p_note:            "Interview invitation sent",
    });

    return new Response(
      JSON.stringify({ ok: true, emailSent, rsvpUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("send-interview-invitation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
