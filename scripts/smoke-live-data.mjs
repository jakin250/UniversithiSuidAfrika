import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const port = 4317 + Math.floor(Math.random() * 1000);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'universithi-live-'));
const databasePath = path.join(tempDir, 'app.json');
const baseUrl = `http://127.0.0.1:${port}`;
const sessionSecret = 'live-readiness-smoke-test-secret-1234567890';

const server = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_PATH: databasePath,
    SESSION_SECRET: sessionSecret,
    UNIVERSITY_EMAIL_DOMAINS: 'example.edu,*.example.edu',
    NODE_ENV: 'test'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', chunk => { output += chunk.toString(); });
server.stderr.on('data', chunk => { output += chunk.toString(); });

function stopServer() {
  if (!server.killed) server.kill('SIGTERM');
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become healthy. Output:\n${output}`);
}

async function request(pathname, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { response, payload };
}

try {
  await waitForHealth();

  const email = `student-${Date.now()}@example.edu`;
  const password = 'StrongPass123!';
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Live Data Student', email, password, campus: 'Online' })
  });

  const cookie = registered.response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Registration did not return a session cookie.');
  if (!registered.payload?.user?.id) throw new Error('Registration did not return a user payload.');

  const me = await request('/api/auth/me', {}, cookie);
  if (me.payload?.user?.email !== email) throw new Error('Session cookie did not authenticate the registered user.');

  await request('/api/marketplace/listings', {
    method: 'POST',
    body: JSON.stringify({ title: 'Live Smoke Test Laptop Stand', price: 120, condition: 'Good' })
  }, cookie);
  const listings = await request('/api/marketplace/listings');
  if (!listings.payload.some(item => item.title === 'Live Smoke Test Laptop Stand')) {
    throw new Error('Marketplace listing did not persist to live data store.');
  }

  await request('/api/bookstore/books', {
    method: 'POST',
    body: JSON.stringify({ title: 'Live Smoke Test Textbook', author: 'Readiness Bot', price: 95, condition: 'Good' })
  }, cookie);
  const books = await request('/api/bookstore/books');
  if (!books.payload.some(item => item.title === 'Live Smoke Test Textbook')) {
    throw new Error('Bookstore book did not persist to live data store.');
  }

  await request('/api/forum/posts', {
    method: 'POST',
    body: JSON.stringify({ title: 'Live Smoke Test Forum Post', category: 'General Discussion' })
  }, cookie);
  const posts = await request('/api/forum/posts');
  if (!posts.payload.some(item => item.title === 'Live Smoke Test Forum Post')) {
    throw new Error('Forum post did not persist to live data store.');
  }

  if (!fs.existsSync(databasePath)) throw new Error('Expected JSON database file was not created.');
  const persisted = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  if (!persisted.users?.some(user => user.email === email)) {
    throw new Error('Registered user was not written to the JSON database file.');
  }

  console.log('Registration and live data smoke test passed.');
} finally {
  stopServer();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
