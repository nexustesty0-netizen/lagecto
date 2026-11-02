import { readLocalNoticePrefs, shouldPlaySound, type NoticeSoundId } from "./notification-prefs";

let ctx: AudioContext | null = null;
let playing = false;
let lastAt = 0;
const heard = new Set<string>();

function audioContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

export function unlockNotificationAudio() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("lg-interacted", "1");
  const audio = audioContext();
  if (audio?.state === "suspended") void audio.resume().catch(() => undefined);
}

export function markNotificationHeard(id: string) {
  heard.add(id);
  if (heard.size > 200) heard.clear();
}

export function wasNotificationHeard(id: string) {
  return heard.has(id);
}

function tone(audio: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType, gainValue: number) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playPatch(id: NoticeSoundId) {
  const audio = audioContext();
  if (!audio) return;
  const now = audio.currentTime;
  if (id === "soft") {
    tone(audio, 523.25, now, 0.16, "sine", 0.035);
    return;
  }
  if (id === "ping") {
    tone(audio, 1318.51, now, 0.09, "triangle", 0.03);
    return;
  }
  tone(audio, 880, now, 0.09, "sine", 0.04);
  tone(audio, 1174.66, now + 0.08, 0.12, "sine", 0.035);
}

export function previewNotificationSound(id?: NoticeSoundId) {
  unlockNotificationAudio();
  playPatch(id || readLocalNoticePrefs().soundId);
}

export function playNotificationSound(noticeId: string, type?: string | null) {
  if (wasNotificationHeard(`s:${noticeId}`)) return;
  const prefs = readLocalNoticePrefs();
  if (!shouldPlaySound(prefs, type)) return;
  const now = Date.now();
  if (playing || now - lastAt < 800) return;
  playing = true;
  lastAt = now;
  markNotificationHeard(`s:${noticeId}`);
  try {
    playPatch(prefs.soundId);
  } catch {
    // Browsers may block audio until a gesture. Visual alerts still work.
  }
  window.setTimeout(() => {
    playing = false;
  }, 280);
}
