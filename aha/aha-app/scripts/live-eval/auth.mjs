/** DEV-ONLY live-eval sign-in: the vendored @free2z/sdk FetchTransport with an RFC 8252 loopback
 * redirect, the same shape as AHA's desktop sign-in (http://127.0.0.1:<port>/callback). The person
 * signs in and consents in their own browser; this script only prints and opens the URL and waits.
 * Tokens live in this process's memory only (FetchTransport's private session). The access token is
 * observed on the way out (wrapped fetch) solely to send the non-streamed /v1/chat, which the SDK
 * does not expose; it is never logged or written anywhere. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { Client, FetchTransport } from '@free2z/sdk';

export const SCOPES = ['openid', 'offline_access', 'balance:read', 'ai:invoke'];
export const AI_BASE = 'https://ai.free2z.cash/v1';

const PAGE = ok => `<!doctype html><meta charset="utf-8"><title>AHA live eval</title><body style="font:16px system-ui;padding:40px">${ok ? 'Signed in. You can close this tab and return to the terminal.' : 'Sign-in did not complete. You can close this tab.'}</body>`;

/** Bind 127.0.0.1 on a free port; resolves with the server and its callback URI. */
function listen() {
  return new Promise((resolve, reject) => {
    let waiter;
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const ok = url.searchParams.has('code');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGE(ok));
      waiter?.(`http://127.0.0.1:${server.address().port}${req.url}`);
    });
    server.on('error', reject);
    let closed = false;
    server.listen(0, '127.0.0.1', () => resolve({
      server, close: () => { if (!closed) { closed = true; server.close(); } }, redirectUri: `http://127.0.0.1:${server.address().port}/callback`,
      next: () => new Promise(r => { waiter = r; }),
    }));
  });
}

/**
 * Signs in (blocking until the person finishes in the browser, or `timeoutMs`). Returns the SDK
 * client plus `bearer()`, the most recent access token the SDK itself sent to the AI gateway.
 */
export async function signIn({ clientId, spendCap, timeoutMs = 30 * 60_000, log = console.log }) {
  const loop = await listen();
  let bearer;
  const observingFetch = (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (target.startsWith(AI_BASE)) {
      const auth = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('authorization');
      if (auth?.startsWith('Bearer ')) bearer = auth;
    }
    return fetch(input, init);
  };
  const authSession = {
    open() {
      return {
        async authorize(url) {
          log(`\n=== Free2Z sign-in needed ===\nOpen this URL, sign in and review the consent (scopes: ${SCOPES.join(' ')}; suggested app budget ${spendCap.cap2z} 2Z ${spendCap.period}):\n\n${url}\n\nWaiting for the browser to return to ${loop.redirectUri} ...\n`);
          spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
          let timer, reopen;
          const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('sign-in timed out')), timeoutMs); });
          // The person may be away: open the same URL once more halfway through the wait.
          reopen = setTimeout(() => { log(`Still waiting; opening the sign-in URL once more.`); spawn('open', [url], { stdio: 'ignore', detached: true }).unref(); }, timeoutMs / 2);
          try { return await Promise.race([loop.next(), timeout]); } finally { clearTimeout(timer); clearTimeout(reopen); }
        },
        close: loop.close,
      };
    },
  };
  const transport = new FetchTransport({
    clientId, redirectUri: loop.redirectUri, scopes: SCOPES, aiBase: AI_BASE,
    allowInsecureLoopback: true, // only the http://127.0.0.1 redirect; the issuer and APIs stay https
    authSession, fetch: observingFetch, requestTimeoutMs: 60_000,
  });
  const client = new Client(transport);
  try {
    await client.signIn({ spendCap, prompt: 'consent' });
  } finally {
    loop.close();
  }
  return {
    client,
    /** A fresh token: `estimate()` goes through the SDK (which refreshes as needed) right before each call. */
    bearer: () => bearer,
  };
}
