/**
 * Every email AMP sends, in one branded layout (founder, 2026-11-17: "We
 * always want a really attractive HTML version of all of the emails we send
 * going forward"). A sender writes its content once, as blocks; `renderEmail`
 * turns the same blocks into the HTML part and the plain-text part, so the two
 * never drift. There are no per-email templates.
 *
 * The HTML is built for mail clients, not browsers: table layout, inline
 * styles, one `<style>` block that only enhances (dark mode, phone padding),
 * no external CSS, no script, no web fonts. Its one image is the AMP mark,
 * served from the AMP origin with alt text. Nothing in it measures the reader:
 * no tracking pixel, no redirecting links, no analytics parameters.
 */
import { brand, brandTitle } from "../brand.js";

/** A link the reader acts on: `label` in HTML, the URL itself in plain text. */
export interface EmailLink {
  label: string;
  url: string;
}

/**
 * One piece of an email. In plain text, blocks are separated by a blank line.
 *
 * - A string is a paragraph. A line break stays a line break; URLs and email
 *   addresses in it are linked, the address always shown as text. An empty
 *   string is a blank line in plain text and nothing in HTML.
 * - `button` is the email's main action; `link` is a quieter one. In plain
 *   text each is its `lead` (if any) and the URL, on the next line or, with
 *   `sameLine`, after a space. HTML shows the lead with the control, without
 *   repeating the label (see `leadBefore`).
 * - `code` is a code to type, large and selectable.
 * - `lines` keeps its lines together (an address, a signature).
 * - `list` is a bulleted list; in plain text each item is "- item".
 */
export type EmailBlock =
  | string
  | { button: EmailLink; lead?: string; sameLine?: boolean }
  | { link: EmailLink; lead?: string; sameLine?: boolean }
  | { code: string }
  | { lines: readonly string[] }
  | { list: readonly string[] };

export interface EmailContent {
  /** The AMP origin the mark is served from (`<origin>/icon-192.png`). */
  origin: string;
  subject: string;
  /** A heading above the body, HTML only (the subject already carries it in
   * plain text). Omit when the first paragraph already says it. */
  heading?: string;
  /** The inbox preview line. Defaults to the first paragraph. */
  preheader?: string;
  body: readonly EmailBlock[];
  /** Small print under the body: contact, postal address, opt-out. */
  footer?: readonly EmailBlock[];
}

/** What every send path hands its provider: both parts, always. */
export interface Email {
  subject: string;
  html: string;
  text: string;
}

/**
 * The layout's colours, each one an AMP role token from
 * `src/web/ui/tokens.css` (tests/email.test.ts holds them equal). The page is
 * the sunken surface and the card the raised one, as in the app.
 */
export const EMAIL_TOKENS = {
  page: { light: "surface-sunken", dark: "surface" },
  card: { light: "surface-raised", dark: "surface-sunken" },
  ink: { light: "on-surface", dark: "on-surface" },
  muted: { light: "muted-text", dark: "muted-text" },
  border: { light: "border", dark: "border" },
  button: { light: "primary", dark: "primary" },
  onButton: { light: "on-primary", dark: "on-primary" },
  link: { light: "primary", dark: "primary" },
  code: { light: "answer", dark: "answer" },
  codeBorder: { light: "answer-border", dark: "answer-border" },
} as const;
type Role = keyof typeof EMAIL_TOKENS;
export const EMAIL_COLORS: Record<"light" | "dark", Record<Role, string>> = {
  light: {
    page: "#efeee5",
    card: "#f7f6f0",
    ink: "#183e3a",
    muted: "#4c625b",
    border: "#e2e5da",
    button: "#1f5f55",
    onButton: "#fffefa",
    link: "#1f5f55",
    code: "#ffffff",
    codeBorder: "#78887f",
  },
  dark: {
    page: "#122522",
    card: "#233c36",
    ink: "#e9f0e8",
    muted: "#b6c9bd",
    border: "#365148",
    button: "#8bd1b5",
    onButton: "#102320",
    link: "#8bd1b5",
    code: "#122522",
    codeBorder: "#6f8c80",
  },
};

