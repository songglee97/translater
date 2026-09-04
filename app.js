// Voice Translator — Korean <-> English
// Speech-to-text and text-to-speech use the browser's Web Speech API (no key).
// Translation uses the free MyMemory API, with an unofficial Google endpoint as fallback.

const LANGS = {
  ko: { code: 'ko', speech: 'ko-KR', label: '한국어' },
  en: { code: 'en', speech: 'en-US', label: 'English' },
};

let sourceLang = 'ko';
let targetLang = 'en';

const $ = (id) => document.getElementById(id);
const els = {
  srcLabel: $('srcLabel'),
  tgtLabel: $('tgtLabel'),
  swapBtn: $('swapBtn'),
  micBtn: $('micBtn'),
  micHint: $('micHint'),
  sourceText: $('sourceText'),
  targetText: $('targetText'),
  counter: $('counter'),
  translateBtn: $('translateBtn'),
  speakBtn: $('speakBtn'),
  copyBtn: $('copyBtn'),
  autoSpeak: $('autoSpeak'),
  status: $('status'),
};

// ---------- Status helpers ----------
function setStatus(msg, isError = false) {
  els.status.textContent = msg || '';
  els.status.classList.toggle('error', isError);
}

function updateCounter() {
  els.counter.textContent = `${els.sourceText.value.length} / 500`;
}

function updateLabels() {
  els.srcLabel.textContent = LANGS[sourceLang].label;
  els.tgtLabel.textContent = LANGS[targetLang].label;
  els.sourceText.placeholder = sourceLang === 'ko' ? '말하거나 입력하세요…' : 'Speak or type here…';
  if (recognition) recognition.lang = LANGS[sourceLang].speech;
}

// ---------- Translation ----------
async function translateViaMyMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = await res.json();
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(data.responseDetails || 'MyMemory returned no translation');
  }
  return data.responseData.translatedText;
}

// Best-effort fallback: this Google endpoint is unofficial and may stop working at any time.
async function translateViaGoogleGtx(text, from, to) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const data = await res.json();
  const out = (data?.[0] || []).map((seg) => seg?.[0] || '').join('');
  if (!out) throw new Error('Google returned no translation');
  return out;
}

async function translate(text, from, to) {
  try {
    return await translateViaMyMemory(text, from, to);
  } catch (e1) {
    console.warn('MyMemory failed, trying fallback:', e1);
    return await translateViaGoogleGtx(text, from, to);
  }
}

let translating = false;
async function doTranslate({ speakAfter = false } = {}) {
  const text = els.sourceText.value.trim();
  if (!text) {
    els.targetText.value = '';
    return;
  }
  if (text.length > 500) {
    setStatus('Please keep it under 500 characters.', true);
    return;
  }
  if (translating) return;
  translating = true;
  els.translateBtn.disabled = true;
  setStatus('Translating…');
  try {
    const result = await translate(text, sourceLang, targetLang);
    els.targetText.value = result;
    setStatus('');
    if (speakAfter && els.autoSpeak.checked) speak(result, targetLang);
  } catch (err) {
    console.error(err);
    setStatus('Translation failed. Check your internet connection and try again.', true);
  } finally {
    translating = false;
    els.translateBtn.disabled = false;
  }
}

// Debounced auto-translate while typing
let typingTimer = null;
els.sourceText.addEventListener('input', () => {
  updateCounter();
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => doTranslate(), 600);
});
els.sourceText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    doTranslate({ speakAfter: true });
  }
});

els.translateBtn.addEventListener('click', () => doTranslate({ speakAfter: true }));

// ---------- Swap ----------
els.swapBtn.addEventListener('click', () => {
  [sourceLang, targetLang] = [targetLang, sourceLang];
  const oldSrc = els.sourceText.value;
  els.sourceText.value = els.targetText.value;
  els.targetText.value = oldSrc;
  updateLabels();
  updateCounter();
});

// ---------- Text-to-speech ----------
let voices = [];
function loadVoices() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
}
if (window.speechSynthesis) {
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function speak(text, lang) {
  if (!window.speechSynthesis || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGS[lang].speech;
  const match = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang));
  if (match) u.voice = match;
  u.rate = 1;
  speechSynthesis.speak(u);
}

els.speakBtn.addEventListener('click', () => speak(els.targetText.value, targetLang));

// ---------- Copy ----------
els.copyBtn.addEventListener('click', async () => {
  const text = els.targetText.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied!');
    setTimeout(() => setStatus(''), 1500);
  } catch {
    setStatus('Could not copy to clipboard.', true);
  }
});

// ---------- Speech-to-text ----------
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (!SpeechRecognitionCtor) {
  els.micBtn.disabled = true;
  els.micHint.textContent = 'Voice input needs Chrome, Edge, or Safari. You can still type.';
} else {
  recognition = new SpeechRecognitionCtor();
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    els.micBtn.classList.add('listening');
    els.micHint.textContent = sourceLang === 'ko' ? '듣고 있어요… 말하세요' : 'Listening… speak now';
    setStatus('');
  };

  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (const r of event.results) {
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    els.sourceText.value = finalText || interim;
    updateCounter();
    if (finalText) {
      clearTimeout(typingTimer);
      doTranslate({ speakAfter: true });
    }
  };

  recognition.onerror = (event) => {
    const messages = {
      'not-allowed': 'Microphone access was blocked. Allow the mic in your browser settings and try again.',
      'service-not-allowed': 'Speech service not allowed in this browser.',
      'no-speech': 'No speech detected. Tap the mic and try again.',
      'audio-capture': 'No microphone found.',
      'network': 'Speech recognition needs an internet connection.',
      'aborted': '',
    };
    const msg = messages[event.error] ?? `Speech error: ${event.error}`;
    if (msg) setStatus(msg, true);
  };

  recognition.onend = () => {
    listening = false;
    els.micBtn.classList.remove('listening');
    els.micHint.textContent = 'Tap the mic and speak';
  };

  els.micBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    speechSynthesis?.cancel();
    recognition.lang = LANGS[sourceLang].speech;
    try {
      recognition.start();
    } catch (e) {
      // start() throws if called while already running
      console.warn(e);
    }
  });
}

// ---------- Init ----------
updateLabels();
updateCounter();
