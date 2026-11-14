import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as httpServer } from 'node:http';
import { createServer as smtpServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID, createHmac, createDecipheriv } from 'node:crypto';
import { createRequire } from 'node:module';
import { cp, mkdtemp, symlink, realpath, lstat, readlink, unlink, rm } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

const execute = promisify(execFile);
function otp(secret, offset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const bytes = [];
  for (const char of secret) { value = (value << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const data = Buffer.alloc(8); data.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(data).digest(); const at = digest[19] & 15;
  return String((digest.readUInt32BE(at) & 0x7fffffff) % 1000000).padStart(6, '0');
}

// Opt-in: temporarily stops the local app and runs the SAME Docker image with a capture-only SMTP.
// Main DB is used only for uniquely identified synthetic accounts; no external email is sent.
test('recovery email, mandatory 2FA and recovery in browser with Docker API and local SMTP', { skip: process.env.BLOG_RECOVERY_E2E !== '1', timeout: 240000 }, async t => {
  const backend = resolve('../Backend-Blog'), requireBackend = createRequire(join(backend, 'package.json'));
  requireBackend('dotenv').config({ path: join(backend, '.env'), quiet: true });
  const { Client } = requireBackend('pg'), bcrypt = requireBackend('bcrypt');
  const db = new Client({ host: '127.0.0.1', port: Number(process.env.DB_PORT || 5433), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const state = (await db.query("SELECT (SELECT count(*) FROM mail_outbox)::int AS mail, (SELECT count(*) FROM newsletter_deliveries WHERE sent_at IS NULL)::int AS newsletter")).rows[0];
  assert.equal(state.mail, 0, 'finish pending mail before capture test'); assert.equal(state.newsletter, 0, 'finish pending newsletter before capture test');
  const ids = [], messages = [], smtpSockets = new Set(); let rejectedRecipient = false;
  const smtp = smtpServer(socket => {
    smtpSockets.add(socket); socket.on('close', () => smtpSockets.delete(socket)); socket.on('error', () => {});
    socket.write('220 capture.local ESMTP\r\n'); let buffer = '', data = false, raw = '', recipients = [];
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const at = buffer.indexOf('\r\n'), line = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        if (data) {
          if (line === '.') { messages.push({ to: [...recipients], text: raw.replace(/=\r?\n/g, '').replace(/=([A-F0-9]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) }); data = false; raw = ''; socket.write('250 2.0.0 captured\r\n'); }
          else raw += line.replace(/^\.\./, '.') + '\r\n';
        } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-capture.local\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');
        else if (/^AUTH /i.test(line)) socket.write('235 2.7.0 authenticated\r\n');
        else if (/^MAIL FROM:/i.test(line)) { recipients = []; socket.write('250 2.1.0 ok\r\n'); }
        else if (/^RCPT TO:/i.test(line)) {
          const address = /<([^>]+)>/.exec(line)?.[1] || '';
          if (!address.endsWith('@example.invalid')) { rejectedRecipient = true; socket.write('550 synthetic recipients only\r\n'); }
          else { recipients.push(address); socket.write('250 2.1.5 ok\r\n'); }
        } else if (/^DATA$/i.test(line)) { data = true; socket.write('354 send data\r\n'); }
        else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  smtp.listen(0, '0.0.0.0'); await once(smtp, 'listening');
  const freePort = async () => { const server = httpServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; };
  const port = await freePort(), debugPort = await freePort(), base = `http://localhost:${port}`, origin = 'http://127.0.0.1:3000';
  const helper = `blog-recovery-proof-${randomUUID().slice(0, 8)}`, queuePrefix = `recovery-proof-${randomUUID().slice(0, 8)}`;
  const temp = await mkdtemp(join(tmpdir(), 'blog-recovery-real-')); let app, browser, socket, stopped = false;
  t.after(async () => {
    socket?.close();
    for (const child of [app, browser]) if (child?.pid) { if (process.platform === 'win32') await execute('taskkill', ['/pid', String(child.pid), '/t', '/f']).catch(() => {}); else child.kill(); }
    await execute('docker', ['rm', '-f', helper], { cwd: backend }).catch(() => {});
    // Remove only this test's encrypted messages before the normal worker is restored.
    try {
      const key = createHmac('sha256', process.env.JWT_SECRET).update('mail-queue-encryption-v1').digest();
      for (const row of (await db.query('SELECT id,payload FROM mail_outbox')).rows) {
        const bytes = Buffer.from(row.payload, 'base64url'), decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0,12));
        decipher.setAuthTag(bytes.subarray(12,28));
        const message = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
        if (ids.some(id => message.to === `${id}@example.invalid` || message.to === `recovery-${id}@example.invalid`)) await db.query('DELETE FROM mail_outbox WHERE id=$1', [row.id]);
      }
      await db.query('DELETE FROM audit_logs WHERE target_id=ANY($1::uuid[]) OR actor_id=ANY($1::uuid[])', [ids]);
      await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [ids]);
    } finally {
      await db.end();
      for (const client of smtpSockets) client.destroy(); await new Promise(resolve => smtp.close(resolve));
      if (stopped) await execute('docker', ['compose', '--profile', 'app', 'up', '-d', '--no-deps', 'app'], { cwd: backend });
    }
    const link = join(temp, 'node_modules');
    if (await lstat(link).catch(() => null)) {
      const tempReal = await realpath(temp), tempRoot = await realpath(tmpdir());
      assert.equal(dirname(tempReal).toLowerCase(), tempRoot.toLowerCase()); assert.match(basename(tempReal), /^blog-recovery-real-/);
      assert.ok((await lstat(link)).isSymbolicLink()); assert.equal((await realpath(resolve(dirname(link), await readlink(link)))).toLowerCase(), (await realpath(join(process.cwd(), 'node_modules'))).toLowerCase());
      await unlink(link); await rm(tempReal, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });
  async function waitFor(action, label) { for (let i = 0; i < 300; i++) { try { const result = await action(); if (result) return result; } catch {} await delay(150); } throw new Error(`Timeout: ${label}`); }
  await execute('docker', ['compose', 'stop', 'app'], { cwd: backend }); stopped = true;
  await execute('docker', ['compose', 'run', '-d', '--name', helper, '--no-deps', '-p', '127.0.0.1:3000:3000', '-e', 'PORT=3000', '-e', `FRONTEND_URL=${base}`, '-e', 'SMTP_HOST=host.docker.internal', '-e', `SMTP_PORT=${smtp.address().port}`, '-e', 'SMTP_USER=synthetic', '-e', 'SMTP_PASS=synthetic', '-e', 'SMTP_FROM=synthetic@example.invalid', '-e', `MAIL_QUEUE_PREFIX=${queuePrefix}`, 'app'], { cwd: backend });
  await waitFor(async () => (await fetch(`${origin}/api/v1/health`)).ok, 'Docker API');
  const id = randomUUID(), owner = randomUUID(); ids.push(id, owner);
  const email = `${id}@example.invalid`, recoveryEmail = `recovery-${id}@example.invalid`, password = 'SyntheticPassword123!';
  for (const [userId, role] of [[id, 'READER'], [owner, 'SUPER_ADMIN']]) await db.query("INSERT INTO users(id,name,email,password_hash,role,email_verified) VALUES ($1,'Synthetic recovery browser',$2,$3,$4,true)", [userId, `${userId}@example.invalid`, await bcrypt.hash(password, 10), role]);
  async function request(path, body, token, method = 'POST') {
    const response = await fetch(origin + '/api/v1' + path, { method, headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) }, ...(body && { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  const before = await request('/auth/login', { email, password }); assert.equal(before.status, 200); const oldToken = before.body.access_token;
  assert.equal((await request('/auth/totp/setup', { password }, oldToken)).status, 409);
  assert.equal((await request('/auth/recovery-email', undefined, undefined, 'GET')).status, 401);
  for (const name of ['src', 'public', 'package.json', 'next.config.ts', 'tsconfig.json']) await cp(join(process.cwd(), name), join(temp, name), { recursive: true });
  await symlink(join(process.cwd(), 'node_modules'), join(temp, 'node_modules'), 'junction');
  app = spawn(process.execPath, [join(temp, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-p', String(port)], { cwd: temp, env: { ...process.env, API_ORIGIN: origin, SITE_ORIGIN: base }, stdio: ['ignore', 'pipe', 'pipe'] });
  app.stdout.resume(); app.stderr.resume();
  browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(temp, 'browser')}`, 'about:blank'], { stdio: 'ignore' });
  browser.on('error', () => {});
  await waitFor(async () => (await fetch(`${base}/entrar`)).ok, 'Next');
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === 'page' && item.url === 'about:blank'), 'Edge');
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, 'open');
  let sequence = 0; const pending = new Map();
  socket.addEventListener('message', event => { const value = JSON.parse(event.data); if (pending.has(value.id)) { const promise = pending.get(value.id); pending.delete(value.id); if (value.error) promise.reject(new Error(value.error.message)); else promise.resolve(value.result); } });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const value = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.text); return value.result.value; };
  const has = text => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`);
  const fill = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const navigate = url => cdp('Page.navigate', { url });
  await navigate(`${base}/entrar`); await waitFor(() => evaluate("!!document.querySelector('#email') && Object.keys(document.querySelector('#email')).some(k=>k.startsWith('__reactProps'))"), 'login hydration');
  await fill('#email', email); await fill('#password', password); await click('Entrar');
  await waitFor(() => has('Enviar confirmação do e-mail'), 'account recovery settings');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.includes('Ativar autenticação')).disabled"), true);
  await fill('#recovery-email', recoveryEmail); await fill('#recovery-email-password', password); await click('Enviar confirmação do e-mail');
  await waitFor(() => has('Enviamos um link'), 'email requested');
  const confirmation = await waitFor(() => messages.find(message => message.to.includes(recoveryEmail) && message.text.includes('/confirmar-email-recuperacao#token=')), 'confirmation captured by SMTP');
  const confirmationToken = /#token=([\w-]{43})/.exec(confirmation.text)[1];
  await navigate(`${base}/confirmar-email-recuperacao#token=${confirmationToken}`); await waitFor(() => has('Confirme que você tem acesso'), 'confirmation page'); await click('Confirmar e-mail de recuperação'); await waitFor(() => has('E-mail confirmado.'), 'confirmed');
  assert.equal(await has('após 24 horas'), false);
  assert.equal(await evaluate('location.hash'), '');
  await navigate(`${base}/conta`); await waitFor(() => has('Confirmado'), 'verified email status');
  await waitFor(() => evaluate("!Array.from(document.querySelectorAll('button')).find(e=>e.textContent.includes('Ativar autenticação')).disabled"), '2FA enabled button');
  await click('Ativar autenticação de dois fatores'); await fill('#totp-password', password); await click('Continuar');
  await waitFor(() => has('Verificar e ativar'), 'provisioning');
  const originalSecret = await evaluate("document.querySelector('span[class*=keyChunks]').textContent.replace(/\\s/g,'')");
  await fill('#totp-code', otp(originalSecret)); await click('Verificar e ativar');
  await waitFor(() => has('Códigos de recuperação de emergência'), 'codes visible after enabling'); await delay(700);
  const oldCodes = await evaluate("Array.from(document.querySelectorAll('div[class*=recoveryCode]')).map(e=>e.textContent.trim())"); assert.equal(oldCodes.length, 8);
  assert.equal((await request('/auth/recovery-email', undefined, oldToken, 'GET')).status, 401);
  await click('Concluir');
  t.diagnostic('E-mail confirmado, 2FA ativado e oito códigos preservados na tela.');
  await navigate(`${base}/recuperar-autenticador`); await waitFor(() => evaluate("!!document.querySelector('#request-recovery-email') && Object.keys(document.querySelector('#request-recovery-email')).some(k=>k.startsWith('__reactProps'))"), 'recovery request hydration');
  await fill('#request-recovery-email', email); await fill('#request-recovery-password', password); await click('Enviar instruções para o e-mail de recuperação');
  await waitFor(() => has('Se os dados estiverem corretos'), 'generic request result').catch(async error => { throw new Error(`${error.message}: ${await evaluate("document.querySelector('[role=alert]')?.textContent || document.querySelector('main')?.innerText.slice(-500)")}`); });
  const issued = await waitFor(() => messages.find(message => message.to.includes(recoveryEmail) && message.text.includes('/recuperar-autenticador#token=')), 'recovery link SMTP');
  const token = /#token=([\w-]{43})/.exec(issued.text)[1];
  const grant = (await db.query('SELECT available_at, created_at FROM totp_recovery_grants WHERE user_id=$1 AND consumed_at IS NULL', [id])).rows[0];
  assert.ok(grant.available_at - grant.created_at < 1000, 'recovery is available immediately');
  assert.equal(messages.filter(message => message.to.includes(email)).every(message => !message.text.includes('/recuperar-autenticador#token=')), true);
  await navigate(`${base}/recuperar-autenticador#token=${token}`); await waitFor(() => has('Iniciar configuração'), 'grant page'); await fill('#recovery-password', password); await click('Iniciar configuração');
  await waitFor(() => has('Confirmar novo autenticador'), 'new provisioning');
  const nextSecret = await evaluate("document.querySelector('code[class*=secret]').textContent");
  await fill('#recovery-code', otp(nextSecret)); await click('Confirmar novo autenticador');
  await waitFor(() => has('Guarde seus novos códigos'), 'recovered');
  const newCodes = await evaluate("Array.from(document.querySelectorAll('li code')).map(e=>e.textContent)"); assert.equal(newCodes.length, 8);
  assert.equal((await request('/auth/login', { email, password, totpCode: oldCodes[0] })).status, 401);
  assert.equal((await request('/auth/login', { email, password, totpCode: newCodes[0] })).status, 200);
  const row = (await db.query('SELECT recovery_email, totp_enabled, role FROM users WHERE id=$1', [id])).rows[0];
  assert.equal(row.recovery_email, recoveryEmail); assert.equal(row.totp_enabled, true); assert.equal(row.role, 'READER');
  await db.query('UPDATE users SET totp_enabled=true, recovery_email=$1, recovery_email_verified_at=now() WHERE id=$2', [`recovery-${owner}@example.invalid`, owner]);
  const superResult = await request('/auth/totp-recovery/request', { email: `${owner}@example.invalid`, password }); assert.equal(superResult.status, 200);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM totp_recovery_grants WHERE user_id=$1', [owner])).rows[0].count, 0);
  await waitFor(async () => (await db.query('SELECT count(*)::int AS count FROM mail_outbox')).rows[0].count === 0, 'outbox drained to capture');
  assert.equal(rejectedRecipient, false, 'no real recipients may enter SMTP capture');
});
