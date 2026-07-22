// Lightweight HTML sanitizer — removes script tags, inline event handlers, and
// javascript: URIs before rendering user-supplied HTML via dangerouslySetInnerHTML.
// For production deployments with complex rich-text, consider DOMPurify instead.

const SCRIPT_RE   = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const HANDLER_RE  = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;
const JS_URI_RE   = /href\s*=\s*["']?\s*javascript\s*:/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(SCRIPT_RE,  '')
    .replace(HANDLER_RE, '')
    .replace(JS_URI_RE,  'href="#"');
}

/** Use this instead of { __html: raw } to ensure sanitization is applied. */
export function safeHtml(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) };
}
