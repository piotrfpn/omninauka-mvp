import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST_DIR = path.join(REPO_ROOT, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function resolveChromiumBinary() {
  const envCandidate = process.env.CHROMIUM_PATH || process.env.CHROME_PATH;
  if (envCandidate && fs.existsSync(envCandidate)) {
    return envCandidate;
  }

  const playwrightRoots = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    playwrightRoots.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    playwrightRoots.push(path.join(localAppData, 'ms-playwright'));
  } else if (process.platform === 'darwin') {
    playwrightRoots.push(path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'));
  } else {
    playwrightRoots.push(path.join(os.homedir(), '.cache', 'ms-playwright'));
  }

  const relativeExecutables =
    process.platform === 'win32'
      ? [
          ['chrome-headless-shell-win64', 'chrome-headless-shell.exe'],
          ['chrome-win', 'chrome.exe'],
          ['chrome-win64', 'chrome.exe'],
        ]
      : process.platform === 'darwin'
        ? [
            ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
            ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
          ]
        : [
            ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
            ['chrome-linux', 'chrome'],
          ];

  for (const root of playwrightRoots) {
    if (!fs.existsSync(root)) continue;
    const entries = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (d.name.startsWith('chromium_headless_shell-') || d.name.startsWith('chromium-')))
      .map((d) => d.name)
      .sort()
      .reverse();

    for (const dirName of entries) {
      for (const relParts of relativeExecutables) {
        const candidate = path.join(root, dirName, ...relParts);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }

  throw new Error(
    'Could not locate a Chromium binary. Set CHROMIUM_PATH or install Playwright Chromium.'
  );
}

function startStaticServer(rootDir) {
  if (!fs.existsSync(path.join(rootDir, 'index.html'))) {
    throw new Error(`Build directory not found at ${rootDir}. Run "npm run build" before running E2E tests.`);
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname === '/') pathname = '/index.html';
        let filePath = path.join(rootDir, pathname);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(rootDir, 'index.html');
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPCoordinator {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
  }
  async connect() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (typeof msg.id === 'number') {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(`${msg.error.message} (${msg.error.code})`));
          else entry.resolve(msg.result);
        }
      } else if (msg.method) {
        for (const fn of this.listeners) {
          try {
            fn(msg);
          } catch {
            /* ignore */
          }
        }
      }
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout on ${method}`));
      }, 15000);
      this.pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(JSON.stringify(payload));
    });
  }
  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function launchBrowser() {
  const chromeBinary = resolveChromiumBinary();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omninauka-pf03-3b-1-e2e-'));
  const proc = spawn(
    chromeBinary,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Chrome launch timeout. Stderr: ${stderr}`)), 10000);
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\r\n]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early with code ${code}`));
    });
  });

  const cdp = new CDPCoordinator(wsUrl);
  await cdp.connect();
  return { proc, cdp, userDataDir };
}

async function main() {
  const { server, baseUrl } = await startStaticServer(DIST_DIR);
  const { proc, cdp, userDataDir } = await launchBrowser();

  const supabaseCalls = [];
  const runtimeExceptions = [];
  const consoleErrors = [];
  let mockRealAuthActive = false;

  const realUserFixture = {
    id: 'real-user-pf033b1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'uczen@omninauka.invalid',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: {
      name: 'Zosia',
      ageBand: '16_17',
      accountStatus: 'active',
      user_role: 'student',
    },
    created_at: '2026-01-01T00:00:00Z',
  };

  const handledRequestIds = new Set();
  const activeSessions = new Set();

  cdp.onEvent(async (msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeExceptions.push(msg.params?.exceptionDetails?.text || 'exception');
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (!text.includes('Failed to load quiz from DB') && !text.includes('Dashboard DB fetch error')) {
        consoleErrors.push(text);
      }
    } else if (msg.method === 'Fetch.requestPaused' && msg.sessionId && activeSessions.has(msg.sessionId)) {
      const { requestId, request } = msg.params;
      const key = `${msg.sessionId}:${requestId}`;
      if (handledRequestIds.has(key)) return;
      handledRequestIds.add(key);

      const url = request.url || '';
      const method = request.method || 'GET';
      supabaseCalls.push({ method, url, isDemoPhase: !mockRealAuthActive });

      const fulfill = async (status, bodyObj) => {
        if (!activeSessions.has(msg.sessionId)) return;
        const bodyStr = bodyObj === null ? '' : JSON.stringify(bodyObj);
        try {
          await cdp.send(
            'Fetch.fulfillRequest',
            {
              requestId,
              responseCode: status,
              responseHeaders: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Access-Control-Allow-Origin', value: '*' },
                { name: 'Access-Control-Allow-Headers', value: '*' },
                { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,PUT,DELETE,OPTIONS' },
              ],
              body: Buffer.from(bodyStr, 'utf8').toString('base64'),
            },
            msg.sessionId
          );
        } catch {
          /* session closed */
        }
      };

      if (method === 'OPTIONS') {
        await fulfill(204, null);
        return;
      }

      if (url.includes('/auth/v1/token')) {
        mockRealAuthActive = true;
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(
          JSON.stringify({
            sub: realUserFixture.id,
            email: realUserFixture.email,
            role: 'authenticated',
            exp,
          })
        ).toString('base64url');
        await fulfill(200, {
          access_token: `${header}.${payload}.sig`,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: exp,
          refresh_token: 'synthetic-refresh-token',
          user: {
            ...realUserFixture,
            app_metadata: { provider: 'email', providers: ['email'] },
          },
        });
        return;
      }

      if (url.includes('/auth/v1/user')) {
        if (mockRealAuthActive) {
          await fulfill(200, realUserFixture);
        } else {
          await fulfill(401, { message: 'Unauthorized' });
        }
        return;
      }

      if (url.includes('/auth/v1/logout')) {
        mockRealAuthActive = false;
        await fulfill(204, null);
        return;
      }

      if (url.includes('/rest/v1/profiles')) {
        await fulfill(200, {
          id: realUserFixture.id,
          email: realUserFixture.email,
          name: 'Zosia',
          plan: 'free',
          age_band: '16_17',
          account_status: 'active',
          user_role: 'student',
          profile_completed: true,
        });
        return;
      }

      if (url.includes('/rest/v1/rpc/get_my_effective_plan')) {
        await fulfill(200, {
          effective_plan: 'free',
          plan_source: 'own',
          inherited_from_parent: false,
          source_plan_expires_at: null,
        });
        return;
      }

      if (url.includes('/rest/v1/study_sessions')) {
        if (request.headers?.Accept?.includes('vnd.pgrst.object+json')) {
          await fulfill(406, { code: 'PGRST116', message: 'No rows found' });
        } else {
          await fulfill(200, []);
        }
        return;
      }

      await fulfill(200, {});
    }
  });

  async function createTab(width = 1280, height = 800) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    activeSessions.add(sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      },
      sessionId
    );
    await cdp.send(
      'Fetch.enable',
      {
        patterns: [{ urlPattern: '*supabase*', requestStage: 'Request' }],
      },
      sessionId
    );

    const evaluate = async (expression) => {
      const res = await cdp.send(
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId
      );
      if (res.exceptionDetails) {
        throw new Error(`Eval error: ${res.exceptionDetails.text}`);
      }
      return res.result?.value;
    };

    const waitFor = async (predicateExpr, timeoutMs = 8000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const val = await evaluate(predicateExpr);
        if (val) return val;
        await sleep(80);
      }
      const bodyText = await evaluate(`document.body?.innerText || ''`);
      const pathname = await evaluate(`location.pathname`);
      throw new Error(
        `Timeout waiting for: ${predicateExpr}\nPath: ${pathname}\nBody: ${bodyText.slice(0, 400)}`
      );
    };

    const goto = async (urlPath) => {
      const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;
      await cdp.send('Page.navigate', { url: fullUrl }, sessionId);
      await waitFor(`document.readyState === 'complete'`);
      await sleep(150);
    };

    const reload = async () => {
      await cdp.send('Page.reload', { ignoreCache: true }, sessionId);
      await waitFor(`document.readyState === 'complete'`);
      await sleep(200);
    };

    const setViewport = async (w, h) => {
      await cdp.send(
        'Emulation.setDeviceMetricsOverride',
        {
          width: w,
          height: h,
          deviceScaleFactor: 1,
          mobile: w < 768,
        },
        sessionId
      );
      await sleep(100);
    };

    const close = async () => {
      activeSessions.delete(sessionId);
      try {
        await cdp.send('Target.closeTarget', { targetId });
      } catch {
        /* ignore */
      }
    };

    return { targetId, sessionId, evaluate, waitFor, goto, reload, setViewport, close };
  }

  const results = {};

  try {
    const tab1 = await createTab();

    // ─── TEST A: Biologia (Login -> Demo -> Dashboard -> Biologia -> Podsumowanie -> Fiszki -> Quiz -> Wynik) ───
    supabaseCalls.length = 0;
    await tab1.goto('/login');
    await tab1.waitFor(`document.body.innerText.includes('Wejdź w tryb demo')`);
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Wejdź w tryb demo')).click();
    `);
    await tab1.waitFor(`location.pathname === '/app/dashboard' && document.body.innerText.includes('Kacper')`);
    await tab1.waitFor(`document.body.innerText.includes('Dane przykładowe — tryb Demo')`);
    await tab1.waitFor(
      `document.body.innerText.includes('Budowa komórki - organelle') && document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')`
    );

    // Click Biologia session card
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('p')).find(p => p.innerText.includes('Budowa komórki - organelle')).closest('.omni-card').click();
    `);
    await tab1.waitFor(`location.pathname === '/app/analysis/session-001'`);
    await tab1.waitFor(`document.body.innerText.includes('Budowa komórki - organelle')`);
    await tab1.waitFor(`document.body.innerText.includes('Przykładowa lekcja — Demo')`);
    await tab1.waitFor(
      `document.body.innerText.includes('To przygotowany przykład działania OmniNauka. Nie jest wynikiem analizy przesłanego dokumentu.')`
    );
    const hasConfidenceText = await tab1.evaluate(`document.body.innerText.includes('94%')`);
    assert.equal(hasConfidenceText, false, 'Demo analysis must not present static confidence as live AI confidence');

    // Open Flashcards from AnalysisPage
    await tab1.evaluate(`
      document.querySelector('a[href="/app/flashcards/session-001"]').click();
    `);
    await tab1.waitFor(`location.pathname === '/app/flashcards/session-001'`);
    await tab1.waitFor(`document.body.innerText.includes('Mitochondrium')`);
    const bioFlashcardCounter = await tab1.evaluate(
      `document.body.innerText.includes('1 z 5') || document.body.innerText.includes('1 / 5') || document.body.innerText.includes('5')`
    );
    assert.equal(bioFlashcardCounter, true);

    // Flip card, click "Do powtórki" once, then "Znam" 4 times to finish all 5 Biology flashcards
    await tab1.evaluate(`document.querySelector('[style*="perspective"]').click()`);
    await sleep(100);
    for (let i = 0; i < 5; i++) {
      await tab1.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const target = buttons.find(b => b.innerText.includes(${i === 0 ? "'Do powtórki'" : "'Znam'"}));
        target.click();
      })()`);
      await sleep(220);
    }
    await tab1.waitFor(
      `Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('quiz') || b.innerText.includes('Quiz'))`
    );
    const hasFlashcardRegenBtnInDemo = await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.toLowerCase().includes('wygeneruj') || b.innerText.toLowerCase().includes('regener'))
    `);
    assert.equal(hasFlashcardRegenBtnInDemo, false, 'Flashcards completion in Demo must not show regeneration button');
    const leakedFlashcardLocal = await tab1.evaluate(`localStorage.getItem('flashcards-progress-session-001')`);
    assert.equal(leakedFlashcardLocal, null, 'Demo must not write flashcards-progress to shared localStorage');

    // Navigate to Biology Quiz from Flashcards completion screen
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('quiz')).click();
    `);
    await tab1.waitFor(`location.pathname === '/app/quiz/session-001'`);
    await tab1.waitFor(`document.body.innerText.includes('1 / 3') && document.body.innerText.includes('elektrownią komórki')`);

    // Answer Q1 (Mitochondrium), Q2 (W chloroplastach), Q3 (true_false -> Prawda)
    for (const answerText of ['Mitochondrium', 'W chloroplastach', 'Prawda']) {
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes(${JSON.stringify(answerText)})).click();
      `);
      await sleep(100);
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Następne') || b.innerText.includes('Zakończ')).click();
      `);
      await sleep(150);
    }
    await tab1.waitFor(`document.body.innerText.includes('100%')`);
    const hasQuizRegenBtnInDemo = await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).some(b => b.innerText.toLowerCase().includes('wygeneruj') || b.innerText.toLowerCase().includes('nowy zestaw'))
    `);
    assert.equal(hasQuizRegenBtnInDemo, false, 'Quiz completion in Demo must not show regeneration button');
    const leakedQuizLocal = await tab1.evaluate(`localStorage.getItem('quiz-progress-session-001')`);
    assert.equal(leakedQuizLocal, null, 'Demo must not write quiz-progress to shared localStorage');

    // Open ResultsPage
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Zobacz') || b.innerText.includes('Wynik') || b.innerText.includes('Raport')).click();
    `);
    await tab1.waitFor(`location.pathname === '/app/results'`);
    await tab1.waitFor(
      `document.body.innerText.includes('100%') && document.body.innerText.includes('Budowa komórki - organelle') && document.body.innerText.includes('Dane przykładowe — tryb Demo')`
    );

    const nonAuthDemoCallsA = supabaseCalls.filter((c) => !c.url.includes('/auth/v1/'));
    assert.equal(
      nonAuthDemoCallsA.length,
      0,
      `Expected 0 non-auth Supabase calls in Demo Biology flow, got ${JSON.stringify(nonAuthDemoCallsA)}`
    );
    results.TEST_A_BIOLOGIA = 'PASS';

    // ─── TEST B & TEST C: Historia + Zmiana przedmiotu (Biologia -> Historia -> Biologia) ───
    await tab1.goto('/app/dashboard');
    await tab1.waitFor(`document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')`);
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('p')).find(p => p.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')).closest('.omni-card').click();
    `);
    await tab1.waitFor(
      `location.pathname === '/app/analysis/session-002' && document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')`
    );

    const quizResultsAfterSwitchToHistory = await tab1.evaluate(`sessionStorage.getItem('quizResults')`);
    assert.equal(quizResultsAfterSwitchToHistory, null, 'Switching from Biology to History must clear Biology quizResults');

    await tab1.goto('/app/results');
    await tab1.waitFor(
      `document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie') && !document.body.innerText.includes('elektrownią komórki')`
    );

    await tab1.goto('/app/flashcards/session-002');
    await tab1.waitFor(
      `document.body.innerText.includes('1 września 1939') && !document.body.innerText.includes('Mitochondrium')`
    );
    for (let i = 0; i < 3; i++) {
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Znam')).click();
      `);
      await sleep(220);
    }
    await tab1.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.innerText.toLowerCase().includes('quiz'))`);

    await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('quiz')).click();
    `);
    await tab1.waitFor(
      `location.pathname === '/app/quiz/session-002' && document.body.innerText.includes('1 / 2') && document.body.innerText.includes('Kiedy wybuchła II wojna światowa?')`
    );

    for (const answerText of ['1 września 1939', 'Schlieffenplan']) {
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes(${JSON.stringify(answerText)})).click();
      `);
      await sleep(100);
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Następne') || b.innerText.includes('Zakończ')).click();
      `);
      await sleep(150);
    }
    await tab1.waitFor(`document.body.innerText.includes('50%')`);
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Zobacz') || b.innerText.includes('Wynik') || b.innerText.includes('Raport')).click();
    `);
    await tab1.waitFor(
      `location.pathname === '/app/results' && document.body.innerText.includes('50%') && document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')`
    );
    results.TEST_B_HISTORIA = 'PASS';

    await tab1.goto('/app/analysis/session-001');
    await tab1.waitFor(`document.body.innerText.includes('Budowa komórki - organelle') && !document.body.innerText.includes('Blitzkrieg')`);
    const quizResultsAfterSwitchBackToBio = await tab1.evaluate(`sessionStorage.getItem('quizResults')`);
    assert.equal(quizResultsAfterSwitchBackToBio, null, 'Switching from History back to Biology must clear History quizResults');
    results.TEST_C_SUBJECT_SWITCH = 'PASS';

    // ─── TEST D: F5 on Dashboard, Biology Analysis, History Flashcards, Biology Quiz, and Completed Quiz Results ───
    await tab1.goto('/app/dashboard');
    await tab1.waitFor(`document.body.innerText.includes('Kacper')`);
    await tab1.reload();
    await tab1.waitFor(
      `location.pathname === '/app/dashboard' && document.body.innerText.includes('Kacper') && document.body.innerText.includes('Dane przykładowe — tryb Demo')`
    );

    await tab1.goto('/app/analysis/session-001');
    await tab1.waitFor(`document.body.innerText.includes('Budowa komórki - organelle')`);
    await tab1.reload();
    await tab1.waitFor(
      `location.pathname === '/app/analysis/session-001' && document.body.innerText.includes('Budowa komórki - organelle') && document.body.innerText.includes('Przykładowa lekcja — Demo')`
    );

    await tab1.goto('/app/flashcards/session-002');
    await tab1.waitFor(`document.body.innerText.includes('1 września 1939')`);
    await tab1.reload();
    await tab1.waitFor(`location.pathname === '/app/flashcards/session-002' && document.body.innerText.includes('1 września 1939')`);

    await tab1.goto('/app/quiz/session-001');
    await tab1.waitFor(`document.body.innerText.includes('1 / 3') && document.body.innerText.includes('elektrownią komórki')`);
    await tab1.reload();
    await tab1.waitFor(
      `location.pathname === '/app/quiz/session-001' && document.body.innerText.includes('1 / 3') && document.body.innerText.includes('elektrownią komórki')`
    );

    for (const answerText of ['Mitochondrium', 'W chloroplastach', 'Prawda']) {
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes(${JSON.stringify(answerText)})).click();
      `);
      await sleep(80);
      await tab1.evaluate(`
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Następne') || b.innerText.includes('Zakończ')).click();
      `);
      await sleep(120);
    }
    await tab1.goto('/app/results');
    await tab1.waitFor(`document.body.innerText.includes('100%') && document.body.innerText.includes('Budowa komórki - organelle')`);
    await tab1.reload();
    await tab1.waitFor(
      `location.pathname === '/app/results' && document.body.innerText.includes('100%') && document.body.innerText.includes('Budowa komórki - organelle')`
    );
    results.TEST_D_F5_PERSISTENCE = 'PASS';

    // ─── TEST E: Direct navigation to /app/analysis/session-001, /app/analysis/session-002, /app/flashcards/session-001, /app/quiz/session-002 ───
    await tab1.goto('/app/analysis/session-001');
    await tab1.waitFor(`document.body.innerText.includes('Budowa komórki - organelle')`);
    await tab1.goto('/app/analysis/session-002');
    await tab1.waitFor(`document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')`);
    await tab1.goto('/app/flashcards/session-001');
    await tab1.waitFor(`document.body.innerText.includes('Mitochondrium')`);
    await tab1.goto('/app/quiz/session-002');
    await tab1.waitFor(`document.body.innerText.includes('1 / 2') && document.body.innerText.includes('Kiedy wybuchła II wojna światowa?')`);
    results.TEST_E_DIRECT_NAVIGATION = 'PASS';

    // ─── TEST F: Unknown Demo ID (/app/analysis/unknown-demo-id) ───
    const callsBeforeUnknown = supabaseCalls.filter((c) => !c.url.includes('/auth/v1/')).length;
    await tab1.goto('/app/analysis/unknown-demo-id');
    await tab1.waitFor(`document.body.innerText.includes('Ta przykładowa lekcja nie jest dostępna. Wybierz Biologię lub Historię.')`);
    await tab1.waitFor(`Array.from(document.querySelectorAll('a')).some(a => a.getAttribute('href') === '/app/dashboard')`);
    const callsAfterUnknown = supabaseCalls.filter((c) => !c.url.includes('/auth/v1/')).length;
    assert.equal(callsAfterUnknown, callsBeforeUnknown, 'Unknown Demo ID must not query Supabase');
    results.TEST_F_UNKNOWN_ID = 'PASS';

    // ─── TEST G: Regeneration blocked in Demo ───
    const regenCalls = supabaseCalls.filter((c) => c.url.includes('regenerate-module'));
    assert.equal(regenCalls.length, 0, 'Demo must never call regenerate-module');
    results.TEST_G_REGENERATION_BLOCKED = 'PASS';

    // ─── TEST H: Demo Upload (/app/upload & legacy /app/analysis/demo-session redirect) ───
    await tab1.goto('/app/analysis/demo-session');
    await tab1.waitFor(`location.pathname === '/app/upload'`);
    await tab1.waitFor(`document.body.innerText.includes('Wypróbuj przykładową lekcję')`);
    await tab1.waitFor(
      `document.body.innerText.includes('W trybie Demo możesz sprawdzić naukę na gotowych przykładach. Aby analizować własne notatki, załóż konto.')`
    );
    await tab1.waitFor(
      `document.body.innerText.includes('Biologia — Budowa komórki') && document.body.innerText.includes('Historia — II wojna światowa')`
    );
    const hasFileInputsInDemo = await tab1.evaluate(`document.querySelectorAll('input[type="file"]').length`);
    assert.equal(hasFileInputsInDemo, 0, 'Demo UploadPage must not render file upload inputs');

    await tab1.evaluate(`
      Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Historia — II wojna światowa')).click();
    `);
    await tab1.waitFor(
      `location.pathname === '/app/analysis/session-002' && document.body.innerText.includes('II Wojna Światowa - wybuch i pierwsze kampanie')`
    );
    results.TEST_H_DEMO_UPLOAD = 'PASS';

    // ─── TEST L (part 1: App pages responsive check at 375, 390, 768, 1024, 1440) ───
    for (const vp of [
      [375, 812],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ]) {
      await tab1.setViewport(vp[0], vp[1]);
      for (const route of [
        '/app/dashboard',
        '/app/analysis/session-001',
        '/app/flashcards/session-001',
        '/app/quiz/session-001',
        '/app/results',
      ]) {
        await tab1.goto(route);
        const overflow = await tab1.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`);
        assert.equal(overflow, false, `Horizontal overflow detected on ${route} at ${vp[0]}px`);
      }
    }
    await tab1.setViewport(1280, 800);

    // Clear Demo state before testing /jak-to-dziala direct entry
    await tab1.evaluate(`localStorage.clear(); sessionStorage.clear(); window.name = '';`);
    await tab1.goto('/jak-to-dziala');

    // ─── TEST I & TEST M & TEST L (part 2): /jak-to-dziala Hero CTA, PL/EN translations, responsive layout, direct Demo entry ───
    await tab1.waitFor(`document.querySelector('#hero-heading') !== null`);
    const heroPlCheck = await tab1.evaluate(`(() => {
      const hero = document.querySelector('[data-section="02"]');
      const primaryBtn = hero.querySelector('a.action.primary');
      const demoBtn = hero.querySelector('button.action.demo-action');
      const note = hero.querySelector('p.note');
      const heroLinks = Array.from(hero.querySelectorAll('.actions a, .actions button')).map(el => el.innerText.trim());
      const pilotSection = document.querySelector('#pilotaz');
      return {
        primaryText: primaryBtn?.innerText.trim(),
        demoText: demoBtn?.innerText.trim(),
        noteText: note?.innerText.trim(),
        heroLinks,
        hasPilotInHero: hero.innerText.includes('Zapytaj o udział w pilotażu') || hero.innerText.includes('Dostęp do pilotażu jest kontrolowany'),
        hasLowerPilotSection: Boolean(pilotSection),
      };
    })()`);
    assert.equal(heroPlCheck.primaryText, 'Zobacz, jak działa');
    assert.equal(heroPlCheck.demoText, 'Wypróbuj tryb demo');
    assert.equal(heroPlCheck.noteText, 'Poznaj produkt bez zakładania konta.');
    assert.deepEqual(heroPlCheck.heroLinks, ['Zobacz, jak działa', 'Wypróbuj tryb demo']);
    assert.equal(heroPlCheck.hasPilotInHero, false, 'Hero must not contain pilot button or controlled pilot note');
    assert.equal(heroPlCheck.hasLowerPilotSection, true, 'Dedicated lower #pilotaz section must remain intact');

    // Switch to EN and verify translations
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('.lang-btn')).find(b => b.innerText.trim() === 'EN').click();
    `);
    await tab1.waitFor(`document.querySelector('[data-section="02"] button.action.demo-action')?.innerText.trim() === 'Try Demo'`);
    const heroEnCheck = await tab1.evaluate(`(() => {
      const hero = document.querySelector('[data-section="02"]');
      const primaryBtn = hero.querySelector('a.action.primary');
      const demoBtn = hero.querySelector('button.action.demo-action');
      const note = hero.querySelector('p.note');
      return {
        primaryText: primaryBtn?.innerText.trim(),
        demoText: demoBtn?.innerText.trim(),
        noteText: note?.innerText.trim(),
        hasPilotInHero: hero.innerText.includes('Ask about the pilot') || hero.innerText.includes('Pilot access is controlled'),
      };
    })()`);
    assert.equal(heroEnCheck.primaryText, 'See how it works');
    assert.equal(heroEnCheck.demoText, 'Try Demo');
    assert.equal(heroEnCheck.noteText, 'Explore the product without creating an account.');
    assert.equal(heroEnCheck.hasPilotInHero, false);

    // Switch back to PL
    await tab1.evaluate(`
      Array.from(document.querySelectorAll('.lang-btn')).find(b => b.innerText.trim() === 'PL').click();
    `);
    await tab1.waitFor(
      `document.querySelector('[data-section="02"] button.action.demo-action')?.innerText.trim() === 'Wypróbuj tryb demo'`
    );

    // Check responsive viewports (375, 390, 768, 1024, 1440) on /jak-to-dziala
    for (const [w, h] of [
      [375, 812],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ]) {
      await tab1.setViewport(w, h);
      const layout = await tab1.evaluate(`(() => {
        const primary = document.querySelector('[data-section="02"] a.action.primary').getBoundingClientRect();
        const demo = document.querySelector('[data-section="02"] button.action.demo-action').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          demoBelowPrimary: demo.top >= primary.bottom - 2,
          primaryHeight: primary.height,
          demoHeight: demo.height,
        };
      })()`);
      assert.equal(layout.overflow, false, `Overflow on /jak-to-dziala at ${w}px`);
      assert.equal(layout.demoBelowPrimary, true, `Demo CTA must be directly below primary CTA at ${w}px`);
      assert.ok(layout.primaryHeight >= 44 && layout.demoHeight >= 44, `Touch target height >= 44px at ${w}px`);
    }
    await tab1.setViewport(1280, 800);
    results.TEST_L_RESPONSIVE = 'PASS';

    // Click "Zobacz, jak działa" -> scrolls to #jak-dziala
    await tab1.evaluate(`document.querySelector('[data-section="02"] a.action.primary').click()`);
    await sleep(300);
    const hashAfterPrimaryClick = await tab1.evaluate(`location.hash`);
    assert.equal(hashAfterPrimaryClick, '#jak-dziala');

    // Click "Wypróbuj tryb demo" -> opens Kacper's dashboard directly without visiting /login
    await tab1.evaluate(`document.querySelector('[data-section="02"] button.action.demo-action').click()`);
    await tab1.waitFor(
      `location.pathname === '/app/dashboard' && document.body.innerText.includes('Kacper') && document.body.innerText.includes('Dane przykładowe — tryb Demo')`
    );
    results.TEST_I_HOW_IT_WORKS_CTA = 'PASS';

    // ─── TEST K (part 1): Tab 1 in Demo + Tab 2 unauthenticated opens /app/dashboard -> Tab 2 redirected to /login, Tab 1 stays in Demo ───
    const tab2DemoCheck = await createTab();
    await tab2DemoCheck.goto('/app/dashboard');
    await tab2DemoCheck.waitFor(`location.pathname === '/login'`);
    const tab1StillDemo = await tab1.evaluate(
      `location.pathname === '/app/dashboard' && document.body.innerText.includes('Kacper')`
    );
    assert.equal(tab1StillDemo, true, 'Opening unauthenticated Tab 2 must not log out Tab 1 Demo');
    await tab2DemoCheck.close();

    // Clean up Demo in Tab 1 and log in as a synthetic real user to test TEST J & TEST K (part 2)
    await tab1.evaluate(`localStorage.clear(); sessionStorage.clear(); window.name = '';`);
    await tab1.goto('/login');
    await tab1.waitFor(`document.querySelector('input[type="email"]') !== null`);
    await tab1.evaluate(`(() => {
      const setVal = (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal(document.querySelector('input[type="email"]'), 'uczen@omninauka.invalid');
      setVal(document.querySelector('input[type="password"]'), 'SyntheticFixturePass!');
      document.querySelector('form button[type="submit"]').click();
    })()`);
    await tab1.waitFor(`location.pathname === '/app/dashboard' && document.body.innerText.includes('Zosia')`);

    // Verify real user cannot access Demo mock data by typing /app/analysis/session-001
    await tab1.goto('/app/analysis/session-001');
    await tab1.waitFor(
      `!document.body.innerText.includes('Budowa komórki - organelle') && !document.body.innerText.includes('Przykładowa lekcja — Demo')`
    );

    // ─── TEST J & TEST M (part 2): Active real session -> attempt to launch Demo from /jak-to-dziala in PL and EN ───
    await tab1.goto('/jak-to-dziala');
    await tab1.waitFor(`document.querySelector('[data-section="02"] button.action.demo-action') !== null`);
    await tab1.evaluate(`document.querySelector('[data-section="02"] button.action.demo-action').click()`);
    await tab1.waitFor(
      `document.querySelector('[role="alert"]')?.innerText.includes('W tej przeglądarce aktywna jest sesja prawdziwego konta')`
    );
    const stayedOnHowItWorks = await tab1.evaluate(`location.pathname === '/jak-to-dziala'`);
    assert.equal(stayedOnHowItWorks, true, 'Real user must remain on /jak-to-dziala with a clear warning when clicking Try Demo');

    await tab1.evaluate(`
      Array.from(document.querySelectorAll('.lang-btn')).find(b => b.innerText.trim() === 'EN').click();
    `);
    await tab1.waitFor(
      `document.querySelector('[role="alert"]')?.innerText.includes('An active account session was detected in this browser')`
    );
    results.TEST_M_LOCALIZATION = 'PASS';
    results.TEST_J_REAL_ACCOUNT_CONFLICT = 'PASS';

    // ─── TEST K (part 2): Tab 1 has active real account + Tab 2 attempts Demo on /jak-to-dziala -> blocked fail-closed, Tab 1 stays logged in ───
    await tab1.goto('/app/dashboard');
    await tab1.waitFor(`location.pathname === '/app/dashboard' && document.body.innerText.includes('Zosia')`);
    await tab1.evaluate(`localStorage.setItem('quiz-progress-real-session', 'REAL_USER_PROGRESS')`);

    const tab2 = await createTab();
    await tab2.goto('/jak-to-dziala');
    await tab2.waitFor(`document.querySelector('[data-section="02"] button.action.demo-action') !== null`);
    await tab2.evaluate(`document.querySelector('[data-section="02"] button.action.demo-action').click()`);
    await tab2.waitFor(`document.querySelector('[role="alert"]') !== null`);
    const tab2Path = await tab2.evaluate(`location.pathname`);
    assert.equal(tab2Path, '/jak-to-dziala');
    const tab1RealIntact = await tab1.evaluate(`
      location.pathname === '/app/dashboard' &&
      document.body.innerText.includes('Zosia') &&
      localStorage.getItem('quiz-progress-real-session') === 'REAL_USER_PROGRESS'
    `);
    assert.equal(tab1RealIntact, true, 'Tab 1 real user session and localStorage progress must remain untouched');
    results.TEST_K_MULTI_TAB = 'PASS';

    await tab2.close();
    await tab1.close();

    assert.equal(runtimeExceptions.length, 0, `Unexpected runtime exceptions: ${JSON.stringify(runtimeExceptions)}`);
    assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`);

    console.log(
      'PF03_3B_1_E2E_SUMMARY:' +
        JSON.stringify({
          status: 'PASS',
          results,
          runtimeExceptions: runtimeExceptions.length,
          consoleErrors: consoleErrors.length,
        })
    );
  } finally {
    cdp.close();
    proc.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error('PF03_3B_1_E2E_FATAL:', err);
  process.exit(1);
});
