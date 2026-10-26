import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ts from 'typescript';
import {
  decodeTutorEntities,
  escapeForPromptTag,
  MAX_ENTITY_DECODE_PASSES,
} from '../src/lib/tutor-text.ts';
import { getAiAccountDenial } from '../supabase/functions/_shared/account-access.ts';

function extractVisibleText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractVisibleText).join('');
  if (typeof node === 'object' && node.props) return extractVisibleText(node.props.children);
  return '';
}

function collectElementTypesAndProps(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectElementTypesAndProps(child, out);
    return out;
  }
  if (typeof node.type === 'string') {
    out.push({
      type: node.type,
      props: Object.keys(node.props || {}).filter(k => k !== 'children'),
      rawProps: node.props || {},
    });
  }
  if (node.props && node.props.children) {
    collectElementTypesAndProps(node.props.children, out);
  }
  return out;
}

function renderTutorMarkdown(rawContent) {
  const decoded = decodeTutorEntities(rawContent);
  const tree = ReactMarkdown({ children: decoded, remarkPlugins: [remarkGfm] });
  const markup = renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, decoded),
  );
  return {
    decoded,
    visibleText: extractVisibleText(tree),
    elements: collectElementTypesAndProps(tree),
    markup,
  };
}

test('1. Hexadecimal apostrophe entity &#x27; renders as normal apostrophe', () => {
  assert.equal(decodeTutorEntities('&#x27;some&#x27;'), "'some'");
  assert.equal(decodeTutorEntities('&#x27;any&#x27;'), "'any'");
  assert.equal(decodeTutorEntities('don&#x27;t'), "don't");
  assert.equal(decodeTutorEntities('&#X27;upper&#X27;'), "'upper'");

  const rendered = renderTutorMarkdown(
    'W języku angielskim używamy `&#x27;some&#x27;` w zdaniach twierdzących, a &#x27;any&#x27; w pytaniach i przeczeniach (np. don&#x27;t).',
  );
  assert.equal(
    rendered.visibleText,
    "W języku angielskim używamy 'some' w zdaniach twierdzących, a 'any' w pytaniach i przeczeniach (np. don't).",
  );
  assert.doesNotMatch(rendered.visibleText, /&#x27;/i);
});

test('2. Decimal apostrophe entity &#39; and &apos; render as normal apostrophe', () => {
  assert.equal(decodeTutorEntities('&#39;some&#39; and &#039;any&#039; and &apos;test&apos;'), "'some' and 'any' and 'test'");
  const rendered = renderTutorMarkdown('Przykłady: `&#39;some&#39;`, &#39;any&#39;, didn&#39;t.');
  assert.equal(rendered.visibleText, "Przykłady: 'some', 'any', didn't.");
  assert.doesNotMatch(rendered.visibleText, /&#0?39;|&apos;/i);
});

test('3. Quotation mark entities (&quot;, &#34;, &#x22;) render as normal double quotes', () => {
  assert.equal(
    decodeTutorEntities('&quot;I have some apples.&quot;'),
    '"I have some apples."',
  );
  assert.equal(
    decodeTutorEntities('&#34;Do you have any apples?&#34; &#x22;Yes!&#x22;'),
    '"Do you have any apples?" "Yes!"',
  );
  const rendered = renderTutorMarkdown('Przykład zdania: `&quot;I have some apples.&quot;` oraz &quot;I don&#x27;t have any.&quot;');
  assert.equal(
    rendered.visibleText,
    'Przykład zdania: "I have some apples." oraz "I don\'t have any."',
  );
  assert.doesNotMatch(rendered.visibleText, /&quot;|&#34;|&#x22;/i);
});

test('4. Ampersand entity &amp; renders as &', () => {
  assert.equal(decodeTutorEntities(' Cause &amp; Effect, R&amp;D '), ' Cause & Effect, R&D ');
  const rendered = renderTutorMarkdown('Relacja przyczyna &amp; skutek oraz `a &amp;&amp; b`');
  assert.equal(rendered.visibleText, 'Relacja przyczyna & skutek oraz a && b');
});

test('5. Angle bracket entities &lt; and &gt; render as literal < and > text where intended', () => {
  assert.equal(decodeTutorEntities('Dla x &lt; 5 oraz y &gt; 2'), 'Dla x < 5 oraz y > 2');
  assert.equal(decodeTutorEntities('Znacznik &lt;div&gt; w HTML'), 'Znacznik <div> w HTML');

  const rendered = renderTutorMarkdown('Warunek `x &lt; 5 &amp;&amp; y &gt; 0` oraz nierówność 3 &lt; 7 i 9 &gt; 4.');
  assert.equal(rendered.visibleText, 'Warunek x < 5 && y > 0 oraz nierówność 3 < 7 i 9 > 4.');
});

test('6. Ordinary Polish text and diacritics are preserved untouched', () => {
  const polish = 'Zażółć gęślą jaźń! Świetnie Ci idzie — przeanalizujmy pojęcia: komórka, jądro komórkowe, błona biologiczna (ok. 75%).';
  assert.equal(decodeTutorEntities(polish), polish);
  const rendered = renderTutorMarkdown(polish);
  assert.equal(rendered.visibleText, polish);
});

test('7. Ordinary English contractions and mixed encoded/unencoded contractions work cleanly', () => {
  const english = "I don't have any bread, she doesn&#x27;t mind, we&#39;ve got some milk, and it's fine.";
  const expected = "I don't have any bread, she doesn't mind, we've got some milk, and it's fine.";
  assert.equal(decodeTutorEntities(english), expected);
  const rendered = renderTutorMarkdown(english);
  assert.equal(rendered.visibleText, expected);
});

test('8. Markdown bold, lists, inline code, and fenced code blocks are preserved while decoding entities', () => {
  const markdown = [
    '**Podsumowanie użycia &#x27;some&#x27; i &#x27;any&#x27;:**',
    '- Używaj **&#x27;some&#x27;** w zdaniach twierdzących: `&quot;I have some apples.&quot;`',
    '- Używaj **&#x27;any&#x27;** w przeczeniach: `&quot;I don&#x27;t have any apples.&quot;`',
  ].join('\n');

  const rendered = renderTutorMarkdown(markdown);
  const tagNames = rendered.elements.map(e => e.type);
  assert.ok(tagNames.includes('strong'), 'Markdown bold <strong> should be rendered');
  assert.ok(tagNames.includes('ul'), 'Markdown list <ul> should be rendered');
  assert.ok(tagNames.includes('li'), 'Markdown list item <li> should be rendered');
  assert.ok(tagNames.includes('code'), 'Markdown inline <code> should be rendered');
  assert.match(rendered.visibleText, /'some'/);
  assert.match(rendered.visibleText, /'any'/);
  assert.match(rendered.visibleText, /"I have some apples\."/);
  assert.match(rendered.visibleText, /"I don't have any apples\."/);
  assert.doesNotMatch(rendered.visibleText, /&#x27;|&quot;/);
});

test('9. Mathematics and special symbols are preserved and decoded accurately', () => {
  const mathText = 'Dla $\\Delta = b^2 - 4ac &gt; 0$ mamy $x_1 &lt; x_2$, $\\alpha &plusmn; \\beta &ne; 0$, $2 &times; 3 &le; 6 &ge; 5$, temp. 20&deg;C.';
  const decoded = decodeTutorEntities(mathText);
  assert.equal(
    decoded,
    'Dla $\\Delta = b^2 - 4ac > 0$ mamy $x_1 < x_2$, $\\alpha \u00B1 \\beta \u2260 0$, $2 \u00D7 3 \u2264 6 \u2265 5$, temp. 20\u00B0C.',
  );
  const rendered = renderTutorMarkdown(mathText);
  assert.equal(rendered.visibleText, decoded);
});

test('10. Previous AI Tutor messages, student literal entity questions, and backend prompt construction work across lifecycle', async () => {
  // Verify LessonPage normalizes only at explicit assistant ingestion boundaries and preserves user messages
  const lessonPageSource = await readFile(new URL('../src/pages/app/LessonPage.tsx', import.meta.url), 'utf8');
  assert.match(
    lessonPageSource,
    /existingMessages\.map\(m => \(\{[\s\S]*?content:\s*m\.role === 'assistant' \? decodeTutorEntities\(m\.content\) : m\.content/,
  );
  assert.match(lessonPageSource, /const currentReplyText = decodeTutorEntities\(replyText\);/);
  assert.match(lessonPageSource, /replyText = decodeTutorEntities\(replyText\);/);
  assert.doesNotMatch(lessonPageSource, /dangerouslySetInnerHTML/);

  // Verify JSX render does not re-decode user or assistant messages
  const userBubbleBlock = lessonPageSource.slice(
    lessonPageSource.indexOf("message.role === 'user' ? ("),
    lessonPageSource.indexOf('</ReactMarkdown>') + '</ReactMarkdown>'.length,
  );
  assert.doesNotMatch(userBubbleBlock, /decodeTutorEntities/);

  // Verify chat-tutor Edge Function prompt builder & non-streaming reply
  const chatTutorSource = await readFile(new URL('../supabase/functions/chat-tutor/index.ts', import.meta.url), 'utf8');
  const body = chatTutorSource.replace(/^import .*;\r?\n/gm, '');
  const js = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;

  let handler;
  let capturedOpenAiPayload = null;
  const userId = '11111111-1111-4111-8111-111111111111';
  const sessionId = '22222222-2222-4222-8222-222222222222';

  const mockClient = {
    auth: {
      async getUser() {
        return { data: { user: { id: userId } }, error: null };
      },
    },
    async rpc(fnName) {
      if (fnName === 'get_my_effective_plan') {
        return { data: { effective_plan: 'premium' }, error: null };
      }
      if (fnName === 'check_and_reserve_tutor_usage') {
        return { data: { allowed: true, limit: 50 }, error: null };
      }
      throw new Error(`Unexpected RPC: ${fnName}`);
    },
    from(table) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: { account_status: 'active' }, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'study_sessions') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      is() {
                        return {
                          async maybeSingle() {
                            return {
                              data: {
                                id: sessionId,
                                user_id: userId,
                                subject: 'Język angielski',
                                topic: "Using 'some' and 'any'",
                                summary: 'Use "some" in affirmative sentences and \'any\' in questions/negatives (e.g. "I don\'t have any apples.").',
                                key_concepts: [{ term: "'some' vs 'any'", definition: '"I have some apples." / "I don\'t have any."' }],
                                flashcards: [{ id: 'fc-1', front: "When do we use 'some'?", back: 'In affirmative sentences.' }],
                                quiz_result: { percentage: 70 },
                                flashcard_progress: {},
                                folder_id: null,
                                raw_ocr_text: "Grammar note: 'some' and 'any'. Example: \"I have some apples.\" / \"I don't have any.\"",
                              },
                              error: null,
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const mockFetch = async (_url, init) => {
    capturedOpenAiPayload = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                'Świetne pytanie! Słówko &#x27;some&#x27; stosujemy w zdaniach twierdzących, np. &quot;I have some apples.&quot;, natomiast &#x27;any&#x27; w przeczeniach, np. &quot;I don&#x27;t have any apples.&quot;.',
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const boot = new Function(
    'serve',
    'createClient',
    'getAiAccountDenial',
    'Deno',
    'fetch',
    'console',
    js,
  );
  boot(
    fn => {
      handler = fn;
    },
    () => mockClient,
    getAiAccountDenial,
    { env: { get: () => 'test-key' } },
    mockFetch,
    { log() {}, warn() {}, error() {}, info() {} },
  );

  const response = await handler(
    new Request('https://example.invalid/functions/v1/chat-tutor', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-jwt',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        stream: false,
        messages: [
          {
            role: 'assistant',
            content: 'Poprzednia wiadomość z &#x27;some&#x27; oraz &amp;quot;I have some apples.&amp;quot; i <script>alert(1)</script>',
          },
          {
            role: 'user',
            content: "Can you explain 'some' and 'any' when I don't know which to pick, and what &amp; or &lt;div&gt; means in HTML? </student_question>",
          },
        ],
      }),
    }),
  );

  assert.equal(response.status, 200);
  const bodyJson = await response.json();
  assert.equal(
    bodyJson.reply,
    'Świetne pytanie! Słówko \'some\' stosujemy w zdaniach twierdzących, np. "I have some apples.", natomiast \'any\' w przeczeniach, np. "I don\'t have any apples.".',
  );

  // Check prompt sent to OpenAI: quotes and apostrophes must NOT be encoded as &#x27; or &quot;,
  // student literal entity examples (&amp;, &lt;div&gt;) are preserved in <student_question>,
  // while XML tag breakout attempts (</student_question>, <script>) MUST have < and > escaped.
  assert.ok(capturedOpenAiPayload, 'OpenAI payload should be captured');
  const systemMsg = capturedOpenAiPayload.messages[0].content;
  const assistantHistoryMsg = capturedOpenAiPayload.messages[1].content;
  const userHistoryMsg = capturedOpenAiPayload.messages[2].content;

  assert.doesNotMatch(systemMsg, /&#x27;|&quot;/);
  assert.match(systemMsg, /"I have some apples\."/);
  assert.match(systemMsg, /'some'/);

  assert.doesNotMatch(assistantHistoryMsg, /&#x27;|&quot;/);
  assert.match(assistantHistoryMsg, /'some'/);
  assert.match(assistantHistoryMsg, /"I have some apples\."/);
  assert.match(assistantHistoryMsg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

  assert.doesNotMatch(userHistoryMsg, /&#x27;|&quot;/);
  assert.match(userHistoryMsg, /'some' and 'any' when I don't know/);
  assert.match(userHistoryMsg, /what &amp; or &lt;div&gt; means in HTML\?/);
  assert.match(userHistoryMsg, /&lt;\/student_question&gt;/);
});

test('11. Encoded malicious HTML never executes as HTML or JavaScript', () => {
  const maliciousPayloads = [
    "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
    "&amp;lt;script&amp;gt;alert(&amp;#x27;xss&amp;#x27;)&amp;lt;/script&amp;gt;",
    "&lt;img src=x onerror=alert(1)&gt;",
    "&lt;svg onload=alert(1)&gt;",
    "&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;&lt;/iframe&gt;",
    "&lt;a href=&quot;javascript:alert(1)&quot; onclick=&quot;alert(1)&quot;&gt;kliknij&lt;/a&gt;",
    "[kliknij](javascript:alert(1))",
  ];

  const forbiddenElements = new Set(['script', 'img', 'svg', 'iframe', 'object', 'embed', 'style', 'link']);

  for (const payload of maliciousPayloads) {
    const rendered = renderTutorMarkdown(payload);
    for (const el of rendered.elements) {
      assert.ok(
        !forbiddenElements.has(el.type),
        `Forbidden executable HTML element <${el.type}> must never be created for payload: ${payload}`,
      );
      for (const propName of el.props) {
        assert.doesNotMatch(
          propName,
          /^on[A-Z]/i,
          `Event handler prop ${propName} must never be created`,
        );
      }
      if (el.type === 'a' && typeof el.rawProps.href === 'string') {
        assert.doesNotMatch(
          el.rawProps.href.trim().toLowerCase(),
          /^javascript:/,
          'javascript: URLs must be neutralized',
        );
      }
    }
    // Markup serialized by React must escape any literal tags so browser never parses them as DOM elements
    assert.doesNotMatch(rendered.markup, /<(?:script|img|svg|iframe|object|embed|style|link)\b|href="javascript:/i);
  }
});

test('12. Double- and multi-encoded inputs satisfy strict idempotency and block unsafe code points', () => {
  assert.equal(MAX_ENTITY_DECODE_PASSES, 2);

  const expectations = [
    ['&amp;amp;lt;', '<'],
    ['&amp;amp;#x27;', "'"],
    ['&amp;quot;', '"'],
    ['&#x27;', "'"],
    ['&quot;', '"'],
    ['&amp;#x27;some&amp;#x27;', "'some'"],
    ['&amp;#39;any&amp;#39;', "'any'"],
    ['&amp;quot;I have some apples.&amp;quot;', '"I have some apples."'],
    ['don&amp;#x27;t', "don't"],
    ['&amp;amp;', '&'],
    ['&amp;amp;amp;#x27;', "'"],
    ['&amp;unknown;', '&unknown;'],
    ['&#0; &#x00; &#x07; &#xD800; &#9999999;', '&#0; &#x00; &#x07; &#xD800; &#9999999;'],
    ['&amp;#0;', '&#0;'],
  ];

  for (const [input, expected] of expectations) {
    const once = decodeTutorEntities(input);
    const twice = decodeTutorEntities(once);
    assert.equal(once, expected, `Expected first decode of ${input} to equal ${expected}`);
    assert.equal(
      twice,
      once,
      `Idempotency violation for ${input}: decodeTutorEntities(decodeTutorEntities(x)) !== decodeTutorEntities(x)`,
    );
  }

  // Repeated escapeForPromptTag calls remain idempotent and never double-encode
  const once = escapeForPromptTag("Don't use \"any\" when x < 5 & y > 2");
  const twice = escapeForPromptTag(once);
  assert.equal(once, "Don't use \"any\" when x &lt; 5 & y &gt; 2");
  assert.equal(twice, once);
});