/** The app's type: system sans for reading, the display serif for headings
 * (`--font-display`), and a monospace for codes. */
const SANS =
  "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace";

/** The mark, built from `public/favicon.svg` by scripts/build-site-icons.ts. */
export const EMAIL_MARK_PATH = "/icon-192.png";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** A button or link goes to a web page, never a `javascript:` or other URL.
 * (In paragraphs, only web URLs and mail addresses are linked at all.) */
function safeUrl(url: string) {
  const { protocol } = new URL(url);
  if (protocol !== "https:" && protocol !== "http:")
    throw new Error(`Email links must be http(s): ${protocol}`);
  return url;
}

const INLINE =
  /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)'’”]|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

/** Escaped text with its URLs and addresses linked and line breaks kept. */
function rich(text: string, color: string, linkClass = "amp-link") {
  let html = "";
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const value = match[0];
    html += escape(text.slice(last, match.index));
    const href = value.includes("://") ? value : `mailto:${value}`;
    html += `<a href="${escape(href)}" class="${linkClass}" style="color:${color};text-decoration:underline;word-break:break-word;">${escape(value)}</a>`;
    last = match.index + value.length;
  }
  html += escape(text.slice(last));
  return html.replace(/\n/g, "<br>");
}

const PARAGRAPH = `margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;`;

function textOf(block: EmailBlock): string {
  if (typeof block === "string") return block;
  if ("button" in block || "link" in block) {
    const { url } = "button" in block ? block.button : block.link;
    return block.lead
      ? `${block.lead}${block.sameLine ? " " : "\n"}${url}`
      : url;
  }
  if ("code" in block) return block.code;
  if ("lines" in block) return block.lines.join("\n");
  return block.list.map((item) => `- ${item}`).join("\n\n");
}

/** What HTML shows of a lead: nothing when it only repeats the label
 * ("Sign in:" above "Sign in"), and without the label when it ends with it
 * ("... Stop optional emails:" before the "Stop optional emails" link). */
function leadBefore(lead: string | undefined, label: string) {
  const bare = (lead ?? "").replace(/[\s:]+$/, "");
  return bare.toLowerCase().endsWith(label.toLowerCase())
    ? bare.slice(0, bare.length - label.length)
    : (lead ?? "");
}

function htmlOf(block: EmailBlock, small: boolean): string {
  const c = EMAIL_COLORS.light;
  const ink = small ? "amp-muted" : "amp-ink";
  const color = small ? c.muted : c.ink;
  const size = small ? "font-size:13px;line-height:1.55;" : "";
  const p = (inner: string) =>
    `<p class="${ink}" style="${PARAGRAPH}${size}color:${color};">${inner}</p>`;
  if (block === "") return "";
  if (typeof block === "string") return p(rich(block, c.link));
  if ("button" in block) {
    const { label, url } = block.button;
    const href = escape(safeUrl(url));
    const lead = leadBefore(block.lead, label).trim();
    return `${lead ? p(rich(lead, c.link)) : ""}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-collapse:separate;"><tr><td class="amp-button" align="center" bgcolor="${c.button}" style="border-radius:10px;background-color:${c.button};mso-padding-alt:14px 24px;"><a href="${href}" class="amp-on-button" style="display:inline-block;padding:14px 24px;font-family:${SANS};font-size:16px;font-weight:600;line-height:20px;color:${c.onButton};text-decoration:none;border-radius:10px;">${escape(label)}</a></td></tr></table>`;
  }
  if ("link" in block) {
    const { label, url } = block.link;
    const href = escape(safeUrl(url));
    const anchor = `<a href="${href}" class="amp-link" style="color:${c.link};font-weight:600;text-decoration:underline;">${escape(label)}</a>`;
    const lead = leadBefore(block.lead, label);
    // A lead that ended with the label runs into the link; any other sits
    // above it.
    return p(
      !lead.trim()
        ? anchor
        : lead === block.lead
          ? `${rich(lead, c.link)}<br>${anchor}`
          : `${rich(lead, c.link)}${anchor}`,
    );
  }
  if ("code" in block)
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-collapse:separate;"><tr><td class="amp-code" style="padding:14px 22px;border:1px solid ${c.codeBorder};border-radius:12px;background-color:${c.code};"><span class="amp-ink" style="font-family:${MONO};font-size:34px;line-height:40px;font-weight:600;letter-spacing:6px;color:${c.ink};-webkit-user-select:all;user-select:all;">${escape(block.code)}</span></td></tr></table>`;
  if ("lines" in block) return p(rich(block.lines.join("\n"), c.link));
  return `<ul class="${ink}" style="margin:0 0 16px;padding:0 0 0 22px;font-family:${SANS};font-size:${small ? 13 : 16}px;line-height:1.6;color:${color};">${block.list
    .map((item) => `<li style="margin:0 0 8px;">${rich(item, c.link)}</li>`)
    .join("")}</ul>`;
}

