/**
 * Newsletter signup — server-side Mailchimp Marketing API.
 *
 * Why this exists: the four lists live in TWO Mailchimp accounts, so a single
 * browser form POST can never reach them all. Posting the public form headlessly
 * also fails silently for The Digest, whose audience challenges submissions that
 * lack a freshly-minted hosted-form token (`ht`) — unreadable cross-origin. The
 * Marketing API sidesteps the public form entirely and, unlike an opaque
 * cross-origin POST, returns a real per-list result we can show the subscriber.
 *
 * API keys never reach the browser. Set them in Netlify → Site configuration →
 * Environment variables:
 *   MAILCHIMP_KEY_US6   — thegovlab account  (The Digest, The GovLab)
 *   MAILCHIMP_KEY_US14  — innovate-us account (Reboot Democracy, InnovateUS)
 * A Mailchimp key ends in its datacenter ("…-us14"), which is where the API host
 * comes from, so no datacenter needs configuring here.
 *
 * Optional:
 *   MAILCHIMP_STATUS    — "pending" (default) or "subscribed". See note below.
 */

const LISTS = {
  reboot:     { id: '6f8a160bd5', keyEnv: 'MAILCHIMP_KEY_US14', label: 'Reboot Democracy' },
  innovateus: { id: '6fd2122762', keyEnv: 'MAILCHIMP_KEY_US14', label: 'InnovateUS' },
  digest:     { id: 'd90a01c7ff', keyEnv: 'MAILCHIMP_KEY_US6',  label: 'The Digest' },
  govlab:     { id: 'ef27ea1e30', keyEnv: 'MAILCHIMP_KEY_US6',  label: 'The GovLab' },
  // Tags: the Marketing API takes tag NAMES, not the numeric ids used by the
  // embedded form (Reboot's form sends 7353324,7353316). Add e.g.
  // tags: ['Website Signup'] once the names are confirmed in Mailchimp.
};

// "subscribed" adds the address immediately with no confirmation email, which
// matches these audiences' single opt-in setting and how the existing embedded
// forms already behave. The trade-off: this endpoint is public and has no
// CAPTCHA, so a third party could sign up an address that isn't theirs — hence
// the honeypot and rate limit below. Set MAILCHIMP_STATUS=pending to require a
// confirmation click instead.
const STATUS = process.env.MAILCHIMP_STATUS === 'pending' ? 'pending' : 'subscribed';

// Best-effort throttle. Serverless instances are per-container and cold-start
// often, so this is a speed bump against naive hammering, not real protection —
// enable Netlify's platform rate limiting for that.
const RATE = { windowMs: 60_000, max: 5 };
const hits = new Map();
function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // bound memory on a long-lived instance
  return recent.length > RATE.max;
}

const ALLOWED_ORIGINS = [
  'https://thegovlab.org',
  'https://www.thegovlab.org',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function corsHeaders(origin) {
  const ok =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(origin || '') ||
    /^https:\/\/govlab2020\.netlify\.app$/.test(origin || '') ||
    /^http:\/\/(localhost|127\.0\.0\.1|\[::\]|\[::1\]):\d+$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });

/** Add one address to one audience. Never throws — always resolves to a result. */
async function subscribe(listKey, email) {
  const cfg = LISTS[listKey];
  const key = process.env[cfg.keyEnv];
  if (!key) {
    return { list: listKey, label: cfg.label, ok: false, state: 'misconfigured',
             message: `${cfg.keyEnv} is not set` };
  }
  const dc = key.split('-').pop();
  if (!/^us\d+$/.test(dc)) {
    return { list: listKey, label: cfg.label, ok: false, state: 'misconfigured',
             message: `${cfg.keyEnv} has no datacenter suffix` };
  }

  const payload = { email_address: email, status: STATUS };
  if (cfg.tags?.length) payload.tags = cfg.tags;

  let res, body;
  try {
    res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${cfg.id}/members`, {
      method: 'POST',
      headers: {
        // Mailchimp accepts Basic auth with any username.
        Authorization: 'Basic ' + Buffer.from(`anystring:${key}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    body = await res.json().catch(() => ({}));
  } catch (err) {
    return { list: listKey, label: cfg.label, ok: false, state: 'network',
             message: err?.name === 'TimeoutError' ? 'Mailchimp timed out' : 'Could not reach Mailchimp' };
  }

  if (res.ok) {
    return { list: listKey, label: cfg.label, ok: true,
             state: body.status === 'pending' ? 'pending' : 'subscribed' };
  }

  // Mailchimp returns 400 "Member Exists" for anyone already on the list —
  // expected, not an error worth alarming the visitor about.
  const title = body.title || '';
  if (res.status === 400 && /Member Exists/i.test(title)) {
    return { list: listKey, label: cfg.label, ok: true, state: 'already' };
  }
  if (res.status === 400 && /Invalid Resource/i.test(title)) {
    return { list: listKey, label: cfg.label, ok: false, state: 'rejected',
             message: 'Mailchimp rejected this address' };
  }
  if (res.status === 401 || res.status === 403) {
    return { list: listKey, label: cfg.label, ok: false, state: 'auth',
             message: 'Mailchimp rejected the API key' };
  }
  return { list: listKey, label: cfg.label, ok: false, state: 'error',
           message: title || `Mailchimp returned ${res.status}` };
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let payload;
  try { payload = await req.json(); }
  catch { return json({ error: 'Expected JSON' }, 400, origin); }

  // Honeypot: a real person never fills a field they cannot see. Answer 200 so
  // a bot cannot tell it was caught.
  if (payload?.hp) return json({ results: [] }, 200, origin);

  const ip = (req.headers.get('x-nf-client-connection-ip') ||
              (req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim();
  if (rateLimited(ip)) {
    return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429, origin);
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Please enter a valid email address.' }, 400, origin);
  }

  const requested = Array.isArray(payload?.lists) ? payload.lists : [];
  const lists = [...new Set(requested)].filter((k) => Object.hasOwn(LISTS, k));
  if (!lists.length) return json({ error: 'Please choose at least one newsletter.' }, 400, origin);

  const results = await Promise.all(lists.map((k) => subscribe(k, email)));
  // 200 even on partial failure — the body carries per-list detail.
  return json({ results }, 200, origin);
};

export const config = { path: '/api/subscribe' };
