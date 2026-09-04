// Cloudflare Worker: receives recorded audio, transcribes it with Groq Whisper,
// then translates with a Groq LLM that first restores natural sentence boundaries.
// The Groq API key lives only here (as a Worker secret), never in the web page.

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const WHISPER_MODEL = 'whisper-large-v3-turbo';
const LLM_MODEL = 'llama-3.3-70b-versatile';

const LANG_NAMES = { ko: 'Korean', en: 'English' };

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function transcribe(file, lang, env) {
  const form = new FormData();
  form.append('file', file, file.name || 'audio.webm');
  form.append('model', WHISPER_MODEL);
  form.append('language', lang);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.text || '').trim();
}

async function translate(text, from, to, env) {
  const system = [
    `You are a professional ${LANG_NAMES[from]}-to-${LANG_NAMES[to]} interpreter.`,
    'The input is a raw speech transcript. The speaker may have paused mid-sentence,',
    'so fragments separated by pauses can belong to the same sentence.',
    'First silently reconstruct the intended sentences (fix punctuation, join fragments, remove filler words like 음, 어, um, uh),',
    `then translate into natural, fluent ${LANG_NAMES[to]} that a native speaker would say.`,
    'Keep the register: polite/formal speech stays polite, casual stays casual.',
    'Return ONLY a JSON object with two keys: "cleaned" (the tidied source text) and "translation". No commentary.',
  ].join(' ');

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { cleaned: text, translation: content.trim() };
  }
  return {
    cleaned: (parsed.cleaned || text).trim(),
    translation: (parsed.translation || '').trim(),
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
    if (!env.GROQ_API_KEY) return json({ error: 'Server is missing GROQ_API_KEY' }, 500, cors);

    try {
      const form = await request.formData();
      const from = String(form.get('from') || 'ko');
      const to = String(form.get('to') || 'en');
      if (!LANG_NAMES[from] || !LANG_NAMES[to] || from === to) {
        return json({ error: 'Unsupported language pair' }, 400, cors);
      }

      // Either audio (voice mode) or plain text (typed mode)
      const audio = form.get('audio');
      let transcript = String(form.get('text') || '').trim();

      if (audio && typeof audio === 'object') {
        if (audio.size > 20 * 1024 * 1024) return json({ error: 'Audio too large' }, 413, cors);
        transcript = await transcribe(audio, from, env);
      }
      if (!transcript) return json({ error: 'No speech detected' }, 422, cors);

      const { cleaned, translation } = await translate(transcript, from, to, env);
      return json({ transcript: cleaned, rawTranscript: transcript, translation }, 200, cors);
    } catch (err) {
      console.error(err);
      return json({ error: String(err.message || err) }, 502, cors);
    }
  },
};