/** Dark mode where the client honours it (Apple Mail, iOS Mail, Outlook for
 * Mac); Outlook.com marks its dark mode with `data-ogsc`/`data-ogsb`. Clients
 * that invert colours themselves (the Gmail app) get a layout whose every
 * colour is a solid fill, which inverts cleanly. Phone padding for clients
 * that read media queries. */
function styleSheet() {
  const d = EMAIL_COLORS.dark;
  const dark = (prefix: string) =>
    [
      `${prefix}.amp-page{background-color:${d.page}!important;}`,
      `${prefix}.amp-card{background-color:${d.card}!important;border-color:${d.border}!important;}`,
      `${prefix}.amp-ink{color:${d.ink}!important;}`,
      `${prefix}.amp-muted{color:${d.muted}!important;}`,
      `${prefix}.amp-link{color:${d.link}!important;}`,
      `${prefix}.amp-button{background-color:${d.button}!important;}`,
      `${prefix}.amp-on-button{color:${d.onButton}!important;}`,
      `${prefix}.amp-code{background-color:${d.code}!important;border-color:${d.codeBorder}!important;}`,
    ].join("");
  return [
    ":root{color-scheme:light dark;supported-color-schemes:light dark;}",
    "body{margin:0!important;padding:0!important;width:100%!important;}",
    "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}",
    `@media (prefers-color-scheme:dark){${dark("")}}`,
    dark("[data-ogsc] ").replace(/background-color:[^!]+!important;/g, ""),
    `[data-ogsb] .amp-page{background-color:${d.page}!important;}[data-ogsb] .amp-card{background-color:${d.card}!important;}[data-ogsb] .amp-button{background-color:${d.button}!important;}[data-ogsb] .amp-code{background-color:${d.code}!important;}`,
    "@media (max-width:480px){.amp-gutter{padding:16px 8px!important;}.amp-inner{padding:24px 20px 8px!important;}}",
  ].join("\n");
}

