import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { createServer as portServer } from 'node:net';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, cp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, createCipheriv, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Explicit opt-in AND loopback-only synthetic services. Never reads a local .env.
test('V2: backend + Next/BFF + HTTPS + real Chromium session fault matrix', {
  skip: process.env.GRIFORIO_V2_ISOLATED !== '1', timeout: 360000,
}, async t => {
  assert.match(process.env.DB_NAME ?? '', /^griforio_v2(?:_|$)/);
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.SMTP_HOST, '127.0.0.1');
  assert.match(process.env.REDIS_URL ?? '', /^redis:\/\/127\.0\.0\.1:\d+/);
  const backend = resolve('../Backend-Blog'), front = process.cwd();
  const requireBackend = createRequire(join(backend, 'package.json'));
  const { Client } = requireBackend('pg'), bcrypt = requireBackend('bcrypt');
  const { generateSync, generateSecret } = requireBackend('otplib');
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const temp = await mkdtemp(join(tmpdir(), 'griforio-v2-browser-'));
  const apiDir = join(temp, 'api'), frontDir = join(temp, 'front');
  await mkdir(apiDir); await mkdir(frontDir);
  for (const name of ['src', 'package.json', 'nest-cli.json', 'tsconfig.json', 'tsconfig.build.json']) await cp(join(backend, name), join(apiDir, name), { recursive: true });
  for (const name of ['src', 'public', 'package.json', 'next.config.ts', 'tsconfig.json']) await cp(join(front, name), join(frontDir, name), { recursive: true });
  if (process.env.GRIFORIO_V2_REPRODUCE_OLD_LOGOUT === '1') {
    // Red/green proof in the disposable copy only; never patches the repository.
    const oldLogout = join(frontDir, 'src/app/gestao-editorial/sair/route.ts');
    await writeFile(oldLogout, (await readFile(oldLogout, 'utf8')).replace('deleteSession(id);', 'deleteSession(id); jar.set(cookieName, "", {httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:0});'));
  }
  for (const [dir, source] of [[apiDir, backend], [frontDir, front]]) await symlink(join(source, 'node_modules'), join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // A temporary route under /admin uses the existing chrome exclusion, so the
  // navbar cannot consume an injected fault before the operation under test.
  await mkdir(join(frontDir, 'src/app/admin/session-test'), { recursive: true });
  await writeFile(join(frontDir, 'src/app/admin/session-test/page.tsx'), '"use client";\nimport * as session from "@/lib/session-client";\nimport {useEffect} from "react";\nexport default function Probe(){useEffect(()=>{(window as unknown as {__sessionProbe: unknown}).__sessionProbe=session;},[]);return <main>Isolated session probe</main>;}\n');
  const children = [], sockets = [], servers = [], transcript = [];
  let mode = null, bodyLoss = false;
  const listen = async server => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server); return server.address().port; };
  const freePort = async () => { const server = portServer(); const port = await listen(server); await new Promise(resolve => server.close(resolve)); return port; };
  const apiPort = await freePort(), nextPort = await freePort();
  const launch = (args, cwd, env) => { const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child); let output = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { output += value; }); child.output = () => output; return child; };
  const wait = async (action, label, attempts = 200) => { for (let index = 0; index < attempts; index++) { try { const result = await action(); if (result) return result; } catch {} await delay(100); } throw new Error(`Timeout: ${label}`); };
  const response = async (upstream, res) => {
    const body = Buffer.from(await upstream.arrayBuffer());
    for (const [key, value] of upstream.headers) if (!['connection', 'transfer-encoding', 'content-length', 'set-cookie', 'content-encoding'].includes(key)) res.setHeader(key, value);
    const cookies = upstream.headers.getSetCookie(); if (cookies.length) res.setHeader('set-cookie', cookies);
    res.statusCode = upstream.status; res.end(body);
  };
  const bridge = httpServer(async (req, res) => {
    try {
      const body = []; for await (const chunk of req) body.push(chunk);
      const headers = { ...req.headers }; delete headers.host; delete headers.connection;
      const isRefresh = req.url === '/api/v1/auth/refresh/v2';
      const entry = isRefresh ? { operation: req.headers['x-refresh-operation'], sid: req.headers['x-session-id'], generation: req.headers['x-refresh-generation'] } : null;
      if (entry) transcript.push(entry);
      const fault = (isRefresh && mode?.kind !== 'logout') || (req.url === '/api/v1/auth/logout/v2' && mode?.kind === 'logout') ? mode : null; if (fault) mode = null;
      if (fault?.kind === 'before') { fault.reached(); res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{}'); }
      const upstream = await fetch(`http://127.0.0.1:${apiPort}${req.url}`, { method: req.method, headers, ...(body.length ? { body: Buffer.concat(body) } : {}), redirect: 'manual' });
      // Fully receive the committed response before injecting loss/delay.
      const buffered = new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: upstream.headers });
      if (entry) entry.status = upstream.status;
      if (fault) { fault.reached(); if (fault.kind === 'drop') { res.destroy(); return; } await fault.release; }
      await response(buffered, res);
    } catch { if (!res.destroyed) { res.writeHead(502); res.end(); } }
  });
  const bridgePort = await listen(bridge);
  const openssl = process.env.OPENSSL_PATH || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', join(temp, 'tls.key'), '-out', join(temp, 'tls.crt'), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore', windowsHide: true });
  const gateway = httpsServer({ key: await readFile(join(temp, 'tls.key')), cert: await readFile(join(temp, 'tls.crt')) }, async (req, res) => {
    try { const body = []; for await (const chunk of req) body.push(chunk); const headers = { ...req.headers }; delete headers.connection;
      const upstream = await fetch(`http://127.0.0.1:${nextPort}${req.url}`, { method: req.method, headers, ...(body.length ? { body: Buffer.concat(body) } : {}), redirect: 'manual' });
      if (bodyLoss && req.url === '/api/v1/auth/refresh/v2') {
        bodyLoss = false;
        res.writeHead(upstream.status, { 'content-type': 'application/json', 'set-cookie': upstream.headers.getSetCookie() });
        res.write('{"access_token":');
        setTimeout(() => res.destroy(), 200);
        return;
      }
      await response(upstream, res);
    } catch { if (!res.destroyed) { res.writeHead(502); res.end(); } }
  });
  const httpsPort = await listen(gateway), origin = `https://localhost:${httpsPort}`;
  const env = { ...process.env, NODE_ENV: 'production', PORT: String(apiPort), JWT_EXPIRES_IN: '12', FRONTEND_URL: origin, SITE_ORIGIN: origin, API_ORIGIN: `http://127.0.0.1:${bridgePort}`, ENABLE_ADMIN_BFF: 'true', EDITORIAL_WORKFLOW_ENABLED: 'true' };
  t.after(async () => {
    if (mode) mode.unblock();
    for (const socket of sockets) socket.close();
    for (const child of children.reverse()) {
      if (child.exitCode === null) {
        if (process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); } catch {} }
        else child.kill('SIGTERM');
      }
    }
    for (const server of servers) { server.closeAllConnections?.(); server.close(); }
    await db.end();
  });
  const build = async (dir, args) => { const child = launch(args, dir, env); const [code] = await once(child, 'exit'); assert.equal(code, 0, child.output().slice(-1800)); };
  await build(apiDir, [join(backend, 'node_modules/@nestjs/cli/bin/nest.js'), 'build']);
  await build(apiDir, [join(backend, 'node_modules/typeorm/cli.js'), 'migration:run', '-d', 'dist/database/data-source.js']);
  // Webpack supports the external dependency junction in this disposable copy.
  // The repository's normal production build is validated separately with Turbopack.
  await build(frontDir, [join(front, 'node_modules/next/dist/bin/next'), 'build', '--webpack']);
  const api = launch(['dist/main.js'], apiDir, env);
  await wait(async () => (await fetch(`http://127.0.0.1:${apiPort}/api/v1/health`)).status === 200, 'API');
  const app = launch([join(front, 'node_modules/next/dist/bin/next'), 'start', '-p', String(nextPort)], frontDir, env);
  await wait(async () => (await fetch(`http://127.0.0.1:${nextPort}/sobre`)).status === 200, 'Next');
  assert.equal(api.exitCode, null); assert.equal(app.exitCode, null);
  const password = 'SyntheticV2Password123!', readerId = randomUUID(), adminId = randomUUID(), secret = generateSecret();
  const hash = await bcrypt.hash(password, 12), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(env.TOTP_ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const totpSecret = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  for (const [id, role] of [[readerId, 'READER'], [adminId, 'ADMIN']]) await db.query('INSERT INTO users(id,name,email,password_hash,role,email_verified,first_post_approved,recovery_email,recovery_email_verified_at,totp_enabled,totp_secret) VALUES($1,$2,$3,$4,$5,true,true,$6,now(),$7,$8)', [id, `Synthetic V2 ${role}`, `${id}@example.test`, hash, role, `recovery-${id}@example.test`, role === 'ADMIN', role === 'ADMIN' ? totpSecret : null]);
  const edge = process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const debugPort = await freePort();
  const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--ignore-certificate-errors', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(temp, 'chromium')}`, 'about:blank'], { stdio: 'ignore', windowsHide: true }); children.push(browser);
  async function tab(create = false) {
    const target = await wait(async () => create ? (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json() : (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === 'page'), 'Chromium');
    const socket = new WebSocket(target.webSocketDebuggerUrl); sockets.push(socket); await once(socket, 'open');
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); } });
    const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    return { cdp, evaluate };
  }
  const page = await tab(), other = await tab(true);
  const scenario = (name, action) => !process.env.GRIFORIO_V2_CASE || name.startsWith(process.env.GRIFORIO_V2_CASE) ? t.test(name, action) : Promise.resolve();
  async function navigate(page, path = '/admin/session-test') { await page.evaluate('delete window.__sessionProbe'); await page.cdp('Page.navigate', { url: origin + path }); if (path === '/admin/session-test') await wait(() => page.evaluate('Boolean(window.__sessionProbe)'), 'probe hydration'); else await wait(() => page.evaluate('document.readyState === "complete"'), 'navigation'); }
  const call = (page, method, ...args) => page.evaluate(`window.__sessionProbe[${JSON.stringify(method)}](...${JSON.stringify(args)})`);
  const profile = page => call(page, 'getOwnProfile');
  const state = page => page.evaluate('JSON.parse(localStorage.getItem("blog-session-coordination-v2"))');
  async function signIn() { await navigate(page); await call(page, 'login', `${readerId}@example.test`, password); assert.equal((await profile(page)).id, readerId); return (await state(page)).sessionId; }
  const generation = async sid => Number((await db.query('SELECT refresh_generation FROM auth_sessions WHERE id=$1', [sid])).rows[0]?.refresh_generation);
  function fault(kind) {
    let reached, unblock;
    const entered = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { mode = null; reject(new Error(`Fault ${kind} was not reached`)); }, 20000);
      timer.unref(); reached = () => { clearTimeout(timer); resolve(); };
    });
    const release = new Promise(resolve => { unblock = resolve; }); mode = { kind, reached, release, unblock }; return { entered, unblock };
  }

  await scenario('1 login/logout and real HttpOnly Secure SameSite Strict cookies', async () => {
    const sid = await signIn();
    assert.equal(await page.evaluate('isSecureContext && Boolean(navigator.locks)'), true);
    const cookies = (await page.cdp('Network.getAllCookies')).cookies.filter(cookie => cookie.name.includes(sid));
    assert.equal(cookies.length, 2); assert.ok(cookies.every(cookie => cookie.httpOnly && cookie.secure && cookie.sameSite === 'Strict' && cookie.path === '/api/v1/auth'));
    assert.doesNotMatch(await page.evaluate('document.cookie'), /griforio.*(?:rt|proof)/);
    assert.equal(await call(page, 'logout'), true); assert.equal(await call(page, 'restoreSession'), false);
    assert.equal((await db.query('SELECT id FROM auth_sessions WHERE id=$1', [sid])).rowCount, 0);
  });
  await scenario('2 rapid reload while rotation is committed reuses one operation', async () => {
    const sid = await signIn(), held = fault('hold'); await navigate(page);
    await page.evaluate('void window.__sessionProbe.getOwnProfile().catch(()=>{}); true'); await held.entered;
    await navigate(page); assert.equal((await profile(page)).id, readerId); held.unblock();
    for (let index = 0; index < 5; index++) { await navigate(page); assert.equal((await profile(page)).id, readerId); }
    assert.equal(await generation(sid), 1); assert.equal(await call(page, 'logout'), true);
  });
  await scenario('3 parallel authenticated requests and 4 multiple tabs do not create competing rotations', async () => {
    const sid = await signIn(); await navigate(page); await navigate(other);
    const result = await Promise.all([page.evaluate('Promise.all(Array.from({length:8},()=>window.__sessionProbe.getOwnProfile())).then(values=>values.map(value=>value.id))'), profile(other)]);
    assert.ok(result[0].every(id => id === readerId)); assert.equal(result[1].id, readerId);
    const legacy = await page.evaluate("fetch('/api/v1/auth/refresh',{method:'POST'}).then(async response=>({status:response.status,code:(await response.json()).code}))");
    assert.equal(legacy.status, 400); assert.equal(legacy.code, 'PROTOCOL_V2_REQUIRED');
    assert.equal((await profile(other)).id, readerId);
    assert.equal(await generation(sid), 1); assert.equal(await call(page, 'logout'), true);
  });
  await scenario('5 lost response AFTER commit is recovered after reload using the same ID', async () => {
    const sid = await signIn(); await navigate(page); const loss = fault('drop');
    await assert.rejects(profile(page)); await loss.entered;
    const pending = await state(page); assert.equal(pending.pending, true); assert.equal(await generation(sid), 1);
    await navigate(page); assert.equal((await profile(page)).id, readerId);
    assert.equal((await state(page)).operation.id, pending.operation.id); assert.equal(await generation(sid), 1);
    assert.equal(await call(page, 'logout'), true);
  });
  await scenario('6 transient failure BEFORE commit remains recoverable, not signed out', async () => {
    const sid = await signIn(); await navigate(page); fault('before'); await assert.rejects(profile(page));
    assert.equal(await generation(sid), 0); assert.equal((await state(page)).loggedOut, undefined);
    assert.equal((await profile(page)).id, readerId); assert.equal(await generation(sid), 1); await call(page, 'logout');
  });
  await scenario('7 genuinely expired JWT renews; expired/revoked session is rejected', async () => {
    const sid = await signIn(); await delay(13000); assert.equal((await profile(page)).id, readerId);
    await db.query("UPDATE auth_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [sid]);
    await navigate(page); assert.equal(await profile(page), null); assert.equal((await state(page)).loggedOut, true);
  });
  await scenario('8 logout concurrent with a delayed rotation cannot restore a revoked session', async () => {
    const sid = await signIn(); await navigate(page); await navigate(other); const held = fault('hold');
    await page.evaluate('void window.__sessionProbe.getOwnProfile().catch(()=>{}); true'); await held.entered;
    await navigate(page); assert.equal(await call(other, 'logout'), true); held.unblock();
    assert.equal(await call(page, 'restoreSession'), false);
    assert.equal((await db.query('SELECT id FROM auth_sessions WHERE id=$1', [sid])).rowCount, 0);
  });
  await scenario('9 late g1 Set-Cookie cannot overwrite g2 or resurrect old credentials', async () => {
    const sid = await signIn(); await navigate(page); await profile(page); const record = await state(page), held = fault('hold');
    await page.evaluate(`void fetch('/api/v1/auth/refresh/v2',{method:'POST',headers:{'X-Session-Id':${JSON.stringify(sid)},'X-Refresh-Operation':${JSON.stringify(record.operation.id)},'X-Refresh-Generation':String(${record.operation.generation})}}).catch(()=>{}); true`);
    await held.entered; await delay(13000); assert.equal((await profile(page)).id, readerId); assert.equal(await generation(sid), 2);
    held.unblock(); await delay(300);
    const cookies = (await page.cdp('Network.getAllCookies')).cookies;
    assert.ok(cookies.some(cookie => cookie.name === `__Secure-griforio-rt-${sid}-2`));
    await navigate(page); assert.equal((await profile(page)).id, readerId); await call(page, 'logout');
  });
  await scenario('10 administrative 2FA, BFF recovery and logout isolation from public session', async () => {
    const publicSid = await signIn(); await navigate(other, '/gestao-editorial/entrar');
    await wait(() => other.evaluate('Boolean(document.querySelector("input[name=csrf]"))'), 'admin CSRF');
    const csrf = await other.evaluate('document.querySelector("input[name=csrf]").value');
    const adminLogin = code => other.evaluate(`fetch('/gestao-editorial/entrar/sessao',{method:'POST',redirect:'manual',body:new URLSearchParams(${JSON.stringify({ csrf, email: `${adminId}@example.test`, password, totpCode: code })})}).then(response=>response.status)`);
    assert.equal(await adminLogin('000000'), 401);
    await adminLogin(generateSync({ secret }));
    const adminCookie = (await other.cdp('Network.getAllCookies')).cookies.find(cookie => cookie.name === '__Host-editorial-session');
    assert.ok(adminCookie?.httpOnly && adminCookie.secure);
    await navigate(other, '/gestao-editorial'); await delay(3000);
    const offset = transcript.length; fault('drop');
    await other.evaluate("fetch('/gestao-editorial').then(response=>response.text()).catch(()=>null)");
    assert.ok((await other.cdp('Network.getAllCookies')).cookies.some(cookie => cookie.name === '__Host-editorial-session'));
    assert.equal(await other.evaluate("fetch('/gestao-editorial',{redirect:'manual'}).then(response=>response.status)"), 200);
    const attempts = transcript.slice(offset); assert.ok(attempts.length >= 2); assert.equal(attempts[0].operation, attempts[1].operation);
    await delay(8000); const held = fault('hold');
    await other.evaluate("void fetch('/gestao-editorial').catch(()=>{}); true"); await held.entered;
    const logoutCsrf = await other.evaluate('document.querySelector("input[name=csrf]").value');
    await other.evaluate(`fetch('/gestao-editorial/sair',{method:'POST',redirect:'manual',body:new URLSearchParams({csrf:${JSON.stringify(logoutCsrf)}})}).then(response=>response.status)`);
    held.unblock();
    assert.equal((await db.query('SELECT id FROM auth_sessions WHERE user_id=$1', [adminId])).rowCount, 0);
    assert.equal((await db.query('SELECT id FROM auth_sessions WHERE id=$1', [publicSid])).rowCount, 1);
    assert.equal((await profile(page)).id, readerId); await call(page, 'logout');
  });
  await scenario('11 body lost AFTER Set-Cookie can advance after recovery expiry only with current credentials', async () => {
    const sid = await signIn(); await navigate(page); bodyLoss = true;
    await assert.rejects(profile(page));
    assert.equal((await state(page)).pending, true);
    assert.ok((await page.cdp('Network.getAllCookies')).cookies.some(cookie => cookie.name === `__Secure-griforio-rt-${sid}-1`));
    await delay(13000);
    assert.equal((await profile(page)).id, readerId);
    assert.equal(await generation(sid), 2);
    await call(page, 'logout');
  });
  await scenario('12 late administrative logout response cannot erase a new 2FA login', async () => {
    await navigate(page);
    async function administrativeLogin() {
      await navigate(other, '/gestao-editorial/entrar');
      await wait(() => other.evaluate('Boolean(document.querySelector("input[name=csrf]"))'), 'fresh login CSRF');
      const csrf = await other.evaluate('document.querySelector("input[name=csrf]").value');
      const [row] = (await db.query('SELECT totp_last_counter FROM users WHERE id=$1', [adminId])).rows;
      const counter = Math.max(Math.floor(Date.now() / 30000), Number(row.totp_last_counter ?? 0) + 1);
      await wait(() => counter <= Math.floor(Date.now() / 30000) + 1, 'next unused TOTP step', 350);
      const code = generateSync({ secret, epoch: counter * 30 });
      await other.evaluate(`fetch('/gestao-editorial/entrar/sessao',{method:'POST',redirect:'manual',body:new URLSearchParams(${JSON.stringify({ csrf, email: `${adminId}@example.test`, password, totpCode: code })})}).then(response=>response.status)`);
      await navigate(other, '/gestao-editorial');
      await wait(() => other.evaluate('Boolean(document.querySelector("input[name=csrf]"))'), 'administrative session');
    }
    await administrativeLogin();
    const csrf = await other.evaluate('document.querySelector("input[name=csrf]").value'), held = fault('logout');
    await page.evaluate(`window.__oldAdminLogoutDone=false; void fetch('/gestao-editorial/sair',{method:'POST',redirect:'manual',body:new URLSearchParams({csrf:${JSON.stringify(csrf)}})}).finally(()=>{window.__oldAdminLogoutDone=true}).catch(()=>{}); true`);
    await held.entered;
    await administrativeLogin();
    const before = (await other.cdp('Network.getAllCookies')).cookies.find(cookie => cookie.name === '__Host-editorial-session');
    held.unblock(); await wait(() => page.evaluate('window.__oldAdminLogoutDone'), 'old logout response processed');
    const after = (await other.cdp('Network.getAllCookies')).cookies.find(cookie => cookie.name === '__Host-editorial-session');
    assert.ok(before && after?.value === before.value, 'late logout must preserve the new opaque cookie');
    assert.equal(await other.evaluate("fetch('/gestao-editorial',{redirect:'manual'}).then(response=>response.status)"), 200);
    assert.equal((await db.query('SELECT id FROM auth_sessions WHERE user_id=$1', [adminId])).rowCount, 1);
  });
  await writeFile(join(temp, 'results.json'), JSON.stringify({ tests: transcript.map(entry => ({ generation: entry.generation, status: entry.status })), temp }, null, 2));
});
