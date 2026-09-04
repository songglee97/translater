// Voice Translator — Korean <-> English
//
// Two modes, chosen by window.TRANSLATER_API_URL (see config.js):
//  - API mode (recommended): record audio with MediaRecorder while the mic is on,
//    send it to our Cloudflare Worker, which runs Whisper + an LLM on Groq.
//    Handles mid-sentence pauses naturally because the whole recording is heard at once.
//  - Browser mode (fallback): Web Speech API for recognition + MyMemory for translation.
// Text-to-speech always uses the browser's speechSynthesis.

const API_URL = (window.TRANSLATER_API_URL || '').trim();
const API_MODE = API_URL.length > 0 && typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia;

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
  const n = els.sourceText.value.length;
  els.counter.textContent = API_URL ? `${n} chars` : `${n} / 500`;
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

// Our own Worker: accepts either { text } or { audio } plus from/to, returns { transcript, translation }.
async function callApi({ text, audio, from, to }) {
  const form = new FormData();
  form.append('from', from);
  form.append('to', to);
  if (audio) form.append('audio', audio, audio.name || 'audio');
  if (text) form.append('text', text);
  const res = await fetch(API_URL, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API HTTP ${res.status}`);
  return data;
}

async function translate(text, from, to) {
  if (API_URL) {
    try {
      const data = await callApi({ text, from, to });
      return data.translation;
    } catch (e0) {
      console.warn('Worker failed, falling back to MyMemory:', e0);
    }
  }
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
  if (!API_URL && text.length > 500) {
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

// ===== API mode: record audio, send the whole clip to the Worker =====
if (API_MODE) {
  let mediaRecorder = null;
  let chunks = [];
  let stream = null;
  let timerId = null;
  let startedAt = 0;

  function pickMimeType() {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  function fmtElapsed() {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function setRecordingUI(on) {
    listening = on;
    els.micBtn.classList.toggle('listening', on);
    if (on) {
      const tick = () => {
        els.micHint.textContent = (sourceLang === 'ko'
          ? `녹음 중 ${fmtElapsed()} · 다시 누르면 번역돼요`
          : `Recording ${fmtElapsed()} · tap again to translate`);
      };
      tick();
      timerId = setInterval(tick, 500);
    } else {
      clearInterval(timerId);
      els.micHint.textContent = 'Tap the mic to start recording';
    }
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error(e);
      setStatus('Microphone access was blocked. Allow the mic in your browser settings and try again.', true);
      return;
    }
    chunks = [];
    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = onRecordingStopped;
    mediaRecorder.start(250); // gather data every 250ms so nothing is lost on stop
    startedAt = Date.now();
    setRecordingUI(true);
    setStatus('');
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    setRecordingUI(false);
  }

  async function onRecordingStopped() {
    stream?.getTracks().forEach((t) => t.stop());
    const type = mediaRecorder.mimeType || chunks[0]?.type || 'audio/webm';
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    const blob = new Blob(chunks, { type });
    chunks = [];
    if (blob.size < 1000 || Date.now() - startedAt < 500) {
      setStatus('Recording was too short. Tap the mic and speak.', true);
      return;
    }
    const file = new File([blob], `speech.${ext}`, { type });

    translating = true;
    els.translateBtn.disabled = true;
    els.micBtn.disabled = true;
    setStatus(sourceLang === 'ko' ? '음성을 인식하고 번역하는 중…' : 'Transcribing and translating…');
    try {
      const data = await callApi({ audio: file, from: sourceLang, to: targetLang });
      els.sourceText.value = (data.transcript || '').slice(0, 2000);
      els.targetText.value = data.translation || '';
      updateCounter();
      setStatus('');
      if (els.autoSpeak.checked) speak(data.translation, targetLang);
    } catch (err) {
      console.error(err);
      setStatus(`Failed: ${err.message}`, true);
    } finally {
      translating = false;
      els.translateBtn.disabled = false;
      els.micBtn.disabled = false;
    }
  }

  els.micBtn.addEventListener('click', () => {
    if (listening) { stopRecording(); return; }
    speechSynthesis?.cancel();
    els.sourceText.value = '';
    els.targetText.value = '';
    updateCounter();
    startRecording();
  });

// ===== Browser mode: Web Speech API =====
} else if (!SpeechRecognitionCtor) {
  els.micBtn.disabled = true;
  els.micHint.textContent = 'Voice input needs Chrome, Edge, or Safari. You can still type.';
} else {
  recognition = new SpeechRecognitionCtor();
  recognition.interimResults = true;
  recognition.continuous = true; // keep recording until the button is tapped again
  recognition.maxAlternatives = 1;

  // The browser ends a recognition session on its own after a pause in speech.
  // To make recording stop ONLY on the second tap, we auto-restart the session
  // whenever it ends without the user asking, and carry the transcript across sessions.
  let userStopped = true;   // false while the user wants recording to continue
  let committed = '';       // finalized text from earlier sessions
  let sessionFinal = '';    // finalized text from the current session
  let sessionInterim = '';  // not-yet-finalized text from the current session (shown live)
  let fatal = false;        // an error that makes restarting pointless (mic denied, etc.)

  function showTranscript() {
    const text = [committed, sessionFinal, sessionInterim].filter(Boolean).join(' ').trim();
    els.sourceText.value = text.slice(0, 500);
    updateCounter();
  }

  function setRecordingUI(on) {
    listening = on;
    els.micBtn.classList.toggle('listening', on);
    els.micHint.textContent = on
      ? (sourceLang === 'ko' ? '녹음 중… 다시 누르면 멈추고 번역돼요' : 'Recording… tap again to stop and translate')
      : 'Tap the mic to start recording';
  }

  function startSession() {
    sessionFinal = '';
    sessionInterim = '';
    recognition.lang = LANGS[sourceLang].speech;
    try {
      recognition.start();
    } catch (e) {
      // start() throws if a session is already running; ignore.
      console.warn(e);
    }
  }

  recognition.onstart = () => {
    setRecordingUI(true);
    setStatus('');
  };

  recognition.onresult = (event) => {
    let finalText = '';
    let interim = '';
    for (const r of event.results) {
      if (r.isFinal) finalText += r[0].transcript + ' ';
      else interim += r[0].transcript + ' ';
    }
    sessionFinal = finalText.trim();
    sessionInterim = interim.trim();
    showTranscript();
  };

  recognition.onerror = (event) => {
    const messages = {
      'not-allowed': 'Microphone access was blocked. Allow the mic in your browser settings and try again.',
      'service-not-allowed': 'Speech service not allowed in this browser.',
      'audio-capture': 'No microphone found.',
      'network': 'Speech recognition needs an internet connection.',
    };
    if (event.error in messages) {
      fatal = true;
      setStatus(messages[event.error], true);
    }
    // 'no-speech' and 'aborted' are normal during a long recording; onend will restart.
  };

  recognition.onend = () => {
    // Fold this session's text into the running transcript. Include the interim
    // (not-yet-finalized) part too: when the user taps stop, the browser often ends
    // without ever marking the last phrase as final, and we must not lose it.
    committed = [committed, sessionFinal, sessionInterim].filter(Boolean).join(' ').trim();
    sessionFinal = '';
    sessionInterim = '';

    if (!userStopped && !fatal) {
      // Browser ended the session on its own: keep recording.
      startSession();
      return;
    }

    setRecordingUI(false);
    showTranscript();
    if (committed) {
      clearTimeout(typingTimer);
      doTranslate({ speakAfter: true });
    }
  };

  els.micBtn.addEventListener('click', () => {
    if (listening) {
      userStopped = true;
      recognition.stop(); // onend fires next and triggers the translation
      return;
    }
    speechSynthesis?.cancel();
    userStopped = false;
    fatal = false;
    committed = '';
    sessionFinal = '';
    els.sourceText.value = '';
    els.targetText.value = '';
    updateCounter();
    startSession();
  });
}

// ---------- Init ----------
updateLabels();
updateCounter();