/** Both parts of an email from one content. */
export function renderEmail(content: EmailContent): Email {
  const { origin, heading, body, footer = [] } = content;
  // A subject is one line; a name someone typed can carry a line break.
  const subject = content.subject.replace(/\s*[\r\n]+\s*/g, " ");
  const c = EMAIL_COLORS.light;
  const mark = new URL(EMAIL_MARK_PATH, safeUrl(origin)).href;
  const preheader = (
    content.preheader ??
    body.find((block): block is string => typeof block === "string") ??
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const text = [...body, ...footer].map(textOf).join("\n\n");
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escape(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
${styleSheet()}
</style>
</head>
<body class="amp-page" style="margin:0;padding:0;width:100%;background-color:${c.page};-webkit-text-size-adjust:100%;text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">${escape(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" class="amp-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.page}" style="width:100%;background-color:${c.page};">
<tr><td class="amp-gutter" align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 4px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 12px 0 0;vertical-align:middle;"><img src="${escape(mark)}" width="36" height="36" alt="${escape(brand.name)}" style="display:block;width:36px;height:36px;border:0;border-radius:9px;outline:none;text-decoration:none;"></td>
<td class="amp-ink" style="vertical-align:middle;font-family:${SERIF};font-size:19px;line-height:24px;color:${c.ink};">${escape(brand.expansion)}</td>
</tr></table>
</td></tr>
<tr><td class="amp-card amp-inner" bgcolor="${c.card}" style="padding:32px 32px 16px;background-color:${c.card};border:1px solid ${c.border};border-radius:16px;word-break:break-word;overflow-wrap:anywhere;">
${heading ? `<h1 class="amp-ink" style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:600;color:${c.ink};">${escape(heading)}</h1>\n` : ""}${body.map((block) => htmlOf(block, false)).join("\n")}
</td></tr>
${
  footer.length
    ? `<tr><td style="padding:24px 4px 0;word-break:break-word;overflow-wrap:anywhere;">
${footer.map((block) => htmlOf(block, true)).join("\n")}
</td></tr>`
    : ""
}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
  return { subject, html, text };
}

/** An email with its HTML part removed: what a delivery retry resends when its
 * first attempt was made before AMP's mail carried HTML. */
export type TextOnlyRetry<M extends Email> = Omit<M, "html"> & {
  html?: undefined;
};

/**
 * The payload a delivery attempt must send. A provider idempotency key is
 * bound to the payload it was first used with, and the provider refuses a
 * changed one, so an outbox row first dispatched before this mail carried
 * HTML (an ambiguous attempt from before the 2026-11-17 deploy) resends its
 * text-only payload. `boundTo` says whether a payload is the row's recorded
 * binding. New rows always send both parts. (Like a wording change, a later
 * change to the layout stops a retry already in flight as `binding-changed`.)
 */
export function retryPayload<M extends Email>(
  mail: M,
  boundTo: (payload: M | TextOnlyRetry<M>) => boolean,
): M | TextOnlyRetry<M> {
  const { html: _html, ...textOnly } = mail;
  return !boundTo(mail) && boundTo(textOnly) ? textOnly : mail;
}

/**
 * Account mail (sign-in, invitations, school requests): the content with the
 * product's name as its quiet footer, as account mail has always ended.
 */
export function accountEmail(
  origin: string,
  content: Omit<EmailContent, "origin" | "footer">,
): Email {
  return renderEmail({ ...content, origin, footer: [brandTitle] });
}

/** One-link account mail: the text (blank-line separated paragraphs), then
 * its link as a button named `action` ("Accept invitation"). */
export interface LinkedMessage {
  subject: string;
  text: string;
  url: string;
  action: string;
}

/** The account mail path for one-link mail (src/server/accounts.ts). */
export type AccountMail = (to: string, message: LinkedMessage) => Promise<void>;

/** One-link account mail: the text's paragraphs, then its link as a button.
 * The plain text is the text, the link and the product's name, as account
 * mail has always been. */
export function linkedEmail(origin: string, message: LinkedMessage): Email {
  return accountEmail(origin, {
    subject: message.subject,
    body: [
      ...message.text.split(/\n{2,}/),
      { button: { label: message.action, url: message.url } },
    ],
  });
}

/** Refuses a payload missing either part. Every account send passes it. */
export function deliverable<M extends Email>(mail: M): M {
  if (!mail.text.trim() || !mail.html.startsWith("<!doctype html>"))
    throw new Error("An email needs both its HTML and plain-text parts");
  return mail;
}

/**
 * The sign-up code email: the code large and selectable, no link needed.
 * `expiresInMinutes` says how long it lasts when the sender knows. Send it
 * through the account mail path: `send(email, signUpCodeEmail({...}))`.
 */
export function signUpCodeEmail(input: {
  code: string;
  origin: string;
  expiresInMinutes?: number;
}): Email {
  if (!/^\d{6}$/.test(input.code))
    throw new Error("A sign-up code is six digits");
  const expires = input.expiresInMinutes
    ? ` It expires in ${input.expiresInMinutes} minutes.`
    : "";
  return accountEmail(input.origin, {
    subject: `${input.code} is your ${brand.name} sign-up code`,
    heading: "Your sign-up code",
    preheader: `Enter ${input.code} to finish signing up for ${brand.name}.`,
    body: [
      `Enter this code to finish signing up for ${brand.name}.`,
      { code: input.code },
      `If you did not ask for it, ignore this email.${expires}`,
    ],
  });
}
