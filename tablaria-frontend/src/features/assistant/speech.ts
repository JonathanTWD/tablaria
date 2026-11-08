/**
 * The browser's own speech recognition and synthesis (ADR-042): free, but not
 * in every browser (Chrome and Edge have both; Firefox only synthesis), so
 * the panel offers each one only where it exists.
 */

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface SpeechRecognizer {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognizerClass = new () => SpeechRecognizer;

function recognizerClass(): RecognizerClass | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognizerClass;
    webkitSpeechRecognition?: RecognizerClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function canListen(): boolean {
  return recognizerClass() !== undefined;
}

export function canSpeak(): boolean {
  return "speechSynthesis" in window;
}

/** Listens for one question in Spanish; `onText` gets what was heard. */
export function listen(onText: (text: string) => void, onEnd: () => void): SpeechRecognizer | null {
  const Recognizer = recognizerClass();
  if (!Recognizer) {
    return null;
  }
  const recognizer = new Recognizer();
  recognizer.lang = "es-ES";
  recognizer.interimResults = false;
  recognizer.onresult = (event) => {
    const text = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ").trim();
    if (text) {
      onText(text);
    }
  };
  recognizer.onend = onEnd;
  recognizer.onerror = onEnd;
  recognizer.start();
  return recognizer;
}

export function speak(text: string): void {
  if (!canSpeak()) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak()) {
    window.speechSynthesis.cancel();
  }
}

const SPEAK_KEY = "tablaria:assistant-speak";
const NOTICE_KEY = "tablaria:assistant-notice";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    // Storage blocked: the choice only lasts until the page reloads.
    return false;
  }
}

function saveFlag(key: string, on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: see readFlag.
  }
}

export const speakPreference = {
  read: () => readFlag(SPEAK_KEY),
  save: (on: boolean) => saveFlag(SPEAK_KEY, on),
};

/** Whether this browser already saw the privacy notice. */
export const noticePreference = {
  read: () => readFlag(NOTICE_KEY),
  save: () => saveFlag(NOTICE_KEY, true),
};
