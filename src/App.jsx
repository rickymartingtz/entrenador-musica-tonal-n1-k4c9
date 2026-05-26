import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Soundfont from "soundfont-player";
import * as VF from "vexflow";

let sharedAuralAudioContext = null;

function getSharedAuralAudioContext() {
  if (typeof window === "undefined") return null;
  if (sharedAuralAudioContext?.state === "closed") sharedAuralAudioContext = null;
  if (!sharedAuralAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API no disponible en este navegador");
    try {
      sharedAuralAudioContext = new AudioContextClass({ latencyHint: "interactive" });
    } catch {
      sharedAuralAudioContext = new AudioContextClass();
    }
  }
  return sharedAuralAudioContext;
}

function isMobileAudioRuntime() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const coarsePointer = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
  const narrowScreen = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 920;
  return /iPhone|iPad|iPod|Android/i.test(ua) || (coarsePointer && narrowScreen);
}

function fireSilentUnlockPulse(context) {
  if (!context) return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const startAt = Math.max(context.currentTime, 0);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.04);
  } catch {
    // En algunos navegadores móviles puede fallar si el contexto aún no está listo.
  }
}

let sharedAuralMicrophoneStream = null;
let sharedAuralMicrophonePromise = null;

function microphoneStreamIsLive(stream) {
  return Boolean(stream?.getAudioTracks?.().some((track) => track.readyState === "live"));
}

async function requestSharedAuralMicrophoneStream() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Micrófono no disponible en este navegador");
  }
  if (microphoneStreamIsLive(sharedAuralMicrophoneStream)) return sharedAuralMicrophoneStream;
  if (sharedAuralMicrophonePromise) return sharedAuralMicrophonePromise;

  sharedAuralMicrophonePromise = navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
  }).then((stream) => {
    sharedAuralMicrophoneStream = stream;
    return stream;
  }).finally(() => {
    sharedAuralMicrophonePromise = null;
  });

  return sharedAuralMicrophonePromise;
}


function IconBase({ children, className = "h-4 w-4", viewBox = "0 0 24 24" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function VolumeIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </IconBase>
  );
}

function StopIcon({ className }) {
  return (
    <IconBase className={className}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </IconBase>
  );
}

function PlayIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M8.25 5.75v12.5L17.75 12 8.25 5.75Z" />
    </IconBase>
  );
}

function PauseIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M8.5 6.25v11.5" />
      <path d="M15.5 6.25v11.5" />
    </IconBase>
  );
}

function TimerResetIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M8 7H4.75V3.75" />
      <path d="M5.1 7.1A8 8 0 1 1 4 12" />
    </IconBase>
  );
}

function ShuffleIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M3.75 7.5h2.7c1.45 0 2.6.68 3.48 2.05l.5.78" />
      <path d="M13.55 14.48l.52.78c.88 1.37 2.03 2.05 3.48 2.05h2.7" />
      <path d="M18 5.25 20.25 7.5 18 9.75" />
      <path d="M18 14.25 20.25 16.5 18 18.75" />
      <path d="M3.75 16.5h2.7c1.45 0 2.6-.68 3.48-2.05l4.14-6.4C14.95 6.68 16.1 6 17.55 6h2.7" />
    </IconBase>
  );
}

function RefreshIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
    </IconBase>
  );
}

function ResetIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M20 9A8 8 0 0 0 6.3 5.7L4 8" />
      <path d="M4 15a8 8 0 0 0 13.7 3.3L20 16" />
    </IconBase>
  );
}

function TrashIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 15h10l1-15" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  );
}

function EyeIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}

function SunIcon({ className }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </IconBase>
  );
}

function MoonIcon({ className }) {
  return (
    <IconBase className={className}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7 7 0 1 0 11 11Z" />
    </IconBase>
  );
}

const SOUNDFONT_LIBRARY = "MusyngKite";
const SOUNDFONT_BASE_URL = "https://gleitz.github.io/midi-js-soundfonts";
const SETTINGS_KEY = "metodoAural.tonalFunctions.settings.v7";
const STATS_KEY = "metodoAural.tonalFunctions.stats.v1";
const THEME_KEY = "metodoAural.tonalFunctions.theme.v1";
const MARKS_KEY = "metodoAural.tonalFunctions.marks.v1";
const MIN_NOTES = 1;
const MAX_NOTES = 24;
const DEFAULT_NOTE_COUNT = 8;
const DEFAULT_SPEED = 60;
const DEFAULT_HARMONIC_SPEED = 40;
const DEFAULT_VOLUME = 50;
const DEFAULT_RANDOM_INSTRUMENT_MODE = "all";
const DEFAULT_RANDOM_INSTRUMENT_ENABLED = true;
const DEFAULT_RANDOMIZE_INSTRUMENT_ON_EXERCISE = true;
const COMPOUND_REGISTER_LOW_MIDI = 36;  // C2: Do en segunda línea adicional inferior de clave de Fa.
const COMPOUND_REGISTER_HIGH_MIDI = 91; // G6: Sol en cuarta línea adicional superior de clave de Sol.
const DEFAULT_UPPER_VOICE_VOLUME = 50;
const DEFAULT_LOWER_VOICE_VOLUME = 50;
const NOTE_BASE_SECONDS = 2;
const GAP_BASE_SECONDS = 0.5;
const CADENCE_BPM = 90;
const CADENCE_LAST_CHORD_EXTRA_SECONDS = 1;
const POST_CADENCE_PAUSE_SECONDS = 1.5;
const INTERNAL_VOLUME_BOOST = 9.0;
const SOUNDFONT_GAIN_BOOST = 16.0;
const PITCH_HISTORY_LEN = 32;
const TUNER_RANGE_CENTS = 50;
const IN_TUNE_THRESHOLD = 10;
const TUNER_HOLD_OPTIONS = [0.5, 1, 1.5, 2, 3, 4];
const TUNER_MICRO_GAP_MS = 300;
const TUNER_COMPLETE_DELAY_MS = 560;
const TUNER_ANALYSIS_INTERVAL_MS = 40;
const TUNER_YIN_THRESHOLD = 0.13;
const PITCH_SMOOTH_ALPHA = 0.35;
const TUNER_STALE_DISPLAY_MS = 520;
const TUNER_HOLD_GRACE_MS = 180;

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_TO_SPANISH = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
const ACCIDENTAL_TO_TEXT = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };
const ACCIDENTAL_TO_ASCII = { "-2": "bb", "-1": "b", 0: "", 1: "#", 2: "##" };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const TRAINER_MODES = ["melodicFunctions", "harmonicFunctions", "tonalFunctions"];
const MODE_LABELS = {
  melodicFunctions: "Funciones melódicas",
};

const KEY_OPTIONS = [
  { id: "C", label: "Do", root: { letter: "C", accidental: 0, pc: 0 } },
  { id: "G", label: "Sol", root: { letter: "G", accidental: 0, pc: 7 } },
  { id: "D", label: "Re", root: { letter: "D", accidental: 0, pc: 2 } },
  { id: "A", label: "La", root: { letter: "A", accidental: 0, pc: 9 } },
  { id: "E", label: "Mi", root: { letter: "E", accidental: 0, pc: 4 } },
  { id: "B", label: "Si", root: { letter: "B", accidental: 0, pc: 11 } },
  { id: "F#", label: "Fa♯", root: { letter: "F", accidental: 1, pc: 6 } },
  { id: "C#", label: "Do♯", root: { letter: "C", accidental: 1, pc: 1 } },
  { id: "F", label: "Fa", root: { letter: "F", accidental: 0, pc: 5 } },
  { id: "Bb", label: "Si♭", root: { letter: "B", accidental: -1, pc: 10 } },
  { id: "Eb", label: "Mi♭", root: { letter: "E", accidental: -1, pc: 3 } },
  { id: "Ab", label: "La♭", root: { letter: "A", accidental: -1, pc: 8 } },
  { id: "Db", label: "Re♭", root: { letter: "D", accidental: -1, pc: 1 } },
  { id: "Gb", label: "Sol♭", root: { letter: "G", accidental: -1, pc: 6 } },
  { id: "Cb", label: "Do♭", root: { letter: "C", accidental: -1, pc: 11 } },
];

const CLEFS = [
  { key: "treble", label: "Clave de Sol", symbol: "𝄞", tag: "", vex: "treble" },
  { key: "treble8va", label: "Clave de Sol 8va alta", symbol: "𝄞", tag: "8va", clefAnnotation: "8va", vex: "treble" },
  { key: "treble15ma", label: "Clave de Sol 15ma alta", symbol: "𝄞", tag: "15ma", clefAnnotation: "15ma", vex: "treble" },
  { key: "soprano", label: "Clave de Do en I", symbol: "𝄡", tag: "I", vex: "soprano" },
  { key: "mezzo", label: "Clave de Do en II", symbol: "𝄡", tag: "II", vex: "mezzo-soprano" },
  { key: "alto", label: "Clave de Do en III", symbol: "𝄡", tag: "III", vex: "alto" },
  { key: "tenor", label: "Clave de Do en IV", symbol: "𝄡", tag: "IV", vex: "tenor" },
  { key: "baritoneF", label: "Clave de Fa en III", symbol: "𝄢", tag: "", vex: "baritone-f" },
  { key: "bass", label: "Clave de Fa", symbol: "𝄢", tag: "", vex: "bass" },
  { key: "bass8vb", label: "Clave de Fa 8va baja", symbol: "𝄢", tag: "8vb", clefAnnotation: "8vb", vex: "bass" },
];

const GRAND_STAFF_CLEF = { key: "grandStaff", label: "Clave de Sol y Fa", symbol: "𝄞𝄢", tag: "", vex: "treble" };
const GRAND_STAFF_TREBLE = { key: "treble", label: "Clave de Sol", symbol: "𝄞", tag: "", vex: "treble" };
const GRAND_STAFF_BASS = { key: "bass", label: "Clave de Fa", symbol: "𝄢", tag: "", vex: "bass" };
const GRAND_STAFF_LOW_MIDI = COMPOUND_REGISTER_LOW_MIDI;   // C2: límite inferior práctico pedido para compuestos.
const GRAND_STAFF_HIGH_MIDI = COMPOUND_REGISTER_HIGH_MIDI;  // G6: límite superior práctico pedido para compuestos.
const GRAND_STAFF_SPLIT_MIDI = 60; // C4: cambio natural entre Fa y Sol.
const CADENCE_INSTRUMENT = "piano";

const CLEF_COMFORT_RANGES = {
  treble: { low: 57, high: 84, center: 67 },
  treble8va: { low: 69, high: 96, center: 79 },
  treble15ma: { low: 81, high: 108, center: 91 },
  soprano: { low: 60, high: 84, center: 72 },
  mezzo: { low: 57, high: 81, center: 69 },
  alto: { low: 53, high: 77, center: 65 },
  tenor: { low: 48, high: 72, center: 60 },
  baritoneF: { low: 43, high: 67, center: 55 },
  bass: { low: 36, high: 64, center: 50 },
  bass8vb: { low: 24, high: 52, center: 38 },
};

function clefComfortRange(clef) {
  return CLEF_COMFORT_RANGES[clef?.key] ?? CLEF_COMFORT_RANGES.treble;
}

function clefLedgerPenalty(note, clef) {
  if (!note) return 99;
  const range = clefComfortRange(clef);
  const midi = Math.round(note.midi);
  if (midi >= range.low && midi <= range.high) return 0;
  return midi < range.low ? (range.low - midi) / 2 : (midi - range.high) / 2;
}
const SCALE_PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
};

const SCALE_LABELS = {
  major: "mayor",
  naturalMinor: "menor natural",
  harmonicMinor: "menor armónica",
  melodicMinor: "menor melódica",
};

const DEGREE_OPTIONS = [
  { degree: 1, label: "1" },
  { degree: 2, label: "2" },
  { degree: 3, label: "3" },
  { degree: 4, label: "4" },
  { degree: 5, label: "5" },
  { degree: 6, label: "6" },
  { degree: 7, label: "7" },
];

const ANSWER_DEGREE_KEYS = [
  { token: "b1", label: "♭1", degree: 1, alter: -1, semitones: -1 },
  { token: "1", label: "1", degree: 1, alter: 0, semitones: 0 },
  { token: "#1", label: "♯1", degree: 1, alter: 1, semitones: 1 },
  { token: "b2", label: "♭2", degree: 2, alter: -1, semitones: 1 },
  { token: "2", label: "2", degree: 2, alter: 0, semitones: 2 },
  { token: "#2", label: "♯2", degree: 2, alter: 1, semitones: 3 },
  { token: "b3", label: "♭3", degree: 3, alter: -1, semitones: 3 },
  { token: "3", label: "3", degree: 3, alter: 0, semitones: 4 },
  { token: "4", label: "4", degree: 4, alter: 0, semitones: 5 },
  { token: "#4", label: "♯4", degree: 4, alter: 1, semitones: 6 },
  { token: "b5", label: "♭5", degree: 5, alter: -1, semitones: 6 },
  { token: "5", label: "5", degree: 5, alter: 0, semitones: 7 },
  { token: "#5", label: "♯5", degree: 5, alter: 1, semitones: 8 },
  { token: "b6", label: "♭6", degree: 6, alter: -1, semitones: 8 },
  { token: "6", label: "6", degree: 6, alter: 0, semitones: 9 },
  { token: "#6", label: "♯6", degree: 6, alter: 1, semitones: 10 },
  { token: "b7", label: "♭7", degree: 7, alter: -1, semitones: 10 },
  { token: "7", label: "7", degree: 7, alter: 0, semitones: 11 },
  { token: "#7", label: "♯7", degree: 7, alter: 1, semitones: 12 },
];

const ALTERED_DEGREES_BY_MODE = {
  major: [
    { degree: 1, alter: 1 },
    { degree: 2, alter: -1 },
    { degree: 2, alter: 1 },
    { degree: 3, alter: -1 },
    { degree: 4, alter: 1 },
    { degree: 5, alter: -1 },
    { degree: 5, alter: 1 },
    { degree: 6, alter: -1 },
    { degree: 6, alter: 1 },
    { degree: 7, alter: -1 },
  ],
  minor: [
    { degree: 1, alter: -1 },
    { degree: 1, alter: 1 },
    { degree: 2, alter: -1 },
    { degree: 3, alter: 1 },
    { degree: 4, alter: -1 },
    { degree: 4, alter: 1 },
    { degree: 5, alter: -1 },
    { degree: 6, alter: 1 },
    { degree: 7, alter: -1 },
    { degree: 7, alter: 1 },
  ],
};

const ALTERED_FORM_OPTIONS = [
  { key: "passing", label: "Notas de paso" },
  { key: "neighbor", label: "Bordaduras" },
  { key: "appoggiatura", label: "Apoyaturas" },
];

function alteredDegreeToken(mode, degree, alter) {
  return `${mode}:${alter < 0 ? "b" : "#"}${degree}`;
}

function alteredDegreeShortLabel(degree, alter) {
  return `${degree}${alter < 0 ? "♭" : "♯"}`;
}

function alteredDegreeLongLabel(degree, alter) {
  return `${degree}° grado ${alter < 0 ? "bemol" : "sostenido"}`;
}

const ALTERED_DEGREE_OPTIONS_BY_MODE = {
  major: ALTERED_DEGREES_BY_MODE.major.map((item) => ({
    ...item,
    mode: "major",
    token: alteredDegreeToken("major", item.degree, item.alter),
    label: alteredDegreeShortLabel(item.degree, item.alter),
    title: `Modo mayor · ${alteredDegreeLongLabel(item.degree, item.alter)}`,
  })),
  minor: ALTERED_DEGREES_BY_MODE.minor.map((item) => ({
    ...item,
    mode: "minor",
    token: alteredDegreeToken("minor", item.degree, item.alter),
    label: alteredDegreeShortLabel(item.degree, item.alter),
    title: `Modo menor · ${alteredDegreeLongLabel(item.degree, item.alter)}`,
  })),
};

const DEFAULT_ALTERED_MAJOR_TOKENS = ALTERED_DEGREE_OPTIONS_BY_MODE.major.map((item) => item.token);
const DEFAULT_ALTERED_MINOR_TOKENS = ALTERED_DEGREE_OPTIONS_BY_MODE.minor.map((item) => item.token);

function sanitizeAlteredTokens(tokens, mode) {
  const valid = new Set((ALTERED_DEGREE_OPTIONS_BY_MODE[mode] ?? []).map((item) => item.token));
  const incoming = Array.isArray(tokens) ? tokens : mode === "minor" ? DEFAULT_ALTERED_MINOR_TOKENS : DEFAULT_ALTERED_MAJOR_TOKENS;
  return [...new Set(incoming)].filter((token) => valid.has(token));
}


const DYAD_INTERVAL_OPTIONS = [
  {
    family: "2",
    label: "2as",
    shortLabel: "Segundas",
    variants: [
      { key: "m2", label: "2m", semitones: 1, diatonicSteps: 1 },
      { key: "M2", label: "2M", semitones: 2, diatonicSteps: 1 },
    ],
  },
  {
    family: "3",
    label: "3as",
    shortLabel: "Terceras",
    variants: [
      { key: "m3", label: "3m", semitones: 3, diatonicSteps: 2 },
      { key: "M3", label: "3M", semitones: 4, diatonicSteps: 2 },
    ],
  },
  {
    family: "4",
    label: "4as",
    shortLabel: "Cuartas",
    variants: [
      { key: "P4", label: "4J", semitones: 5, diatonicSteps: 3 },
      { key: "A4", label: "4A", semitones: 6, diatonicSteps: 3 },
    ],
  },
  {
    family: "5",
    label: "5as",
    shortLabel: "Quintas",
    variants: [
      { key: "d5", label: "5d", semitones: 6, diatonicSteps: 4 },
      { key: "P5", label: "5J", semitones: 7, diatonicSteps: 4 },
    ],
  },
  {
    family: "6",
    label: "6as",
    shortLabel: "Sextas",
    variants: [
      { key: "m6", label: "6m", semitones: 8, diatonicSteps: 5 },
      { key: "M6", label: "6M", semitones: 9, diatonicSteps: 5 },
    ],
  },
  {
    family: "7",
    label: "7as",
    shortLabel: "Séptimas",
    variants: [
      { key: "m7", label: "7m", semitones: 10, diatonicSteps: 6 },
      { key: "M7", label: "7M", semitones: 11, diatonicSteps: 6 },
    ],
  },
  {
    family: "8",
    label: "8vas",
    shortLabel: "Octavas",
    variants: [
      { key: "P8", label: "8J", semitones: 12, diatonicSteps: 7 },
    ],
  },
];

const DYAD_DIRECTION_OPTIONS = [
  { key: "auto", label: "Automático" },
];


const HARMONIC_EXERCISE_MODES = [
  { key: "soprano", label: "Función armónica de la soprano" },
  { key: "sopranoBass", label: "Función armónica de la soprano y el bajo" },
];

const HARMONIC_SOPRANO_HINT_OPTIONS = [
  { key: "all", label: "Soprano completa dada" },
  { key: "first", label: "Sólo primera soprano dada" },
];

const TRIAD_CHORD_OPTIONS = [
  { key: "M", label: "Mayor" },
  { key: "m", label: "Menor" },
  { key: "dim", label: "Disminuido" },
  { key: "aug", label: "Aumentado" },
];

const SEVENTH_CHORD_GROUPS = [
  {
    key: "basic",
    label: "Acordes de séptima",
    description: "",
    chords: ["Dom7", "m7", "ø7", "Maj7", "dim7", "mMaj7"],
  },
  {
    key: "altered",
    label: "Acordes de séptima alterados",
    description: "",
    chords: ["Dom7#5", "augMaj7", "Dom7b5", "Maj7b5", "dimMaj7"],
  },
  {
    key: "suspended",
    label: "Acordes de séptima suspendidos",
    description: "",
    chords: ["Dom7sus4", "Maj7sus4"],
  },
];

const SEVENTH_CHORD_OPTIONS = SEVENTH_CHORD_GROUPS.flatMap((group) => group.chords.map((key) => ({ key, group: group.key })));
const DEFAULT_HARMONIC_TRIADS = ["M", "m"];
const DEFAULT_HARMONIC_SEVENTHS = ["Dom7"];
const DEFAULT_HARMONIC_CHORD_COUNT = 8;
const MIN_HARMONIC_CHORDS = 1;
const MAX_HARMONIC_CHORDS = 12;
const HARMONIC_ARPEGGIO_SPEED_OPTIONS = [
  { key: "quick", label: "Rápido", stepSeconds: 0.18, noteSeconds: 0.58 },
  { key: "normal", label: "Normal", stepSeconds: 0.32, noteSeconds: 0.78 },
  { key: "slow", label: "Lento", stepSeconds: 0.55, noteSeconds: 1.05 },
  { key: "verySlow", label: "Muy lento", stepSeconds: 0.85, noteSeconds: 1.35 },
];
const DEFAULT_HARMONIC_ARPEGGIO_SPEED = "normal";

const HARMONIC_ROOT_SPELLINGS = [
  { label: "C", letter: "C", accidental: 0, pc: 0 },
  { label: "C♯", letter: "C", accidental: 1, pc: 1 },
  { label: "D♭", letter: "D", accidental: -1, pc: 1 },
  { label: "D", letter: "D", accidental: 0, pc: 2 },
  { label: "D♯", letter: "D", accidental: 1, pc: 3 },
  { label: "E♭", letter: "E", accidental: -1, pc: 3 },
  { label: "E", letter: "E", accidental: 0, pc: 4 },
  { label: "F", letter: "F", accidental: 0, pc: 5 },
  { label: "F♯", letter: "F", accidental: 1, pc: 6 },
  { label: "G♭", letter: "G", accidental: -1, pc: 6 },
  { label: "G", letter: "G", accidental: 0, pc: 7 },
  { label: "G♯", letter: "G", accidental: 1, pc: 8 },
  { label: "A♭", letter: "A", accidental: -1, pc: 8 },
  { label: "A", letter: "A", accidental: 0, pc: 9 },
  { label: "A♯", letter: "A", accidental: 1, pc: 10 },
  { label: "B♭", letter: "B", accidental: -1, pc: 10 },
  { label: "B", letter: "B", accidental: 0, pc: 11 },
];

const HARMONIC_TONE_LABELS = {
  root: "8a",
  third: "3a",
  fourth: "4a",
  fifth: "5a",
  seventh: "7a",
};

const HARMONIC_CHORD_DEFS = {
  M: {
    key: "M",
    category: "triad",
    label: "Mayor",
    suffix: "",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
    ],
  },
  m: {
    key: "m",
    category: "triad",
    label: "Menor",
    suffix: "m",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
    ],
  },
  dim: {
    key: "dim",
    category: "triad",
    label: "Disminuido",
    suffix: "°",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 6, diatonicSteps: 4 },
    ],
  },
  aug: {
    key: "aug",
    category: "triad",
    label: "Aumentado",
    suffix: "+",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 8, diatonicSteps: 4 },
    ],
  },
  Dom7: {
    key: "Dom7",
    category: "seventh",
    label: "Dom7",
    suffix: "7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
      { role: "seventh", semitones: 10, diatonicSteps: 6 },
    ],
  },
  m7: {
    key: "m7",
    category: "seventh",
    label: "m7",
    suffix: "m7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
      { role: "seventh", semitones: 10, diatonicSteps: 6 },
    ],
  },
  "ø7": {
    key: "ø7",
    category: "seventh",
    label: "ø7",
    suffix: "ø7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 6, diatonicSteps: 4 },
      { role: "seventh", semitones: 10, diatonicSteps: 6 },
    ],
  },
  Maj7: {
    key: "Maj7",
    category: "seventh",
    label: "Maj7",
    suffix: "Maj7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
      { role: "seventh", semitones: 11, diatonicSteps: 6 },
    ],
  },
  dim7: {
    key: "dim7",
    category: "seventh",
    label: "dim7",
    suffix: "°7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 6, diatonicSteps: 4 },
      { role: "seventh", semitones: 9, diatonicSteps: 6 },
    ],
  },
  mMaj7: {
    key: "mMaj7",
    category: "seventh",
    label: "mMaj7",
    suffix: "mMaj7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
      { role: "seventh", semitones: 11, diatonicSteps: 6 },
    ],
  },
  "Dom7#5": {
    key: "Dom7#5",
    category: "seventh",
    label: "Dom7#5",
    suffix: "7♯5",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 8, diatonicSteps: 4 },
      { role: "seventh", semitones: 10, diatonicSteps: 6 },
    ],
  },
  augMaj7: {
    key: "augMaj7",
    category: "seventh",
    label: "aumMaj7",
    suffix: "+Maj7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 8, diatonicSteps: 4 },
      { role: "seventh", semitones: 11, diatonicSteps: 6 },
    ],
  },
  Dom7b5: {
    key: "Dom7b5",
    category: "seventh",
    label: "Dom7b5",
    suffix: "7♭5",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 6, diatonicSteps: 4 },
      { role: "seventh", semitones: 10, diatonicSteps: 6 },
    ],
  },
  Maj7b5: {
    key: "Maj7b5",
    category: "seventh",
    label: "Maj7b5",
    suffix: "Maj7♭5",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 4, diatonicSteps: 2 },
      { role: "fifth", semitones: 6, diatonicSteps: 4 },
      { role: "seventh", semitones: 11, diatonicSteps: 6 },
    ],
  },
  dimMaj7: {
    key: "dimMaj7",
    category: "seventh",
    label: "dimMaj7",
    suffix: "°Maj7",
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "third", semitones: 3, diatonicSteps: 2 },
      { role: "fifth", semitones: 6, diatonicSteps: 4 },
      { role: "seventh", semitones: 11, diatonicSteps: 6 },
    ],
  },
  Dom7sus4: {
    key: "Dom7sus4",
    category: "seventh",
    label: "Dom7sus4",
    suffix: "7sus4",
    rootPositionOnly: true,
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "fourth", semitones: 5, diatonicSteps: 3 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
      { role: "seventh", semitones: 10, diatonicSteps: 6 },
    ],
  },
  Maj7sus4: {
    key: "Maj7sus4",
    category: "seventh",
    label: "Maj7sus4",
    suffix: "Maj7sus4",
    rootPositionOnly: true,
    tones: [
      { role: "root", semitones: 0, diatonicSteps: 0 },
      { role: "fourth", semitones: 5, diatonicSteps: 3 },
      { role: "fifth", semitones: 7, diatonicSteps: 4 },
      { role: "seventh", semitones: 11, diatonicSteps: 6 },
    ],
  },
};

const HARMONIC_CHORD_FULL_LABELS = {
  M: "Mayor",
  m: "Menor",
  dim: "Disminuido",
  aug: "Aumentado",
  Dom7: "Séptima de dominante",
  m7: "Séptima menor",
  "ø7": "Séptima semidisminuida",
  Maj7: "Séptima mayor",
  dim7: "Séptima disminuida",
  mMaj7: "Menor con séptima mayor",
  "Dom7#5": "Séptima de dominante con quinta aumentada",
  augMaj7: "Séptima mayor aumentada",
  Dom7b5: "Séptima de dominante con quinta disminuida",
  Maj7b5: "Séptima mayor con quinta disminuida",
  dimMaj7: "Disminuido con séptima mayor",
  Dom7sus4: "Séptima de dominante suspendida",
  Maj7sus4: "Séptima mayor suspendida",
};

function harmonicChordFullLabel(chordKey) {
  return HARMONIC_CHORD_FULL_LABELS[chordKey] ?? HARMONIC_CHORD_DEFS[chordKey]?.label ?? chordKey;
}

const INSTRUMENTS = [
  // Voces
  { value: "voiceOohs", label: "Voces · Oohs", soundfont: "voice_oohs", fallback: "voice", sustain: true },

  // Teclados
  { value: "piano", label: "Teclados · Piano acústico", soundfont: "acoustic_grand_piano", fallback: "piano", sustain: false },
  { value: "electricPiano1", label: "Teclados · Piano eléctrico I", soundfont: "electric_piano_1", fallback: "piano", sustain: false },
  { value: "electricPiano2", label: "Teclados · Piano eléctrico II", soundfont: "electric_piano_2", fallback: "piano", sustain: false },
  { value: "harpsichord", label: "Teclados · Clave / harpsichord", soundfont: "harpsichord", fallback: "piano", sustain: false },
  { value: "clavinet", label: "Teclados · Clavinet", soundfont: "clavinet", fallback: "piano", sustain: false },
  { value: "musicBox", label: "Teclados · Caja de música", soundfont: "music_box", fallback: "mallet", sustain: false },

  // Órganos y lengüetas
  { value: "drawbarOrgan", label: "Órganos · Drawbar", soundfont: "drawbar_organ", fallback: "organ", sustain: true },
  { value: "percussiveOrgan", label: "Órganos · Percusivo", soundfont: "percussive_organ", fallback: "organ", sustain: true },
  { value: "rockOrgan", label: "Órganos · Rock", soundfont: "rock_organ", fallback: "organ", sustain: true },
  { value: "accordion", label: "Lengüetas · Acordeón", soundfont: "accordion", fallback: "organ", sustain: true },
  { value: "harmonica", label: "Lengüetas · Armónica", soundfont: "harmonica", fallback: "voice", sustain: true },

  // Cuerdas orquestales
  { value: "violin", label: "Cuerdas · Violín", soundfont: "violin", fallback: "strings", sustain: true },
  { value: "viola", label: "Cuerdas · Viola", soundfont: "viola", fallback: "strings", sustain: true },
  { value: "cello", label: "Cuerdas · Violonchelo", soundfont: "cello", fallback: "strings", sustain: true },
  { value: "contrabass", label: "Cuerdas · Contrabajo", soundfont: "contrabass", fallback: "strings", sustain: true },
  { value: "strings", label: "Cuerdas · Ensamble", soundfont: "string_ensemble_2", fallback: "strings", sustain: true },
  { value: "pizzicatoStrings", label: "Cuerdas · Pizzicato", soundfont: "pizzicato_strings", fallback: "mallet", sustain: false },
  { value: "synthStrings1", label: "Cuerdas · Sintéticas I", soundfont: "synth_strings_1", fallback: "strings", sustain: true },
  { value: "synthStrings2", label: "Cuerdas · Sintéticas II", soundfont: "synth_strings_2", fallback: "strings", sustain: true },
  { value: "orchestralHarp", label: "Cuerdas · Arpa orquestal", soundfont: "orchestral_harp", fallback: "piano", sustain: false },

  // Alientos / maderas
  { value: "piccolo", label: "Alientos · Piccolo", soundfont: "piccolo", fallback: "voice", sustain: true },
  { value: "flute", label: "Alientos · Flauta", soundfont: "flute", fallback: "voice", sustain: true },
  { value: "recorder", label: "Alientos · Flauta dulce", soundfont: "recorder", fallback: "voice", sustain: true },
  { value: "panFlute", label: "Alientos · Flauta de pan", soundfont: "pan_flute", fallback: "voice", sustain: true },
  { value: "whistle", label: "Alientos · Silbato", soundfont: "whistle", fallback: "voice", sustain: true },
  { value: "ocarina", label: "Alientos · Ocarina", soundfont: "ocarina", fallback: "voice", sustain: true },
  { value: "oboe", label: "Alientos · Oboe", soundfont: "oboe", fallback: "voice", sustain: true },
  { value: "englishHorn", label: "Alientos · Corno inglés", soundfont: "english_horn", fallback: "voice", sustain: true },
  { value: "clarinet", label: "Alientos · Clarinete", soundfont: "clarinet", fallback: "voice", sustain: true },
  { value: "bassoon", label: "Alientos · Fagot", soundfont: "bassoon", fallback: "voice", sustain: true },
  { value: "sopranoSax", label: "Saxofones · Soprano", soundfont: "soprano_sax", fallback: "voice", sustain: true },
  { value: "altoSax", label: "Saxofones · Alto", soundfont: "alto_sax", fallback: "voice", sustain: true },
  { value: "tenorSax", label: "Saxofones · Tenor", soundfont: "tenor_sax", fallback: "voice", sustain: true },
  { value: "baritoneSax", label: "Saxofones · Barítono", soundfont: "baritone_sax", fallback: "voice", sustain: true },

  // Metales
  { value: "trumpet", label: "Metales · Trompeta", soundfont: "trumpet", fallback: "organ", sustain: true },
  { value: "mutedTrumpet", label: "Metales · Trompeta con sordina", soundfont: "muted_trumpet", fallback: "organ", sustain: true },
  { value: "frenchHorn", label: "Metales · Corno francés", soundfont: "french_horn", fallback: "organ", sustain: true },
  { value: "trombone", label: "Metales · Trombón", soundfont: "trombone", fallback: "organ", sustain: true },
  { value: "tuba", label: "Metales · Tuba", soundfont: "tuba", fallback: "organ", sustain: true },

  // Percusión afinada
  { value: "timpani", label: "Percusión afinada · Timbales sinfónicos", soundfont: "timpani", fallback: "mallet", sustain: false },
  { value: "glockenspiel", label: "Percusión afinada · Glockenspiel", soundfont: "glockenspiel", fallback: "mallet", sustain: false },
  { value: "xylophone", label: "Percusión afinada · Xilófono", soundfont: "xylophone", fallback: "mallet", sustain: false },
  { value: "marimba", label: "Percusión afinada · Marimba", soundfont: "marimba", fallback: "mallet", sustain: false },
  { value: "vibraphone", label: "Percusión afinada · Vibráfono", soundfont: "vibraphone", fallback: "mallet", sustain: false },

  // Cuerdas pulsadas / populares
  { value: "nylonGuitar", label: "Cuerdas pulsadas · Guitarra de nylon", soundfont: "acoustic_guitar_nylon", fallback: "piano", sustain: false },
  { value: "steelGuitar", label: "Cuerdas pulsadas · Guitarra acústica", soundfont: "acoustic_guitar_steel", fallback: "piano", sustain: false },
  { value: "cleanGuitar", label: "Cuerdas pulsadas · Guitarra eléctrica clean", soundfont: "electric_guitar_clean", fallback: "piano", sustain: false },
  { value: "mutedGuitar", label: "Cuerdas pulsadas · Guitarra eléctrica muted", soundfont: "electric_guitar_muted", fallback: "piano", sustain: false },
  { value: "overdrivenGuitar", label: "Cuerdas pulsadas · Guitarra overdrive", soundfont: "overdriven_guitar", fallback: "piano", sustain: false },
  { value: "distortionGuitar", label: "Cuerdas pulsadas · Guitarra distorsionada", soundfont: "distortion_guitar", fallback: "piano", sustain: false },
  { value: "koto", label: "Cuerdas pulsadas · Koto", soundfont: "koto", fallback: "piano", sustain: false },
  { value: "fingerBass", label: "Bajos · Eléctrico finger", soundfont: "electric_bass_finger", fallback: "bass", sustain: false },
  { value: "pickBass", label: "Bajos · Eléctrico pick", soundfont: "electric_bass_pick", fallback: "bass", sustain: false },

  // Sintetizadores · leads
  { value: "leadSquare", label: "Lead 1 · Square", soundfont: "lead_1_square", fallback: "organ", sustain: true },
  { value: "leadSaw", label: "Lead 2 · Sawtooth", soundfont: "lead_2_sawtooth", fallback: "organ", sustain: true },
  { value: "leadCalliope", label: "Lead 3 · Calliope", soundfont: "lead_3_calliope", fallback: "organ", sustain: true },
  { value: "leadChiff", label: "Lead 4 · Chiff", soundfont: "lead_4_chiff", fallback: "organ", sustain: true },
  { value: "leadVoice", label: "Lead 5 · Voice", soundfont: "lead_6_voice", fallback: "organ", sustain: true },
  { value: "leadBass", label: "Lead 6 · Bass + Lead", soundfont: "lead_8_bass__lead", fallback: "organ", sustain: true },

  // Sintetizadores · pads
  { value: "warmPad", label: "Pad 1 · Warm", soundfont: "pad_2_warm", fallback: "strings", sustain: true },
  { value: "padPolysynth", label: "Pad 2 · Polysynth", soundfont: "pad_3_polysynth", fallback: "strings", sustain: true },
  { value: "padBowed", label: "Pad 3 · Bowed", soundfont: "pad_5_bowed", fallback: "strings", sustain: true },
  { value: "padMetallic", label: "Pad 4 · Metallic", soundfont: "pad_6_metallic", fallback: "strings", sustain: true },
  { value: "padHalo", label: "Pad 5 · Halo", soundfont: "pad_7_halo", fallback: "strings", sustain: true },

  // Sintetizadores · FX
  { value: "fxRain", label: "FX 1 · Rain", soundfont: "fx_1_rain", fallback: "organ", sustain: true },
  { value: "fxSoundtrack", label: "FX 2 · Soundtrack", soundfont: "fx_2_soundtrack", fallback: "organ", sustain: true },
  { value: "fxCrystal", label: "FX 3 · Crystal", soundfont: "fx_3_crystal", fallback: "organ", sustain: true },
  { value: "fxBrightness", label: "FX 4 · Brightness", soundfont: "fx_5_brightness", fallback: "organ", sustain: true },
  { value: "fxEchoes", label: "FX 5 · Echoes", soundfont: "fx_7_echoes", fallback: "organ", sustain: true },
];

function getInstrumentConfig(value) {
  return INSTRUMENTS.find((item) => item.value === value) ?? INSTRUMENTS.find((item) => item.value === "piano") ?? INSTRUMENTS[0];
}

function getInstrumentGainMultiplier(instrumentOrValue) {
  const config = typeof instrumentOrValue === "string" ? getInstrumentConfig(instrumentOrValue) : instrumentOrValue;
  const multiplier = Number(config?.gainMultiplier ?? 1);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

const RANDOM_INSTRUMENT_MODES = [
  { key: "all", label: "Aleatorio" },
];

function sanitizeRandomInstrumentMode(mode) {
  return RANDOM_INSTRUMENT_MODES.some((item) => item.key === mode) ? mode : DEFAULT_RANDOM_INSTRUMENT_MODE;
}

function getRandomInstrumentPool(mode = DEFAULT_RANDOM_INSTRUMENT_MODE) {
  const safeMode = sanitizeRandomInstrumentMode(mode);
  const pool = INSTRUMENTS.filter((item) => {
    if (safeMode === "sustained") return item.sustain;
    if (safeMode === "percussive") return !item.sustain;
    return true;
  });
  return pool.length ? pool : INSTRUMENTS;
}

function pickRandomInstrumentValue(mode = DEFAULT_RANDOM_INSTRUMENT_MODE) {
  return randomItem(getRandomInstrumentPool(mode))?.value ?? "piano";
}

function pickRandomInstrumentAvoiding(currentInstrument, mode = DEFAULT_RANDOM_INSTRUMENT_MODE) {
  let candidate = pickRandomInstrumentValue(mode);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (candidate !== currentInstrument) return candidate;
    candidate = pickRandomInstrumentValue(mode);
  }
  return candidate;
}

const PIANO_KEYS = [
  { pc: 0, name: "C", display: "Do", type: "white" },
  { pc: 1, name: "C#", display: "Do♯/Re♭", type: "black", left: "9%" },
  { pc: 2, name: "D", display: "Re", type: "white" },
  { pc: 3, name: "Eb", display: "Re♯/Mi♭", type: "black", left: "23.2%" },
  { pc: 4, name: "E", display: "Mi", type: "white" },
  { pc: 5, name: "F", display: "Fa", type: "white" },
  { pc: 6, name: "F#", display: "Fa♯/Sol♭", type: "black", left: "51.7%" },
  { pc: 7, name: "G", display: "Sol", type: "white" },
  { pc: 8, name: "Ab", display: "Sol♯/La♭", type: "black", left: "65.9%" },
  { pc: 9, name: "A", display: "La", type: "white" },
  { pc: 10, name: "Bb", display: "La♯/Si♭", type: "black", left: "80.2%" },
  { pc: 11, name: "B", display: "Si", type: "white" },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}


const TONAL_GENERATION_MEMORY = {
  recentAlteredTokens: [],
  recentDegreeStartsByKey: {},
  recentKeyIds: [],
  lastKeyFifths: null,
  alteredFormulaCounter: 0,
};

function noteRepeatKey(note) {
  if (!note) return "";
  return `${note.degree}:${note.accidentalAlter ?? 0}:${mod(note.pc ?? note.midi ?? 0, 12)}`;
}

function sameFunctionalDegree(a, b) {
  if (!a || !b) return false;
  return noteRepeatKey(a) === noteRepeatKey(b);
}

function sameScaleDegree(a, b) {
  return Boolean(a && b) && Number(a.degree) === Number(b.degree);
}

function sameNaturalVariant(a, b) {
  if (!a || !b) return false;
  return Number(a.degree) === Number(b.degree)
    && Number(a.accidentalAlter ?? 0) === Number(b.accidentalAlter ?? 0)
    && mod(a.pc ?? a.midi ?? 0, 12) === mod(b.pc ?? b.midi ?? 0, 12);
}

function signedChromaticDistance(a, b) {
  if (!a || !b) return 0;
  let diff = mod((b.pc ?? b.midi ?? 0) - (a.pc ?? a.midi ?? 0), 12);
  if (diff > 6) diff -= 12;
  return diff;
}

function isDirectParallelModeVariantMotion(a, b) {
  if (!sameScaleDegree(a, b)) return false;
  if ((a.letter ?? null) !== (b.letter ?? null)) return false;
  if (Number(a.accidentalAlter ?? 0) === Number(b.accidentalAlter ?? 0)) return false;
  return Math.abs(signedChromaticDistance(a, b)) === 1;
}

function candidateTouchesDirectParallelModeVariant(candidate, previous = null, next = null) {
  return isDirectParallelModeVariantMotion(previous, candidate) || isDirectParallelModeVariantMotion(candidate, next);
}

function mixtureScaleKindsForMode(baseMode, minorScales = []) {
  const minorKinds = minorScales.length ? minorScales : ["harmonicMinor"];
  const uniqueMinorKinds = [...new Set(minorKinds.filter((kind) => SCALE_PATTERNS[kind]))];
  if (baseMode === "minor") return [...uniqueMinorKinds, "major"];
  return ["major", ...uniqueMinorKinds];
}

function degreeWasHeard(note, degree) {
  return Boolean(note) && Number(note.degree) === Number(degree);
}

function collectHeardDegrees(notes = []) {
  const set = new Set();
  notes.forEach((note) => {
    if (note?.degree) set.add(note.degree);
  });
  return set;
}
function noteBelongsToAlteredFormula(note) {
  return Boolean(note?.alteredFormulaGroup);
}

function validateAlteredFormulaAt(sequence, index) {
  const note = sequence[index];
  if (!note?.form || !note?.alteredFormulaGroup) return true;
  const prev = sequence[index - 1] ?? null;
  const next = sequence[index + 1] ?? null;
  if (note.form === "passing") {
    if (!prev || !next) return false;
    return prev.degree === note.degree && next.degree === resolutionDegreeForAltered(note.degree, note.accidentalAlter);
  }
  if (note.form === "neighbor") {
    if (!prev || !next) return false;
    return prev.degree === next.degree && prev.degree === resolutionDegreeForAltered(note.degree, note.accidentalAlter);
  }
  if (note.form === "appoggiatura") {
    if (!next) return false;
    const resolutionDegree = resolutionDegreeForAltered(note.degree, note.accidentalAlter);
    return next.degree === resolutionDegree;
  }
  return true;
}


function alteredPoolForSettings({ baseMode, selectedDegrees, selectedAlteredMajorTokens, selectedAlteredMinorTokens }) {
  const poolMode = baseMode === "minor" ? "minor" : "major";
  const selectedTokens = poolMode === "minor"
    ? sanitizeAlteredTokens(selectedAlteredMinorTokens, "minor")
    : sanitizeAlteredTokens(selectedAlteredMajorTokens, "major");
  const selectedTokenSet = new Set(selectedTokens);
  return ALTERED_DEGREES_BY_MODE[poolMode]
    .map((item) => ({ ...item, mode: poolMode, token: alteredDegreeToken(poolMode, item.degree, item.alter) }))
    .filter((item) => {
      const degreeAllowed = selectedDegrees.includes(item.degree) || selectedDegrees.includes(resolutionDegreeForAltered(item.degree, item.alter));
      return selectedTokenSet.has(item.token) && degreeAllowed;
    });
}

function targetAlteredFormulaCount(settings, targetCount, bodyCount, alteredPoolSize) {
  if (!settings.includeAltered || bodyCount < 1 || alteredPoolSize <= 0) return 0;
  // Si el alumno activa grados alterados, deben aparecer incluso en ejercicios
  // mínimos. Con 2 notas sólo cabe una apoyatura cromática hacia la tónica; con
  // 3–4 notas cabe por lo menos una fórmula breve.
  const maxBySpace = bodyCount <= 1 ? 1 : Math.max(1, Math.floor(bodyCount / 2));
  let desired = 1;
  if (targetCount >= 22) desired = alteredPoolSize;       // En ejercicios largos intentamos recorrer todos.
  else if (targetCount >= 18) desired = 6;
  else if (targetCount >= 15) desired = 4;
  else if (targetCount >= 12) desired = 3;
  else if (targetCount >= 8) desired = 2;
  else desired = 1;
  return Math.min(desired, maxBySpace, alteredPoolSize);
}

function rememberAlteredTokens(tokens = []) {
  const clean = tokens.filter(Boolean);
  if (!clean.length) return;
  TONAL_GENERATION_MEMORY.recentAlteredTokens = [...clean, ...TONAL_GENERATION_MEMORY.recentAlteredTokens]
    .filter((token, index, array) => token && array.indexOf(token) === index)
    .slice(0, 18);
}

function canAppendNotesWithoutImmediateRepeat(currentNotes, nextNotes) {
  if (!Array.isArray(nextNotes) || !nextNotes.length) return false;
  const previous = currentNotes[currentNotes.length - 1] ?? null;
  if (previous && sameFunctionalDegree(previous, nextNotes[0])) return false;
  for (let index = 1; index < nextNotes.length; index += 1) {
    if (sameFunctionalDegree(nextNotes[index - 1], nextNotes[index])) return false;
  }
  return true;
}

function uniqueByDegreeAndAlter(candidates = []) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = noteRepeatKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mod(value, base) {
  return ((value % base) + base) % base;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function frequencyToMidi(frequency) {
  return 69 + 12 * Math.log2(frequency / 440);
}

function midiToSharpName(midi) {
  const rounded = Math.round(midi);
  return `${SHARP_NAMES[mod(rounded, 12)]}${Math.floor(rounded / 12) - 1}`;
}

function naturalMidi(letter, octave) {
  return 12 * (octave + 1) + NATURAL_PCS[letter];
}

function letterIndex(letter) {
  return LETTERS.indexOf(letter);
}

function diatonicIndex(letter, octave) {
  return octave * 7 + letterIndex(letter);
}

function bestAccidentalForPc(letter, octave, targetPc) {
  const naturalPc = NATURAL_PCS[letter];
  const candidates = [-2, -1, 0, 1, 2].map((acc) => ({ acc, pc: mod(naturalPc + acc, 12) }));
  const found = candidates.find((candidate) => candidate.pc === mod(targetPc, 12));
  if (found) return found.acc;
  let delta = mod(targetPc - naturalPc, 12);
  if (delta > 6) delta -= 12;
  return clamp(delta, -2, 2);
}

function normalizeNoteMidi(note) {
  if (!note) return note;
  let midi = naturalMidi(note.letter, note.octave) + note.accidental;
  const targetPc = mod(note.pc ?? midi, 12);
  while (mod(midi, 12) !== targetPc && midi < 120) midi += 12;
  while (mod(midi, 12) !== targetPc && midi > 0) midi -= 12;
  return { ...note, midi, frequency: midiToFrequency(midi) };
}

function makeNote({ key, degree, accidentalAlter = 0, scaleKind = "major", octave = 4, role = "natural", source = null, form = null }) {
  const pattern = SCALE_PATTERNS[scaleKind] ?? SCALE_PATTERNS.major;
  const rootLetterIndex = letterIndex(key.root.letter);
  const letter = LETTERS[(rootLetterIndex + degree - 1) % 7];
  const octaveShift = Math.floor((rootLetterIndex + degree - 1) / 7);
  const noteOctave = octave + octaveShift;
  const pc = mod(key.root.pc + pattern[degree - 1] + accidentalAlter, 12);
  const accidental = bestAccidentalForPc(letter, noteOctave, pc);
  const label = `${accidentalAlter < 0 ? "♭" : accidentalAlter > 0 ? "♯" : ""}${degree}`;
  return normalizeNoteMidi({
    letter,
    octave: noteOctave,
    accidental,
    pc,
    degree,
    accidentalAlter,
    scaleKind,
    role,
    source,
    form,
    degreeLabel: label,
  });
}

function transposeNoteOctave(note, octaveShift) {
  if (!note) return note;
  return normalizeNoteMidi({ ...note, octave: note.octave + octaveShift });
}

function noteName(note) {
  if (!note) return "—";
  const accidental = ACCIDENTAL_TO_TEXT[note.accidental] ?? "";
  return `${LETTER_TO_SPANISH[note.letter]}${accidental}${note.octave}`;
}

function staffKey(note) {
  if (!note) return "c/4";
  const accidental = ACCIDENTAL_TO_ASCII[note.accidental] ?? "";
  return `${note.letter.toLowerCase()}${accidental}/${note.octave}`;
}

function getKeyConfig(id) {
  return KEY_OPTIONS.find((key) => key.id === id) ?? KEY_OPTIONS[0];
}

function getClefConfig(id) {
  return CLEFS.find((clef) => clef.key === id) ?? CLEFS[0];
}

function chooseVariedKey(selectedKeyIds = []) {
  const candidateIds = selectedKeyIds.length ? selectedKeyIds : KEY_OPTIONS.map((key) => key.id);
  const candidates = candidateIds.map((id) => getKeyConfig(id)).filter(Boolean);
  if (!candidates.length) return KEY_OPTIONS[0];
  if (candidates.length === 1) {
    const only = candidates[0];
    TONAL_GENERATION_MEMORY.recentKeyIds = [only.id, ...TONAL_GENERATION_MEMORY.recentKeyIds].slice(0, 8);
    TONAL_GENERATION_MEMORY.lastKeyFifths = KEY_FIFTHS[only.id] ?? 0;
    return only;
  }
  const recent = TONAL_GENERATION_MEMORY.recentKeyIds ?? [];
  const lastFifths = Number.isFinite(TONAL_GENERATION_MEMORY.lastKeyFifths) ? TONAL_GENERATION_MEMORY.lastKeyFifths : null;
  const ranked = candidates.map((key) => {
    const fifths = KEY_FIFTHS[key.id] ?? 0;
    let score = 0;
    const recentIndex = recent.indexOf(key.id);
    if (recentIndex >= 0) score += 6 - Math.min(recentIndex, 5);
    if (lastFifths !== null) {
      const sameSide = Math.sign(fifths) === Math.sign(lastFifths) && Math.sign(fifths) !== 0;
      const oppositeSide = Math.sign(fifths) !== 0 && Math.sign(lastFifths) !== 0 && Math.sign(fifths) !== Math.sign(lastFifths);
      if (sameSide) score += 2.6;
      if (oppositeSide) score -= 1.9;
      if ((fifths === 0) === (lastFifths === 0)) score += 1.4;
      score += Math.max(0, 3 - Math.abs(Math.abs(fifths) - Math.abs(lastFifths))) * 0.9;
      if (Math.abs(fifths) >= 5 && Math.abs(lastFifths) >= 5) score += 1.6;
      if (Math.abs(fifths) <= 1 && Math.abs(lastFifths) <= 1) score += 1.1;
    }
    score += Math.random() * 0.35;
    return { key, fifths, score };
  }).sort((a, b) => a.score - b.score);
  const chosen = ranked[0].key;
  TONAL_GENERATION_MEMORY.recentKeyIds = [chosen.id, ...recent].slice(0, 8);
  TONAL_GENERATION_MEMORY.lastKeyFifths = KEY_FIFTHS[chosen.id] ?? 0;
  return chosen;
}

function addClefToStave(stave, clef) {
  if (!stave || !clef) return;
  if (clef.clefAnnotation) {
    try {
      stave.addClef(clef.vex, "default", clef.clefAnnotation);
      return;
    } catch {
      // VexFlow puede variar en soporte de anotaciones por build.
    }
  }
  stave.addClef(clef.vex);
}

const KEY_FIFTHS = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};

function keyFifthsForMode(keyId, cadenceMode = "major") {
  const base = KEY_FIFTHS[keyId] ?? 0;
  return cadenceMode === "minor" ? base - 3 : base;
}

function keyIsPracticalForMode(keyId, cadenceMode = "major") {
  const fifths = keyFifthsForMode(keyId, cadenceMode);
  return Number.isFinite(fifths) && fifths >= -7 && fifths <= 7;
}

function keyOptionsForModeScope(modeScope = "major") {
  if (modeScope === "minor") return KEY_OPTIONS.filter((key) => keyIsPracticalForMode(key.id, "minor"));
  return KEY_OPTIONS.filter((key) => keyIsPracticalForMode(key.id, "major") || keyIsPracticalForMode(key.id, "minor"));
}

function practicalKeyIdsForCadenceMode(selectedKeyIds = [], cadenceMode = "major") {
  const requested = Array.isArray(selectedKeyIds) && selectedKeyIds.length ? selectedKeyIds : KEY_OPTIONS.map((key) => key.id);
  const practical = requested.filter((id) => keyIsPracticalForMode(id, cadenceMode));
  if (practical.length) return practical;
  return KEY_OPTIONS.filter((key) => keyIsPracticalForMode(key.id, cadenceMode)).map((key) => key.id);
}

function possibleCadenceModesForSettings(modeScope, selectedKeyIds = []) {
  const requestedModes = modeScope === "minor"
    ? ["minor"]
    : modeScope === "major"
      ? ["major"]
      : ["major", "minor"];
  return requestedModes.filter((mode) => practicalKeyIdsForCadenceMode(selectedKeyIds, mode).length > 0);
}

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

function keySignatureFifths(exercise) {
  if (!exercise?.key?.id) return 0;
  return keyFifthsForMode(exercise.key.id, exercise.cadenceMode);
}

function vexKeySignatureName(exercise) {
  if (!exercise?.key?.id) return null;
  return `${exercise.key.id}${exercise.cadenceMode === "minor" ? "m" : ""}`;
}

function vexKeySignatureIsSupported(exercise) {
  const fifths = keySignatureFifths(exercise);
  return Number.isFinite(fifths) && fifths >= -7 && fifths <= 7;
}

function keySignatureAccidentalMap(exercise) {
  const map = {};
  if (!exercise?.key) return map;
  // VexFlow sólo maneja armaduras prácticas hasta 7 alteraciones.
  // Para tonalidades teóricas como Re♭ menor, Sol♭ menor o Do♭ menor,
  // no dibujamos armadura y mostramos los accidentales nota por nota.
  if (!vexKeySignatureIsSupported(exercise)) return map;
  // La armadura representa los siete grados diatónicos de la tonalidad. En modo
  // menor usamos la menor natural como armadura; la sensible elevada de la
  // cadencia menor se escribirá como alteración accidental cuando corresponda.
  const scaleKind = exercise.cadenceMode === "minor" ? "naturalMinor" : "major";
  for (let degree = 1; degree <= 7; degree += 1) {
    const note = makeNote({ key: exercise.key, degree, scaleKind, octave: 4 });
    map[note.letter] = note.accidental;
  }
  return map;
}

function addKeySignatureToStave(stave, exercise) {
  const keySig = vexKeySignatureName(exercise);
  if (!stave || !keySig) return;
  if (!vexKeySignatureIsSupported(exercise)) return;
  try {
    stave.addKeySignature(keySig);
  } catch (error) {
    console.warn("No se pudo dibujar la armadura:", keySig, error);
  }
}

function addDisplayedAccidental(staveNote, Accidental, note, noteIndex, accidentalState, signatureMap) {
  if (!note || !staveNote || !Accidental) return;
  const stateKey = `${note.letter}${note.octave}`;
  const signatureAccidental = signatureMap?.[note.letter] ?? 0;
  const previousAccidental = accidentalState.has(stateKey) ? accidentalState.get(stateKey) : signatureAccidental;
  if (note.accidental !== previousAccidental) {
    const acc = note.accidental === 0 ? "n" : vexAccidental(note.accidental);
    if (acc) staveNote.addModifier(new Accidental(acc), noteIndex);
  }
  accidentalState.set(stateKey, note.accidental);
}

function minorScaleListLabel(minorScales = []) {
  const selected = minorScales.length ? minorScales : ["harmonicMinor"];
  return selected.map((key) => SCALE_LABELS[key]).filter(Boolean).join(" / ") || "menor armónica";
}

function modeLabel(modeScope, _minorScales) {
  if (modeScope === "major") return "Modo mayor";
  if (modeScope === "minor") return "Modo menor";
  if (modeScope === "randomMode") return "Mayor o menor aleatorio";
  return "Mayor y menor combinados";
}

function answerNoteFromToken(key, token, octave) {
  const answerKey = ANSWER_DEGREE_KEYS.find((item) => item.token === token) ?? ANSWER_DEGREE_KEYS[1];
  const rootLetterIndex = letterIndex(key.root.letter);
  const letter = LETTERS[(rootLetterIndex + answerKey.degree - 1) % 7];
  const octaveShift = Math.floor((rootLetterIndex + answerKey.degree - 1) / 7);
  const noteOctave = octave + octaveShift;
  const targetPc = mod(key.root.pc + answerKey.semitones, 12);
  const accidental = bestAccidentalForPc(letter, noteOctave, targetPc);
  return normalizeNoteMidi({
    letter,
    octave: noteOctave,
    accidental,
    pc: targetPc,
    degree: answerKey.degree,
    accidentalAlter: answerKey.alter,
    degreeLabel: answerKey.label,
    scaleKind: "answer",
    role: "answer",
  });
}


function compactAlterLabel(alter, degree) {
  if (alter < 0) return `${"♭".repeat(Math.abs(alter))}${degree}`;
  if (alter > 0) return `${"♯".repeat(Math.abs(alter))}${degree}`;
  return `${degree}`;
}

function accidentalAlterFromPc(key, scaleKind, degree, pc) {
  const pattern = SCALE_PATTERNS[scaleKind] ?? SCALE_PATTERNS.major;
  let diff = mod(pc - mod(key.root.pc + pattern[degree - 1], 12), 12);
  if (diff > 6) diff -= 12;
  return clamp(diff, -2, 2);
}

function functionalDegreeForLetter(key, letter) {
  return mod(letterIndex(letter) - letterIndex(key.root.letter), 7) + 1;
}

function makeIntervallicSecondVoice(baseNote, key, scaleKind, intervalVariant, direction) {
  const baseDiatonic = diatonicIndex(baseNote.letter, baseNote.octave);
  const targetDiatonic = baseDiatonic + direction * intervalVariant.diatonicSteps;
  const letter = LETTERS[mod(targetDiatonic, 7)];
  const octave = Math.floor(targetDiatonic / 7);
  const targetMidi = Math.round(baseNote.midi + direction * intervalVariant.semitones);
  const pc = mod(targetMidi, 12);
  const accidental = bestAccidentalForPc(letter, octave, pc);
  const degree = functionalDegreeForLetter(key, letter);
  const accidentalAlter = accidentalAlterFromPc(key, scaleKind, degree, pc);
  return normalizeNoteMidi({
    letter,
    octave,
    accidental,
    pc,
    degree,
    accidentalAlter,
    degreeLabel: compactAlterLabel(accidentalAlter, degree),
    scaleKind,
    role: "secondVoice",
    source: "dyad",
    intervalLabel: intervalVariant.label,
  });
}

function makeDiatonicSecondVoice(baseNote, key, scaleKind, intervalVariant, direction) {
  const baseDiatonic = diatonicIndex(baseNote.letter, baseNote.octave);
  const targetDiatonic = baseDiatonic + direction * intervalVariant.diatonicSteps;
  const letter = LETTERS[mod(targetDiatonic, 7)];
  const octave = Math.floor(targetDiatonic / 7);
  const degree = functionalDegreeForLetter(key, letter);
  const pattern = SCALE_PATTERNS[scaleKind] ?? SCALE_PATTERNS.major;
  const pc = mod(key.root.pc + pattern[degree - 1], 12);
  const accidental = bestAccidentalForPc(letter, octave, pc);
  return normalizeNoteMidi({
    letter,
    octave,
    accidental,
    pc,
    degree,
    accidentalAlter: 0,
    degreeLabel: `${degree}`,
    scaleKind,
    role: "secondVoice",
    source: "diatonicDyad",
    intervalLabel: intervalVariant.familyLabel ?? intervalVariant.label,
  });
}

function dyadVariantPool(selectedDyadFamilies) {
  const selected = selectedDyadFamilies?.length ? selectedDyadFamilies : ["3", "6"];
  return DYAD_INTERVAL_OPTIONS
    .filter((family) => selected.includes(family.family))
    .flatMap((family) => family.variants.map((variant) => ({ ...variant, family: family.family, familyLabel: family.shortLabel })));
}

function chooseDyadDirection(_setting) {
  // La colocación de la segunda voz ya no es un parámetro visible: se decide
  // automáticamente para que ambas líneas sean cantables y el resultado no se
  // llene de líneas adicionales innecesarias.
  return Math.random() < 0.5 ? 1 : -1;
}

function noteRegisterPenaltyForClef(note, clef) {
  if (!note) return 999;
  if (clef?.key === "grandStaff") return noteLedgerPenalty(note) * 5;
  return clefLedgerPenalty(note, clef) * 5;
}

function dyadDiatonicStepPreference(variant) {
  // En música tonal a dos voces, las terceras y sextas suelen dar líneas más
  // naturales; quintas y octavas son útiles, pero menos móviles.
  if ([2, 5].includes(variant?.diatonicSteps)) return 0;
  if ([3, 4].includes(variant?.diatonicSteps)) return 1.2;
  if ([1, 6].includes(variant?.diatonicSteps)) return 1.8;
  if (variant?.diatonicSteps === 7) return 2.2;
  return 1;
}

function buildSecondaryVoice(sequence, exerciseContext, settings) {
  if (!settings.twoVoice) return [];
  const variants = dyadVariantPool(settings.selectedDyadFamilies);
  const scaleKind = exerciseContext.scaleKind ?? (exerciseContext.cadenceMode === "minor" ? "naturalMinor" : "major");
  const clef = exerciseContext.clef ?? CLEFS[0];
  let previousSecondary = null;
  let previousDirection = null;
  const familyUsage = {};
  const totalEvents = Math.max(0, sequence.length - 1);
  const compoundRange = { low: COMPOUND_REGISTER_LOW_MIDI, high: COMPOUND_REGISTER_HIGH_MIDI };

  return sequence.map((primary, index) => {
    const isFinalEvent = index === sequence.length - 1;
    const directions = [1, -1];
    const candidates = [];
    const missingFamilies = variants.length
      ? [...new Set(variants.map((variant) => variant.family))].filter((family) => !familyUsage[family])
      : [];
    const remainingEvents = Math.max(0, totalEvents - index);

    variants.forEach((variant) => {
      directions.forEach((direction) => {
        const baseSecondary = makeDiatonicSecondVoice(primary, exerciseContext.key, scaleKind, variant, direction);
        const octaveShifts = settings.compound ? [-3, -2, -1, 0, 1, 2, 3] : [0];
        const secondaryOptions = octaveShifts
          .map((shift) => transposeNoteOctave(baseSecondary, shift))
          .filter((secondary) => {
            if (!secondary) return false;
            if (settings.compound) {
              return secondary.midi >= compoundRange.low && secondary.midi <= compoundRange.high;
            }
            return true;
          });

        secondaryOptions.forEach((option) => {
          let secondary = option;

          if (!settings.compound) {
            let guard = 0;
            while (Math.abs(secondary.midi - primary.midi) > 12 && guard < 4) {
              secondary = transposeNoteOctave(secondary, secondary.midi > primary.midi ? -1 : 1);
              guard += 1;
            }
          }

          const lower = secondary.midi < primary.midi ? secondary : primary;
          const upper = secondary.midi < primary.midi ? primary : secondary;
          if (isFinalEvent && lower.degree !== 1) return;

          const verticalDistance = Math.abs(secondary.midi - primary.midi);
          const melodicDistance = previousSecondary ? Math.abs(secondary.midi - previousSecondary.midi) : 0;
          const ledgerPenalty = noteRegisterPenaltyForClef(secondary, clef) + noteRegisterPenaltyForClef(primary, clef) * 0.35;
          const leapPenalty = Math.max(0, melodicDistance - (settings.compound ? 10 : 5)) * (settings.compound ? 0.9 : 1.8);
          const overlyWidePenalty = settings.compound ? Math.max(0, verticalDistance - 31) * 0.85 : Math.max(0, verticalDistance - 12) * 3;
          const tooClosePenalty = verticalDistance <= 1 ? 5 : 0;
          const compoundSpacingReward = settings.compound && verticalDistance >= 13 ? -7.5 : 0;
          const registerSeparationReward = settings.compound && lower.midi <= 52 && upper.midi >= 60 ? -5.5 : 0;
          const finalBassPenalty = isFinalEvent && lower.degree === 1 ? 0 : 1.5;
          const directionChangePenalty = previousDirection !== null && direction !== previousDirection ? 4.5 : 0;
          const crossingPenalty = previousSecondary && ((direction > 0 && previousSecondary.midi <= sequence[Math.max(0, index - 1)].midi) || (direction < 0 && previousSecondary.midi >= sequence[Math.max(0, index - 1)].midi)) ? 2.4 : 0;
          const missingFamilyReward = missingFamilies.includes(variant.family) && remainingEvents <= missingFamilies.length + 1 ? -10 : missingFamilies.includes(variant.family) ? -4.5 : 0;
          const overusedPenalty = (familyUsage[variant.family] ?? 0) * 1.65;

          candidates.push({
            note: secondary,
            direction,
            family: variant.family,
            score:
              ledgerPenalty * 8 +
              leapPenalty +
              overlyWidePenalty +
              tooClosePenalty +
              crossingPenalty +
              directionChangePenalty +
              finalBassPenalty +
              overusedPenalty +
              dyadDiatonicStepPreference(variant) +
              missingFamilyReward +
              compoundSpacingReward +
              registerSeparationReward +
              Math.random() * 0.6,
          });
        });
      });
    });

    const fallbackVariant = { key: "M3", label: "3a", diatonicSteps: 2, family: "3", familyLabel: "Tercera" };
    const fallbackNote = makeDiatonicSecondVoice(primary, exerciseContext.key, scaleKind, fallbackVariant, 1);
    const chosenEntry = (candidates.length ? candidates : [{ note: fallbackNote, direction: 1, family: fallbackVariant.family, score: 999 }])
      .sort((a, b) => a.score - b.score)[0];
    previousSecondary = chosenEntry.note;
    previousDirection = chosenEntry.direction;
    familyUsage[chosenEntry.family] = (familyUsage[chosenEntry.family] ?? 0) + 1;
    return chosenEntry.note;
  });
}

function sanitizeHarmonicMode(mode) {
  return HARMONIC_EXERCISE_MODES.some((item) => item.key === mode) ? mode : "soprano";
}

function sanitizeHarmonicSopranoHintMode(mode) {
  return HARMONIC_SOPRANO_HINT_OPTIONS.some((item) => item.key === mode) ? mode : "all";
}

function sanitizeHarmonicTriads(items) {
  const valid = new Set(TRIAD_CHORD_OPTIONS.map((item) => item.key));
  const incoming = Array.isArray(items) ? items : DEFAULT_HARMONIC_TRIADS;
  return [...new Set(incoming)].filter((item) => valid.has(item));
}

function sanitizeHarmonicSevenths(items) {
  const valid = new Set(SEVENTH_CHORD_OPTIONS.map((item) => item.key));
  const incoming = Array.isArray(items) ? items : DEFAULT_HARMONIC_SEVENTHS;
  return [...new Set(incoming)].filter((item) => valid.has(item));
}

function isHarmonicExercise(exercise) {
  return exercise?.kind === "harmonicFunctions";
}

function harmonicExerciseModeLabel(mode) {
  return HARMONIC_EXERCISE_MODES.find((item) => item.key === mode)?.label ?? HARMONIC_EXERCISE_MODES[0].label;
}

function harmonicToneLabel(role) {
  return HARMONIC_TONE_LABELS[role] ?? "—";
}

function inversionLabelForIndex(index) {
  if (index === 0) return "Fund.";
  if (index === 1) return "1a inv.";
  if (index === 2) return "2a inv.";
  if (index === 3) return "3a inv.";
  return `${index}a inv.`;
}

function chordSymbol(root, chordDef) {
  return `${root.label}${chordDef?.suffix ?? ""}`;
}

function makeChordTone(root, chordDef, tone, octave = 4) {
  const baseDiatonic = diatonicIndex(root.letter, octave);
  const targetDiatonic = baseDiatonic + tone.diatonicSteps;
  const letter = LETTERS[mod(targetDiatonic, 7)];
  const noteOctave = Math.floor(targetDiatonic / 7);
  const pc = mod(root.pc + tone.semitones, 12);
  const accidental = bestAccidentalForPc(letter, noteOctave, pc);
  return normalizeNoteMidi({
    letter,
    octave: noteOctave,
    accidental,
    pc,
    degree: tone.diatonicSteps + 1,
    accidentalAlter: accidental,
    degreeLabel: harmonicToneLabel(tone.role),
    scaleKind: "chromaticChord",
    role: "harmonicChordTone",
    source: chordDef.key,
    chordTone: tone.role,
  });
}

function chordSpellingPenalty(root, chordDef) {
  if (!root || !chordDef) return 999;
  return chordDef.tones.reduce((sum, tone) => {
    const note = makeChordTone(root, chordDef, tone, 4);
    const accidentalWeight = Math.abs(note.accidental) + (Math.abs(note.accidental) >= 2 ? 12 : 0);
    return sum + accidentalWeight;
  }, Math.abs(root.accidental) * 0.35);
}

function chooseHarmonicRoot(chordDef) {
  const pc = Math.floor(Math.random() * 12);
  const candidates = HARMONIC_ROOT_SPELLINGS.filter((root) => root.pc === pc);
  const pool = candidates.length ? candidates : HARMONIC_ROOT_SPELLINGS;
  return [...pool].sort((a, b) => (chordSpellingPenalty(a, chordDef) + Math.random() * 0.2) - (chordSpellingPenalty(b, chordDef) + Math.random() * 0.2))[0];
}

function noteForRole(root, chordDef, role, octave = 4) {
  const tone = chordDef.tones.find((item) => item.role === role) ?? chordDef.tones[0];
  return makeChordTone(root, chordDef, tone, octave);
}

function fitNoteNearMidi(note, targetMidi, direction = 0) {
  if (!note) return note;
  let fitted = note;
  let guard = 0;
  while (fitted.midi < targetMidi - 6 && guard < 8) {
    fitted = transposeNoteOctave(fitted, 1);
    guard += 1;
  }
  while (fitted.midi > targetMidi + 6 && guard < 16) {
    fitted = transposeNoteOctave(fitted, -1);
    guard += 1;
  }
  if (direction < 0) {
    while (fitted.midi >= targetMidi && guard < 24) {
      fitted = transposeNoteOctave(fitted, -1);
      guard += 1;
    }
  } else if (direction > 0) {
    while (fitted.midi <= targetMidi && guard < 24) {
      fitted = transposeNoteOctave(fitted, 1);
      guard += 1;
    }
  }
  return fitted;
}

function placeSopranoNote(root, chordDef, role) {
  let note = noteForRole(root, chordDef, role, 4);
  while (note.midi < 64) note = transposeNoteOctave(note, 1);
  while (note.midi > 81) note = transposeNoteOctave(note, -1);
  return note;
}

function buildClosedSopranoVoicing(root, chordDef, sopranoRole) {
  const soprano = { ...placeSopranoNote(root, chordDef, sopranoRole), harmonicVoice: "soprano" };
  const lower = chordDef.tones
    .filter((tone) => tone.role !== sopranoRole)
    .map((tone) => {
      let note = makeChordTone(root, chordDef, tone, soprano.octave);
      while (note.midi >= soprano.midi) note = transposeNoteOctave(note, -1);
      while (transposeNoteOctave(note, 1).midi < soprano.midi) note = transposeNoteOctave(note, 1);
      return { ...note, harmonicVoice: "inner" };
    });
  return [...lower, soprano].sort((a, b) => a.midi - b.midi);
}

function roleCounts(roles) {
  return roles.reduce((map, role) => ({ ...map, [role]: (map[role] ?? 0) + 1 }), {});
}

function removeOneRole(roles, role) {
  const index = roles.indexOf(role);
  if (index < 0) return roles;
  return [...roles.slice(0, index), ...roles.slice(index + 1)];
}

function weightedTriadDuplicateRole(bassRole, sopranoRole) {
  if (bassRole === sopranoRole) return bassRole;
  const weighted = ["root", "root", "root", "root", "fifth", "fifth", "third"];
  if (![bassRole, sopranoRole].includes("root")) weighted.push("root", "root");
  return randomItem(weighted);
}

function possibleNotesForRoleBetween(root, chordDef, role, lowExclusive, highExclusive) {
  const notes = [];
  for (let octave = 1; octave <= 6; octave += 1) {
    const note = noteForRole(root, chordDef, role, octave);
    if (note.midi > lowExclusive && note.midi < highExclusive) notes.push(note);
  }
  return notes;
}

function buildSopranoBassVoicing(root, chordDef, sopranoRole, inversionIndex) {
  const bassRole = chordDef.tones[inversionIndex]?.role ?? "root";
  let bass = noteForRole(root, chordDef, bassRole, 2);
  while (bass.midi < 38) bass = transposeNoteOctave(bass, 1);
  while (bass.midi > 55) bass = transposeNoteOctave(bass, -1);

  let soprano = placeSopranoNote(root, chordDef, sopranoRole);
  while (soprano.midi <= bass.midi + 12) soprano = transposeNoteOctave(soprano, 1);
  while (soprano.midi > 84) soprano = transposeNoteOctave(soprano, -1);

  let roles = chordDef.tones.map((tone) => tone.role);
  if (chordDef.category === "triad") roles.push(weightedTriadDuplicateRole(bassRole, sopranoRole));
  roles = removeOneRole(roles, bassRole);
  roles = removeOneRole(roles, sopranoRole);
  if (roles.length < 2 && chordDef.category === "triad") roles.push(weightedTriadDuplicateRole(bassRole, sopranoRole));
  roles = roles.slice(0, 2);

  const firstOptions = possibleNotesForRoleBetween(root, chordDef, roles[0], bass.midi, soprano.midi);
  const secondOptions = possibleNotesForRoleBetween(root, chordDef, roles[1], bass.midi, soprano.midi);
  const candidates = [];
  firstOptions.forEach((a) => {
    secondOptions.forEach((b) => {
      if (a.midi === b.midi && roles[0] !== roles[1]) return;
      const [tenor, alto] = [a, b].sort((x, y) => x.midi - y.midi);
      if (!(bass.midi < tenor.midi && tenor.midi < alto.midi && alto.midi < soprano.midi)) return;
      const bassTenor = tenor.midi - bass.midi;
      const tenorAlto = alto.midi - tenor.midi;
      const altoSoprano = soprano.midi - alto.midi;
      const hardPenalty = (bassTenor > 19 ? 80 : 0) + (tenorAlto > 12 ? 80 : 0) + (altoSoprano > 12 ? 80 : 0);
      const spacingPenalty = Math.max(0, bassTenor - 16) * 2.2 + Math.max(0, tenorAlto - 9) * 2.5 + Math.max(0, altoSoprano - 9) * 2.5;
      const registerPenalty = Math.abs(tenor.midi - 52) * 0.22 + Math.abs(alto.midi - 60) * 0.22 + Math.abs(soprano.midi - 69) * 0.14 + Math.abs(bass.midi - 45) * 0.16;
      candidates.push({
        notes: [
          { ...bass, harmonicVoice: "bass" },
          { ...tenor, harmonicVoice: "tenor" },
          { ...alto, harmonicVoice: "alto" },
          { ...soprano, harmonicVoice: "soprano" },
        ],
        score: hardPenalty + spacingPenalty + registerPenalty + Math.random() * 2,
      });
    });
  });

  if (candidates.length) return candidates.sort((a, b) => a.score - b.score)[0].notes;

  const fallbackInner = roles.map((role, index) => fitNoteNearMidi(noteForRole(root, chordDef, role, 3), bass.midi + 7 + index * 5, 1));
  return [
    { ...bass, harmonicVoice: "bass" },
    ...fallbackInner.map((note, index) => ({ ...note, harmonicVoice: index === 0 ? "tenor" : "alto" })),
    { ...soprano, harmonicVoice: "soprano" },
  ].sort((a, b) => a.midi - b.midi);
}

function chooseSopranoRoleForChord(chordDef, harmonicMode, inversionIndex = null) {
  let roles = chordDef.tones.map((tone) => tone.role);
  if (harmonicMode === "sopranoBass" && chordDef.category === "seventh") {
    const bassRole = chordDef.tones[inversionIndex ?? 0]?.role;
    roles = roles.filter((role) => role !== bassRole);
  }
  if (chordDef.rootPositionOnly && harmonicMode === "sopranoBass") {
    roles = roles.filter((role) => role !== "root");
  }
  return randomItem(roles.length ? roles : chordDef.tones.map((tone) => tone.role));
}

function makeHarmonicEventObject({ chordKey, chordDef, root, harmonicMode, sopranoRole, inversionIndex, notes }) {
  const symbol = chordSymbol(root, chordDef);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    chordKey,
    chordLabel: chordDef.label,
    chordSymbol: symbol,
    rootLabel: root.label,
    category: chordDef.category,
    sopranoRole,
    sopranoPositionLabel: harmonicToneLabel(sopranoRole),
    inversionIndex,
    inversionLabel: harmonicMode === "sopranoBass" ? inversionLabelForIndex(inversionIndex ?? 0) : null,
    notes: notes.map((note) => ({
      ...note,
      chordSymbol: symbol,
      sopranoPositionLabel: harmonicToneLabel(sopranoRole),
      inversionLabel: harmonicMode === "sopranoBass" ? inversionLabelForIndex(inversionIndex ?? 0) : null,
    })),
  };
}

function sopranoMotionPenalty(previousEvent, candidateNotes) {
  if (!previousEvent || !candidateNotes?.length) return 0;
  const previousNotes = [...(previousEvent.notes ?? [])].sort((a, b) => a.midi - b.midi);
  const nextNotes = [...candidateNotes].sort((a, b) => a.midi - b.midi);
  const previousSoprano = previousNotes[previousNotes.length - 1];
  const previousAlto = previousNotes[previousNotes.length - 2];
  const nextSoprano = nextNotes[nextNotes.length - 1];
  const nextAlto = nextNotes[nextNotes.length - 2];
  if (!previousSoprano || !nextSoprano) return 0;

  const leap = Math.abs(nextSoprano.midi - previousSoprano.midi);
  let leapPenalty = 0;
  if (leap <= 2) leapPenalty = leap * 0.35;              // Segundas: preferidas.
  else if (leap <= 4) leapPenalty = 4 + (leap - 2) * 1.8; // Terceras: ocasionales.
  else if (leap <= 5) leapPenalty = 14;                   // Cuartas: raras.
  else leapPenalty = 34 + (leap - 5) * 8.5;               // Saltos mayores: evitar casi siempre.

  const crossingPenalty =
    (previousAlto && nextSoprano.midi <= previousAlto.midi ? 90 : 0) +
    (nextAlto && previousSoprano.midi <= nextAlto.midi ? 90 : 0);
  const registerPenalty = Math.abs(nextSoprano.midi - 69) * 0.28;
  return leapPenalty + crossingPenalty + registerPenalty;
}

function buildHarmonicEvent(chordKey, harmonicMode, previousEvent = null) {
  const chordDef = HARMONIC_CHORD_DEFS[chordKey] ?? HARMONIC_CHORD_DEFS.M;
  const maxInversion = chordDef.rootPositionOnly ? 0 : chordDef.tones.length - 1;

  if (harmonicMode === "soprano") {
    const sopranoRoles = chordDef.tones.map((tone) => tone.role);
    const candidates = [];
    const rootPool = shuffle(HARMONIC_ROOT_SPELLINGS).slice(0, previousEvent ? 14 : 8);
    rootPool.forEach((root) => {
      sopranoRoles.forEach((sopranoRole) => {
        const notes = buildClosedSopranoVoicing(root, chordDef, sopranoRole);
        const soprano = notes[notes.length - 1];
        const alto = notes[notes.length - 2];
        const compactnessPenalty = alto && soprano ? Math.max(0, soprano.midi - alto.midi - 5) * 0.9 : 0;
        candidates.push({
          root,
          sopranoRole,
          notes,
          score:
            chordSpellingPenalty(root, chordDef) * 0.7 +
            sopranoMotionPenalty(previousEvent, notes) +
            compactnessPenalty +
            Math.random() * 1.2,
        });
      });
    });
    const chosen = (candidates.length ? candidates : [{
      root: chooseHarmonicRoot(chordDef),
      sopranoRole: chooseSopranoRoleForChord(chordDef, harmonicMode, null),
      notes: null,
      score: 999,
    }]).sort((a, b) => a.score - b.score)[0];
    const notes = chosen.notes ?? buildClosedSopranoVoicing(chosen.root, chordDef, chosen.sopranoRole);
    return makeHarmonicEventObject({ chordKey, chordDef, root: chosen.root, harmonicMode, sopranoRole: chosen.sopranoRole, inversionIndex: null, notes });
  }

  const root = chooseHarmonicRoot(chordDef);
  const inversionIndex = Math.floor(Math.random() * (maxInversion + 1));
  const sopranoRole = chooseSopranoRoleForChord(chordDef, harmonicMode, inversionIndex);
  const notes = buildSopranoBassVoicing(root, chordDef, sopranoRole, inversionIndex);
  return makeHarmonicEventObject({ chordKey, chordDef, root, harmonicMode, sopranoRole, inversionIndex, notes });
}

function buildHarmonicExercise(settings) {
  const harmonicMode = sanitizeHarmonicMode(settings.harmonicMode);
  const selectedTriads = sanitizeHarmonicTriads(settings.selectedHarmonicTriads);
  const selectedSevenths = sanitizeHarmonicSevenths(settings.selectedHarmonicSevenths);
  const chordPool = [...selectedTriads, ...selectedSevenths].filter((key) => HARMONIC_CHORD_DEFS[key]);
  const safePool = chordPool.length ? chordPool : DEFAULT_HARMONIC_TRIADS;
  const count = clamp(Number(settings.harmonicChordCount) || DEFAULT_HARMONIC_CHORD_COUNT, MIN_HARMONIC_CHORDS, MAX_HARMONIC_CHORDS);
  const events = [];
  for (let index = 0; index < count; index += 1) {
    const previousEvent = events[events.length - 1] ?? null;
    events.push(buildHarmonicEvent(randomItem(safePool), harmonicMode, previousEvent));
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: "harmonicFunctions",
    trainerMode: "harmonicFunctions",
    harmonicMode,
    harmonicSopranoHintMode: sanitizeHarmonicSopranoHintMode(settings.harmonicSopranoHintMode),
    harmonicEvents: events,
    sequence: events.map((event) => event.notes[event.notes.length - 1]),
    secondarySequence: [],
    twoVoice: false,
    clef: harmonicMode === "sopranoBass" ? GRAND_STAFF_CLEF : CLEFS[0],
    compound: harmonicMode === "sopranoBass",
    cadenceMode: "major",
    modeScope: "chromaticHarmony",
    createdAt: Date.now(),
    repeated: settings.repeatEachNote,
  };
}

function sameNoteIdentity(a, b) {
  return Boolean(a && b) && Math.round(a.midi) === Math.round(b.midi) && a.letter === b.letter && a.accidental === b.accidental && a.octave === b.octave;
}

function getEventNotes(exercise, index) {
  if (!exercise) return [];
  if (isHarmonicExercise(exercise)) {
    return (exercise.harmonicEvents?.[index]?.notes ?? []).filter(Boolean).sort((a, b) => a.midi - b.midi);
  }
  const primary = exercise.sequence?.[index];
  const secondary = exercise.secondarySequence?.[index];
  return [primary, secondary].filter(Boolean).sort((a, b) => a.midi - b.midi);
}

function getGivenEventNotes(exercise, index) {
  const notes = getEventNotes(exercise, index);
  if (isHarmonicExercise(exercise)) {
    const soprano = notes[notes.length - 1];
    if (!soprano) return [];
    const mode = exercise.harmonicSopranoHintMode || "all";
    if (mode === "all") return [soprano];
    if (mode === "first" && index === 0) return [soprano];
    return [];
  }
  if (!exercise?.twoVoice || notes.length < 2) return [];
  const mode = exercise.dyadResponseMode || "both";
  if (mode === "upper") return [notes[0]];
  if (mode === "lower") return [notes[notes.length - 1]];
  return [];
}

function getResponseTargetNotes(exercise, index) {
  const notes = getEventNotes(exercise, index);
  if (isHarmonicExercise(exercise)) {
    const given = getGivenEventNotes(exercise, index);
    const targets = notes.filter((note) => !given.some((givenNote) => sameNoteIdentity(note, givenNote)));
    // En "Función armónica de la soprano" la referencia auditiva/visual es la voz superior;
    // responder de arriba hacia abajo hace que el alumno complete el acorde desde la soprano.
    // En "Soprano y bajo" conservamos bajo → arriba porque el bajo define la inversión.
    if (exercise.harmonicMode === "soprano") return targets.sort((a, b) => b.midi - a.midi);
    return targets.sort((a, b) => a.midi - b.midi);
  }
  if (!exercise?.twoVoice || notes.length < 2) return notes;
  const mode = exercise.dyadResponseMode || "both";
  if (mode === "upper") return [notes[notes.length - 1]];
  if (mode === "lower") return [notes[0]];
  return notes;
}

function getNoteIdentity(note) {
  if (!note) return "";
  return `${Math.round(note.midi)}:${note.degreeLabel}:${note.letter}:${note.accidental}`;
}

function statusForVisibleNote(note, answerNotes, answerStatuses) {
  const answerIndex = answerNotes.findIndex((target) => getNoteIdentity(target) === getNoteIdentity(note));
  return answerIndex >= 0 ? answerStatuses?.[answerIndex] ?? null : null;
}

function flattenExerciseNotes(exercise) {
  if (!exercise) return [];
  return (exercise.sequence ?? []).flatMap((_, index) => getEventNotes(exercise, index));
}


function getAnswerProgress(exercise, attempts) {
  const sequence = exercise?.sequence ?? [];
  const clef = exercise?.clef ?? CLEFS[0];
  let answered = 0;
  for (let index = 0; index < sequence.length; index += 1) {
    const required = Math.max(1, getResponseTargetNotes(exercise, index).length);
    const done = Math.min(required, attempts?.[index]?.statuses?.length ?? (attempts?.[index]?.status ? required : 0));
    answered += done;
    if (done < required) return { index, voiceIndex: done, answered };
  }
  return { index: sequence.length, voiceIndex: 0, answered };
}

function totalAnswerSlots(exercise) {
  return (exercise?.sequence ?? []).reduce((sum, _entry, index) => sum + Math.max(1, getResponseTargetNotes(exercise, index).length), 0);
}

function formatEventLabel(exercise, index) {
  if (isHarmonicExercise(exercise)) {
    const event = exercise.harmonicEvents?.[index];
    if (!event) return "—";
    const inversion = event.inversionLabel ? ` · ${event.inversionLabel}` : "";
    return `${event.chordSymbol} · ${event.sopranoPositionLabel}${inversion}`;
  }
  const notes = getEventNotes(exercise, index);
  return notes.map((note) => note.degreeLabel).join("–");
}

function getHarmonicPlaybackEventDescriptors(exercise) {
  if (!isHarmonicExercise(exercise)) return [];
  return (exercise.harmonicEvents ?? []).map((event, index) => ({
    label: `Acorde ${index + 1}: ${event?.chordSymbol ?? "—"}`,
    detail: formatEventLabel(exercise, index),
    chordIndex: index,
  }));
}

function compareSingleNote(target, answer, compound) {
  if (!target || !answer) return false;
  if (compound) return Math.round(target.midi) === Math.round(answer.midi);
  return mod(target.midi, 12) === mod(answer.midi, 12);
}

function answerEventIsCorrect(exercise, index, answer) {
  const targetNotes = getResponseTargetNotes(exercise, index);
  const answerNotes = answer?.notes ? answer.notes : [answer?.note ?? answer].filter(Boolean);
  if (!targetNotes.length || targetNotes.length !== answerNotes.length) return false;
  return targetNotes.every((target, noteIndex) => compareSingleNote(target, answerNotes[noteIndex], exercise.compound));
}

function createNaturalCandidates(key, baseMode, modeScope, minorScales, selectedDegrees, includeAltered = false) {
  const candidates = [];
  const scaleKinds = modeScope === "majorMinor"
    ? mixtureScaleKindsForMode(baseMode, minorScales)
    : baseMode === "minor"
      ? (minorScales.length ? minorScales : ["harmonicMinor"])
      : ["major"];

  selectedDegrees.forEach((degree) => {
    scaleKinds.forEach((scaleKind) => {
      const rawNote = makeNote({ key, degree, scaleKind, role: "natural", source: scaleKind });
      const note = modeScope === "majorMinor"
        ? (() => {
            const relativeAlter = accidentalAlterFromPc(key, "major", degree, rawNote.pc);
            return {
              ...rawNote,
              accidentalAlter: relativeAlter,
              degreeLabel: compactAlterLabel(relativeAlter, degree),
              source: scaleKind === "major" ? "majorMixture" : scaleKind,
            };
          })()
        : rawNote;
      const duplicate = candidates.some((candidate) => candidate.degree === note.degree && candidate.pc === note.pc && candidate.letter === note.letter && candidate.accidental === note.accidental);
      if (!duplicate) candidates.push(note);
    });
  });

  // En modo mayor/menor combinados la mezcla se hace con escalas paralelas:
  // Do mayor + Do menor, Sol mayor + Sol menor, Mi menor + Mi mayor, etc.
  // includeAltered queda reservado para las fórmulas cromáticas independientes.
  void includeAltered;

  return candidates.length ? candidates : [makeNote({ key, degree: 1, scaleKind: baseMode === "minor" ? "naturalMinor" : "major" })];
}

function resolutionDegreeForAltered(degree, alter) {
  if (alter > 0) return degree === 7 ? 1 : degree + 1;
  return degree === 1 ? 7 : degree - 1;
}

function createAlteredFormula({
  key,
  baseMode,
  minorScales,
  selectedDegrees,
  selectedForms,
  selectedAlteredMajorTokens,
  selectedAlteredMinorTokens,
  usedAlteredTokens = new Set(),
  previousNote = null,
  currentNotes = [],
  maxLength = Infinity,
  forceShortAppoggiatura = false,
}) {
  const poolMode = baseMode === "minor" ? "minor" : "major";
  const pool = alteredPoolForSettings({ baseMode, selectedDegrees, selectedAlteredMajorTokens, selectedAlteredMinorTokens });
  if (!pool.length || !selectedForms.length) return null;

  const recentTokens = TONAL_GENERATION_MEMORY.recentAlteredTokens;
  const rankedPool = pool
    .map((item) => ({
      item,
      score:
        (usedAlteredTokens.has(item.token) ? 100 : 0) +
        (recentTokens.includes(item.token) ? 12 - Math.min(10, recentTokens.indexOf(item.token)) : 0) +
        Math.random() * 1.5,
    }))
    .sort((a, b) => a.score - b.score);

  const scaleKind = poolMode === "major" ? "major" : randomItem(minorScales.length ? minorScales : ["harmonicMinor"]);
  const effectiveForms = (forceShortAppoggiatura || maxLength <= 2)
    ? ["appoggiatura"]
    : selectedForms;
  const formOrder = shuffle(effectiveForms);

  for (const { item: alteredDef } of rankedPool) {
    for (const form of formOrder) {
      const altered = makeNote({ key, degree: alteredDef.degree, accidentalAlter: alteredDef.alter, scaleKind, role: "altered", source: poolMode, form });
      const resolutionDegree = resolutionDegreeForAltered(alteredDef.degree, alteredDef.alter);
      const resolution = makeNote({ key, degree: resolutionDegree, scaleKind, role: "resolution", source: poolMode, form });
      const tonic = makeNote({ key, degree: 1, scaleKind, role: "tonic", source: poolMode, form });
      const naturalSameDegree = makeNote({ key, degree: alteredDef.degree, scaleKind, role: "preparation", source: poolMode, form });

      let notes;
      if (maxLength <= 1) {
        // En ejercicios de sólo 2 notas, la única fórmula viable es una
        // apoyatura cromática que resuelve directamente en la tónica final.
        if (resolutionDegree !== 1) continue;
        notes = [altered];
      } else if (form === "neighbor") {
        notes = [resolution, altered, resolution];
      } else if (form === "appoggiatura") {
        // En ejercicios breves no agregamos una tónica adicional; la tónica final
        // obligatoria del ejercicio funciona como resolución cuando corresponde.
        if (maxLength <= 2) notes = [altered, resolution];
        else notes = resolutionDegree === 1 ? [altered, resolution] : [altered, resolution, tonic];
      } else {
        notes = [naturalSameDegree, altered, resolution];
      }

      if (notes.length > maxLength) continue;

      const formulaGroupId = `alt-${++TONAL_GENERATION_MEMORY.alteredFormulaCounter}`;
      const labelled = notes.map((note, noteIndex) => {
        const isAlteredNote = note.role === "altered";
        return {
          ...note,
          form: isAlteredNote ? form : null,
          alteredFormulaToken: alteredDef.token,
          alteredFormulaGroup: formulaGroupId,
          alteredFormulaIndex: noteIndex,
          alteredFormulaLength: notes.length,
          formulaLabel: isAlteredNote
            ? `${altered.degreeLabel} · ${form === "neighbor" ? "bordadura" : form === "appoggiatura" ? "apoyatura" : "nota de paso"}`
            : null,
        };
      });

      const previousSafe = !previousNote || !sameFunctionalDegree(previousNote, labelled[0]);
      if (previousSafe && canAppendNotesWithoutImmediateRepeat(currentNotes, labelled)) {
        labelled.alteredToken = alteredDef.token;
        return labelled;
      }
    }
  }

  return null;
}

function compoundWindowForOctaves(_octaves) {
  return { low: COMPOUND_REGISTER_LOW_MIDI, high: COMPOUND_REGISTER_HIGH_MIDI };
}

function compoundSpanForOctaves(_octaves) {
  return COMPOUND_REGISTER_HIGH_MIDI - COMPOUND_REGISTER_LOW_MIDI;
}

function buildCompoundRegisterPlan({ compoundOctaves: _compoundOctaves, totalNotes }) {
  const low = COMPOUND_REGISTER_LOW_MIDI;
  const high = COMPOUND_REGISTER_HIGH_MIDI;
  const desiredLow = low;
  const desiredHigh = high;
  const actualSpan = high - low;
  const length = Math.max(1, Number(totalNotes) || 8);
  const wideMotifs = [
    [0.08, 0.42, 0.86, 0.72, 0.18, 0.55, 0.94, 0.34, 0.12, 0.68],
    [0.18, 0.62, 0.92, 0.74, 0.26, 0.08, 0.48, 0.88, 0.58, 0.14],
    [0.76, 0.34, 0.10, 0.28, 0.82, 0.96, 0.56, 0.20, 0.66, 0.90],
    [0.38, 0.82, 0.94, 0.60, 0.12, 0.46, 0.78, 0.30, 0.08, 0.70],
  ];
  const motif = randomItem(wideMotifs);
  const phase = Math.floor(Math.random() * motif.length);
  const targets = [];
  for (let index = 0; index < length; index += 1) {
    const base = motif[(index + phase) % motif.length];
    const cycle = Math.floor((index + phase) / motif.length);
    const drift = ((cycle % 3) - 1) * 0.055;
    const jitter = (Math.random() - 0.5) * 0.08;
    const normalized = clamp(base + drift + jitter, 0.03, 0.97);
    targets.push(desiredLow + normalized * actualSpan);
  }

  if (length >= 4) {
    const anchorIndexes = shuffle([0, Math.floor(length * 0.33), Math.floor(length * 0.66), length - 1]);
    const anchors = [0.08, 0.92, 0.48, 0.72];
    anchorIndexes.forEach((targetIndex, anchorIndex) => {
      if (targetIndex >= 0 && targetIndex < targets.length) {
        targets[targetIndex] = desiredLow + anchors[anchorIndex] * actualSpan;
      }
    });
  }

  return { low, high, desiredLow, desiredHigh, desiredSpan: actualSpan, targets, bucketCounts: [0, 0, 0, 0] };
}

function compoundBucketForMidi(midi, plan) {
  const normalized = clamp((midi - plan.desiredLow) / Math.max(1, plan.desiredSpan), 0, 0.999);
  return Math.floor(normalized * 4);
}

function noteLedgerPenalty(note) {
  if (!note) return 99;
  const midi = Math.round(note.midi);
  const inTrebleComfort = midi >= 57 && midi <= COMPOUND_REGISTER_HIGH_MIDI;
  const inBassComfort = midi >= COMPOUND_REGISTER_LOW_MIDI && midi <= 64;
  if (inTrebleComfort || inBassComfort) return 0;
  if (midi < COMPOUND_REGISTER_LOW_MIDI) return (COMPOUND_REGISTER_LOW_MIDI - midi) / 12 + 2;
  if (midi > COMPOUND_REGISTER_HIGH_MIDI) return (midi - COMPOUND_REGISTER_HIGH_MIDI) / 12 + 2;
  return 1;
}

function selectedDegreeSpanLimit(selectedDegrees = []) {
  const degrees = [...new Set(selectedDegrees)].sort((a, b) => a - b);
  const onlyFirstThree = degrees.length > 0 && degrees.every((degree) => [1, 2, 3].includes(degree));
  const includesFourSevenLayer = degrees.some((degree) => [4, 7].includes(degree)) && degrees.every((degree) => [1, 2, 3, 4, 7].includes(degree));
  if (onlyFirstThree) return 12;       // Contornos muy cerrados.
  if (includesFourSevenLayer) return 14; // Octava/novena como zona preferente.
  return 16;                           // Décima como zona preferente.
}

function diatonicDegreeDistance(a, b) {
  const direct = Math.abs((a ?? 1) - (b ?? 1));
  return Math.min(direct, 7 - direct);
}

function signedStepDirection(fromDegree, toDegree) {
  const from = Number(fromDegree);
  const to = Number(toDegree);
  if (!from || !to) return 0;
  const direct = to - from;
  if (Math.abs(direct) === 1) return Math.sign(direct);
  if (from === 7 && to === 1) return 1;
  if (from === 1 && to === 7) return -1;
  return 0;
}

function scalarRunMotionsWithCandidate(history = [], candidate) {
  const degrees = [...history.map((note) => note?.degree).filter(Boolean), candidate?.degree].map(Number);
  if (degrees.length < 2) return { run: 0, direction: 0, isStep: false };
  let run = 0;
  let direction = 0;
  for (let index = degrees.length - 1; index > 0; index -= 1) {
    const stepDirection = signedStepDirection(degrees[index - 1], degrees[index]);
    if (!stepDirection) break;
    if (!direction) direction = stepDirection;
    if (stepDirection !== direction) break;
    run += 1;
  }
  return { run, direction, isStep: Boolean(signedStepDirection(degrees[degrees.length - 2], degrees[degrees.length - 1])) };
}

function lastMelodicMotionKind(history = []) {
  if (!Array.isArray(history) || history.length < 2) return "none";
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const distance = diatonicDegreeDistance(prev?.degree, last?.degree);
  if (distance === 0) return "repeat";
  if (distance === 1) return "step";
  if (distance <= 3) return "smallLeap";
  return "largeLeap";
}

function pickMelodicNaturalCandidate(candidates, previous, twoVoice, options = {}) {
  if (!Array.isArray(candidates) || !candidates.length) return makeNote({ key: KEY_OPTIONS[0], degree: 1 });
  const uniqueCandidates = uniqueByDegreeAndAlter(candidates);
  const nonRepeating = uniqueCandidates.filter((candidate) => !previous || !sameFunctionalDegree(previous, candidate));
  const nextNote = options.nextNote ?? null;
  const preliminaryPool = nonRepeating.length ? nonRepeating : uniqueCandidates;
  const nonChromaticMixturePool = preliminaryPool.filter((candidate) => !candidateTouchesDirectParallelModeVariant(candidate, previous, nextNote));
  const pool = nonChromaticMixturePool.length ? nonChromaticMixturePool : preliminaryPool;
  const usageCounts = options.usageCounts ?? {};
  const requiredDegrees = new Set(options.requiredDegrees ?? []);
  const avoidRecentStartKey = options.avoidRecentStartKey ?? null;
  const recentStarts = avoidRecentStartKey ? (TONAL_GENERATION_MEMORY.recentDegreeStartsByKey[avoidRecentStartKey] ?? []) : [];
  const history = Array.isArray(options.history) ? options.history : [];
  const previous2 = history.length >= 2 ? history[history.length - 2] : null;
  const lastMotionKind = lastMelodicMotionKind(history);

  if (!previous && requiredDegrees.size) {
    const requiredPool = pool.filter((candidate) => requiredDegrees.has(candidate.degree));
    if (requiredPool.length) return randomItem(requiredPool);
  }

  const ranked = pool
    .map((candidate) => {
      const degreeDistance = previous ? diatonicDegreeDistance(previous.degree, candidate.degree) : 2;
      const immediateRepeatPenalty = previous && sameFunctionalDegree(previous, candidate) ? 999 : 0;
      const directModeMixturePenalty = candidateTouchesDirectParallelModeVariant(candidate, previous, nextNote) ? 999 : 0;
      const baseRepeatPenalty = previous && candidate.degree === previous.degree ? 8 : 0;
      const scalarInfo = scalarRunMotionsWithCandidate(history, candidate);
      const isStep = previous && degreeDistance === 1;
      const isSmallLeap = previous && degreeDistance >= 2 && degreeDistance <= 3;
      const isWideLeap = previous && degreeDistance >= 4;
      const leapPenalty = previous
        ? twoVoice
          ? Math.max(0, degreeDistance - 2) * 2.8
          : isWideLeap ? 1.5 : 0
        : 0;
      const stepBalance = previous && !twoVoice && isStep
        ? scalarInfo.run >= 4
          ? 28
          : scalarInfo.run === 3
            ? 2.8
            : lastMotionKind === "largeLeap" || lastMotionKind === "smallLeap"
              ? -2.1
              : -0.95
        : 0;
      const leapBalance = previous && !twoVoice && !isStep
        ? lastMotionKind === "step"
          ? (isSmallLeap ? -1.35 : -0.55)
          : lastMotionKind === "smallLeap" || lastMotionKind === "largeLeap"
            ? (isWideLeap ? 3.2 : 1.25)
            : -0.35
        : 0;
      const requiredReward = requiredDegrees.has(candidate.degree) ? -10 : 0;
      const underusedReward = -Math.max(0, 3 - (usageCounts[candidate.degree] ?? 0)) * 1.55;
      const overusedPenalty = (usageCounts[candidate.degree] ?? 0) * 2.05;
      const tonalAnchorReward = twoVoice && [1, 3, 5].includes(candidate.degree) ? -0.25 : 0;
      const startVarietyPenalty = !previous && recentStarts.includes(candidate.degree) ? 2.25 : 0;
      const scalarRunPenalty = previous && previous2
        && Math.abs(candidate.degree - previous.degree) === 1
        && Math.abs(previous.degree - previous2.degree) === 1
        && Math.sign(candidate.degree - previous.degree) === Math.sign(previous.degree - previous2.degree)
          ? (twoVoice ? 2.2 : scalarInfo.run >= 4 ? 28 : scalarInfo.run === 3 ? 3.4 : 0.8)
          : 0;
      const sameDirectionPenalty = previous && previous2
        && Math.sign(candidate.degree - previous.degree) === Math.sign(previous.degree - previous2.degree)
        && Math.sign(candidate.degree - previous.degree) !== 0
          ? (twoVoice ? 0.8 : isStep ? 0.6 : 1.4)
          : 0;
      const balancedMotionJitter = Math.random() * (twoVoice ? 0.65 : 2.15);
      return {
        candidate,
        score:
          immediateRepeatPenalty +
          directModeMixturePenalty +
          degreeDistance * (twoVoice ? 1.35 : 0.42) +
          baseRepeatPenalty +
          leapPenalty +
          stepBalance +
          leapBalance +
          scalarRunPenalty +
          sameDirectionPenalty +
          requiredReward +
          underusedReward +
          overusedPenalty +
          tonalAnchorReward +
          startVarietyPenalty +
          balancedMotionJitter,
      };
    })
    .sort((a, b) => a.score - b.score);
  return ranked[0].candidate;
}

function chooseRegister(note, previous, state, options) {
  const { compound, compoundOctaves, maxSpan, selectedDegrees = [], clef } = options;
  const base = note;
  if (compound) {
    if (!state.compoundPlan) {
      state.compoundPlan = buildCompoundRegisterPlan({ compoundOctaves, totalNotes: options.totalNotes ?? 8 });
      state.compoundIndex = 0;
      state.compoundDirections = [];
    }
    const plan = state.compoundPlan;
    const currentIndex = state.compoundIndex ?? 0;
    const targetMidi = plan.targets[currentIndex] ?? (plan.desiredLow + plan.desiredSpan * 0.5);
    const previousTarget = currentIndex > 0 ? plan.targets[currentIndex - 1] : null;
    const plannedDistance = previousTarget == null ? 0 : Math.abs(targetMidi - previousTarget);
    const wantsCompound = Boolean(previous && plannedDistance >= 13);
    const maxReasonableLeap = Math.max(18, plan.desiredSpan + 7);
    const candidates = [];
    for (let shift = -7; shift <= 7; shift += 1) {
      const candidate = transposeNoteOctave(base, shift);
      if (candidate.midi >= plan.low && candidate.midi <= plan.high) candidates.push(candidate);
    }
    const usable = candidates.length ? candidates : [base];
    const currentSpan = state.minMidi == null || state.maxMidi == null ? 0 : state.maxMidi - state.minMidi;
    const lastDirections = state.compoundDirections ?? [];

    const ranked = usable
      .map((candidate) => {
        const ledger = noteLedgerPenalty(candidate);
        const targetPenalty = Math.abs(candidate.midi - targetMidi);
        const distance = previous ? Math.abs(candidate.midi - previous.midi) : targetPenalty;
        const direction = previous ? Math.sign(candidate.midi - previous.midi) : 0;
        const sameDirectionReward = previous && direction !== 0 && direction === lastDirections[lastDirections.length - 1] ? -4.5 : 0;
        const strictAlternationPenalty = previous && lastDirections.length >= 2 && direction !== 0 && direction === lastDirections[lastDirections.length - 2] && direction === -lastDirections[lastDirections.length - 1] ? 16 : 0;
        const stagnantPenalty = previous && distance <= 5 ? 18 : 0;
        const simplePenalty = wantsCompound && distance <= 12 ? 34 + (13 - distance) * 3.2 : 0;
        const compoundReward = previous && distance >= 13 ? -9 : 0;
        const extremeLeapPenalty = previous && distance > maxReasonableLeap ? (distance - maxReasonableLeap) * 1.35 : 0;
        const minWithCandidate = Math.min(state.minMidi ?? candidate.midi, candidate.midi);
        const maxWithCandidate = Math.max(state.maxMidi ?? candidate.midi, candidate.midi);
        const spanWithCandidate = maxWithCandidate - minWithCandidate;
        const expandsRange = state.minMidi != null && state.maxMidi != null && (candidate.midi < state.minMidi - 4 || candidate.midi > state.maxMidi + 4);
        const spanExpansionReward = currentSpan < plan.desiredSpan * 0.82 && expandsRange ? -16 : 0;
        const spanShortPenalty = currentSpan < plan.desiredSpan * 0.65 && !expandsRange && currentIndex > 1 ? 8 : 0;
        const fullCoverageReward = spanWithCandidate >= plan.desiredSpan * 0.9 ? -8 : 0;
        const bucket = compoundBucketForMidi(candidate.midi, plan);
        const bucketReward = -(3 - Math.min(3, plan.bucketCounts?.[bucket] ?? 0)) * 1.8;
        const boundaryReward = (bucket === 0 || bucket === 3) && currentSpan < plan.desiredSpan * 0.75 ? -3 : 0;

        return {
          candidate,
          direction,
          bucket,
          score:
            targetPenalty * 1.15 +
            ledger * 5.5 +
            simplePenalty +
            stagnantPenalty +
            compoundReward +
            sameDirectionReward +
            strictAlternationPenalty +
            extremeLeapPenalty +
            spanExpansionReward +
            spanShortPenalty +
            fullCoverageReward +
            bucketReward +
            boundaryReward +
            Math.random() * 0.5,
        };
      })
      .sort((a, b) => a.score - b.score);

    const chosen = ranked[0] ?? { candidate: usable[0], direction: 0, bucket: compoundBucketForMidi(usable[0]?.midi ?? targetMidi, plan) };
    if (chosen.direction) state.compoundDirections = [...lastDirections, chosen.direction].slice(-4);
    if (Array.isArray(plan.bucketCounts)) plan.bucketCounts[chosen.bucket] = (plan.bucketCounts[chosen.bucket] ?? 0) + 1;
    state.compoundIndex = currentIndex + 1;
    return chosen.candidate;
  }

  const range = clefComfortRange(clef);
  const broadLow = Math.max(24, range.low - 12);
  const broadHigh = Math.min(108, range.high + 12);
  const candidates = [];
  for (let shift = -4; shift <= 4; shift += 1) {
    const candidate = transposeNoteOctave(base, shift);
    if (candidate.midi >= broadLow && candidate.midi <= broadHigh) candidates.push(candidate);
  }
  if (!candidates.length) return base;

  const spanLimit = Math.min(maxSpan ?? 16, selectedDegreeSpanLimit(selectedDegrees));
  const bounded = candidates.filter((candidate) => {
    const min = Math.min(state.minMidi ?? candidate.midi, candidate.midi);
    const max = Math.max(state.maxMidi ?? candidate.midi, candidate.midi);
    return max - min <= spanLimit;
  });
  const usable = bounded.length ? bounded : candidates;

  return usable.sort((a, b) => {
    const ledgerA = clefLedgerPenalty(a, clef);
    const ledgerB = clefLedgerPenalty(b, clef);
    const previousPenaltyA = previous ? Math.abs(a.midi - previous.midi) : Math.abs(a.midi - range.center);
    const previousPenaltyB = previous ? Math.abs(b.midi - previous.midi) : Math.abs(b.midi - range.center);
    const spanA = Math.abs(Math.max(state.maxMidi ?? a.midi, a.midi) - Math.min(state.minMidi ?? a.midi, a.midi));
    const spanB = Math.abs(Math.max(state.maxMidi ?? b.midi, b.midi) - Math.min(state.minMidi ?? b.midi, b.midi));
    const centerPenaltyA = Math.abs(a.midi - range.center);
    const centerPenaltyB = Math.abs(b.midi - range.center);
    return (ledgerA * 70 + previousPenaltyA * 1.15 + spanA * 2 + centerPenaltyA * 0.35) - (ledgerB * 70 + previousPenaltyB * 1.15 + spanB * 2 + centerPenaltyB * 0.35);
  })[0];
}

function buildTonalExercise(settings) {
  const requestedKeys = settings.selectedKeys.length ? settings.selectedKeys : KEY_OPTIONS.map((key) => key.id);
  const possibleModes = possibleCadenceModesForSettings(settings.modeScope, requestedKeys);
  const cadenceMode = randomItem(possibleModes.length ? possibleModes : ["major"]);
  const selectedKeys = practicalKeyIdsForCadenceMode(requestedKeys, cadenceMode);
  const key = chooseVariedKey(selectedKeys);
  const selectedClefs = settings.selectedClefs?.length ? settings.selectedClefs : CLEFS.map((clef) => clef.key);
  const clef = settings.compound ? GRAND_STAFF_CLEF : getClefConfig(randomItem(selectedClefs));
  const finalScaleKind = cadenceMode === "minor" ? randomItem(settings.minorScales.length ? settings.minorScales : ["harmonicMinor"]) : "major";
  const selectedDegrees = [...new Set((settings.selectedDegrees?.length ? settings.selectedDegrees : [1, 2, 3]).map(Number))].sort((a, b) => a - b);
  const naturalCandidates = createNaturalCandidates(key, cadenceMode, settings.modeScope, settings.minorScales, selectedDegrees, settings.includeAltered);
  const selectedForms = ALTERED_FORM_OPTIONS.map((item) => item.key).filter((keyName) => settings.alteredForms.includes(keyName));
  const targetCount = clamp(settings.noteCount, MIN_NOTES, MAX_NOTES);
  const bodyCount = Math.max(0, targetCount - 1);
  const raw = [];
  const usageCounts = Object.fromEntries(selectedDegrees.map((degree) => [degree, degree === 1 ? 1 : 0])); // La tónica final cuenta para el balance.
  const usedAlteredTokens = new Set();
  const alteredPool = alteredPoolForSettings({
    baseMode: cadenceMode,
    selectedDegrees,
    selectedAlteredMajorTokens: settings.selectedAlteredMajorTokens,
    selectedAlteredMinorTokens: settings.selectedAlteredMinorTokens,
  });
  const alteredTarget = targetAlteredFormulaCount(settings, targetCount, bodyCount, alteredPool.length);
  const startMemoryKey = `${key.id}:${cadenceMode}:${selectedDegrees.join("-")}`;

  function markNotes(notes) {
    notes.forEach((note) => {
      if (note?.degree && Object.prototype.hasOwnProperty.call(usageCounts, note.degree)) {
        usageCounts[note.degree] += 1;
      }
    });
  }

  function currentlyMissingDegrees() {
    const heard = collectHeardDegrees(raw);
    heard.add(1); // La última nota siempre será la tónica.
    return selectedDegrees.filter((degree) => !heard.has(degree));
  }

  function appendNatural(forceMissing = false) {
    const previous = raw[raw.length - 1] ?? null;
    const missing = currentlyMissingDegrees();
    const requiredDegrees = forceMissing ? missing : [];
    let pool = naturalCandidates;
    if (forceMissing && missing.length) {
      const missingPool = naturalCandidates.filter((candidate) => missing.includes(candidate.degree));
      if (missingPool.length) pool = missingPool;
    }
    const candidate = pickMelodicNaturalCandidate(pool, previous, settings.twoVoice, {
      usageCounts,
      requiredDegrees,
      avoidRecentStartKey: raw.length === 0 ? startMemoryKey : null,
      history: raw,
    });
    raw.push({ ...candidate, formulaLabel: null });
    markNotes([candidate]);
  }

  function appendAlteredFormula() {
    const remaining = bodyCount - raw.length;
    const formula = createAlteredFormula({
      key,
      baseMode: cadenceMode,
      minorScales: settings.minorScales,
      selectedDegrees,
      selectedForms,
      selectedAlteredMajorTokens: settings.selectedAlteredMajorTokens,
      selectedAlteredMinorTokens: settings.selectedAlteredMinorTokens,
      usedAlteredTokens,
      previousNote: raw[raw.length - 1] ?? null,
      currentNotes: raw,
      maxLength: remaining,
      forceShortAppoggiatura: remaining <= 2,
    });
    if (!formula?.length) return false;
    if (formula.length > remaining) return false;
    raw.push(...formula);
    if (formula.alteredToken) usedAlteredTokens.add(formula.alteredToken);
    markNotes(formula);
    return true;
  }

  const alteredInsertionPoints = Array.from({ length: alteredTarget }, (_, index) =>
    Math.max(0, Math.floor(((index + 1) * Math.max(1, bodyCount)) / (alteredTarget + 1)) - 1)
  );

  while (raw.length < bodyCount) {
    const remaining = bodyCount - raw.length;
    const missing = currentlyMissingDegrees();
    const alteredRemaining = Math.max(0, alteredTarget - usedAlteredTokens.size);
    const nextAlteredPoint = alteredInsertionPoints[usedAlteredTokens.size] ?? bodyCount + 1;
    const slotsPerRemainingAltered = Math.max(2, Math.ceil(remaining / Math.max(1, alteredRemaining)));
    const mustUseAlteredNow =
      alteredRemaining > 0 &&
      remaining >= 1 &&
      (
        raw.length >= nextAlteredPoint ||
        usedAlteredTokens.size === 0 && raw.length >= 1 ||
        remaining <= alteredRemaining * 3
      );

    if (mustUseAlteredNow && appendAlteredFormula()) continue;

    // Si todavía hay grados naturales seleccionados sin aparecer, los priorizamos,
    // pero ya no bloqueamos completamente las fórmulas alteradas.
    if (missing.length > 0 && (remaining <= missing.length + alteredRemaining * 2 || Math.random() < 0.72)) {
      appendNatural(true);
      continue;
    }

    const shouldUseAltered = alteredRemaining > 0 && remaining >= 1 && Math.random() < 0.62;
    if (shouldUseAltered && appendAlteredFormula()) continue;

    appendNatural(missing.length > 0 && Math.random() < 0.55);
  }

  // Revisión estricta de cobertura: si hay grados seleccionados que todavía
  // no sonaron, sustituimos notas naturales redundantes por esos grados sin
  // tocar bloques de fórmulas alteradas.
  function enforceNaturalDegreeCoverage() {
    const heard = collectHeardDegrees(raw);
    heard.add(1); // La tónica final cuenta como aparición del 1.
    const missingDegrees = selectedDegrees.filter((degree) => !heard.has(degree));
    missingDegrees.forEach((missingDegree) => {
      const replacementPool = naturalCandidates.filter((candidate) => candidate.degree === missingDegree);
      if (!replacementPool.length) return;
      const currentCounts = {};
      raw.forEach((note) => {
        if (!note?.degree || noteBelongsToAlteredFormula(note)) return;
        currentCounts[note.degree] = (currentCounts[note.degree] ?? 0) + 1;
      });
      const rankedSlots = raw
        .map((note, index) => {
          if (noteBelongsToAlteredFormula(note)) return null;
          if (!note?.degree || note.degree === missingDegree) return null;
          const duplicateReward = (currentCounts[note.degree] ?? 0) > 1 ? -14 : 0;
          const tonicPenalty = note.degree === 1 ? 7 : 0;
          const edgePenalty = index === 0 || index === raw.length - 1 ? 3 : 0;
          return { index, score: duplicateReward + tonicPenalty + edgePenalty + Math.random() * 0.2 };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score);
      for (const slot of rankedSlots) {
        const prev = raw[slot.index - 1] ?? null;
        const next = raw[slot.index + 1] ?? null;
        const safePool = replacementPool.filter((candidate) => !sameFunctionalDegree(prev, candidate) && !sameFunctionalDegree(next, candidate));
        const pool = safePool.length ? safePool : replacementPool;
        const replacement = pickMelodicNaturalCandidate(pool, prev, settings.twoVoice, { usageCounts, requiredDegrees: [missingDegree], nextNote: next });
        if (!replacement) continue;
        raw[slot.index] = { ...replacement, formulaLabel: null, form: null, alteredFormulaToken: null, alteredFormulaGroup: null, alteredFormulaIndex: null, alteredFormulaLength: null };
        return;
      }
    });
  }

  function enforceMajorMinorMixtureCoverage() {
    if (settings.modeScope !== "majorMinor") return;
    const preferredDegrees = selectedDegrees.filter((degree) => [3, 6, 7].includes(degree));
    if (!preferredDegrees.length || !raw.length) return;

    const variantsByDegree = preferredDegrees
      .map((degree) => {
        const variants = uniqueByDegreeAndAlter(naturalCandidates.filter((candidate) => candidate.degree === degree));
        return { degree, variants };
      })
      .filter((group) => group.variants.length > 1);
    if (!variantsByDegree.length) return;

    const essentialNonMixtureDegrees = selectedDegrees.filter((degree) => degree !== 1 && ![3, 6, 7].includes(degree)).length;
    const maxVariantSlots = Math.max(0, raw.length - essentialNonMixtureDegrees);
    if (maxVariantSlots <= 0) return;

    const targetVariants = [];
    const plannedHasVariant = (variant) =>
      raw.some((note) => sameNaturalVariant(note, variant)) || targetVariants.some((note) => sameNaturalVariant(note, variant));

    let guard = 0;
    while (targetVariants.length < maxVariantSlots && guard < 12) {
      guard += 1;
      let addedInPass = false;
      for (const group of variantsByDegree) {
        const missingVariant = group.variants.find((variant) => !plannedHasVariant(variant));
        if (!missingVariant) continue;
        targetVariants.push(missingVariant);
        addedInPass = true;
        if (targetVariants.length >= maxVariantSlots) break;
      }
      if (!addedInPass) break;
    }

    function placeVariant(variant) {
      if (raw.some((note) => sameNaturalVariant(note, variant))) return true;
      const degreeCounts = {};
      raw.forEach((note) => {
        if (!note?.degree || noteBelongsToAlteredFormula(note)) return;
        degreeCounts[note.degree] = (degreeCounts[note.degree] ?? 0) + 1;
      });

      function cleanNatural(note) {
        return { ...note, formulaLabel: null, form: null, alteredFormulaToken: null, alteredFormulaGroup: null, alteredFormulaIndex: null, alteredFormulaLength: null };
      }

      function sequenceIsSafeAround(start, notes) {
        const context = [raw[start - 1] ?? null, ...notes, raw[start + notes.length] ?? null].filter(Boolean);
        for (let index = 1; index < context.length; index += 1) {
          if (sameFunctionalDegree(context[index - 1], context[index])) return false;
          if (isDirectParallelModeVariantMotion(context[index - 1], context[index])) return false;
        }
        return true;
      }

      function placeVariantWithScalarBridge() {
        if (raw.length < 3) return false;
        const counterpart = raw.find((note) =>
          !noteBelongsToAlteredFormula(note)
          && sameScaleDegree(note, variant)
          && !sameNaturalVariant(note, variant)
        );
        if (!counterpart) return false;
        const bridgePool = naturalCandidates.filter((candidate) =>
          candidate.degree !== variant.degree
          && diatonicDegreeDistance(candidate.degree, variant.degree) === 1
        );
        if (!bridgePool.length) return false;

        const windows = Array.from({ length: Math.max(0, raw.length - 2) }, (_, start) => start)
          .filter((start) => !raw.slice(start, start + 3).some((note) => noteBelongsToAlteredFormula(note)))
          .sort((a, b) => {
            const center = raw.length / 2;
            return Math.abs(a + 1 - center) - Math.abs(b + 1 - center);
          });

        for (const start of windows) {
          const localBridgeCandidates = bridgePool.filter((candidate) => {
            const before = raw[start - 1] ?? null;
            const after = raw[start + 3] ?? null;
            return !candidateTouchesDirectParallelModeVariant(candidate, before, after);
          });
          const bridge = pickMelodicNaturalCandidate(localBridgeCandidates.length ? localBridgeCandidates : bridgePool, raw[start - 1] ?? null, settings.twoVoice, {
            usageCounts,
            history: raw.slice(0, start),
            nextNote: raw[start + 3] ?? null,
          });
          const patterns = [
            [variant, bridge, counterpart],
            [counterpart, bridge, variant],
          ].map((pattern) => pattern.map(cleanNatural));
          const chosen = patterns.find((pattern) => sequenceIsSafeAround(start, pattern));
          if (!chosen) continue;
          raw.splice(start, 3, ...chosen);
          return true;
        }
        return false;
      }

      const rankedSlots = raw
        .map((note, index) => {
          if (!note || noteBelongsToAlteredFormula(note)) return null;
          if (sameNaturalVariant(note, variant)) return null;
          if (sameScaleDegree(note, variant) && (degreeCounts[note.degree] ?? 0) <= 1) return null;
          const prev = raw[index - 1] ?? null;
          const next = raw[index + 1] ?? null;
          if (sameFunctionalDegree(prev, variant) || sameFunctionalDegree(next, variant)) return null;
          if (candidateTouchesDirectParallelModeVariant(variant, prev, next)) return null;
          const sameDegreeReward = note.degree === variant.degree ? -18 : 0;
          const duplicateReward = (degreeCounts[note.degree] ?? 0) > 1 ? -10 : 0;
          const tonicBodyReward = note.degree === 1 ? -4 : 0;
          const essentialPenalty = selectedDegrees.includes(note.degree) && note.degree !== variant.degree && (degreeCounts[note.degree] ?? 0) <= 1 ? 16 : 0;
          const edgePenalty = index === 0 || index === raw.length - 1 ? 2 : 0;
          return { index, score: sameDegreeReward + duplicateReward + tonicBodyReward + essentialPenalty + edgePenalty + Math.random() * 0.25 };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score);

      const slot = rankedSlots[0];
      if (slot) {
        raw[slot.index] = cleanNatural(variant);
        return true;
      }
      return placeVariantWithScalarBridge();
    }

    targetVariants.forEach((variant) => placeVariant(variant));
  }

  enforceNaturalDegreeCoverage();
  enforceMajorMinorMixtureCoverage();

  // Última barrera contra repeticiones inmediatas antes de la tónica final.
  if (raw.length && !noteBelongsToAlteredFormula(raw[raw.length - 1]) && sameFunctionalDegree(raw[raw.length - 1], makeNote({ key, degree: 1, scaleKind: finalScaleKind, role: "finalTonic", source: cadenceMode, octave: 4 }))) {
    const alternatives = naturalCandidates.filter((candidate) => !sameFunctionalDegree(candidate, raw[raw.length - 1]) && candidate.degree !== 1);
    if (alternatives.length) {
      const replacement = pickMelodicNaturalCandidate(alternatives, raw[raw.length - 2] ?? null, settings.twoVoice, { usageCounts });
      raw[raw.length - 1] = { ...replacement, formulaLabel: null };
    }
  }

  raw.push({
    ...makeNote({ key, degree: 1, scaleKind: finalScaleKind, role: "finalTonic", source: cadenceMode, octave: 4 }),
    formulaLabel: null,
  });

  // Limpieza final: si por una fórmula quedó una repetición inmediata, sustituimos
  // la segunda nota por un grado diatónico disponible sin alterar la tónica final.
  for (let index = 1; index < raw.length - 1; index += 1) {
    if (noteBelongsToAlteredFormula(raw[index - 1]) || noteBelongsToAlteredFormula(raw[index]) || noteBelongsToAlteredFormula(raw[index + 1])) continue;
    if (!sameFunctionalDegree(raw[index - 1], raw[index])) continue;
    const alternatives = naturalCandidates.filter((candidate) => !sameFunctionalDegree(candidate, raw[index - 1]) && !sameFunctionalDegree(candidate, raw[index + 1]));
    if (alternatives.length) raw[index] = { ...pickMelodicNaturalCandidate(alternatives, raw[index - 1], settings.twoVoice, { usageCounts }), formulaLabel: null };
  }
  const invalidFormulaGroups = new Set();
  raw.forEach((note, index) => {
    if (note?.alteredFormulaGroup && !validateAlteredFormulaAt(raw, index)) invalidFormulaGroups.add(note.alteredFormulaGroup);
  });
  if (invalidFormulaGroups.size) {
    raw.forEach((note, index) => {
      if (!invalidFormulaGroups.has(note?.alteredFormulaGroup)) return;
      if (index === raw.length - 1) return;
      const prev = raw[index - 1] ?? null;
      const next = raw[index + 1] ?? null;
      const alternatives = naturalCandidates.filter((candidate) => !sameFunctionalDegree(candidate, prev) && !sameFunctionalDegree(candidate, next));
      if (alternatives.length) {
        raw[index] = { ...pickMelodicNaturalCandidate(alternatives, prev, settings.twoVoice, { usageCounts }), formulaLabel: null, form: null, alteredFormulaToken: null, alteredFormulaGroup: null, alteredFormulaIndex: null, alteredFormulaLength: null };
      } else {
        raw[index] = { ...note, formulaLabel: null, form: null, alteredFormulaToken: null, alteredFormulaGroup: null, alteredFormulaIndex: null, alteredFormulaLength: null };
      }
    });
  }

  // Cobertura forzada de alterados: si el usuario los activó y la sucesión tiene
  // espacio, garantizamos al menos el número objetivo sustituyendo notas
  // naturales. Esto evita que los alterados se pierdan por las reglas de
  // cobertura natural o por validaciones posteriores.
  let forceGuard = 0;
  while (usedAlteredTokens.size < alteredTarget && forceGuard < 24) {
    forceGuard += 1;
    let inserted = false;
    const candidateStarts = shuffle(Array.from({ length: Math.max(0, raw.length - 1) }, (_, index) => index))
      .sort((a, b) => Math.abs(a - raw.length / 2) - Math.abs(b - raw.length / 2));
    for (const start of candidateStarts) {
      const prefix = raw.slice(0, start);
      const formula = createAlteredFormula({
        key,
        baseMode: cadenceMode,
        minorScales: settings.minorScales,
        selectedDegrees,
        selectedForms,
        selectedAlteredMajorTokens: settings.selectedAlteredMajorTokens,
        selectedAlteredMinorTokens: settings.selectedAlteredMinorTokens,
        usedAlteredTokens,
        previousNote: prefix[prefix.length - 1] ?? null,
        currentNotes: prefix,
        maxLength: raw.length - start,
        forceShortAppoggiatura: raw.length - start <= 2,
      });
      if (!formula?.length || start + formula.length > raw.length) continue;
      const replaced = raw.slice(start, start + formula.length);
      if (replaced.some((note) => noteBelongsToAlteredFormula(note))) continue;
      const next = raw[start + formula.length] ?? null;
      if (next && sameFunctionalDegree(formula[formula.length - 1], next)) continue;
      raw.splice(start, formula.length, ...formula);
      if (formula.alteredToken) usedAlteredTokens.add(formula.alteredToken);
      inserted = true;
      break;
    }
    if (!inserted) break;
  }

  enforceNaturalDegreeCoverage();
  enforceMajorMinorMixtureCoverage();

  function repairBodyEndingBeforeFinalTonic() {
    const finalTonic = makeNote({ key, degree: 1, scaleKind: finalScaleKind, role: "finalTonic", source: cadenceMode, octave: 4 });
    if (raw.length < 2 || !sameFunctionalDegree(raw[raw.length - 2], finalTonic) || !sameFunctionalDegree(raw[raw.length - 1], finalTonic)) return;

    const replaceSlotWithNatural = (index) => {
      const prev = raw[index - 1] ?? null;
      const next = index + 1 < raw.length ? raw[index + 1] : finalTonic;
      const pool = naturalCandidates.filter((candidate) => candidate.degree !== 1 && !sameFunctionalDegree(candidate, prev) && !sameFunctionalDegree(candidate, next));
      const fallbackPool = naturalCandidates.filter((candidate) => candidate.degree !== 1 && !sameFunctionalDegree(candidate, prev));
      const replacement = pickMelodicNaturalCandidate(pool.length ? pool : fallbackPool, prev, settings.twoVoice, { usageCounts });
      if (replacement) {
        raw[index] = { ...replacement, formulaLabel: null, form: null, alteredFormulaToken: null, alteredFormulaGroup: null, alteredFormulaIndex: null, alteredFormulaLength: null };
        return true;
      }
      return false;
    };

    const targetIndex = raw.length - 2;
    const last = raw[targetIndex];
    if (noteBelongsToAlteredFormula(last)) {
      const groupId = last.alteredFormulaGroup;
      const groupIndexes = raw.map((note, index) => note?.alteredFormulaGroup === groupId ? index : -1).filter((index) => index >= 0);
      // Si una fórmula alterada cayó justo antes de la tónica obligatoria y
      // termina en la misma tónica, es mejor sacrificar esa fórmula completa
      // que producir 1–1 al final.
      for (const index of groupIndexes) replaceSlotWithNatural(index);
    } else {
      replaceSlotWithNatural(targetIndex);
    }
  }
  repairBodyEndingBeforeFinalTonic();

  function repairDirectMajorMinorChromaticMotions() {
    if (settings.modeScope !== "majorMinor") return;
    for (let index = 1; index < raw.length; index += 1) {
      if (!isDirectParallelModeVariantMotion(raw[index - 1], raw[index])) continue;

      const preferredSlots = index === raw.length - 1 ? [index - 1] : [index, index - 1];
      for (const slotIndex of preferredSlots) {
        if (slotIndex <= 0 || slotIndex >= raw.length - 1) continue;
        if (noteBelongsToAlteredFormula(raw[slotIndex])) continue;
        const prev = raw[slotIndex - 1] ?? null;
        const next = raw[slotIndex + 1] ?? null;
        const alternatives = naturalCandidates.filter((candidate) =>
          candidate.degree !== raw[slotIndex]?.degree
          && !sameFunctionalDegree(candidate, prev)
          && !sameFunctionalDegree(candidate, next)
          && !candidateTouchesDirectParallelModeVariant(candidate, prev, next)
        );
        if (!alternatives.length) continue;
        const replacement = pickMelodicNaturalCandidate(alternatives, prev, settings.twoVoice, {
          usageCounts,
          history: raw.slice(0, slotIndex),
          nextNote: next,
        });
        raw[slotIndex] = { ...replacement, formulaLabel: null, form: null, alteredFormulaToken: null, alteredFormulaGroup: null, alteredFormulaIndex: null, alteredFormulaLength: null };
        break;
      }
    }
  }
  repairDirectMajorMinorChromaticMotions();

  const state = { minMidi: null, maxMidi: null };
  const sequence = [];
  raw.forEach((note, index) => {
    const previous = sequence[index - 1] ?? null;
    const registered = chooseRegister(note, previous, state, {
      compound: settings.compound,
      compoundOctaves: settings.compoundOctaves,
      maxSpan: settings.maxRange === "fifteenth" ? 24 : 16,
      selectedDegrees,
      clef,
      totalNotes: raw.length,
    });
    state.minMidi = Math.min(state.minMidi ?? registered.midi, registered.midi);
    state.maxMidi = Math.max(state.maxMidi ?? registered.midi, registered.midi);
    sequence.push(registered);
  });

  const exerciseContext = { key, cadenceMode, scaleKind: finalScaleKind, clef };
  const secondarySequence = buildSecondaryVoice(sequence, exerciseContext, settings);
  rememberAlteredTokens([...usedAlteredTokens]);
  if (sequence[0]?.degree) {
    TONAL_GENERATION_MEMORY.recentDegreeStartsByKey[startMemoryKey] = [sequence[0].degree, ...(TONAL_GENERATION_MEMORY.recentDegreeStartsByKey[startMemoryKey] ?? [])].slice(0, 8);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    key,
    cadenceMode,
    modeScope: settings.modeScope,
    minorScales: settings.minorScales,
    sequence,
    secondarySequence,
    twoVoice: Boolean(settings.twoVoice),
    dyadDirection: settings.dyadDirection,
    dyadResponseMode: settings.dyadResponseMode || "both",
    selectedDyadFamilies: settings.selectedDyadFamilies,
    clef,
    createdAt: Date.now(),
    compound: settings.compound,
    repeated: settings.repeatEachNote,
  };
}

function chooseCadenceBassOctave(key, exercise) {
  const low = 40;  // E2
  const high = 52; // E3
  const exerciseNotes = flattenExerciseNotes(exercise);
  const averageRegister = exerciseNotes.length
    ? exerciseNotes.reduce((sum, note) => sum + note.midi, 0) / exerciseNotes.length
    : 62;
  const target = averageRegister >= 66 ? 52 : 40;
  const tonicCandidates = [];
  for (let octave = 1; octave <= 4; octave += 1) {
    const note = makeNote({ key, degree: 1, scaleKind: "major", octave });
    tonicCandidates.push(note);
  }
  const inside = tonicCandidates.filter((note) => note.midi >= low && note.midi <= high);
  const pool = inside.length ? inside : tonicCandidates;
  return pool.sort((a, b) => Math.abs(a.midi - target) - Math.abs(b.midi - target))[0]?.octave ?? 3;
}

function buildCadenceChords(exercise) {
  const key = exercise.key;
  const mode = exercise.cadenceMode;
  const baseScale = mode === "minor" ? "naturalMinor" : "major";
  const dominantScale = mode === "minor" ? "harmonicMinor" : baseScale;
  const bassOctave = chooseCadenceBassOctave(key, exercise);
  const upperOctave = bassOctave + 1;
  const voice = (degree, octave, scaleKind = baseScale) => makeNote({ key, degree, scaleKind, octave });

  // Cadencia I–IV–V–I definida por grados:
  // Bajo:      1–4–5–1, con tónica del bajo dentro de E2–E3 cuando es posible.
  // Tenor:     3–4–2–3
  // Contralto: 5–6–5–5
  // Soprano:   1–1–7–1
  return [
    [voice(1, bassOctave), voice(3, upperOctave), voice(5, upperOctave), voice(1, upperOctave + 1)],
    [voice(4, bassOctave), voice(4, upperOctave), voice(6, upperOctave), voice(1, upperOctave + 1)],
    [voice(5, bassOctave), voice(2, upperOctave), voice(5, upperOctave), voice(7, upperOctave, dominantScale)],
    [voice(1, bassOctave), voice(3, upperOctave), voice(5, upperOctave), voice(1, upperOctave + 1)],
  ];
}
function defaultSettings() {
  return {
    trainerMode: "melodicFunctions",
    noteCount: DEFAULT_NOTE_COUNT,
    selectedDegrees: [1, 2, 3],
    selectedKeys: KEY_OPTIONS.map((key) => key.id),
    selectedClefs: ["treble"],
    modeScope: "randomMode",
    minorScales: ["harmonicMinor"],
    includeAltered: false,
    alteredForms: ALTERED_FORM_OPTIONS.map((item) => item.key),
    selectedAlteredMajorTokens: DEFAULT_ALTERED_MAJOR_TOKENS,
    selectedAlteredMinorTokens: DEFAULT_ALTERED_MINOR_TOKENS,
    repeatEachNote: true,
    speed: DEFAULT_SPEED,
    volume: DEFAULT_VOLUME,
    upperVoiceVolume: DEFAULT_UPPER_VOICE_VOLUME,
    lowerVoiceVolume: DEFAULT_LOWER_VOICE_VOLUME,
    instrument: "piano",
    randomInstrumentMode: DEFAULT_RANDOM_INSTRUMENT_MODE,
    randomInstrumentEnabled: DEFAULT_RANDOM_INSTRUMENT_ENABLED,
    randomizeInstrumentOnExercise: DEFAULT_RANDOMIZE_INSTRUMENT_ON_EXERCISE,
    compound: false,
    twoVoice: false,
    selectedDyadFamilies: ["3", "6"],
    dyadDirection: "auto",
    dyadResponseMode: "both",
    compoundOctaves: 5,
    maxRange: "tenth",
    responseOctave: 4,
    harmonicMode: "soprano",
    harmonicChordCount: DEFAULT_HARMONIC_CHORD_COUNT,
    harmonicSopranoHintMode: "all",
    selectedHarmonicTriads: DEFAULT_HARMONIC_TRIADS,
    selectedHarmonicSevenths: DEFAULT_HARMONIC_SEVENTHS,
  };
}

function initialSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
    const merged = { ...defaultSettings(), ...(stored ?? {}) };
    return {
      ...merged,
      modeScope: ["major", "minor", "randomMode", "majorMinor"].includes(merged.modeScope) ? merged.modeScope : "randomMode",
      selectedDegrees: Array.isArray(merged.selectedDegrees) && merged.selectedDegrees.length ? merged.selectedDegrees.filter((degree) => degree >= 1 && degree <= 7) : [1, 2, 3],
      selectedKeys: Array.isArray(merged.selectedKeys) ? merged.selectedKeys.filter((id) => KEY_OPTIONS.some((key) => key.id === id)) : KEY_OPTIONS.map((key) => key.id),
      selectedClefs: Array.isArray(merged.selectedClefs) && merged.selectedClefs.length ? merged.selectedClefs.filter((id) => CLEFS.some((clef) => clef.key === id)) : ["treble"],
      alteredForms: Array.isArray(merged.alteredForms) ? merged.alteredForms.filter((key) => ALTERED_FORM_OPTIONS.some((item) => item.key === key)) : ALTERED_FORM_OPTIONS.map((item) => item.key),
      selectedAlteredMajorTokens: sanitizeAlteredTokens(merged.selectedAlteredMajorTokens, "major"),
      selectedAlteredMinorTokens: sanitizeAlteredTokens(merged.selectedAlteredMinorTokens, "minor"),
      minorScales: Array.isArray(merged.minorScales) && merged.minorScales.length ? merged.minorScales.filter((key) => ["naturalMinor", "harmonicMinor", "melodicMinor"].includes(key)) : ["harmonicMinor"],
      speed: clamp(Number(merged.speed) || DEFAULT_SPEED, 10, 200),
      volume: clamp(Number(merged.volume) || DEFAULT_VOLUME, 0, 100),
      upperVoiceVolume: clamp(Number(merged.upperVoiceVolume) || DEFAULT_UPPER_VOICE_VOLUME, 0, 100),
      lowerVoiceVolume: clamp(Number(merged.lowerVoiceVolume) || DEFAULT_LOWER_VOICE_VOLUME, 0, 100),
      instrument: INSTRUMENTS.some((item) => item.value === merged.instrument) ? merged.instrument : "piano",
      randomInstrumentMode: sanitizeRandomInstrumentMode(merged.randomInstrumentMode ?? DEFAULT_RANDOM_INSTRUMENT_MODE),
      randomInstrumentEnabled: typeof merged.randomInstrumentEnabled === "boolean" ? merged.randomInstrumentEnabled : DEFAULT_RANDOM_INSTRUMENT_ENABLED,
      randomizeInstrumentOnExercise: typeof merged.randomizeInstrumentOnExercise === "boolean" ? merged.randomizeInstrumentOnExercise : DEFAULT_RANDOMIZE_INSTRUMENT_ON_EXERCISE,
      selectedDyadFamilies: Array.isArray(merged.selectedDyadFamilies) && merged.selectedDyadFamilies.length ? merged.selectedDyadFamilies.filter((family) => DYAD_INTERVAL_OPTIONS.some((item) => item.family === family)) : ["3", "6"],
      compoundOctaves: 5,
      dyadDirection: "auto",
      dyadResponseMode: ["both", "upper", "lower"].includes(merged.dyadResponseMode) ? merged.dyadResponseMode : "both",
      harmonicMode: sanitizeHarmonicMode(merged.harmonicMode),
      harmonicChordCount: clamp(Number(merged.harmonicChordCount) || DEFAULT_HARMONIC_CHORD_COUNT, MIN_HARMONIC_CHORDS, MAX_HARMONIC_CHORDS),
      harmonicSopranoHintMode: sanitizeHarmonicSopranoHintMode(merged.harmonicSopranoHintMode),
      selectedHarmonicTriads: sanitizeHarmonicTriads(merged.selectedHarmonicTriads),
      selectedHarmonicSevenths: sanitizeHarmonicSevenths(merged.selectedHarmonicSevenths),
    };
  } catch {
    return defaultSettings();
  }
}

function initialStats() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null");
    return { totalSeconds: 0, exercises: 0, correct: 0, incorrect: 0, ...(stored ?? {}) };
  } catch {
    return { totalSeconds: 0, exercises: 0, correct: 0, incorrect: 0 };
  }
}

function initialMarks() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MARKS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.slice(0, 80) : [];
  } catch {
    return [];
  }
}

function scoreFromStats(stats) {
  const correct = Number(stats?.correct ?? 0);
  const incorrect = Number(stats?.incorrect ?? 0);
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 100) : 100;
}

function formatDateTime(timestamp) {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "—";
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function answerIsCorrect(target, answer, compound) {
  if (!target || !answer) return false;
  if (compound) return Math.round(target.midi) === Math.round(answer.midi);
  return mod(target.midi, 12) === mod(answer.midi, 12);
}

function Badge({ children }) {
  return <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm">{children}</span>;
}

function SelectionChip({ active, onClick, children, disabled = false, title = undefined, onPointerDown = undefined }) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onTouchStart={onPointerDown}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-h-[32px] rounded-full border px-2.5 py-1 text-xs transition sm:min-h-[34px] sm:px-3 sm:py-1 sm:text-sm ${active ? "aural-active" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

function ActionButton({ active = false, onClick, onPointerDown, onTouchStart, children, disabled = false }) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onTouchStart={onPointerDown}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-3 text-sm font-semibold transition sm:w-auto sm:px-5 ${disabled ? "border-zinc-300 bg-white text-zinc-400" : active ? "aural-black-button" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-50"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

class SafeRenderBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Error visual en el módulo tonal:", error);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Hubo un problema al mostrar este ejercicio. Genera una nueva sucesión o reinicia parámetros.</div>;
    }
    return this.props.children;
  }
}

function BottomStat({ label, value }) {
  return (
    <div className="min-w-[92px] shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 sm:min-w-0 sm:px-3">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px] sm:tracking-[0.16em]">{label}</p>
      <p className="truncate text-sm font-bold text-zinc-900 sm:text-base">{value}</p>
    </div>
  );
}

function initialThemePreference() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return "light";
}

function AppThemeStyles() {
  return (
    <style>{`
      .app-theme-light {
        --aural-active-bg: #ecfdf5;
        --aural-active-border: #a7f3d0;
        --aural-active-text: #18181b;
        --aural-active-hover: #d1fae5;
        --aural-ring: rgba(16, 185, 129, 0.12);
        --aural-range: #0284c7;
        --aural-range-fill: #0284c7;
        --aural-range-thumb: #0284c7;
        --aural-range-empty: #d4d4d8;
        --aural-light-page: #f4f4f5;
        --aural-light-mint: #f4f4f5;
        --aural-light-aqua: #f4f4f5;
      }
      html:has(.app-theme-light),
      body:has(.app-theme-light),
      #root:has(.app-theme-light) {
        background: var(--aural-light-page) !important;
      }
      .app-theme-light,
      .app-theme-light.bg-zinc-100 {
        background: #f4f4f5 !important;
      }

      .app-theme-dark {
        /* Modo oscuro nocturno: base casi negra, superficies elevadas y calidez mínima. */
        --aural-dark-page: #050505;
        --aural-dark-page-2: #080807;
        --aural-dark-surface: #11100f;
        --aural-dark-surface-2: #171614;
        --aural-dark-soft: #1d1c1a;
        --aural-dark-soft-2: #242321;
        --aural-dark-border: #302e2a;
        --aural-dark-border-soft: #24231f;
        --aural-dark-text: #f5f5f4;
        --aural-dark-heading: #ffffff;
        --aural-dark-muted: #e7e7e4;
        --aural-dark-subtle: #d4d4d0;
        --aural-dark-faint: #a8a8a3;
        --aural-brand-text: #e7e2d6;

        /* Azul: se conserva como acento principal. */
        --aural-blue-bg: rgba(2, 132, 199, 0.15);
        --aural-blue-border: rgba(56, 189, 248, 0.42);
        --aural-blue-text: #9bd8ff;
        --aural-blue-solid: #0284c7;
        --aural-blue-solid-hover: #0369a1;

        /* Verde: más suave y menos saturado para el ojo en dark mode. */
        --aural-green: #2a6f52;
        --aural-green-2: #337a5c;
        --aural-green-soft: rgba(42, 111, 82, 0.18);
        --aural-green-soft-2: rgba(42, 111, 82, 0.26);
        --aural-green-border: rgba(92, 154, 121, 0.42);
        --aural-green-text: #b8ddc8;

        --aural-range-fill: #1d4f76;
        --aural-range-thumb: #4d7fa8;
        --aural-range-empty: #2a2d31;
        --aural-cream: #ecebea;
        --aural-cream-2: #c8c5c0;
        --aural-active-bg: var(--aural-green-soft);
        --aural-active-border: var(--aural-green-border);
        --aural-active-text: #eaf4ee;
        --aural-active-hover: var(--aural-green-soft-2);
        --aural-ring: rgba(94, 170, 127, 0.16);
        --aural-range: var(--aural-range-fill);
      }

      .aural-active,
      .aural-primary {
        background-color: var(--aural-active-bg) !important;
        border-color: var(--aural-active-border) !important;
        color: var(--aural-active-text) !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 0 0 1px var(--aural-ring) !important;
      }
      .aural-active:hover,
      .aural-primary:hover {
        background-color: var(--aural-active-hover) !important;
        border-color: var(--aural-active-border) !important;
      }
      .aural-status-pill {
        background-color: #ecfdf5 !important;
        border-color: #a7f3d0 !important;
        color: #047857 !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 0 0 1px rgba(16,185,129,0.12) !important;
      }
      .aural-status-kicker {
        color: #9ca3af !important;
      }
      .aural-status-value {
        color: #18181b !important;
      }
      .app-theme-dark .aural-status-pill {
        background-color: var(--aural-active-bg) !important;
        border-color: var(--aural-active-border) !important;
        color: #eefaf3 !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 0 0 1px var(--aural-ring) !important;
      }
      .app-theme-dark .aural-status-kicker {
        color: rgba(236, 253, 245, 0.78) !important;
      }
      .app-theme-dark .aural-status-value {
        color: #ffffff !important;
      }
      .aural-tuner-current-line-in {
        background-color: #047857 !important;
        box-shadow: 0 0 8px rgba(4,120,87,0.30) !important;
      }
      .aural-tuner-current-line-out {
        background-color: #0ea5e9 !important;
      }
      .app-theme-dark .aural-tuner-current-line-in {
        background-color: #10b981 !important;
        box-shadow: 0 0 8px rgba(16,185,129,0.45) !important;
      }
      .app-theme-dark .aural-tuner-current-line-out {
        background-color: #60a5fa !important;
        box-shadow: 0 0 10px rgba(96,165,250,0.45) !important;
      }
      .aural-black-button,
      .aural-mode-active {
        background-color: #18181b !important;
        border-color: #18181b !important;
        color: #ffffff !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.08) !important;
      }
      .aural-black-button:hover,
      .aural-mode-active:hover {
        background-color: #27272a !important;
        border-color: #27272a !important;
      }
      .app-theme-light input[type="range"],
      .app-theme-dark input[type="range"] { accent-color: var(--aural-range); }
      input.aural-range-input {
        -webkit-appearance: none;
        appearance: none;
        height: 8px;
        border-radius: 999px;
        background: var(--range-bg, var(--aural-range-empty));
        outline: none;
      }
      input.aural-range-input::-webkit-slider-runnable-track {
        height: 8px;
        border-radius: 999px;
        background: transparent;
        border: 0;
      }
      input.aural-range-input::-moz-range-track {
        height: 8px;
        border-radius: 999px;
        background: transparent;
        border: 0;
      }
      input.aural-range-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        margin-top: -6px;
        border-radius: 999px;
        border: 0;
        background: var(--aural-range-thumb);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      input.aural-range-input::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 0;
        background: var(--aural-range-thumb);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      .aural-staff-scroll::-webkit-scrollbar { height: 8px; }
      .aural-staff-scroll::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 999px; }

      html:has(.app-theme-dark),
      body:has(.app-theme-dark),
      #root:has(.app-theme-dark) {
        background: var(--aural-dark-page) !important;
      }
      .app-theme-dark {
        background:
          radial-gradient(circle at 16% 0%, rgba(54, 67, 82, 0.10) 0, rgba(54, 67, 82, 0.00) 34%),
          linear-gradient(180deg, var(--aural-dark-page) 0%, var(--aural-dark-page-2) 56%, #030303 100%) !important;
        color: var(--aural-dark-text) !important;
      }

      /* Superficies nocturnas: reemplazan blancos/zincs del modo claro sin caer en café visible. */
      .app-theme-dark [class*="bg-white"],
      .app-theme-dark [class~="bg-zinc-50"],
      .app-theme-dark [class~="bg-zinc-100"],
      .app-theme-dark [class~="bg-zinc-200"],
      .app-theme-dark.bg-zinc-100 {
        background-color: var(--aural-dark-surface) !important;
      }
      .app-theme-dark .bg-white\/95,
      .app-theme-dark .bg-white\/55,
      .app-theme-dark [class*="bg-white/"] {
        background-color: rgba(17, 16, 15, 0.96) !important;
      }
      .app-theme-dark .fixed.inset-x-0.bottom-0,
      .app-theme-dark [class*="backdrop-blur"] {
        background-color: rgba(5, 5, 5, 0.92) !important;
        backdrop-filter: blur(14px);
      }
      .app-theme-dark .rounded-2xl,
      .app-theme-dark .rounded-xl,
      .app-theme-dark .rounded-3xl {
        border-color: var(--aural-dark-border) !important;
      }
      .app-theme-dark .border-zinc-100,
      .app-theme-dark .border-zinc-200,
      .app-theme-dark .border-zinc-300,
      .app-theme-dark .border-dashed {
        border-color: var(--aural-dark-border) !important;
      }
      .app-theme-dark > div,
      .app-theme-dark section,
      .app-theme-dark main,
      .app-theme-dark .rounded-2xl[class*="border"],
      .app-theme-dark .rounded-3xl[class*="border"] {
        border-color: var(--aural-dark-border) !important;
      }

      /* Botones y controles inactivos. */
      .app-theme-dark button:not(.aural-active):not(.aural-primary):not(.aural-black-button):not(.aural-mode-active):not(.piano-white-key):not(.piano-black-key),
      .app-theme-dark select,
      .app-theme-dark input,
      .app-theme-dark option {
        background-color: var(--aural-dark-surface-2) !important;
        color: var(--aural-dark-muted) !important;
        border-color: var(--aural-dark-border) !important;
      }
      .app-theme-dark button:not(.aural-active):not(.aural-primary):not(.aural-black-button):not(.aural-mode-active):not(.piano-white-key):not(.piano-black-key):hover {
        background-color: var(--aural-dark-soft) !important;
        border-color: #3c3934 !important;
        color: var(--aural-dark-text) !important;
      }
      .app-theme-dark button:disabled,
      .app-theme-dark [disabled] {
        background-color: #12110f !important;
        color: var(--aural-dark-faint) !important;
        border-color: var(--aural-dark-border-soft) !important;
        opacity: 1 !important;
      }

      /* Pestañas activas: presencia clara, pero menos brillante que blanco puro. */
      .app-theme-dark .aural-black-button,
      .app-theme-dark .aural-mode-active {
        background-color: var(--aural-dark-soft-2) !important;
        border-color: #403d37 !important;
        color: var(--aural-dark-heading) !important;
        box-shadow: 0 12px 30px rgba(0,0,0,0.28) !important;
      }
      .app-theme-dark .aural-black-button:hover,
      .app-theme-dark .aural-mode-active:hover {
        background-color: #2c2a27 !important;
        border-color: #4a4640 !important;
        color: var(--aural-dark-text) !important;
      }

      /* Texto: crema suave para contenido principal; gris cálido para jerarquía secundaria. */
      .app-theme-dark .text-zinc-950,
      .app-theme-dark .text-zinc-900,
      .app-theme-dark .text-zinc-800,
      .app-theme-dark .text-zinc-700,
      .app-theme-dark .text-zinc-600 {
        color: var(--aural-dark-text) !important;
      }
      .app-theme-dark h1,
      .app-theme-dark h2,
      .app-theme-dark h3 {
        color: var(--aural-dark-heading) !important;
      }
      .app-theme-dark .text-zinc-500,
      .app-theme-dark .text-zinc-400,
      .app-theme-dark .text-zinc-300 {
        color: var(--aural-dark-subtle) !important;
      }
      .app-theme-dark .aural-brand-label {
        color: var(--aural-brand-text) !important;
      }
      .app-theme-dark [class*="text-stone-"],
      .app-theme-dark [class*="text-amber-"],
      .app-theme-dark [class*="text-yellow-"],
      .app-theme-dark [class*="text-orange-"],
      .app-theme-dark [style*="color: rgb(120"],
      .app-theme-dark [style*="color:#7"],
      .app-theme-dark [style*="color: #7"] {
        color: var(--aural-dark-text) !important;
      }

      /* Azules conservados: chips, etiquetas y líneas de referencia siguen sintiéndose azules. */
      .app-theme-dark .bg-sky-50 {
        background-color: var(--aural-blue-bg) !important;
      }
      .app-theme-dark .border-sky-200,
      .app-theme-dark .border-sky-300 {
        border-color: var(--aural-blue-border) !important;
      }
      .app-theme-dark .text-sky-700,
      .app-theme-dark .text-sky-600 {
        color: var(--aural-blue-text) !important;
      }
      .app-theme-dark .bg-sky-100 {
        background-color: rgba(2, 132, 199, 0.24) !important;
      }
      .app-theme-dark .bg-sky-500 {
        background-color: var(--aural-blue-solid) !important;
      }

      /* Verdes suavizados: presentes, pero ya no contaminan el fondo general. */
      .app-theme-dark .bg-emerald-50,
      .app-theme-dark .bg-emerald-50\/70,
      .app-theme-dark .bg-emerald-50\/90 {
        background-color: var(--aural-green-soft) !important;
      }
      .app-theme-dark .border-emerald-200,
      .app-theme-dark .border-emerald-300,
      .app-theme-dark .border-emerald-400 {
        border-color: var(--aural-green-border) !important;
      }
      .app-theme-dark .text-emerald-800,
      .app-theme-dark .text-emerald-700,
      .app-theme-dark .text-emerald-600 {
        color: var(--aural-green-text) !important;
      }
      .app-theme-dark .bg-emerald-600,
      .app-theme-dark .bg-emerald-700 {
        background-color: var(--aural-green) !important;
      }
      .app-theme-dark .bg-emerald-500 {
        background-color: var(--aural-green-2) !important;
      }

      /* Sliders y barras internas: azul petróleo oscuro, más suave que el azul de acción. */
      .app-theme-dark input[type="range"].aural-range-input,
      .app-theme-light input[type="range"].aural-range-input {
        background: var(--range-bg, var(--aural-range-empty)) !important;
      }
      .app-theme-dark input[type="range"].aural-range-input::-webkit-slider-runnable-track,
      .app-theme-light input[type="range"].aural-range-input::-webkit-slider-runnable-track {
        background: transparent !important;
      }
      .app-theme-dark input[type="range"].aural-range-input::-moz-range-track,
      .app-theme-light input[type="range"].aural-range-input::-moz-range-track {
        background: transparent !important;
      }
      .app-theme-dark .bg-zinc-500 {
        background-color: #6f7f8c !important;
      }

      .app-theme-dark .shadow-sm,
      .app-theme-dark .shadow-2xl,
      .app-theme-dark .shadow-\[0_-8px_30px_rgba\(0\,0\,0\,0\.08\)\] {
        box-shadow: 0 18px 52px rgba(0,0,0,0.36) !important;
      }
      .app-theme-dark .aural-staff-scroll::-webkit-scrollbar-thumb { background: #3d3a35; }

      .app-theme-dark .piano-keyboard-shell {
        background-color: #181817 !important;
        border-color: #34322e !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 26px rgba(0,0,0,0.28) !important;
      }
      .app-theme-dark .piano-keyboard-shell button.piano-white-key,
      .app-theme-dark button.piano-white-key,
      .app-theme-dark .piano-white-key {
        background-color: #e6e2dc !important;
        color: #111110 !important;
        border-color: #a9a49b !important;
        box-shadow: inset 0 -12px 18px rgba(30,30,28,0.10) !important;
      }
      .app-theme-dark .piano-keyboard-shell button.piano-white-key:hover,
      .app-theme-dark button.piano-white-key:hover,
      .app-theme-dark .piano-white-key:hover {
        background-color: #f0ece6 !important;
        color: #0f0f0e !important;
      }
      .app-theme-dark .piano-keyboard-shell button.piano-black-key,
      .app-theme-dark button.piano-black-key,
      .app-theme-dark .piano-black-key {
        background-color: #050505 !important;
        color: #efeeeb !important;
        border-color: #242321 !important;
        box-shadow: 0 7px 16px rgba(0,0,0,0.58) !important;
      }
      .app-theme-dark .piano-keyboard-shell button.piano-black-key:hover,
      .app-theme-dark button.piano-black-key:hover,
      .app-theme-dark .piano-black-key:hover {
        background-color: #11110f !important;
      }
      .app-theme-dark .piano-black-key-label {
        background-color: #181817 !important;
        color: #ecebea !important;
        border-color: #34322e !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.34) !important;
      }
      .app-theme-dark .piano-keyboard-shell button.piano-white-key:disabled,
      .app-theme-dark button.piano-white-key:disabled,
      .app-theme-dark .piano-white-key:disabled {
        background-color: #d6d2cc !important;
        color: #55524c !important;
        border-color: #969188 !important;
        opacity: 0.62 !important;
      }
      .app-theme-dark .piano-keyboard-shell button.piano-black-key:disabled,
      .app-theme-dark button.piano-black-key:disabled,
      .app-theme-dark .piano-black-key:disabled {
        background-color: #070707 !important;
        color: #a9a59f !important;
        border-color: #22211f !important;
        opacity: 0.56 !important;
      }

      /* Afinador en modo oscuro: un nivel más visible que el fondo general,
         retomando la estructura del modo claro pero traducida a grises oscuros. */
      .app-theme-dark .aural-tuner-panel {
        background-color: #2b2b2b !important;
        border-color: #565656 !important;
        box-shadow: 0 18px 42px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.055) !important;
      }
      .app-theme-dark .aural-tuner-strip {
        background-color: #161616 !important;
        border-color: #343434 !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025) !important;
      }
      .app-theme-dark .aural-tuner-strip .relative.h-16 {
        background-color: #2b2b2b !important;
        border-color: #565656 !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.018) !important;
      }
      .app-theme-dark .aural-tuner-center-line {
        background-color: rgba(255,255,255,0.28) !important;
      }
      .app-theme-dark .aural-tuner-hold-track {
        background-color: #303030 !important;
      }

      .app-theme-dark .aural-tuner-panel.aural-tuner-in-tune,
      .app-theme-dark .aural-tuner-panel.aural-tuner-completed {
        background-color: #2e2e2e !important;
        border-color: var(--aural-green-border) !important;
        box-shadow: 0 0 0 1px rgba(94,170,127,0.16), 0 18px 42px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.055) !important;
      }
      .app-theme-dark .aural-tuner-strip.aural-tuner-in-tune,
      .app-theme-dark .aural-tuner-strip.aural-tuner-completed {
        background-color: #161616 !important;
        border-color: #343434 !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025) !important;
      }
      .app-theme-dark .aural-tuner-strip.aural-tuner-in-tune .relative.h-16,
      .app-theme-dark .aural-tuner-strip.aural-tuner-completed .relative.h-16,
      .app-theme-dark .aural-tuner-panel.aural-tuner-in-tune .aural-tuner-strip .relative.h-16,
      .app-theme-dark .aural-tuner-panel.aural-tuner-completed .aural-tuner-strip .relative.h-16 {
        background-color: #2b2b2b !important;
        border-color: #565656 !important;
      }
      .app-theme-dark .aural-tuner-panel.aural-tuner-in-tune .aural-tuner-strip,
      .app-theme-dark .aural-tuner-panel.aural-tuner-completed .aural-tuner-strip {
        background-color: #161616 !important;
        border-color: #343434 !important;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025) !important;
      }
      .app-theme-dark .aural-tuner-panel .bg-emerald-300\/28,
      .app-theme-dark .aural-tuner-strip .bg-emerald-300\/28 {
        background-color: rgba(94, 170, 127, 0.22) !important;
      }
      .app-theme-dark .aural-tuner-panel .bg-emerald-700,
      .app-theme-dark .aural-tuner-panel .bg-emerald-600,
      .app-theme-dark .aural-tuner-panel .bg-emerald-500,
      .app-theme-dark .aural-tuner-strip .bg-emerald-700,
      .app-theme-dark .aural-tuner-strip .bg-emerald-600,
      .app-theme-dark .aural-tuner-strip .bg-emerald-500 {
        background-color: var(--aural-green-2) !important;
        box-shadow: 0 0 10px rgba(94,170,127,0.20) !important;
      }
      .app-theme-dark .aural-tuner-panel .bg-sky-500,
      .app-theme-dark .aural-tuner-strip .bg-sky-500 {
        background-color: #d1d5db !important;
      }
      .app-theme-dark svg:not([aria-hidden="true"]) { filter: invert(0.92) sepia(0.03) saturate(0.70) brightness(1.04); }
    `}</style>
  );
}

function rangeFillStyle(value, min, max) {
  const numericValue = Number(value);
  const numericMin = Number(min);
  const numericMax = Number(max);
  const percent = numericMax === numericMin ? 0 : clamp(((numericValue - numericMin) / (numericMax - numericMin)) * 100, 0, 100);
  return {
    "--range-bg": `linear-gradient(90deg, var(--aural-range-fill) 0%, var(--aural-range-fill) ${percent}%, var(--aural-range-empty) ${percent}%, var(--aural-range-empty) 100%)`,
  };
}

function useGoogleFonts() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "metodo-aural-google-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,500;1,600&family=DM+Sans:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}


function pitchClassOf(noteOrMidi) {
  const midi = typeof noteOrMidi === "number" ? noteOrMidi : noteOrMidi?.midi;
  return mod(Math.round(midi ?? 0), 12);
}

function frequencyToNearestMidi(frequency) {
  return Math.round(frequencyToMidi(frequency));
}

function centsOffFromMidi(frequency, midi) {
  return 1200 * Math.log2(frequency / midiToFrequency(midi));
}

function centsOffFromPitchClass(frequency, targetMidi) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const detectedCents = 1200 * Math.log2(frequency / 440);
  const targetCents = (targetMidi - 69) * 100;
  let diff = detectedCents - targetCents;
  diff = ((diff + 600) % 1200 + 1200) % 1200 - 600;
  return diff;
}

function centsOffFromNearestChromatic(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  return centsOffFromMidi(frequency, frequencyToNearestMidi(frequency));
}

function midiToSimpleNote(midi) {
  const names = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return { label: `${names[pitchClassOf(rounded)]}${octave}`, midi: rounded };
}

function formatDetectedPitch(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return "—";
  const midi = frequencyToNearestMidi(frequency);
  return `${midiToSimpleNote(midi).label} · ${frequency.toFixed(1)} Hz`;
}

function autoCorrelatePitch(buffer, sampleRate, threshold = 0.15) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.008) return null;

  const halfLen = Math.floor(buffer.length / 2);
  const yinBuffer = new Float32Array(halfLen);
  for (let tau = 0; tau < halfLen; tau += 1) {
    let sum = 0;
    for (let i = 0; i < halfLen; i += 1) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau += 1) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum > 0 ? yinBuffer[tau] * tau / runningSum : 1;
  }

  let tauEstimate = -1;
  for (let tau = 2; tau < halfLen; tau += 1) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) tau += 1;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate === -1) return null;

  let refined = tauEstimate;
  if (tauEstimate > 0 && tauEstimate < halfLen - 1) {
    const y0 = yinBuffer[tauEstimate - 1];
    const y1 = yinBuffer[tauEstimate];
    const y2 = yinBuffer[tauEstimate + 1];
    const denom = y0 + y2 - 2 * y1;
    if (denom !== 0) refined = tauEstimate + (y0 - y2) / (2 * denom);
  }

  const frequency = sampleRate / refined;
  return Number.isFinite(frequency) && frequency > 0 ? frequency : null;
}

function vexAccidental(accidental) {
  if (accidental === -2) return "bb";
  if (accidental === -1) return "b";
  if (accidental === 1) return "#";
  if (accidental === 2) return "##";
  return null;
}

function statusColor(status) {
  if (status === "correct") return "#047857";
  if (status === "wrong") return "#dc2626";
  return "#18181b";
}


function grandStaffNameForNote(note) {
  return Math.round(note?.midi ?? 60) < GRAND_STAFF_SPLIT_MIDI ? "bass" : "treble";
}

function buildVisibleEntryGroups(exercise, attempts, reveal) {
  const sequence = exercise?.sequence ?? [];
  return sequence.map((_, index) => {
    const allTargetNotes = getEventNotes(exercise, index);
    const answerTargetNotes = getResponseTargetNotes(exercise, index);
    const givenNotes = getGivenEventNotes(exercise, index);
    const attempt = attempts?.[index] ?? null;
    const answerStatuses = attempt?.statuses ?? [];
    const answeredCount = Math.min(answerTargetNotes.length, answerStatuses.length);
    const answeredNotes = answerTargetNotes.slice(0, answeredCount);
    const visibleNotes = reveal
      ? allTargetNotes
      : [...givenNotes, ...answeredNotes].sort((a, b) => a.midi - b.midi);
    const statuses = visibleNotes.map((note) => statusForVisibleNote(note, answerTargetNotes, answerStatuses));
    return {
      targetNotes: allTargetNotes,
      answerTargetNotes,
      givenNotes,
      visibleNotes,
      statuses,
      answerStatuses,
      fullyAnswered: answerTargetNotes.length > 0 && answerStatuses.length >= answerTargetNotes.length,
      reveal,
    };
  });
}


function TonalGrandStaff({ exercise, attempts, reveal, onNotePress }) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const touchRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const [renderError, setRenderError] = useState("");
  const [scrollMetrics, setScrollMetrics] = useState({ left: 0, max: 0 });
  const sequence = exercise?.sequence ?? [];

  const updateScrollMetrics = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setScrollMetrics({ left: node.scrollLeft, max: Math.max(0, node.scrollWidth - node.clientWidth) });
  }, []);

  const scrollStaffBy = useCallback((amount) => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({ left: amount, behavior: "smooth" });
    window.setTimeout(updateScrollMetrics, 220);
  }, [updateScrollMetrics]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    setRenderError("");
    if (!sequence.length) return;

    try {
      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector } = VF;
      const entries = buildVisibleEntryGroups(exercise, attempts, reveal);
      const availableWidth = Math.max(300, scrollRef.current?.clientWidth ?? 650);
      const compact = availableWidth < 560;
      const noteCount = Math.max(1, entries.length);
      // Misma filosofía de espaciado del entrenador de intervalos, con un poco
      // más de reserva por las dos claves y las armaduras largas.
      const clefReserve = compact ? 132 : 108;
      const noteStartPadding = compact ? 58 : 44;
      const minDesktopSpacing = noteCount >= 22 ? 30 : noteCount >= 18 ? 34 : noteCount >= 14 ? 38 : 44;
      const maxDesktopSpacing = noteCount >= 20 ? 58 : 74;
      const estimatedFinalReserve = compact ? 48 : 36;
      const noteSpacing = compact
        ? noteCount <= 2 ? 96 : noteCount <= 4 ? 84 : 64
        : noteCount <= 2 ? 94 : noteCount <= 4 ? 82 : clamp(Math.floor((availableWidth - clefReserve - estimatedFinalReserve - noteStartPadding) / Math.max(1, noteCount)), minDesktopSpacing, maxDesktopSpacing);
      const finalReserve = Math.max(compact ? 48 : 36, Math.round(noteSpacing * 0.54));
      const naturalWidth = clefReserve + noteStartPadding + finalReserve + Math.max(1, noteCount + 0.5) * noteSpacing;
      let width = noteCount <= 2
        ? Math.min(availableWidth, Math.max(compact ? 330 : 360, naturalWidth))
        : compact
          ? Math.max(Math.min(availableWidth, 390), naturalWidth)
          : Math.min(availableWidth, Math.max(naturalWidth, Math.min(availableWidth, 560)));
      width = Math.max(compact ? 330 : 360, Math.round(width));
      const height = compact ? 314 : 330;
      const staveX = compact ? 0 : 22;
      const trebleY = compact ? 38 : 44;
      const bassY = compact ? 142 : 152;
      const staveRightPadding = compact ? 28 : 28;
      const staveWidth = Math.max(210, width - staveX - staveRightPadding);

      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      const trebleStave = new Stave(staveX, trebleY, staveWidth);
      const bassStave = new Stave(staveX, bassY, staveWidth);
      if (VF.Barline?.type?.END && typeof trebleStave.setEndBarType === "function") trebleStave.setEndBarType(VF.Barline.type.END);
      if (VF.Barline?.type?.END && typeof bassStave.setEndBarType === "function") bassStave.setEndBarType(VF.Barline.type.END);
      addClefToStave(trebleStave, GRAND_STAFF_TREBLE);
      addClefToStave(bassStave, GRAND_STAFF_BASS);
      addKeySignatureToStave(trebleStave, exercise);
      addKeySignatureToStave(bassStave, exercise);
      [trebleStave, bassStave].forEach((stave) => {
        if (typeof stave.getNoteStartX === "function" && typeof stave.setNoteStartX === "function") stave.setNoteStartX(stave.getNoteStartX() + noteStartPadding);
        stave.setContext(context).draw();
      });
      if (StaveConnector) {
        try {
          const connectorTypes = StaveConnector.type ?? {};
          const singleLeft = new StaveConnector(trebleStave, bassStave);
          singleLeft.setType?.(connectorTypes.SINGLE_LEFT ?? 1);
          singleLeft.setContext(context).draw();
          const brace = new StaveConnector(trebleStave, bassStave);
          brace.setType?.(connectorTypes.BRACE ?? 3);
          brace.setContext(context).draw();
        } catch {}
      }

      const signatureMap = keySignatureAccidentalMap(exercise);
      const trebleAccidentals = new Map();
      const bassAccidentals = new Map();
      const eventGroups = entries.map((entry) => {
        const visibleItems = entry.visibleNotes.map((note, voiceIndex) => ({
          note,
          status: entry.statuses?.[voiceIndex] ?? null,
          visible: true,
          voiceIndex,
          staff: grandStaffNameForNote(note),
        }));
        return {
          targetNotes: entry.targetNotes,
          visibleItems,
          treble: visibleItems.filter((item) => item.staff === "treble"),
          bass: visibleItems.filter((item) => item.staff === "bass"),
        };
      });

      const makeTickable = (items, clefName, accidentalState) => {
        if (!items.length) {
          const rest = new StaveNote({ clef: clefName, keys: [clefName === "bass" ? "d/3" : "b/4"], duration: "wr" });
          if (typeof rest.setStyle === "function") rest.setStyle({ fillStyle: "rgba(0,0,0,0)", strokeStyle: "rgba(0,0,0,0)" });
          return rest;
        }
        const staveNote = new StaveNote({ clef: clefName, keys: items.map((item) => staffKey(item.note)), duration: "w" });
        items.forEach(({ note }, noteIndex) => {
          addDisplayedAccidental(staveNote, Accidental, note, noteIndex, accidentalState, signatureMap);
        });
        return staveNote;
      };

      const trebleVexNotes = eventGroups.map((group) => makeTickable(group.treble, "treble", trebleAccidentals));
      const bassVexNotes = eventGroups.map((group) => makeTickable(group.bass, "bass", bassAccidentals));
      const spacerTreble = new StaveNote({ clef: "treble", keys: ["b/4"], duration: "hr" });
      const spacerBass = new StaveNote({ clef: "bass", keys: ["d/3"], duration: "hr" });
      [spacerTreble, spacerBass].forEach((note) => {
        if (typeof note.setStyle === "function") note.setStyle({ fillStyle: "rgba(0,0,0,0)", strokeStyle: "rgba(0,0,0,0)" });
      });
      const trebleVoice = new Voice({ num_beats: entries.length * 4 + 2, beat_value: 4 });
      const bassVoice = new Voice({ num_beats: entries.length * 4 + 2, beat_value: 4 });
      [trebleVoice, bassVoice].forEach((voice) => {
        if (typeof voice.setMode === "function" && Voice.Mode) voice.setMode(Voice.Mode.SOFT);
        if (typeof voice.setStrict === "function") voice.setStrict(false);
      });
      trebleVoice.addTickables([...trebleVexNotes, spacerTreble]);
      bassVoice.addTickables([...bassVexNotes, spacerBass]);
      const formatWidth = compact
        ? Math.max(210, Math.max(1, noteCount + 0.5) * noteSpacing)
        : Math.max(180, width - clefReserve - finalReserve - noteStartPadding);
      new Formatter().joinVoices([trebleVoice]).joinVoices([bassVoice]).format([trebleVoice, bassVoice], formatWidth);
      trebleVoice.draw(context, trebleStave);
      bassVoice.draw(context, bassStave);

      const svg = containerRef.current.querySelector("svg");
      const ns = "http://www.w3.org/2000/svg";
      let lastAnsweredEntryIndex = -1;
      eventGroups.forEach((group, index) => {
        if (group.visibleItems.some((item) => item.status === "correct" || item.status === "wrong")) lastAnsweredEntryIndex = index;
      });
      let lastAnsweredNoteX = null;

      const noteXForIndex = (index) => {
        const trebleNote = trebleVexNotes[index];
        const bassNote = bassVexNotes[index];
        const candidates = [trebleNote, bassNote].map((vexNote) => {
          if (!vexNote) return null;
          const beginX = typeof vexNote.getNoteHeadBeginX === "function" ? vexNote.getNoteHeadBeginX() : null;
          const endX = typeof vexNote.getNoteHeadEndX === "function" ? vexNote.getNoteHeadEndX() : null;
          const absoluteX = typeof vexNote.getAbsoluteX === "function" ? vexNote.getAbsoluteX() : null;
          if (typeof beginX === "number" && typeof endX === "number" && beginX > 0 && endX > 0) return (beginX + endX) / 2;
          if (typeof absoluteX === "number" && absoluteX > 0) return absoluteX;
          return null;
        }).filter((value) => typeof value === "number");
        return candidates[0] ?? (clefReserve + noteStartPadding + index * noteSpacing);
      };

      if (svg) {
        svg.setAttribute("style", "display:block; max-width:none; overflow:visible;");
        svg.setAttribute("width", String(width));
        svg.setAttribute("height", String(height));

        const drawFinalDoubleBar = (stave) => {
          const finalX = staveX + staveWidth;
          const topY = typeof stave.getYForLine === "function" ? stave.getYForLine(0) : trebleY;
          const bottomY = typeof stave.getYForLine === "function" ? stave.getYForLine(4) : topY + 40;
          const cover = document.createElementNS(ns, "rect");
          cover.setAttribute("x", String(finalX - 8));
          cover.setAttribute("y", String(topY - 4));
          cover.setAttribute("width", "10");
          cover.setAttribute("height", String(bottomY - topY + 8));
          cover.setAttribute("fill", "white");
          cover.setAttribute("stroke", "none");
          svg.appendChild(cover);
          for (let line = 0; line <= 4; line += 1) {
            const y = typeof stave.getYForLine === "function" ? stave.getYForLine(line) : topY + line * 10;
            const staffLine = document.createElementNS(ns, "line");
            staffLine.setAttribute("x1", String(finalX - 8));
            staffLine.setAttribute("x2", String(finalX));
            staffLine.setAttribute("y1", String(y));
            staffLine.setAttribute("y2", String(y));
            staffLine.setAttribute("stroke", "#8f8f8f");
            staffLine.setAttribute("stroke-width", "1");
            svg.appendChild(staffLine);
          }
          const thin = document.createElementNS(ns, "line");
          thin.setAttribute("x1", String(finalX - 5.5));
          thin.setAttribute("x2", String(finalX - 5.5));
          thin.setAttribute("y1", String(topY));
          thin.setAttribute("y2", String(bottomY));
          thin.setAttribute("stroke", "#111");
          thin.setAttribute("stroke-width", "1.6");
          svg.appendChild(thin);
          const thick = document.createElementNS(ns, "line");
          thick.setAttribute("x1", String(finalX - 1.25));
          thick.setAttribute("x2", String(finalX - 1.25));
          thick.setAttribute("y1", String(topY));
          thick.setAttribute("y2", String(bottomY));
          thick.setAttribute("stroke", "#111");
          thick.setAttribute("stroke-width", "6");
          thick.setAttribute("stroke-linecap", "butt");
          svg.appendChild(thick);
        };
        drawFinalDoubleBar(trebleStave);
        drawFinalDoubleBar(bassStave);

        eventGroups.forEach((group, index) => {
          const noteX = noteXForIndex(index);
          if (index === lastAnsweredEntryIndex) lastAnsweredNoteX = noteX;
          const trebleYs = typeof trebleVexNotes[index]?.getYs === "function" ? trebleVexNotes[index].getYs() : [];
          const bassYs = typeof bassVexNotes[index]?.getYs === "function" ? bassVexNotes[index].getYs() : [];
          const bassBottomMarkY = (bassStave.getYForLine?.(4) ?? (bassY + 40)) + 28;
          const lowestVisibleY = [...trebleYs, ...bassYs].filter((value) => Number.isFinite(value));
          const statusRowY = Math.max(bassBottomMarkY, (lowestVisibleY.length ? Math.max(...lowestVisibleY) : bassBottomMarkY) + 24);
          const drawMark = (status, x, fixedY) => {
            if (status !== "correct" && status !== "wrong") return;
            const mark = document.createElementNS(ns, "text");
            mark.setAttribute("x", String(x));
            mark.setAttribute("y", String(fixedY));
            mark.setAttribute("text-anchor", "middle");
            mark.setAttribute("dominant-baseline", "middle");
            mark.setAttribute("font-size", "17");
            mark.setAttribute("font-weight", "800");
            mark.setAttribute("fill", status === "correct" ? "#16a34a" : "#dc2626");
            mark.textContent = status === "correct" ? "✓" : "×";
            svg.appendChild(mark);
          };
          const drawStatusRow = (statuses, centerX, y) => {
            const cleanStatuses = (statuses ?? []).filter((status) => status === "correct" || status === "wrong");
            if (!cleanStatuses.length) return;
            const gapX = 14;
            const startX = centerX - ((cleanStatuses.length - 1) * gapX) / 2;
            cleanStatuses.forEach((status, statusIndex) => drawMark(status, startX + statusIndex * gapX, y));
          };

          const answerEntry = entries[index] ?? {};
          const showEventAnswer = reveal || answerEntry.fullyAnswered;
          if (isHarmonicExercise(exercise)) {
            const event = exercise.harmonicEvents?.[index];
            if (event && showEventAnswer) {
              const topLabel = document.createElementNS(ns, "text");
              topLabel.setAttribute("x", String(noteX));
              topLabel.setAttribute("y", String((trebleStave.getYForLine?.(0) ?? trebleY) - 34));
              topLabel.setAttribute("text-anchor", "middle");
              topLabel.setAttribute("font-size", "14");
              topLabel.setAttribute("font-weight", "500");
              topLabel.setAttribute("fill", "#18181b");
              topLabel.textContent = event.sopranoPositionLabel;
              svg.appendChild(topLabel);

              const inversionLabel = document.createElementNS(ns, "text");
              inversionLabel.setAttribute("x", String(noteX));
              inversionLabel.setAttribute("y", String(statusRowY + 22));
              inversionLabel.setAttribute("text-anchor", "middle");
              inversionLabel.setAttribute("font-size", "13");
              inversionLabel.setAttribute("font-weight", "500");
              inversionLabel.setAttribute("fill", "#18181b");
              inversionLabel.textContent = event.inversionLabel ?? "Fund.";
              svg.appendChild(inversionLabel);

              const chordLabel = document.createElementNS(ns, "text");
              chordLabel.setAttribute("x", String(noteX));
              chordLabel.setAttribute("y", String(statusRowY + 38));
              chordLabel.setAttribute("text-anchor", "middle");
              chordLabel.setAttribute("font-size", "13");
              chordLabel.setAttribute("font-weight", "500");
              chordLabel.setAttribute("fill", "#18181b");
              chordLabel.textContent = event.chordSymbol;
              svg.appendChild(chordLabel);
            }
          }

          drawStatusRow(answerEntry.answerStatuses, noteX, statusRowY);

          const playableNotes = isHarmonicExercise(exercise) ? group.targetNotes : group.visibleItems.map((item) => item.note);
          if (typeof onNotePress === "function" && playableNotes.length) {
            const ys = isHarmonicExercise(exercise)
              ? [trebleStave.getYForLine?.(0) ?? 38, bassStave.getYForLine?.(4) ?? 208]
              : [
                ...group.treble.map((_item, itemIndex) => trebleYs[itemIndex] ?? trebleStave.getYForLine?.(2) ?? 78),
                ...group.bass.map((_item, itemIndex) => bassYs[itemIndex] ?? bassStave.getYForLine?.(2) ?? 180),
              ];
            const minY = ys.length ? Math.min(...ys) : trebleStave.getYForLine?.(0) ?? 38;
            const maxY = ys.length ? Math.max(...ys) : bassStave.getYForLine?.(4) ?? 208;
            const hit = document.createElementNS(ns, "rect");
            hit.setAttribute("x", String(noteX - 30));
            hit.setAttribute("y", String(minY - 42));
            hit.setAttribute("width", "60");
            hit.setAttribute("height", String(Math.max(92, maxY - minY + 86)));
            hit.setAttribute("fill", "rgba(0,0,0,0.001)");
            hit.setAttribute("stroke", "none");
            hit.setAttribute("opacity", "0.001");
            hit.setAttribute("pointer-events", "all");
            hit.setAttribute("style", "cursor:pointer; outline:none; pointer-events:all;");
            hit.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              onNotePress(playableNotes);
            });
            svg.appendChild(hit);
          }
        });
      }

      const followLastAnsweredNote = () => {
        const node = scrollRef.current;
        const rendered = containerRef.current;
        if (!node || !rendered || lastAnsweredEntryIndex < 0) {
          updateScrollMetrics();
          return;
        }
        const maxLeft = Math.max(0, node.scrollWidth - node.clientWidth);
        if (maxLeft <= 1) {
          updateScrollMetrics();
          return;
        }
        const fallbackX = clefReserve + noteStartPadding + lastAnsweredEntryIndex * noteSpacing;
        const noteX = typeof lastAnsweredNoteX === "number" ? lastAnsweredNoteX : fallbackX;
        const renderedOffset = Number.isFinite(rendered.offsetLeft) ? rendered.offsetLeft : 0;
        const noteXInScrollContent = renderedOffset + noteX;
        const desiredLeft = noteXInScrollContent - node.clientWidth * (compact ? 0.72 : 0.62);
        const nextLeft = clamp(Math.round(desiredLeft), 0, maxLeft);
        if (Math.abs(nextLeft - node.scrollLeft) > 1) node.scrollLeft = nextLeft;
        updateScrollMetrics();
      };
      window.requestAnimationFrame(() => {
        followLastAnsweredNote();
        window.setTimeout(followLastAnsweredNote, 40);
      });
    } catch (error) {
      console.error("Error al renderizar el sistema de dos claves:", error);
      setRenderError("Hubo un problema al dibujar el pentagrama doble.");
    }
  }, [attempts, exercise, onNotePress, reveal, sequence, updateScrollMetrics]);

  const handlePointerDown = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || node.scrollWidth <= node.clientWidth) return;
    dragRef.current = { active: true, startX: event.clientX, startScrollLeft: node.scrollLeft };
    node.setPointerCapture?.(event.pointerId);
  }, []);
  const handlePointerMove = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || !dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    node.scrollLeft = dragRef.current.startScrollLeft - delta;
    updateScrollMetrics();
  }, [updateScrollMetrics]);
  const stopDrag = useCallback(() => { dragRef.current.active = false; }, []);
  const handleTouchStart = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || node.scrollWidth <= node.clientWidth || !event.touches?.length) return;
    touchRef.current = { active: true, startX: event.touches[0].clientX, startScrollLeft: node.scrollLeft };
  }, []);
  const handleTouchMove = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || !touchRef.current.active || !event.touches?.length) return;
    const delta = event.touches[0].clientX - touchRef.current.startX;
    node.scrollLeft = touchRef.current.startScrollLeft - delta;
    updateScrollMetrics();
  }, [updateScrollMetrics]);
  const stopTouch = useCallback(() => { touchRef.current.active = false; }, []);
  const progress = scrollMetrics.max > 0 ? Math.min(100, Math.max(0, ((scrollMetrics.left + 1) / scrollMetrics.max) * 100)) : 0;

  return (
    <div className="mx-auto w-full max-w-full min-w-0 space-y-2 overflow-hidden" style={{ overflowAnchor: "none" }}>
      <div
        ref={scrollRef}
        onScroll={updateScrollMetrics}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={stopTouch}
        onTouchCancel={stopTouch}
        className="staff-scroll w-full min-w-0 max-w-full cursor-default touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl bg-white px-1 pt-2 pb-2 sm:px-2"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin", touchAction: "pan-x", scrollBehavior: "auto", overscrollBehaviorY: "contain", overflowAnchor: "none" }}
      >
        <div className="flex w-max min-w-full justify-start px-20 sm:w-full sm:justify-center sm:px-0">
          <div ref={containerRef} className="inline-block flex-none align-top" />
        </div>
      </div>
      {scrollMetrics.max > 4 ? (
        <div className="flex items-center gap-2 px-1 sm:hidden">
          <button type="button" onClick={() => scrollStaffBy(-180)} className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">←</button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-zinc-500 transition-all" style={{ width: `${Math.max(16, progress)}%` }} /></div>
          <button type="button" onClick={() => scrollStaffBy(180)} className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">→</button>
        </div>
      ) : null}
      {renderError ? <p className="text-sm text-red-600">{renderError}</p> : null}
    </div>
  );
}

function TonalStaff({ exercise, attempts, reveal, onNotePress }) {
  const clef = exercise?.clef ?? CLEFS[0];
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const touchRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const [renderError, setRenderError] = useState("");
  const [scrollMetrics, setScrollMetrics] = useState({ left: 0, max: 0 });
  const sequence = exercise?.sequence ?? [];

  const updateScrollMetrics = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setScrollMetrics({ left: node.scrollLeft, max: Math.max(0, node.scrollWidth - node.clientWidth) });
  }, []);

  const scrollStaffBy = useCallback((amount) => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({ left: amount, behavior: "smooth" });
    window.setTimeout(updateScrollMetrics, 220);
  }, [updateScrollMetrics]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    setRenderError("");
    if (!sequence.length) return;

    try {
      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = VF;
      const entries = buildVisibleEntryGroups(exercise, attempts, reveal);

      const availableWidth = Math.max(300, scrollRef.current?.clientWidth ?? 650);
      const compact = availableWidth < 560;
      const noteCount = Math.max(1, entries.length);
      // Misma filosofía de espaciado del entrenador de intervalos: el ancho
      // natural se calcula a partir de una separación estable por nota, y la
      // doble barra recibe una reserva explícita para no invadir la última nota.
      const clefReserve = compact ? 122 : 104;
      const noteStartPadding = compact ? 58 : 44;
      const minDesktopSpacing = noteCount >= 22 ? 30 : noteCount >= 18 ? 34 : noteCount >= 14 ? 38 : 42;
      const maxDesktopSpacing = noteCount >= 20 ? 58 : 72;
      const estimatedFinalReserve = compact ? 48 : 36;
      const noteSpacing = compact
        ? noteCount <= 2 ? 92 : noteCount <= 4 ? 82 : 62
        : noteCount <= 2 ? 92 : noteCount <= 4 ? 80 : clamp(Math.floor((availableWidth - clefReserve - estimatedFinalReserve - noteStartPadding) / Math.max(1, noteCount)), minDesktopSpacing, maxDesktopSpacing);
      const finalReserve = Math.max(compact ? 48 : 36, Math.round(noteSpacing * 0.54));
      const naturalWidth = clefReserve + noteStartPadding + finalReserve + Math.max(1, noteCount + 0.5) * noteSpacing;
      let width = noteCount <= 2
        ? Math.min(availableWidth, Math.max(compact ? 300 : 330, naturalWidth))
        : compact
          ? Math.max(Math.min(availableWidth, 360), naturalWidth)
          : Math.min(availableWidth, Math.max(naturalWidth, Math.min(availableWidth, 520)));
      width = Math.max(compact ? 300 : 330, Math.round(width));
      const height = compact ? 214 : 230;
      const staveX = compact ? 0 : 22;
      const staveY = compact ? 52 : 58;
      const staveRightPadding = compact ? 28 : 28;
      const staveWidth = Math.max(180, width - staveX - staveRightPadding);

      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      const stave = new Stave(staveX, staveY, staveWidth);
      if (VF.Barline?.type?.END && typeof stave.setEndBarType === "function") stave.setEndBarType(VF.Barline.type.END);
      addClefToStave(stave, clef);
      addKeySignatureToStave(stave, exercise);
      if (typeof stave.getNoteStartX === "function" && typeof stave.setNoteStartX === "function") {
        stave.setNoteStartX(stave.getNoteStartX() + noteStartPadding);
      }
      stave.setContext(context).draw();

      const signatureMap = keySignatureAccidentalMap(exercise);
      const accidentalState = new Map();
      const noteGroups = entries.map((entry) => {
        if (!entry.visibleNotes.length) {
          const placeholder = entry.targetNotes[0] ?? makeNote({ key: exercise.key, degree: 1, scaleKind: exercise.cadenceMode === "minor" ? "naturalMinor" : "major" });
          return [{ note: placeholder, status: "hidden", visible: false, voiceIndex: 0 }];
        }
        return entry.visibleNotes.map((note, voiceIndex) => ({
          note,
          status: entry.statuses?.[voiceIndex] ?? null,
          visible: true,
          voiceIndex,
        }));
      });

      const vexNotes = noteGroups.map((group) => {
        const allHidden = group.every((item) => item.visible === false);
        if (allHidden) {
          const rest = new StaveNote({ clef: clef.vex, keys: ["b/4"], duration: "wr" });
          if (typeof rest.setStyle === "function") rest.setStyle({ fillStyle: "rgba(0,0,0,0)", strokeStyle: "rgba(0,0,0,0)" });
          return rest;
        }

        const staveNote = new StaveNote({
          clef: clef.vex,
          keys: group.map(({ note }) => staffKey(note)),
          duration: "w",
        });

        group.forEach(({ note, visible }, noteIndex) => {
          if (visible === false) return;
          addDisplayedAccidental(staveNote, Accidental, note, noteIndex, accidentalState, signatureMap);
        });
        return staveNote;
      });

      const spacerNote = new StaveNote({ clef: clef.vex, keys: ["b/4"], duration: "hr" });
      if (typeof spacerNote.setStyle === "function") spacerNote.setStyle({ fillStyle: "rgba(0,0,0,0)", strokeStyle: "rgba(0,0,0,0)" });
      const voice = new Voice({ num_beats: entries.length * 4 + 2, beat_value: 4 });
      if (typeof voice.setMode === "function" && Voice.Mode) voice.setMode(Voice.Mode.SOFT);
      if (typeof voice.setStrict === "function") voice.setStrict(false);
      voice.addTickables([...vexNotes, spacerNote]);
      const formatWidth = compact
        ? Math.max(180, Math.max(1, noteCount + 0.5) * noteSpacing)
        : Math.max(150, width - clefReserve - finalReserve - noteStartPadding);
      new Formatter().joinVoices([voice]).format([voice], formatWidth);
      voice.draw(context, stave);

      const svg = containerRef.current.querySelector("svg");
      const ns = "http://www.w3.org/2000/svg";
      let lastAnsweredEntryIndex = -1;
      entries.forEach((entry, index) => {
        if ((entry.statuses ?? []).some((status) => status === "correct" || status === "wrong")) lastAnsweredEntryIndex = index;
      });
      let lastAnsweredNoteX = null;

      if (svg) {
        svg.setAttribute("style", "display:block; max-width:none; overflow:visible;");
        svg.setAttribute("width", String(width));
        svg.setAttribute("height", String(height));

        const drawFinalDoubleBar = () => {
          const finalX = staveX + staveWidth;
          const topY = typeof stave.getYForLine === "function" ? stave.getYForLine(0) : staveY;
          const bottomY = typeof stave.getYForLine === "function" ? stave.getYForLine(4) : topY + 40;
          const cover = document.createElementNS(ns, "rect");
          cover.setAttribute("x", String(finalX - 8));
          cover.setAttribute("y", String(topY - 4));
          cover.setAttribute("width", "10");
          cover.setAttribute("height", String(bottomY - topY + 8));
          cover.setAttribute("fill", "white");
          cover.setAttribute("stroke", "none");
          svg.appendChild(cover);
          for (let line = 0; line <= 4; line += 1) {
            const y = typeof stave.getYForLine === "function" ? stave.getYForLine(line) : topY + line * 10;
            const staffLine = document.createElementNS(ns, "line");
            staffLine.setAttribute("x1", String(finalX - 8));
            staffLine.setAttribute("x2", String(finalX));
            staffLine.setAttribute("y1", String(y));
            staffLine.setAttribute("y2", String(y));
            staffLine.setAttribute("stroke", "#8f8f8f");
            staffLine.setAttribute("stroke-width", "1");
            svg.appendChild(staffLine);
          }
          const thin = document.createElementNS(ns, "line");
          thin.setAttribute("x1", String(finalX - 5.5));
          thin.setAttribute("x2", String(finalX - 5.5));
          thin.setAttribute("y1", String(topY));
          thin.setAttribute("y2", String(bottomY));
          thin.setAttribute("stroke", "#111");
          thin.setAttribute("stroke-width", "1.6");
          svg.appendChild(thin);
          const thick = document.createElementNS(ns, "line");
          thick.setAttribute("x1", String(finalX - 1.25));
          thick.setAttribute("x2", String(finalX - 1.25));
          thick.setAttribute("y1", String(topY));
          thick.setAttribute("y2", String(bottomY));
          thick.setAttribute("stroke", "#111");
          thick.setAttribute("stroke-width", "6");
          thick.setAttribute("stroke-linecap", "butt");
          svg.appendChild(thick);
        };
        drawFinalDoubleBar();

        entries.forEach((entry, index) => {
          const vexNote = vexNotes[index];
          const beginX = typeof vexNote.getNoteHeadBeginX === "function" ? vexNote.getNoteHeadBeginX() : null;
          const endX = typeof vexNote.getNoteHeadEndX === "function" ? vexNote.getNoteHeadEndX() : null;
          const absoluteX = typeof vexNote.getAbsoluteX === "function" ? vexNote.getAbsoluteX() : 88 + index * 68;
          const noteX = typeof beginX === "number" && typeof endX === "number" ? (beginX + endX) / 2 : absoluteX;
          if (index === lastAnsweredEntryIndex) lastAnsweredNoteX = noteX;
          const ys = typeof vexNote.getYs === "function" ? vexNote.getYs() : [92];
          const group = noteGroups[index].filter((item) => item.visible !== false);

          const belowBaseY = (stave.getYForLine?.(4) ?? (staveY + 40)) + 28;
          const finiteYs = ys.filter((value) => Number.isFinite(value));
          const lowestVisibleY = finiteYs.length ? Math.max(...finiteYs) : belowBaseY;
          const statusRowY = Math.max(belowBaseY, lowestVisibleY + 24);
          const drawMark = (status, x, fixedY) => {
            if (status !== "correct" && status !== "wrong") return;
            const mark = document.createElementNS(ns, "text");
            mark.setAttribute("x", String(x));
            mark.setAttribute("y", String(fixedY));
            mark.setAttribute("text-anchor", "middle");
            mark.setAttribute("dominant-baseline", "middle");
            mark.setAttribute("font-size", "17");
            mark.setAttribute("font-weight", "800");
            mark.setAttribute("fill", status === "correct" ? "#16a34a" : "#dc2626");
            mark.textContent = status === "correct" ? "✓" : "×";
            svg.appendChild(mark);
          };
          const drawStatusRow = (statuses, centerX, y) => {
            const cleanStatuses = (statuses ?? []).filter((status) => status === "correct" || status === "wrong");
            if (!cleanStatuses.length) return;
            const gapX = 14;
            const startX = centerX - ((cleanStatuses.length - 1) * gapX) / 2;
            cleanStatuses.forEach((status, statusIndex) => drawMark(status, startX + statusIndex * gapX, y));
          };

          const answerEntry = entries[index] ?? {};
          const showEventAnswer = reveal || answerEntry.fullyAnswered;
          if (isHarmonicExercise(exercise)) {
            const event = exercise.harmonicEvents?.[index];
            if (event && showEventAnswer) {
              const positionText = document.createElementNS(ns, "text");
              positionText.setAttribute("x", String(noteX));
              positionText.setAttribute("y", String((stave.getYForLine?.(0) ?? staveY) - 26));
              positionText.setAttribute("text-anchor", "middle");
              positionText.setAttribute("font-size", "14");
              positionText.setAttribute("font-weight", "500");
              positionText.setAttribute("fill", "#18181b");
              positionText.textContent = event.sopranoPositionLabel;
              svg.appendChild(positionText);

              const chordText = document.createElementNS(ns, "text");
              chordText.setAttribute("x", String(noteX));
              chordText.setAttribute("y", String(statusRowY + 22));
              chordText.setAttribute("text-anchor", "middle");
              chordText.setAttribute("font-size", "13");
              chordText.setAttribute("font-weight", "500");
              chordText.setAttribute("fill", "#18181b");
              chordText.textContent = event.chordSymbol;
              svg.appendChild(chordText);
            }
          }

          drawStatusRow(answerEntry.answerStatuses, noteX, statusRowY);

          const playableNotes = isHarmonicExercise(exercise) ? (entry.targetNotes ?? []) : group.map((item) => item.note);
          if (typeof onNotePress === "function" && playableNotes.length) {
            const groupYs = isHarmonicExercise(exercise) ? [stave.getYForLine?.(0) ?? 58, stave.getYForLine?.(4) ?? 112] : group.map((_item, groupIndex) => ys[groupIndex] ?? ys[0] ?? 92);
            const minY = groupYs.length ? Math.min(...groupYs) : 58;
            const maxY = groupYs.length ? Math.max(...groupYs) : 112;
            const hit = document.createElementNS(ns, "rect");
            hit.setAttribute("x", String(noteX - 28));
            hit.setAttribute("y", String(minY - 38));
            hit.setAttribute("width", "56");
            hit.setAttribute("height", String(Math.max(76, maxY - minY + 76)));
            hit.setAttribute("fill", "rgba(0,0,0,0.001)");
            hit.setAttribute("stroke", "none");
            hit.setAttribute("opacity", "0.001");
            hit.setAttribute("pointer-events", "all");
            hit.setAttribute("style", "cursor:pointer; outline:none; pointer-events:all;");
            hit.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              onNotePress(playableNotes);
            });
            svg.appendChild(hit);
          }
        });
      }

      const followLastAnsweredNote = () => {
        const node = scrollRef.current;
        const rendered = containerRef.current;
        if (!node || !rendered || lastAnsweredEntryIndex < 0) {
          updateScrollMetrics();
          return;
        }
        const maxLeft = Math.max(0, node.scrollWidth - node.clientWidth);
        if (maxLeft <= 1) {
          updateScrollMetrics();
          return;
        }
        const fallbackX = clefReserve + noteStartPadding + lastAnsweredEntryIndex * noteSpacing;
        const noteX = typeof lastAnsweredNoteX === "number" ? lastAnsweredNoteX : fallbackX;
        const renderedOffset = Number.isFinite(rendered.offsetLeft) ? rendered.offsetLeft : 0;
        const noteXInScrollContent = renderedOffset + noteX;
        const targetViewportRatio = compact ? 0.72 : 0.62;
        const desiredLeft = noteXInScrollContent - node.clientWidth * targetViewportRatio;
        const nextLeft = clamp(Math.round(desiredLeft), 0, maxLeft);
        if (Math.abs(nextLeft - node.scrollLeft) > 1) node.scrollLeft = nextLeft;
        updateScrollMetrics();
      };
      window.requestAnimationFrame(() => {
        followLastAnsweredNote();
        window.setTimeout(followLastAnsweredNote, 40);
      });
    } catch (error) {
      console.error("Error al renderizar la partitura:", error);
      setRenderError("Hubo un problema al dibujar la partitura.");
    }
  }, [attempts, clef, exercise, onNotePress, reveal, sequence, updateScrollMetrics]);

  const handlePointerDown = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || node.scrollWidth <= node.clientWidth) return;
    dragRef.current = { active: true, startX: event.clientX, startScrollLeft: node.scrollLeft };
    node.setPointerCapture?.(event.pointerId);
  }, []);
  const handlePointerMove = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || !dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    node.scrollLeft = dragRef.current.startScrollLeft - delta;
    updateScrollMetrics();
  }, [updateScrollMetrics]);
  const stopDrag = useCallback(() => { dragRef.current.active = false; }, []);
  const handleTouchStart = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || node.scrollWidth <= node.clientWidth || !event.touches?.length) return;
    touchRef.current = { active: true, startX: event.touches[0].clientX, startScrollLeft: node.scrollLeft };
  }, []);
  const handleTouchMove = useCallback((event) => {
    const node = scrollRef.current;
    if (!node || !touchRef.current.active || !event.touches?.length) return;
    const delta = event.touches[0].clientX - touchRef.current.startX;
    node.scrollLeft = touchRef.current.startScrollLeft - delta;
    updateScrollMetrics();
  }, [updateScrollMetrics]);
  const stopTouch = useCallback(() => { touchRef.current.active = false; }, []);
  const progress = scrollMetrics.max > 0 ? Math.min(100, Math.max(0, ((scrollMetrics.left + 1) / scrollMetrics.max) * 100)) : 0;

  return (
    <div className="mx-auto w-full max-w-full min-w-0 space-y-2 overflow-hidden" style={{ overflowAnchor: "none" }}>
      <div
        ref={scrollRef}
        onScroll={updateScrollMetrics}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={stopTouch}
        onTouchCancel={stopTouch}
        className="staff-scroll w-full min-w-0 max-w-full cursor-default touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl bg-white px-1 pt-2 pb-2 sm:px-2"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin", touchAction: "pan-x", scrollBehavior: "auto", overscrollBehaviorY: "contain", overflowAnchor: "none" }}
      >
        <div className="flex w-max min-w-full justify-start px-20 sm:w-full sm:justify-center sm:px-0">
          <div ref={containerRef} className="inline-block flex-none align-top" />
        </div>
      </div>
      {scrollMetrics.max > 4 ? (
        <div className="flex items-center gap-2 px-1 sm:hidden">
          <button type="button" onClick={() => scrollStaffBy(-180)} className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">←</button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-zinc-500 transition-all" style={{ width: `${Math.max(16, progress)}%` }} /></div>
          <button type="button" onClick={() => scrollStaffBy(180)} className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">→</button>
        </div>
      ) : null}
      {renderError ? <p className="text-sm text-red-600">{renderError}</p> : null}
    </div>
  );
}


function HarmonicChordPlaybackLine({
  events,
  playbackStartIndex,
  playbackCursorIndex,
  isPlaying,
  onTogglePlay,
  onSelectPlaybackPoint,
  arpeggioSpeed,
  onChangeArpeggioSpeed,
  onPlayArpeggio,
}) {
  if (!events?.length || events.length <= 1) return null;
  const maxIndex = Math.max(0, events.length - 1);
  const activeIndex = clamp(isPlaying ? playbackCursorIndex : playbackStartIndex, 0, maxIndex);
  const activeEvent = events[activeIndex] ?? events[0];
  const speedOptions = HARMONIC_ARPEGGIO_SPEED_OPTIONS;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Línea de reproducción</p>
          <p className="text-xs font-semibold text-zinc-800">{activeEvent?.label ?? "Inicio"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isPlaying ? "aural-black-button" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-50"}`}
          >
            {isPlaying ? "Detener" : "Escuchar desde aquí"}
          </button>
          <div className="flex items-center gap-1 rounded-xl border border-zinc-300 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => onPlayArpeggio?.(activeIndex)}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100"
              title="Reproducir arpegio del acorde seleccionado"
            >
              Arpegio
            </button>
            <select
              value={arpeggioSpeed}
              onChange={(event) => onChangeArpeggioSpeed?.(event.target.value)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 outline-none transition hover:border-zinc-400 focus:border-zinc-500"
              aria-label="Velocidad del arpegio"
            >
              {speedOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="mt-1.5 space-y-1">
        <div className="relative pt-0.5 pb-2.5">
          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={activeIndex}
            onChange={(event) => onSelectPlaybackPoint(Number(event.target.value))}
            className="aural-range-input aural-playback-range relative z-20 w-full"
            style={rangeFillStyle(activeIndex, 0, maxIndex)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3.5">
            {events.map((event, index) => {
              const fraction = events.length <= 1 ? 0 : index / (events.length - 1);
              const isActiveTick = index === activeIndex;
              const widthPx = isActiveTick ? 3 : 2;
              const heightPx = isActiveTick ? 12 : 8;
              const color = isActiveTick ? "#111827" : "#8a8a93";
              const trackInsetPx = 11;
              const leftOffsetPx = trackInsetPx * (1 - 2 * fraction) - (widthPx / 2);
              return (
                <span
                  key={`harmonic-playback-tick-${index}`}
                  className="absolute top-[2px] rounded-[1px]"
                  style={{
                    left: `calc(${(fraction * 100).toFixed(6)}% + ${leftOffsetPx.toFixed(3)}px)`,
                    width: `${widthPx}px`,
                    height: `${heightPx}px`,
                    backgroundColor: color,
                  }}
                  aria-hidden="true"
                />
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 h-4">
            {events.map((event, index) => {
              const fraction = events.length <= 1 ? 0 : index / (events.length - 1);
              const trackInsetPx = 11;
              const buttonSizePx = 16;
              const leftOffsetPx = trackInsetPx * (1 - 2 * fraction) - (buttonSizePx / 2);
              return (
                <button
                  key={`harmonic-playback-select-${index}`}
                  type="button"
                  aria-label={`Seleccionar ${event.label}`}
                  title={event.detail ?? event.label}
                  onClick={() => onSelectPlaybackPoint(index)}
                  className="absolute top-0 h-4 w-4 rounded-full bg-transparent"
                  style={{ left: `calc(${(fraction * 100).toFixed(6)}% + ${leftOffsetPx.toFixed(3)}px)` }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>1</span>
          <span>{events.length}</span>
        </div>
      </div>
    </div>
  );
}

function FormulaSummary({ exercise }) {
  const formulas = (exercise?.sequence ?? []).map((note) => note.formulaLabel).filter((label) => label && !/tónica/i.test(label));
  const unique = [...new Set(formulas)];
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold text-zinc-900">Fórmulas alteradas escuchadas</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {unique.length ? unique.map((label) => <Badge key={label}>{label}</Badge>) : <span className="text-xs text-zinc-500">Sin fórmulas alteradas.</span>}
      </div>
    </div>
  );
}


function AlteredDegreeSelector({ mode, label, selectedTokens, onToggle, onSelectAll, onDeselectAll }) {
  const options = ALTERED_DEGREE_OPTIONS_BY_MODE[mode] ?? [];
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSelectAll} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todos</button>
          <button type="button" onClick={onDeselectAll} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Deseleccionar todos</button>
          <Badge>{selectedTokens.length} activos</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <SelectionChip key={item.token} active={selectedTokens.includes(item.token)} onClick={() => onToggle(item.token)} title={item.title}>
            {item.label}
          </SelectionChip>
        ))}
      </div>
    </div>
  );
}

function MinorScaleSelector({ selectedScales, onToggle, onSelectAll, onDeselectAll }) {
  const options = [
    { key: "naturalMinor", label: "Menor natural" },
    { key: "harmonicMinor", label: "Menor armónica" },
    { key: "melodicMinor", label: "Menor melódica" },
  ];
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Escalas menores</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onSelectAll} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todas</button>
          <button type="button" onClick={onDeselectAll} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Deseleccionar todas</button>
          <Badge>{selectedScales.length} activas</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <SelectionChip key={item.key} active={selectedScales.includes(item.key)} onClick={() => onToggle(item.key)}>
            {item.label}
          </SelectionChip>
        ))}
      </div>
    </div>
  );
}

function PianoKeyboard({ onPress, disabled = false, onPressStart = null }) {
  const whiteKeys = PIANO_KEYS.filter((key) => key.type === "white");
  const blackKeys = PIANO_KEYS.filter((key) => key.type === "black");
  const lastPressAtRef = useRef(0);
  const verticalScrollLockRef = useRef(null);

  const holdVerticalScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const top = window.scrollY ?? window.pageYOffset ?? 0;
    const left = window.scrollX ?? window.pageXOffset ?? 0;
    const restore = () => {
      try {
        window.scrollTo({ left, top, behavior: "auto" });
      } catch {
        window.scrollTo(left, top);
      }
    };
    restore();
    if (verticalScrollLockRef.current) {
      verticalScrollLockRef.current.forEach((id) => clearTimeout(id));
    }
    requestAnimationFrame(restore);
    verticalScrollLockRef.current = [0, 40, 100, 180, 280].map((delay) => setTimeout(restore, delay));
  }, []);

  useEffect(() => () => {
    if (verticalScrollLockRef.current) verticalScrollLockRef.current.forEach((id) => clearTimeout(id));
  }, []);

  const triggerKey = useCallback((event, pc) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget?.blur?.();
    if (disabled) return;
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    const elapsed = now - lastPressAtRef.current;
    if (event.type === "click" && elapsed < 700) return;
    if (event.type !== "click" && elapsed < 60) return;
    lastPressAtRef.current = now;
    holdVerticalScrollPosition();
    onPressStart?.(event);
    onPress(pc);
    holdVerticalScrollPosition();
  }, [disabled, holdVerticalScrollPosition, onPress, onPressStart]);

  const handleKeyDown = useCallback((event, pc) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    triggerKey(event, pc);
  }, [triggerKey]);

  return (
    <div className="mx-auto w-full max-w-2xl pt-3 sm:pt-4" style={{ overflowAnchor: "none" }}>
      <div className="piano-keyboard-shell relative h-28 w-full select-none overflow-visible rounded-b-2xl border border-zinc-300 bg-zinc-200 p-1.5 shadow-sm sm:h-32 sm:p-2">
        <div className="flex h-full gap-0.5 sm:gap-1">
          {whiteKeys.map((key) => (
            <button
              type="button"
              key={key.pc}
              disabled={disabled}
              onPointerDown={(event) => triggerKey(event, key.pc)}
              onTouchStart={(event) => triggerKey(event, key.pc)}
              onClick={(event) => triggerKey(event, key.pc)}
              onKeyDown={(event) => handleKeyDown(event, key.pc)}
              tabIndex={-1}
              className={`piano-white-key relative flex flex-1 touch-manipulation items-end justify-center rounded-b-xl border border-zinc-300 bg-white pb-2 text-[10px] font-semibold text-zinc-700 transition hover:bg-zinc-100 sm:pb-3 sm:text-xs ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {key.display}
            </button>
          ))}
        </div>
        {blackKeys.map((key) => (
          <button
            type="button"
            key={key.pc}
            disabled={disabled}
            onPointerDown={(event) => triggerKey(event, key.pc)}
            onTouchStart={(event) => triggerKey(event, key.pc)}
            onClick={(event) => triggerKey(event, key.pc)}
            onKeyDown={(event) => handleKeyDown(event, key.pc)}
            tabIndex={-1}
            className={`piano-black-key absolute top-1.5 z-10 flex h-[62px] w-[9.5%] touch-manipulation items-start justify-center rounded-b-lg bg-zinc-950 px-1 pt-2 text-center text-[8px] font-semibold leading-tight text-white transition hover:bg-zinc-800 sm:top-2 sm:h-[74px] sm:text-[9px] ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            style={{ left: key.left }}
          >
            <span className="piano-black-key-label absolute -top-5 left-1/2 w-14 -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-1 py-1 text-[8px] font-semibold leading-none text-zinc-700 shadow-sm sm:-top-6 sm:w-20 sm:px-2 sm:text-[10px]">
              {key.display}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TunerStrip({ cents, label, sublabel, micEnabled, active, centsHistoryRef, centsHistoryIdxRef, compact = false, holdProgress = 0, completed = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);
    const darkMode = Boolean(canvas.closest(".app-theme-dark"));

    const xForCents = (value) => w / 2 + (clamp(value, -TUNER_RANGE_CENTS, TUNER_RANGE_CENTS) / TUNER_RANGE_CENTS) * (w / 2 - 7);
    const greenLeft = xForCents(-IN_TUNE_THRESHOLD);
    const greenRight = xForCents(IN_TUNE_THRESHOLD);

    // Centro de afinación limpio, sin difuminado rojizo lateral.
    // En claro mantiene el aspecto suave original; en oscuro usa una franja más sobria.
    ctx.fillStyle = completed
      ? (darkMode ? "#7ea095" : "#b7e4cd")
      : (darkMode ? "#6f8a82" : "#cfeee0");
    ctx.fillRect(greenLeft, 0, Math.max(2, greenRight - greenLeft), h);

    ctx.strokeStyle = darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    [-50, -25, 0, 25, 50].forEach((mark) => {
      const x = xForCents(mark);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });

    ctx.strokeStyle = completed
      ? (darkMode ? "rgba(16,185,129,0.78)" : "rgba(5,150,105,0.75)")
      : (darkMode ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.38)");
    ctx.lineWidth = completed ? 2 : (darkMode ? 1.35 : 1.25);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Historial vertical invertido: la lectura más reciente nace en la punta
    // superior de la línea azul/verde actual y las lecturas anteriores se van
    // desplazando hacia abajo. Eje X = cents, eje Y = antigüedad.
    if (active && centsHistoryRef?.current) {
      const buf = centsHistoryRef.current;
      const len = buf.length;
      const idx = centsHistoryIdxRef.current;
      let drawing = false;
      let previousInTune = false;
      for (let i = 0; i < len; i += 1) {
        const j = ((idx - 1 - i) % len + len) % len;
        const value = buf[j];
        if (!Number.isFinite(value)) {
          if (drawing) ctx.stroke();
          drawing = false;
          previousInTune = false;
          continue;
        }
        const x = xForCents(value);
        const y = (i / Math.max(1, len - 1)) * h;
        const isInTune = Math.abs(value) <= IN_TUNE_THRESHOLD;
        if (!drawing) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = isInTune ? (darkMode ? "#10b981" : "#047857") : (darkMode ? "#d1d5db" : "#0f172a");
          ctx.lineWidth = isInTune ? 2 : (darkMode ? 1.65 : 1.45);
          drawing = true;
        } else if (isInTune !== previousInTune) {
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = isInTune ? (darkMode ? "#10b981" : "#047857") : (darkMode ? "#d1d5db" : "#0f172a");
          ctx.lineWidth = isInTune ? 2 : (darkMode ? 1.65 : 1.45);
        } else {
          ctx.lineTo(x, y);
        }
        previousInTune = isInTune;
      }
      if (drawing) ctx.stroke();
    }
  }, [active, cents, centsHistoryIdxRef, centsHistoryRef, completed, micEnabled]);

  const valid = cents !== null && cents !== undefined && !Number.isNaN(cents);
  const clamped = valid ? clamp(cents, -TUNER_RANGE_CENTS, TUNER_RANGE_CENTS) : 0;
  const linePct = 50 + (clamped / TUNER_RANGE_CENTS) * 50;
  const inTune = valid && Math.abs(cents) <= IN_TUNE_THRESHOLD;
  const bandLeft = 50 - (IN_TUNE_THRESHOLD / TUNER_RANGE_CENTS) * 50;
  const bandWidth = (IN_TUNE_THRESHOLD * 2 / TUNER_RANGE_CENTS) * 50;

  return (
    <div className={`aural-tuner-strip rounded-xl border bg-white p-2 transition ${completed ? "aural-tuner-completed border-emerald-400 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.22)]" : inTune ? "aural-tuner-in-tune border-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]" : "border-zinc-200"}`}>
      <div className="relative h-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 sm:h-[4.75rem]">
        <canvas ref={canvasRef} className="block h-full w-full" />
        <div className="aural-tuner-center-line pointer-events-none absolute inset-y-0 left-1/2 w-px bg-zinc-900/45" />
        {valid ? (
          <div
            className={`pointer-events-none absolute top-0 h-full w-0.5 transition-[left,background-color] duration-75 ease-linear ${inTune ? "aural-tuner-current-line-in" : "aural-tuner-current-line-out"}`}
            style={{ left: `${clamp(linePct, 0, 100)}%` }}
          />
        ) : null}
      </div>
      <div className="aural-tuner-hold-track mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div className={`h-full rounded-full transition-[width,background-color] duration-150 ease-linear ${completed ? "bg-emerald-600" : "bg-emerald-500"}`} style={{ width: `${Math.round(holdProgress * 100)}%` }} />
      </div>
    </div>
  );
}

function TunerPanel({ notes = [], visible = false }) {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const centsHistoryRef = useRef(new Float32Array(PITCH_HISTORY_LEN).fill(NaN));
  const centsHistoryIdxRef = useRef(0);
  const accumulatedHoldMsRef = useRef(0);
  const lastCenteredAtRef = useRef(null);
  const lastDetectionAtRef = useRef(null);
  const completedRef = useRef(new Set());
  const completionTimeoutRef = useRef(null);
  const isCompletingRef = useRef(false);
  const modeRef = useRef("study");
  const targetIndexRef = useRef(0);
  const notesRef = useRef(notes);
  const holdSecondsRef = useRef(1);
  const lastCentsRef = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState("study");
  const [targetIndex, setTargetIndex] = useState(0);
  const [detectedHz, setDetectedHz] = useState(null);
  const [detectedLabel, setDetectedLabel] = useState("—");
  const [cents, setCents] = useState(null);
  const [holdSeconds, setHoldSeconds] = useState(1);
  const [holdProgress, setHoldProgress] = useState(0);
  const [completedFlash, setCompletedFlash] = useState(false);

  const targetNote = notes[targetIndex] ?? null;
  const detectedMidi = detectedHz ? frequencyToNearestMidi(detectedHz) : null;
  const samePitchClass = mode !== "study" || !targetNote || (detectedMidi != null && pitchClassOf(detectedMidi) === pitchClassOf(targetNote));
  const inTune = Number.isFinite(cents) && Math.abs(cents) <= IN_TUNE_THRESHOLD && samePitchClass;
  const activeNoteName = mode === "study" && targetNote ? targetNote.label : detectedLabel;
  const notesSignature = useMemo(() => notes.map((note) => `${note.midi}:${note.label}`).join("|"), [notes]);
  const holdOptionIndex = useMemo(() => {
    const exactIndex = TUNER_HOLD_OPTIONS.findIndex((seconds) => seconds === holdSeconds);
    if (exactIndex >= 0) return exactIndex;
    return TUNER_HOLD_OPTIONS.reduce((bestIndex, seconds, candidateIndex) => (
      Math.abs(seconds - holdSeconds) < Math.abs(TUNER_HOLD_OPTIONS[bestIndex] - holdSeconds) ? candidateIndex : bestIndex
    ), 0);
  }, [holdSeconds]);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { targetIndexRef.current = targetIndex; }, [targetIndex]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { holdSecondsRef.current = holdSeconds; }, [holdSeconds]);

  useEffect(() => {
    setHoldProgress(Math.min(1, accumulatedHoldMsRef.current / (holdSeconds * 1000)));
  }, [holdSeconds]);

  const resetCurrentTargetProgress = useCallback((clearHistory = false) => {
    if (completionTimeoutRef.current) window.clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = null;
    isCompletingRef.current = false;
    setCompletedFlash(false);
    setHoldProgress(0);
    accumulatedHoldMsRef.current = 0;
    lastCenteredAtRef.current = null;
    if (clearHistory) {
      centsHistoryRef.current.fill(NaN);
      centsHistoryIdxRef.current = 0;
      lastCentsRef.current = null;
    }
  }, []);

  const resetTunerState = useCallback(() => {
    if (completionTimeoutRef.current) window.clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = null;
    isCompletingRef.current = false;
    setTargetIndex(0);
    targetIndexRef.current = 0;
    setDetectedHz(null);
    setDetectedLabel("—");
    setCents(null);
    setHoldProgress(0);
    setCompletedFlash(false);
    completedRef.current = new Set();
    accumulatedHoldMsRef.current = 0;
    lastCenteredAtRef.current = null;
    lastDetectionAtRef.current = null;
    lastCentsRef.current = null;
    centsHistoryRef.current.fill(NaN);
    centsHistoryIdxRef.current = 0;
  }, []);

  useEffect(() => { resetTunerState(); }, [notesSignature, resetTunerState]);

  const stopListening = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (completionTimeoutRef.current) window.clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}
    try {
      if (streamRef.current && streamRef.current !== sharedAuralMicrophoneStream) {
        streamRef.current.getTracks()?.forEach((track) => track.stop());
      }
    } catch {}
    sourceRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    setIsListening(false);
    lastCenteredAtRef.current = null;
    isCompletingRef.current = false;
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  const setTargetManually = useCallback((nextIndex) => {
    const list = notesRef.current ?? [];
    const bounded = clamp(nextIndex, 0, Math.max(0, list.length - 1));
    targetIndexRef.current = bounded;
    setTargetIndex(bounded);
    resetCurrentTargetProgress(false);
  }, [resetCurrentTargetProgress]);

  const advanceTarget = useCallback(() => {
    const list = notesRef.current ?? [];
    completedRef.current.add(targetIndexRef.current);
    const next = targetIndexRef.current < list.length - 1 ? targetIndexRef.current + 1 : targetIndexRef.current;
    targetIndexRef.current = next;
    setTargetIndex(next);
    resetCurrentTargetProgress(false);
  }, [resetCurrentTargetProgress]);

  const completeCurrentTarget = useCallback(() => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    completedRef.current.add(targetIndexRef.current);
    setCompletedFlash(true);
    setHoldProgress(1);
    if (completionTimeoutRef.current) window.clearTimeout(completionTimeoutRef.current);
    completionTimeoutRef.current = window.setTimeout(() => {
      const list = notesRef.current ?? [];
      if (targetIndexRef.current < list.length - 1) {
        advanceTarget();
      } else {
        isCompletingRef.current = false;
        setCompletedFlash(true);
        accumulatedHoldMsRef.current = holdSecondsRef.current * 1000;
        setHoldProgress(1);
      }
    }, TUNER_COMPLETE_DELAY_MS);
  }, [advanceTarget]);

  const adjustHoldSeconds = useCallback((direction) => {
    const current = holdSecondsRef.current;
    let index = TUNER_HOLD_OPTIONS.findIndex((seconds) => seconds === current);
    if (index < 0) {
      index = TUNER_HOLD_OPTIONS.reduce((bestIndex, seconds, candidateIndex) => (
        Math.abs(seconds - current) < Math.abs(TUNER_HOLD_OPTIONS[bestIndex] - current) ? candidateIndex : bestIndex
      ), 0);
    }
    const nextIndex = clamp(index + direction, 0, TUNER_HOLD_OPTIONS.length - 1);
    setHoldSeconds(TUNER_HOLD_OPTIONS[nextIndex]);
  }, []);

  const analyse = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioContextRef.current;
    if (!analyser || !ctx) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    const freq = autoCorrelatePitch(buffer, ctx.sampleRate, TUNER_YIN_THRESHOLD);
    const now = performance.now();
    const activeMode = modeRef.current;
    const list = notesRef.current ?? [];
    const activeTarget = list[targetIndexRef.current] ?? null;

    if (!freq) {
      const lastDetection = lastDetectionAtRef.current;
      const silenceMs = lastDetection ? now - lastDetection : Infinity;

      // Microcortes: no limpiamos la lectura ni el progreso inmediatamente.
      if (lastDetection && silenceMs <= TUNER_MICRO_GAP_MS) return;

      lastCenteredAtRef.current = null;

      if (silenceMs <= TUNER_STALE_DISPLAY_MS && Number.isFinite(lastCentsRef.current)) {
        // Mantiene una cola visual muy breve para que el trazo no parpadee.
        centsHistoryRef.current[centsHistoryIdxRef.current] = lastCentsRef.current;
        centsHistoryIdxRef.current = (centsHistoryIdxRef.current + 1) % PITCH_HISTORY_LEN;
        return;
      }

      // Después de un silencio real, limpiamos la lectura. Esto evita que la línea
      // del afinador quede congelada aunque ya no haya señal fiable.
      lastCentsRef.current = null;
      centsHistoryRef.current[centsHistoryIdxRef.current] = NaN;
      centsHistoryIdxRef.current = (centsHistoryIdxRef.current + 1) % PITCH_HISTORY_LEN;
      setDetectedHz(null);
      setDetectedLabel("—");
      setCents(null);
      return;
    }

    lastDetectionAtRef.current = now;

    const nearestMidi = frequencyToNearestMidi(freq);
    let rawCents = null;
    let noteIsRelevant = true;

    if (activeMode === "study" && activeTarget) {
      rawCents = centsOffFromPitchClass(freq, activeTarget.midi);
      noteIsRelevant = pitchClassOf(nearestMidi) === pitchClassOf(activeTarget);
    } else {
      rawCents = centsOffFromNearestChromatic(freq);
      noteIsRelevant = true;
    }

    if (rawCents == null) return;

    const previousCents = lastCentsRef.current;
    const displayCents = Number.isFinite(previousCents) && noteIsRelevant
      ? previousCents + (rawCents - previousCents) * PITCH_SMOOTH_ALPHA
      : rawCents;

    lastCentsRef.current = displayCents;
    centsHistoryRef.current[centsHistoryIdxRef.current] = displayCents;
    centsHistoryIdxRef.current = (centsHistoryIdxRef.current + 1) % PITCH_HISTORY_LEN;

    setDetectedHz(freq);
    setDetectedLabel(midiToSimpleNote(nearestMidi).label);
    setCents(displayCents);

    if (activeMode === "study" && activeTarget) {
      if (isCompletingRef.current) return;
      const centered = noteIsRelevant && Math.abs(displayCents) <= IN_TUNE_THRESHOLD;
      if (centered) {
        const last = lastCenteredAtRef.current;
        const delta = last ? Math.min(100, Math.max(0, now - last)) : 0;
        accumulatedHoldMsRef.current += delta;
        lastCenteredAtRef.current = now;
        const progress = Math.min(1, accumulatedHoldMsRef.current / (holdSecondsRef.current * 1000));
        setHoldProgress(progress);
        if (progress >= 1) completeCurrentTarget();
      } else {
        const last = lastCenteredAtRef.current;
        if (!last || now - last > TUNER_HOLD_GRACE_MS) lastCenteredAtRef.current = null;
        setHoldProgress(Math.min(1, accumulatedHoldMsRef.current / (holdSecondsRef.current * 1000)));
      }
    } else {
      lastCenteredAtRef.current = null;
      setHoldProgress(0);
      setCompletedFlash(false);
    }
  }, [completeCurrentTarget]);

  const startListening = useCallback(async () => {
    if (isListening && analyserRef.current) return;
    try {
      const sharedCtx = getSharedAuralAudioContext();
      if (!sharedCtx) throw new Error("Web Audio API no disponible en este navegador");
      audioContextRef.current = sharedCtx;
      if (audioContextRef.current.state !== "running") await audioContextRef.current.resume();
      const stream = await requestSharedAuralMicrophoneStream();
      const ctx = audioContextRef.current;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      streamRef.current = stream;
      sourceRef.current = source;
      analyserRef.current = analyser;
      setIsListening(true);
      lastDetectionAtRef.current = null;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(analyse, TUNER_ANALYSIS_INTERVAL_MS);
    } catch (error) {
      console.error("No se pudo iniciar el afinador:", error);
      setIsListening(false);
    }
  }, [analyse, isListening]);

  if (!visible || !notes.length) return null;

  return (
    <div className={`aural-tuner-panel mx-auto mt-2 w-full max-w-none rounded-2xl border p-2.5 transition ${completedFlash ? "aural-tuner-completed border-emerald-400 bg-emerald-50/90" : inTune ? "aural-tuner-in-tune border-emerald-300 bg-emerald-50/70" : "border-zinc-200 bg-zinc-50"}`}>
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
          <button type="button" onClick={() => setMode("study")} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${mode === "study" ? "aural-black-button" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50"}`}>Estudio</button>
          <button type="button" onClick={() => setMode("free")} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${mode === "free" ? "aural-black-button" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50"}`}>Libre</button>
          {mode === "study" ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">{targetIndex + 1}/{notes.length}</span> : null}
        </div>

        <div className="text-center">
          {mode === "study" ? (
            <div className="mb-1 flex min-h-[1.55rem] items-center justify-center">
              {detectedLabel !== "—" ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${samePitchClass ? "aural-status-pill" : "border-zinc-200 bg-white text-zinc-700"}`}>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.16em] ${samePitchClass ? "aural-status-kicker" : "text-zinc-400"}`}>detectada</span>
                  <span className={`tabular-nums ${samePitchClass ? "aural-status-value" : "text-zinc-950"}`}>{detectedLabel}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {mode === "study" ? (
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => setTargetManually(targetIndexRef.current - 1)} className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">←</button>
              <div className="min-w-[92px] text-center">
                <div className={`text-2xl font-bold leading-none tracking-tight sm:text-3xl ${completedFlash ? "text-emerald-700" : "text-zinc-950"}`}>{activeNoteName}</div>
              </div>
              <button type="button" onClick={() => setTargetManually(targetIndexRef.current + 1)} className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">→</button>
            </div>
          ) : (
            <div className="min-w-[92px] text-center text-2xl font-bold leading-none tracking-tight text-zinc-950 sm:text-3xl">{activeNoteName}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold text-zinc-500">
            <span className="tabular-nums">{Number.isFinite(cents) ? `${cents > 0 ? "+" : ""}${cents.toFixed(1)} cents` : "—"}</span>
            {Number.isFinite(detectedHz) ? (
              <>
                <span className="text-zinc-300">·</span>
                <span className="tabular-nums">{detectedHz.toFixed(1)} Hz</span>
              </>
            ) : null}
            {completedFlash ? <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold leading-none text-white">✓</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
          {mode === "study" ? (
            <div className="inline-flex items-center gap-1" title="Segundos necesarios para completar cada nota">
              <button
                type="button"
                onClick={() => adjustHoldSeconds(-1)}
                disabled={holdOptionIndex <= 0}
                className="inline-flex h-7 min-w-[1.95rem] items-center justify-center rounded-full border border-zinc-300 bg-white px-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:border-zinc-300 disabled:hover:bg-white"
                aria-label="Disminuir segundos"
              >
                ‹
              </button>
              <span className="inline-flex h-7 min-w-[2.45rem] items-center justify-center rounded-full border border-zinc-300 bg-white px-2 text-center text-[11px] font-semibold tabular-nums text-zinc-700">
                {holdSeconds}s
              </span>
              <button
                type="button"
                onClick={() => adjustHoldSeconds(1)}
                disabled={holdOptionIndex >= TUNER_HOLD_OPTIONS.length - 1}
                className="inline-flex h-7 min-w-[1.95rem] items-center justify-center rounded-full border border-zinc-300 bg-white px-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:border-zinc-300 disabled:hover:bg-white"
                aria-label="Aumentar segundos"
              >
                ›
              </button>
            </div>
          ) : null}
          {isListening ? <span className="aural-status-pill rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm">Mic activo</span> : <button type="button" onClick={startListening} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50">Activar micrófono</button>}
        </div>
      </div>

      <TunerStrip
        cents={cents}
        label={mode === "study" ? activeNoteName : detectedLabel}
        sublabel={mode === "study" ? "objetivo · cualquier octava" : "nota más cercana en 12-TET"}
        micEnabled={isListening}
        active={isListening}
        centsHistoryRef={centsHistoryRef}
        centsHistoryIdxRef={centsHistoryIdxRef}
        holdProgress={mode === "study" ? holdProgress : 0}
        completed={completedFlash}
        compact
      />
    </div>
  );
}


export default function TonalFunctionsTrainer() {
  useGoogleFonts();
  const saved = useMemo(() => (typeof window !== "undefined" ? initialSettings() : defaultSettings()), []);
  const savedStats = useMemo(() => (typeof window !== "undefined" ? initialStats() : { totalSeconds: 0, exercises: 0, correct: 0, incorrect: 0 }), []);
  const savedMarks = useMemo(() => (typeof window !== "undefined" ? initialMarks() : []), []);
  const [trainerMode, setTrainerMode] = useState(saved.trainerMode);
  const [noteCount, setNoteCount] = useState(saved.noteCount);
  const [selectedDegrees, setSelectedDegrees] = useState(saved.selectedDegrees);
  const [selectedKeys, setSelectedKeys] = useState(saved.selectedKeys);
  const [selectedClefs, setSelectedClefs] = useState(saved.selectedClefs ?? ["treble"]);
  const [modeScope, setModeScope] = useState(saved.modeScope);
  const [minorScales, setMinorScales] = useState(saved.minorScales);
  const [includeAltered, setIncludeAltered] = useState(saved.includeAltered);
  const [alteredForms, setAlteredForms] = useState(saved.alteredForms);
  const [selectedAlteredMajorTokens, setSelectedAlteredMajorTokens] = useState(saved.selectedAlteredMajorTokens);
  const [selectedAlteredMinorTokens, setSelectedAlteredMinorTokens] = useState(saved.selectedAlteredMinorTokens);
  const [repeatEachNote, setRepeatEachNote] = useState(saved.repeatEachNote);
  const [speed, setSpeed] = useState(saved.trainerMode === "harmonicFunctions" ? DEFAULT_HARMONIC_SPEED : saved.speed);
  const [volume, setVolume] = useState(saved.volume);
  const [upperVoiceVolume, setUpperVoiceVolume] = useState(saved.upperVoiceVolume ?? DEFAULT_UPPER_VOICE_VOLUME);
  const [lowerVoiceVolume, setLowerVoiceVolume] = useState(saved.lowerVoiceVolume ?? DEFAULT_LOWER_VOICE_VOLUME);
  const [instrument, setInstrument] = useState(saved.instrument);
  const [randomInstrumentMode, setRandomInstrumentMode] = useState(saved.randomInstrumentMode ?? DEFAULT_RANDOM_INSTRUMENT_MODE);
  const [randomInstrumentEnabled, setRandomInstrumentEnabled] = useState(saved.randomInstrumentEnabled ?? DEFAULT_RANDOM_INSTRUMENT_ENABLED);
  const [randomizeInstrumentOnExercise, setRandomizeInstrumentOnExercise] = useState(saved.randomizeInstrumentOnExercise ?? DEFAULT_RANDOMIZE_INSTRUMENT_ON_EXERCISE);
  const [compound, setCompound] = useState(saved.compound);
  const [twoVoice, setTwoVoice] = useState(saved.twoVoice);
  const [selectedDyadFamilies, setSelectedDyadFamilies] = useState(saved.selectedDyadFamilies);
  const [dyadDirection, setDyadDirection] = useState(saved.dyadDirection);
  const [dyadResponseMode, setDyadResponseMode] = useState(saved.dyadResponseMode || "both");
  const [compoundOctaves, setCompoundOctaves] = useState(saved.compoundOctaves);
  const [maxRange, setMaxRange] = useState(saved.maxRange);
  const [responseOctave, setResponseOctave] = useState(saved.responseOctave);
  const [harmonicMode, setHarmonicMode] = useState(saved.harmonicMode ?? "soprano");
  const [harmonicChordCount, setHarmonicChordCount] = useState(saved.harmonicChordCount ?? DEFAULT_HARMONIC_CHORD_COUNT);
  const [harmonicSopranoHintMode, setHarmonicSopranoHintMode] = useState(saved.harmonicSopranoHintMode ?? "all");
  const [selectedHarmonicTriads, setSelectedHarmonicTriads] = useState(saved.selectedHarmonicTriads ?? DEFAULT_HARMONIC_TRIADS);
  const [selectedHarmonicSevenths, setSelectedHarmonicSevenths] = useState(saved.selectedHarmonicSevenths ?? DEFAULT_HARMONIC_SEVENTHS);
  const [exercise, setExercise] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [pendingDyadAnswer, setPendingDyadAnswer] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStartIndex, setPlaybackStartIndex] = useState(0);
  const [playbackCursorIndex, setPlaybackCursorIndex] = useState(0);
  const [harmonicArpeggioSpeed, setHarmonicArpeggioSpeed] = useState(DEFAULT_HARMONIC_ARPEGGIO_SPEED);
  const [stats, setStats] = useState(savedStats);
  const [timerPaused, setTimerPaused] = useState(false);
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const [timeMarks, setTimeMarks] = useState(savedMarks);
  const [runtimeError, setRuntimeError] = useState("");
  const [theme, setTheme] = useState(() => initialThemePreference());
  const darkTheme = theme === "dark";


  const audioContextRef = useRef(null);
  const soundfontCacheRef = useRef(new Map());
  const activeNodesRef = useRef([]);
  const playbackTimeoutsRef = useRef([]);
  const playbackCursorTimeoutsRef = useRef([]);
  const playbackSessionRef = useRef(0);
  const mobileAudioRuntimeRef = useRef(typeof window !== "undefined" ? isMobileAudioRuntime() : false);
  const mobileAudioUnlockedRef = useRef(false);
  const mobileUnlockPromiseRef = useRef(null);
  const [mobileAudioUnlocked, setMobileAudioUnlocked] = useState(!mobileAudioRuntimeRef.current);
  const [showMobileAudioGate, setShowMobileAudioGate] = useState(false);
  const [mobileAudioUnlocking, setMobileAudioUnlocking] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const validIds = new Set(keyOptionsForModeScope(modeScope).map((key) => key.id));
    setSelectedKeys((current) => {
      const cleaned = current.filter((id) => validIds.has(id));
      return cleaned.length === current.length ? current : cleaned;
    });
  }, [modeScope]);

  const settings = useMemo(() => ({
    trainerMode,
    noteCount,
    selectedDegrees,
    selectedKeys,
    selectedClefs,
    modeScope,
    minorScales,
    includeAltered,
    alteredForms,
    selectedAlteredMajorTokens,
    selectedAlteredMinorTokens,
    repeatEachNote,
    speed,
    volume,
    upperVoiceVolume,
    lowerVoiceVolume,
    instrument,
    randomInstrumentMode,
    randomInstrumentEnabled,
    randomizeInstrumentOnExercise,
    compound,
    twoVoice,
    selectedDyadFamilies,
    dyadDirection: "auto",
    dyadResponseMode,
    compoundOctaves,
    maxRange,
    responseOctave,
    harmonicMode,
    harmonicChordCount,
    harmonicSopranoHintMode,
    selectedHarmonicTriads,
    selectedHarmonicSevenths,
  }), [alteredForms, compound, compoundOctaves, dyadDirection, dyadResponseMode, harmonicChordCount, harmonicMode, harmonicSopranoHintMode, includeAltered, instrument, maxRange, minorScales, modeScope, noteCount, randomInstrumentEnabled, randomInstrumentMode, randomizeInstrumentOnExercise, repeatEachNote, responseOctave, selectedAlteredMajorTokens, selectedAlteredMinorTokens, selectedClefs, selectedDegrees, selectedDyadFamilies, selectedHarmonicSevenths, selectedHarmonicTriads, selectedKeys, speed, trainerMode, twoVoice, upperVoiceVolume, lowerVoiceVolume, volume]);

  const answerProgress = useMemo(() => getAnswerProgress(exercise, attempts), [exercise, attempts]);
  const harmonicPlaybackEvents = useMemo(() => getHarmonicPlaybackEventDescriptors(exercise), [exercise]);
  const currentIndex = answerProgress.index;
  const currentVoiceIndex = answerProgress.voiceIndex;
  const answeredSlots = answerProgress.answered;
  const totalSlots = totalAnswerSlots(exercise);
  const exerciseComplete = Boolean(exercise && totalSlots > 0 && answeredSlots >= totalSlots);
  const score = scoreFromStats(stats);
  const savedTotals = useMemo(() => {
    const totals = timeMarks.reduce((acc, mark) => {
      acc.totalSeconds += Number(mark.totalSeconds ?? 0);
      acc.exercises += Number(mark.exercises ?? 0);
      acc.correct += Number(mark.correct ?? 0);
      acc.incorrect += Number(mark.incorrect ?? 0);
      return acc;
    }, { totalSeconds: 0, exercises: 0, correct: 0, incorrect: 0 });
    return {
      ...totals,
      savedCount: timeMarks.length,
      score: scoreFromStats({ correct: totals.correct, incorrect: totals.incorrect }),
    };
  }, [timeMarks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MARKS_KEY, JSON.stringify(timeMarks));
  }, [timeMarks]);

  useEffect(() => {
    setPlaybackStartIndex(0);
    setPlaybackCursorIndex(0);
  }, [exercise?.id]);

  useEffect(() => {
    if (timerPaused) return;
    const timer = window.setInterval(() => setStats((current) => ({ ...current, totalSeconds: current.totalSeconds + 1 })), 1000);
    return () => window.clearInterval(timer);
  }, [timerPaused]);

  const unlockMobileAudioFromGesture = useCallback(() => {
    if (!mobileAudioRuntimeRef.current) return;
    try {
      const context = getSharedAuralAudioContext();
      if (!context) return;
      audioContextRef.current = context;
      fireSilentUnlockPulse(context);
      if (context.state !== "running") {
        const resumePromise = context.resume?.();
        mobileUnlockPromiseRef.current = resumePromise ?? null;
        if (resumePromise?.then) {
          resumePromise.then(() => {
            fireSilentUnlockPulse(context);
            mobileAudioUnlockedRef.current = true;
            setMobileAudioUnlocked(true);
          }).catch((error) => {
            console.warn("No se pudo desbloquear el audio móvil todavía:", error);
            mobileAudioUnlockedRef.current = false;
            setMobileAudioUnlocked(false);
          });
        }
      } else {
        mobileAudioUnlockedRef.current = true;
        setMobileAudioUnlocked(true);
      }
    } catch (error) {
      console.warn("No se pudo preparar el audio móvil:", error);
      mobileAudioUnlockedRef.current = false;
      setMobileAudioUnlocked(false);
    }
  }, []);

  const activateMobileAudioFromGate = useCallback(async () => {
    if (!mobileAudioRuntimeRef.current) return true;
    setMobileAudioUnlocking(true);
    try {
      const context = getSharedAuralAudioContext();
      if (!context) return false;
      audioContextRef.current = context;

      // La primera operación del toque debe ser abrir/reanudar Web Audio y
      // emitir un pulso casi inaudible. No se carga SoundFont antes de esto.
      fireSilentUnlockPulse(context);
      if (context.state !== "running") {
        const resumePromise = context.resume?.();
        mobileUnlockPromiseRef.current = resumePromise ?? null;
        if (resumePromise?.then) await resumePromise;
      }
      fireSilentUnlockPulse(context);

      let micReady = false;
      try {
        await requestSharedAuralMicrophoneStream();
        micReady = true;
      } catch (micError) {
        console.warn("No se pudo activar el micrófono desde el botón de audio:", micError);
      }

      if (context.state !== "running") {
        try { await context.resume?.(); } catch {}
      }
      fireSilentUnlockPulse(context);

      const ready = context.state === "running" || micReady;
      mobileAudioUnlockedRef.current = ready;
      setMobileAudioUnlocked(ready);
      if (!ready) {
        setRuntimeError("El navegador todavía bloqueó el audio. Toca otra vez Activar audio y micrófono.");
      } else if (!micReady) {
        setRuntimeError("Audio activado. El micrófono no se pudo activar; cuando uses el afinador, toca Activar micrófono.");
      }
      return ready;
    } catch (error) {
      console.warn("No se pudo activar el audio móvil:", error);
      mobileAudioUnlockedRef.current = false;
      setMobileAudioUnlocked(false);
      setRuntimeError("No se pudo activar el audio y micrófono. Toca otra vez el botón de activación o revisa los permisos del navegador.");
      return false;
    } finally {
      setMobileAudioUnlocking(false);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playbackSessionRef.current += 1;
    playbackTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    playbackTimeoutsRef.current = [];
    playbackCursorTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    playbackCursorTimeoutsRef.current = [];
    activeNodesRef.current.forEach((node) => {
      try { node?.stop?.(); } catch { /* noop */ }
      try { node?.disconnect?.(); } catch { /* noop */ }
    });
    activeNodesRef.current = [];
    setIsPlaying(false);
  }, []);

  const ensureAudio = useCallback(async () => {
    const context = getSharedAuralAudioContext();
    if (!context) return null;
    audioContextRef.current = context;
    if (mobileAudioRuntimeRef.current && mobileUnlockPromiseRef.current) {
      try { await mobileUnlockPromiseRef.current; } catch { /* se reintentará abajo */ }
    }
    if (context.state === "suspended") {
      try { await context.resume(); } catch { /* puede fallar fuera del gesto del usuario en móvil */ }
    }
    if (context.state === "running") {
      mobileAudioUnlockedRef.current = true;
      setMobileAudioUnlocked(true);
      fireSilentUnlockPulse(context);
    } else if (mobileAudioRuntimeRef.current) {
      setMobileAudioUnlocked(false);
    }
    return context;
  }, []);

  const getPlayer = useCallback(async (instrumentValue = instrument) => {
    const context = await ensureAudio();
    if (!context) return null;
    const config = getInstrumentConfig(instrumentValue);
    const cacheKey = `${config.soundfont}-${SOUNDFONT_LIBRARY}`;
    if (soundfontCacheRef.current.has(cacheKey)) {
      const cachedPlayer = soundfontCacheRef.current.get(cacheKey);
      cachedPlayer.__auralGainMultiplier = getInstrumentGainMultiplier(config);
      return cachedPlayer;
    }
    try {
      const player = await Soundfont.instrument(context, config.soundfont, {
        format: "mp3",
        soundfont: SOUNDFONT_LIBRARY,
        destination: context.destination,
        nameToUrl: (name, soundfont, format) => `${SOUNDFONT_BASE_URL}/${soundfont}/${name}-${format}.js`,
      });
      player.__auralGainMultiplier = getInstrumentGainMultiplier(config);
      soundfontCacheRef.current.set(cacheKey, player);
      return player;
    } catch (error) {
      console.warn("No se pudo cargar Soundfont; usando oscilador interno:", error);
      return null;
    }
  }, [ensureAudio, instrument]);

  const playOscillatorNote = useCallback((context, midi, startTime, duration, gainValue = 0.08) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.025);
    gain.gain.setValueAtTime(gainValue, startTime + Math.max(0.03, duration - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
    activeNodesRef.current.push(oscillator, gain);
  }, []);

  const playMidi = useCallback((player, context, midi, startTime, duration, gain = 0.22, volumeScale = 1) => {
    const safeScale = Number.isFinite(volumeScale) ? volumeScale : 1;
    if (player?.play) {
      const instrumentGain = getInstrumentGainMultiplier(player);
      const node = player.play(midiToSharpName(midi), startTime, { duration, gain: gain * safeScale * instrumentGain * (volume / 100) * SOUNDFONT_GAIN_BOOST });
      activeNodesRef.current.push(node);
    } else {
      playOscillatorNote(context, midi, startTime, duration, (volume / 100) * safeScale * 0.11 * INTERNAL_VOLUME_BOOST);
    }
  }, [playOscillatorNote, volume]);

  const playExerciseData = useCallback(async (targetExercise, options = {}) => {
    if (!targetExercise) return;
    const requestedOptions = typeof options === "object" && options !== null ? options : {};
    const includeCadence = isHarmonicExercise(targetExercise) ? false : requestedOptions.includeCadence ?? true;
    const includeSequence = requestedOptions.includeSequence ?? true;
    stopPlayback();
    const session = playbackSessionRef.current;
    const context = await ensureAudio();
    if (!context) return;
    const playbackInstrument = targetExercise.playbackInstrument ?? instrument;
    const sequencePlayer = await getPlayer(playbackInstrument);
    const cadencePlayer = includeCadence ? await getPlayer(CADENCE_INSTRUMENT) : sequencePlayer;
    if (session !== playbackSessionRef.current) return;

    const tempoBpm = clamp(speed, 10, 200);
    // El tempo marca la negra. Cada evento completo del ejercicio
    // (nota + silencio) ocupa una redonda, es decir, 4 pulsos.
    // Así mantenemos una escala de BPM musical sin obligar al alumno
    // a bajar a tempos extremos como 15 BPM para escuchar con calma.
    const eventDuration = (60 / tempoBpm) * 4;
    const totalBaseUnits = NOTE_BASE_SECONDS + GAP_BASE_SECONDS;
    const noteDuration = eventDuration * (NOTE_BASE_SECONDS / totalBaseUnits);
    const gap = eventDuration * (GAP_BASE_SECONDS / totalBaseUnits);
    const cadenceBeat = 60 / CADENCE_BPM;
    const chordDuration = cadenceBeat * 0.88;
    const chordGap = cadenceBeat * 0.12;
    let cursor = context.currentTime + 0.08;
    setIsPlaying(true);

    if (includeCadence) {
      const chords = buildCadenceChords(targetExercise);
      chords.forEach((chord, chordIndex) => {
        const duration = chordIndex === chords.length - 1 ? chordDuration + CADENCE_LAST_CHORD_EXTRA_SECONDS : chordDuration;
        chord.forEach((note) => playMidi(cadencePlayer, context, note.midi, cursor, duration, 0.22));
        cursor += duration + (chordIndex === chords.length - 1 ? 0 : chordGap);
      });
      if (includeSequence) cursor += POST_CADENCE_PAUSE_SECONDS;
    }

    if (includeSequence) {
      const sequenceStartIndex = clamp(Number(requestedOptions.startIndex) || 0, 0, Math.max(0, (targetExercise.sequence?.length ?? 1) - 1));
      const sequenceEndIndex = requestedOptions.endIndex === undefined
        ? (targetExercise.sequence?.length ?? 0) - 1
        : clamp(Number(requestedOptions.endIndex) || 0, sequenceStartIndex, Math.max(sequenceStartIndex, (targetExercise.sequence?.length ?? 1) - 1));
      if (isHarmonicExercise(targetExercise)) {
        setPlaybackStartIndex(sequenceStartIndex);
        setPlaybackCursorIndex(sequenceStartIndex);
      }
      targetExercise.sequence.forEach((_, index) => {
        if (index < sequenceStartIndex || index > sequenceEndIndex) return;
        const eventStartTime = cursor;
        if (isHarmonicExercise(targetExercise)) {
          const cursorTimeout = window.setTimeout(() => {
            if (session === playbackSessionRef.current) setPlaybackCursorIndex(index);
          }, Math.max(0, (eventStartTime - context.currentTime) * 1000));
          playbackCursorTimeoutsRef.current.push(cursorTimeout);
        }
        const eventNotes = getEventNotes(targetExercise, index);
        eventNotes.forEach((note, noteIndex) => {
          const voiceScale = targetExercise.twoVoice && eventNotes.length > 1 ? (noteIndex === 0 ? lowerVoiceVolume / 50 : upperVoiceVolume / 50) : 1;
          const chordGain = eventNotes.length >= 4 ? 0.17 : eventNotes.length > 1 ? 0.22 : 0.32;
          playMidi(sequencePlayer, context, note.midi, cursor, noteDuration, chordGain, voiceScale);
        });
        cursor += noteDuration;
        if (targetExercise.repeated) {
          cursor += gap;
          eventNotes.forEach((note, noteIndex) => {
            const voiceScale = targetExercise.twoVoice && eventNotes.length > 1 ? (noteIndex === 0 ? lowerVoiceVolume / 50 : upperVoiceVolume / 50) : 1;
            const chordGain = eventNotes.length >= 4 ? 0.17 : eventNotes.length > 1 ? 0.22 : 0.32;
            playMidi(sequencePlayer, context, note.midi, cursor, noteDuration, chordGain, voiceScale);
          });
          cursor += noteDuration;
        }
        cursor += gap;
      });
    }

    const timeout = window.setTimeout(() => setIsPlaying(false), Math.max(1, (cursor - context.currentTime) * 1000 + 120));
    playbackTimeoutsRef.current.push(timeout);
  }, [ensureAudio, getPlayer, instrument, lowerVoiceVolume, playMidi, speed, stopPlayback, upperVoiceVolume]);

  const playExercise = useCallback(async (options = {}) => playExerciseData(exercise, options), [exercise, playExerciseData]);

  const playHarmonicChordAt = useCallback(async (index) => {
    if (!isHarmonicExercise(exercise)) return;
    await playExerciseData(exercise, { includeCadence: false, includeSequence: true, startIndex: index, endIndex: index });
  }, [exercise, playExerciseData]);

  const playHarmonicFromIndex = useCallback(async (index) => {
    if (!isHarmonicExercise(exercise)) return;
    await playExerciseData(exercise, { includeCadence: false, includeSequence: true, startIndex: index });
  }, [exercise, playExerciseData]);

  const selectHarmonicPlaybackPoint = useCallback((index) => {
    const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, harmonicPlaybackEvents.length - 1));
    setPlaybackStartIndex(safeIndex);
    setPlaybackCursorIndex(safeIndex);
    if (isPlaying && isHarmonicExercise(exercise) && harmonicPlaybackEvents.length > 1) {
      playExerciseData(exercise, { includeCadence: false, includeSequence: true, startIndex: safeIndex });
    }
  }, [exercise, harmonicPlaybackEvents.length, isPlaying, playExerciseData]);

  const toggleHarmonicPlaybackFromSelection = useCallback(() => {
    if (!isHarmonicExercise(exercise)) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      playExerciseData(exercise, { includeCadence: false, includeSequence: true, startIndex: playbackStartIndex });
    }
  }, [exercise, isPlaying, playExerciseData, playbackStartIndex, stopPlayback]);

  const setSafeHarmonicArpeggioSpeed = useCallback((speedKey) => {
    const safeSpeed = HARMONIC_ARPEGGIO_SPEED_OPTIONS.some((option) => option.key === speedKey) ? speedKey : DEFAULT_HARMONIC_ARPEGGIO_SPEED;
    setHarmonicArpeggioSpeed(safeSpeed);
  }, []);

  const playHarmonicArpeggioAt = useCallback(async (index) => {
    if (!isHarmonicExercise(exercise)) return;
    const safeIndex = clamp(Number(index) || 0, 0, Math.max(0, (exercise.sequence?.length ?? 1) - 1));
    const notes = getEventNotes(exercise, safeIndex);
    if (!notes.length) return;

    stopPlayback();
    unlockMobileAudioFromGesture();
    const context = await ensureAudio();
    if (!context) return;
    const player = await getPlayer(exercise.playbackInstrument ?? instrument);
    const speedConfig = HARMONIC_ARPEGGIO_SPEED_OPTIONS.find((option) => option.key === harmonicArpeggioSpeed)
      ?? HARMONIC_ARPEGGIO_SPEED_OPTIONS.find((option) => option.key === DEFAULT_HARMONIC_ARPEGGIO_SPEED)
      ?? HARMONIC_ARPEGGIO_SPEED_OPTIONS[0];
    const orderedNotes = [...notes].sort((a, b) => a.midi - b.midi);
    const startTime = context.currentTime + 0.04;

    orderedNotes.forEach((note, noteIndex) => {
      const eventStart = startTime + noteIndex * speedConfig.stepSeconds;
      const duration = speedConfig.noteSeconds + (noteIndex === orderedNotes.length - 1 ? speedConfig.stepSeconds * 1.35 : 0);
      const gain = orderedNotes.length >= 4 ? 0.18 : 0.23;
      playMidi(player, context, note.midi, eventStart, duration, gain);
    });
  }, [ensureAudio, exercise, getPlayer, harmonicArpeggioSpeed, instrument, playMidi, stopPlayback, unlockMobileAudioFromGesture]);

  const playSingleNote = useCallback(async (noteOrNotes) => {
    stopPlayback();
    unlockMobileAudioFromGesture();
    const context = await ensureAudio();
    const player = await getPlayer(instrument);
    const notes = Array.isArray(noteOrNotes) ? noteOrNotes : [noteOrNotes].filter(Boolean);
    if (!context || !notes.length) return;
    const startTime = context.currentTime + 0.02;
    notes.forEach((note) => playMidi(player, context, note.midi, startTime, 1.2, notes.length > 1 ? 0.18 : 0.24));
  }, [ensureAudio, getPlayer, instrument, playMidi, stopPlayback, unlockMobileAudioFromGesture]);

  const generateExerciseCore = useCallback(() => {
    try {
      stopPlayback();
      setRuntimeError("");
      const safeSettings = {
        ...settings,
        selectedDegrees: Array.isArray(settings.selectedDegrees) && settings.selectedDegrees.length ? settings.selectedDegrees : [1, 2, 3],
        selectedKeys: Array.isArray(settings.selectedKeys) && settings.selectedKeys.length ? settings.selectedKeys : KEY_OPTIONS.map((key) => key.id),
        selectedClefs: Array.isArray(settings.selectedClefs) && settings.selectedClefs.length ? settings.selectedClefs : ["treble"],
        minorScales: Array.isArray(settings.minorScales) && settings.minorScales.length ? settings.minorScales : ["harmonicMinor"],
        alteredForms: Array.isArray(settings.alteredForms) ? settings.alteredForms : ALTERED_FORM_OPTIONS.map((item) => item.key),
        selectedAlteredMajorTokens: sanitizeAlteredTokens(settings.selectedAlteredMajorTokens, "major"),
        selectedAlteredMinorTokens: sanitizeAlteredTokens(settings.selectedAlteredMinorTokens, "minor"),
        harmonicMode: sanitizeHarmonicMode(settings.harmonicMode),
        harmonicChordCount: clamp(Number(settings.harmonicChordCount) || DEFAULT_HARMONIC_CHORD_COUNT, MIN_HARMONIC_CHORDS, MAX_HARMONIC_CHORDS),
        harmonicSopranoHintMode: sanitizeHarmonicSopranoHintMode(settings.harmonicSopranoHintMode),
        selectedHarmonicTriads: sanitizeHarmonicTriads(settings.selectedHarmonicTriads),
        selectedHarmonicSevenths: sanitizeHarmonicSevenths(settings.selectedHarmonicSevenths),
      };
      const nextInstrument = settings.randomInstrumentEnabled && settings.randomizeInstrumentOnExercise
        ? pickRandomInstrumentAvoiding(instrument, settings.randomInstrumentMode)
        : instrument;
      if (nextInstrument !== instrument) setInstrument(nextInstrument);
      const nextBase = safeSettings.trainerMode === "harmonicFunctions" ? buildHarmonicExercise(safeSettings) : buildTonalExercise(safeSettings);
      const next = { ...nextBase, playbackInstrument: nextInstrument };
      setExercise(next);
      setAttempts([]);
      setPendingDyadAnswer(null);
      setReveal(false);
      void playExerciseData(next);
    } catch (error) {
      console.error("No se pudo generar la sucesión tonal:", error);
      setRuntimeError("No se pudo generar la sucesión con esta combinación de parámetros. Reinicia parámetros o selecciona más grados/tonalidades.");
    }
  }, [instrument, playExerciseData, settings, stopPlayback]);

  const generateExercise = useCallback(() => {
    if (mobileAudioRuntimeRef.current && !mobileAudioUnlockedRef.current) {
      stopPlayback();
      setShowMobileAudioGate(true);
      return;
    }
    generateExerciseCore();
  }, [generateExerciseCore, stopPlayback]);

  const handleActivateAudioAndGenerate = useCallback(async () => {
    const ready = await activateMobileAudioFromGate();
    if (!ready) return;
    setShowMobileAudioGate(false);
    generateExerciseCore();
  }, [activateMobileAudioFromGate, generateExerciseCore]);

  const handlePianoPress = useCallback((pc) => {
    if (!exercise || reveal || exerciseComplete || currentIndex >= exercise.sequence.length) return;
    const targetNotes = getResponseTargetNotes(exercise, currentIndex);
    const voiceIndex = Math.min(currentVoiceIndex, Math.max(0, targetNotes.length - 1));
    const target = targetNotes[voiceIndex];
    if (!target) return;
    const correct = mod(target.midi, 12) === pc;

    setAttempts((current) => {
      const next = [...current];
      const previous = next[currentIndex] ?? { notes: [], statuses: [], target: targetNotes };
      const notes = [...(previous.notes ?? [])];
      const statuses = [...(previous.statuses ?? [])];
      notes[voiceIndex] = target;
      statuses[voiceIndex] = correct ? "correct" : "wrong";
      next[currentIndex] = {
        ...previous,
        notes: targetNotes.slice(0, statuses.length),
        statuses,
        target: targetNotes,
        status: statuses.length >= targetNotes.length && statuses.every((status) => status === "correct") ? "correct" : (statuses.length >= targetNotes.length ? "wrong" : null),
      };
      return next;
    });

    setStats((current) => ({
      ...current,
      correct: current.correct + (correct ? 1 : 0),
      incorrect: current.incorrect + (correct ? 0 : 1),
    }));
  }, [currentIndex, currentVoiceIndex, exercise, exerciseComplete, reveal]);

  const handleRevealFullAnswer = useCallback(() => {
    if (!exercise || reveal) return;
    let addedErrors = 0;
    setAttempts((current) => {
      const next = [...current];
      exercise.sequence.forEach((_, index) => {
        const targetNotes = getResponseTargetNotes(exercise, index);
        const previous = next[index] ?? { notes: [], statuses: [], target: targetNotes };
        const statuses = [...(previous.statuses ?? [])];
        while (statuses.length < targetNotes.length) {
          statuses.push("wrong");
          addedErrors += 1;
        }
        next[index] = {
          ...previous,
          notes: targetNotes,
          statuses,
          target: targetNotes,
          status: statuses.every((status) => status === "correct") ? "correct" : "wrong",
        };
      });
      return next;
    });
    if (addedErrors > 0) setStats((current) => ({ ...current, incorrect: current.incorrect + addedErrors }));
    setReveal(true);
  }, [exercise, reveal]);



  useEffect(() => {
    if (exerciseComplete && exercise) {
      setReveal(true);
      setStats((current) => ({ ...current, exercises: current.exercises + 1 }));
    }
  }, [exerciseComplete, exercise]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const toggleDegree = (degree) => {
    setSelectedDegrees((current) => {
      const next = current.includes(degree) ? current.filter((item) => item !== degree) : [...current, degree].sort((a, b) => a - b);
      return next.length ? next : current;
    });
  };

  const toggleKey = (keyId) => {
    setSelectedKeys((current) => {
      const next = current.includes(keyId) ? current.filter((item) => item !== keyId) : [...current, keyId];
      return next.length ? next : current;
    });
  };

  const toggleClef = (clefKey) => {
    setSelectedClefs((current) => {
      const next = current.includes(clefKey) ? current.filter((item) => item !== clefKey) : [...current, clefKey];
      return next.length ? next : current;
    });
  };

  const toggleMinorScale = (scale) => {
    setMinorScales((current) => {
      const next = current.includes(scale) ? current.filter((item) => item !== scale) : [...current, scale];
      return next.length ? next : current;
    });
  };

  const toggleAlteredForm = (form) => {
    setAlteredForms((current) => {
      const next = current.includes(form) ? current.filter((item) => item !== form) : [...current, form];
      return next.length ? next : current;
    });
  };

  const setAlteredTokensForMode = (mode, updater) => {
    const setter = mode === "minor" ? setSelectedAlteredMinorTokens : setSelectedAlteredMajorTokens;
    setter((current) => sanitizeAlteredTokens(typeof updater === "function" ? updater(current) : updater, mode));
  };

  const toggleAlteredToken = (mode, token) => {
    setAlteredTokensForMode(mode, (current) => {
      const next = current.includes(token) ? current.filter((item) => item !== token) : [...current, token];
      return next;
    });
  };

  const selectAllAlteredTokens = (mode) => {
    setAlteredTokensForMode(mode, (ALTERED_DEGREE_OPTIONS_BY_MODE[mode] ?? []).map((item) => item.token));
  };

  const deselectAllAlteredTokens = (mode) => {
    setAlteredTokensForMode(mode, []);
  };


  const toggleDyadFamily = (family) => {
    setSelectedDyadFamilies((current) => {
      const next = current.includes(family) ? current.filter((item) => item !== family) : [...current, family].sort((a, b) => Number(a) - Number(b));
      return next.length ? next : current;
    });
  };


  const toggleHarmonicTriad = (chordKey) => {
    setSelectedHarmonicTriads((current) => {
      const next = current.includes(chordKey) ? current.filter((item) => item !== chordKey) : [...current, chordKey];
      return sanitizeHarmonicTriads(next);
    });
  };

  const toggleHarmonicSeventh = (chordKey) => {
    setSelectedHarmonicSevenths((current) => {
      const next = current.includes(chordKey) ? current.filter((item) => item !== chordKey) : [...current, chordKey];
      return sanitizeHarmonicSevenths(next);
    });
  };

  const toggleHarmonicSeventhGroup = (groupKey) => {
    const group = SEVENTH_CHORD_GROUPS.find((item) => item.key === groupKey);
    if (!group) return;
    setSelectedHarmonicSevenths((current) => {
      const allSelected = group.chords.every((chord) => current.includes(chord));
      const next = allSelected
        ? current.filter((chord) => !group.chords.includes(chord))
        : [...new Set([...current, ...group.chords])];
      return sanitizeHarmonicSevenths(next);
    });
  };

  const selectedInstrument = useMemo(() => getInstrumentConfig(instrument), [instrument]);

  const randomizeCurrentInstrument = useCallback(() => {
    const nextInstrument = pickRandomInstrumentAvoiding(instrument, randomInstrumentMode);
    setInstrument(nextInstrument);
    setRandomInstrumentEnabled(true);
    setRandomizeInstrumentOnExercise(true);
    setExercise((current) => current ? { ...current, playbackInstrument: nextInstrument } : current);
  }, [instrument, randomInstrumentMode]);

  const toggleRandomizeInstrumentOnExercise = useCallback(() => {
    const next = !randomInstrumentEnabled;
    setRandomInstrumentEnabled(next);
    setRandomizeInstrumentOnExercise(next);
  }, [randomInstrumentEnabled]);

  const addTimeMark = useCallback((label = "Puntaje guardado") => {
    setTimeMarks((current) => {
      const nextMark = {
        id: `${Date.now()}-${Math.random()}`,
        label,
        timestamp: Date.now(),
        totalSeconds: stats.totalSeconds,
        exercises: stats.exercises,
        correct: stats.correct,
        incorrect: stats.incorrect,
        score: scoreFromStats(stats),
        trainerMode,
        noteCount,
        modeScope,
        instrument,
        degrees: selectedDegrees,
        keys: selectedKeys,
      };
      return [nextMark, ...current].slice(0, 80);
    });
    setShowProgressPanel(true);
  }, [instrument, modeScope, noteCount, selectedDegrees, selectedKeys, stats, trainerMode]);

  const clearTimeMarks = useCallback(() => {
    setTimeMarks([]);
    try { window.localStorage.removeItem(MARKS_KEY); } catch {}
  }, []);

  const deleteTimeMark = useCallback((markId) => {
    setTimeMarks((current) => current.filter((mark) => mark.id !== markId));
  }, []);

  const resetScores = () => setStats({ totalSeconds: 0, exercises: 0, correct: 0, incorrect: 0 });
  const resetParameters = () => {
    const defaults = defaultSettings();
    setTrainerMode(defaults.trainerMode);
    setNoteCount(defaults.noteCount);
    setSelectedDegrees(defaults.selectedDegrees);
    setSelectedKeys(defaults.selectedKeys);
    setSelectedClefs(defaults.selectedClefs);
    setModeScope(defaults.modeScope);
    setMinorScales(defaults.minorScales);
    setIncludeAltered(defaults.includeAltered);
    setAlteredForms(defaults.alteredForms);
    setSelectedAlteredMajorTokens(defaults.selectedAlteredMajorTokens);
    setSelectedAlteredMinorTokens(defaults.selectedAlteredMinorTokens);
    setRepeatEachNote(defaults.repeatEachNote);
    setSpeed(defaults.speed);
    setVolume(defaults.volume);
    setUpperVoiceVolume(defaults.upperVoiceVolume);
    setLowerVoiceVolume(defaults.lowerVoiceVolume);
    setInstrument(defaults.instrument);
    setRandomInstrumentMode(defaults.randomInstrumentMode);
    setRandomInstrumentEnabled(defaults.randomInstrumentEnabled);
    setRandomizeInstrumentOnExercise(defaults.randomizeInstrumentOnExercise);
    setCompound(defaults.compound);
    setTwoVoice(defaults.twoVoice);
    setSelectedDyadFamilies(defaults.selectedDyadFamilies);
    setDyadDirection(defaults.dyadDirection);
    setDyadResponseMode(defaults.dyadResponseMode || "both");
    setCompoundOctaves(defaults.compoundOctaves);
    setMaxRange(defaults.maxRange);
    setResponseOctave(defaults.responseOctave);
    setHarmonicMode(defaults.harmonicMode);
    setHarmonicChordCount(defaults.harmonicChordCount);
    setHarmonicSopranoHintMode(defaults.harmonicSopranoHintMode);
    setSelectedHarmonicTriads(defaults.selectedHarmonicTriads);
    setSelectedHarmonicSevenths(defaults.selectedHarmonicSevenths);
  };

  return (
    <>
      <AppThemeStyles />
      {showMobileAudioGate ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/55 px-5 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white/95 p-5 text-center shadow-2xl">
            <p className="aural-brand-label text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">Método Aural</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">Activar audio y micrófono</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              El navegador móvil necesita un toque directo para permitir el sonido. Activa el audio y la sucesión comenzará de inmediato.
            </p>
            <button
              type="button"
              onPointerDown={unlockMobileAudioFromGesture}
              onTouchStart={unlockMobileAudioFromGesture}
              onClick={handleActivateAudioAndGenerate}
              disabled={mobileAudioUnlocking}
              className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-base font-bold shadow-sm transition ${mobileAudioUnlocking ? "border border-zinc-200 bg-zinc-100 text-zinc-400" : "aural-black-button"}`}
            >
              <VolumeIcon className="h-5 w-5" />
              {mobileAudioUnlocking ? "Activando..." : "Activar audio, micrófono y generar sucesión"}
            </button>
            <button
              type="button"
              onClick={() => setShowMobileAudioGate(false)}
              className="mt-3 text-xs font-semibold text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      <div className={`min-h-screen overflow-x-hidden bg-zinc-100 px-3 py-4 pb-56 text-zinc-950 sm:px-6 sm:py-6 sm:pb-44 md:px-10 md:py-10 md:pb-36 ${darkTheme ? "app-theme-dark" : "app-theme-light"}`}>
        <div className="mx-auto max-w-[1600px] space-y-4 sm:space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="aural-brand-label text-xs font-semibold uppercase tracking-[0.34em] text-zinc-500 sm:text-sm">MÉTODO AURAL</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">Entrenador de música tonal</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
                  {TRAINER_MODES.map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => {
                        setTrainerMode(mode);
                        if (mode === "harmonicFunctions") setSpeed(DEFAULT_HARMONIC_SPEED);
                      }}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${trainerMode === mode ? "aural-mode-active" : "text-zinc-600 hover:bg-zinc-100"}`}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
                  aria-label={darkTheme ? "Activar tema claro" : "Activar tema oscuro"}
                  title={darkTheme ? "Tema claro" : "Tema oscuro"}
                >
                  {darkTheme ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </header>

          {trainerMode === "tonalFunctions" ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">{MODE_LABELS[trainerMode]}</p>
              <p className="mt-1 text-sm text-zinc-500">Pestaña reservada para el módulo de funciones tonales.</p>
            </div>
          ) : null}

          <section className="grid gap-4 sm:gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="space-y-4 sm:space-y-5">
                {trainerMode === "harmonicFunctions" ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-medium text-zinc-700">Modalidad</span>
                        <Badge>{harmonicExerciseModeLabel(harmonicMode)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {HARMONIC_EXERCISE_MODES.map((item) => (
                          <SelectionChip key={item.key} active={harmonicMode === item.key} onClick={() => setHarmonicMode(item.key)}>{item.label}</SelectionChip>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-zinc-700">Número de acordes</span>
                        <Badge>{harmonicChordCount} acordes</Badge>
                      </div>
                      <input type="range" min={MIN_HARMONIC_CHORDS} max={MAX_HARMONIC_CHORDS} step={1} value={harmonicChordCount} onChange={(event) => setHarmonicChordCount(Number(event.target.value))} className="aural-range-input w-full accent-sky-600" style={rangeFillStyle(harmonicChordCount, MIN_HARMONIC_CHORDS, MAX_HARMONIC_CHORDS)} />
                      <div className="flex justify-between text-xs text-zinc-500"><span>1</span><span>12</span></div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-medium text-zinc-700">Pista visual</span>
                        <Badge>{HARMONIC_SOPRANO_HINT_OPTIONS.find((item) => item.key === harmonicSopranoHintMode)?.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {HARMONIC_SOPRANO_HINT_OPTIONS.map((item) => (
                          <SelectionChip key={item.key} active={harmonicSopranoHintMode === item.key} onClick={() => setHarmonicSopranoHintMode(item.key)}>{item.label}</SelectionChip>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                        <SelectionChip active={!repeatEachNote} onClick={() => setRepeatEachNote((current) => !current)}>{repeatEachNote ? "Con repetición" : "Omitir repetición"}</SelectionChip>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-medium text-zinc-700">Acordes</span>
                        <Badge>{selectedHarmonicTriads.length + selectedHarmonicSevenths.length} activos</Badge>
                      </div>

                      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Tríadas</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setSelectedHarmonicTriads(TRIAD_CHORD_OPTIONS.map((item) => item.key))} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todas</button>
                            <button type="button" onClick={() => setSelectedHarmonicTriads([])} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Deseleccionar</button>
                            <Badge>{selectedHarmonicTriads.length} activas</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {TRIAD_CHORD_OPTIONS.map((item) => <SelectionChip key={item.key} active={selectedHarmonicTriads.includes(item.key)} onClick={() => toggleHarmonicTriad(item.key)}>{harmonicChordFullLabel(item.key)}</SelectionChip>)}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {SEVENTH_CHORD_GROUPS.map((group) => (
                          <div key={group.key} className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{group.label}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => toggleHarmonicSeventhGroup(group.key)} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">
                                  {group.chords.every((chord) => selectedHarmonicSevenths.includes(chord)) ? "Quitar grupo" : "Activar grupo"}
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.chords.map((chord) => <SelectionChip key={chord} active={selectedHarmonicSevenths.includes(chord)} onClick={() => toggleHarmonicSeventh(chord)}>{harmonicChordFullLabel(chord)}</SelectionChip>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-zinc-700">Número de notas</span>
                    <Badge>{noteCount} notas</Badge>
                  </div>
                  <input type="range" min={MIN_NOTES} max={MAX_NOTES} step={1} value={noteCount} onChange={(event) => setNoteCount(Number(event.target.value))} className="aural-range-input w-full accent-sky-600" style={rangeFillStyle(noteCount, MIN_NOTES, MAX_NOTES)} />
                  <div className="flex justify-between text-xs text-zinc-500"><span>1</span><span>24</span></div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Grados disponibles</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setSelectedDegrees([1, 2, 3])} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">1 · 2 · 3</button>
                      <button type="button" onClick={() => setSelectedDegrees([1, 2, 3, 4, 7])} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">+ 4 · 7</button>
                      <button type="button" onClick={() => setSelectedDegrees([1, 2, 3, 4, 5, 6, 7])} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">Todos</button>
                      <Badge>{selectedDegrees.length} activos</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DEGREE_OPTIONS.map((item) => <SelectionChip key={item.degree} active={selectedDegrees.includes(item.degree)} onClick={() => toggleDegree(item.degree)}>{item.label}</SelectionChip>)}
                  </div>
                  <div className="border-t border-zinc-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SelectionChip active={repeatEachNote} onClick={() => setRepeatEachNote((current) => !current)}>{repeatEachNote ? "Con repetición" : "Sin repetición"}</SelectionChip>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Textura melódica</span>
                    <Badge>{twoVoice ? "2 voces" : "1 voz"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SelectionChip active={!twoVoice} onClick={() => setTwoVoice(false)}>Una voz</SelectionChip>
                    <SelectionChip active={twoVoice} onClick={() => setTwoVoice(true)}>Dos voces</SelectionChip>
                  </div>
                  {twoVoice ? (
                    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Intervalos verticales permitidos</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setSelectedDyadFamilies(DYAD_INTERVAL_OPTIONS.map((item) => item.family))} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todos</button>
                            <button type="button" onClick={() => setSelectedDyadFamilies([])} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Deseleccionar todos</button>
                            <Badge>{selectedDyadFamilies.length} activos</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {DYAD_INTERVAL_OPTIONS.map((item) => <SelectionChip key={item.family} active={selectedDyadFamilies.includes(item.family)} onClick={() => toggleDyadFamily(item.family)}>{item.label}</SelectionChip>)}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Respuesta</p>
                        <div className="flex flex-wrap gap-2">
                          <SelectionChip active={dyadResponseMode === "both"} onClick={() => setDyadResponseMode("both")}>Escribir ambas voces</SelectionChip>
                          <SelectionChip active={dyadResponseMode === "upper"} onClick={() => setDyadResponseMode("upper")}>Escribir voz superior</SelectionChip>
                          <SelectionChip active={dyadResponseMode === "lower"} onClick={() => setDyadResponseMode("lower")}>Escribir voz inferior</SelectionChip>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Modo</span>
                    <Badge>{modeLabel(modeScope, minorScales)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SelectionChip active={modeScope === "major"} onClick={() => setModeScope("major")}>Mayor</SelectionChip>
                    <SelectionChip active={modeScope === "minor"} onClick={() => setModeScope("minor")}>Menor</SelectionChip>
                    <SelectionChip active={modeScope === "randomMode"} onClick={() => setModeScope("randomMode")}>Mayor o menor aleatorio</SelectionChip>
                    <SelectionChip
                      active={modeScope === "majorMinor"}
                      onClick={() => setModeScope("majorMinor")}
                      title="Mezcla grados del modo mayor y del modo menor paralelo dentro del mismo ejercicio."
                    >
                      Mayor y menor combinados
                    </SelectionChip>
                  </div>
                  {(modeScope === "minor" || modeScope === "randomMode" || modeScope === "majorMinor") ? (
                    <MinorScaleSelector
                      selectedScales={minorScales}
                      onToggle={toggleMinorScale}
                      onSelectAll={() => setMinorScales(["naturalMinor", "harmonicMinor", "melodicMinor"])}
                      onDeselectAll={() => setMinorScales([])}
                    />
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Tonalidades</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setSelectedKeys(keyOptionsForModeScope(modeScope).map((key) => key.id))} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todas</button>
                      <button type="button" onClick={() => setSelectedKeys([])} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">Deseleccionar todas</button>
                      <button type="button" onClick={() => setSelectedKeys(["C"])} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">Solo Do</button>
                      <Badge>{selectedKeys.length} activas</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keyOptionsForModeScope(modeScope).map((key) => <SelectionChip key={key.id} active={selectedKeys.includes(key.id)} onClick={() => toggleKey(key.id)}>{key.label}</SelectionChip>)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Claves</span>
                    {compound ? (
                      <Badge>Sol + Fa automático</Badge>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setSelectedClefs(CLEFS.map((clef) => clef.key))} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todas</button>
                        <button type="button" onClick={() => setSelectedClefs(["treble"])} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500">Solo Sol</button>
                        <Badge>{selectedClefs.length} activas</Badge>
                      </div>
                    )}
                  </div>
                  {!compound ? (
                    <div className="flex flex-wrap gap-2">
                      {CLEFS.map((clef) => <SelectionChip key={clef.key} active={selectedClefs.includes(clef.key)} onClick={() => toggleClef(clef.key)}>{clef.label}</SelectionChip>)}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Grados alterados</span>
                    <SelectionChip active={includeAltered} onClick={() => setIncludeAltered((current) => !current)}>{includeAltered ? "Activos" : "Inactivos"}</SelectionChip>
                  </div>
                  {includeAltered ? (
                    <div className="space-y-3">
                      <div className="space-y-3">
                        {modeScope !== "minor" ? (
                          <AlteredDegreeSelector
                            mode="major"
                            label="Modo mayor"
                            selectedTokens={selectedAlteredMajorTokens}
                            onToggle={(token) => toggleAlteredToken("major", token)}
                            onSelectAll={() => selectAllAlteredTokens("major")}
                            onDeselectAll={() => deselectAllAlteredTokens("major")}
                          />
                        ) : null}
                        {modeScope !== "major" ? (
                          <AlteredDegreeSelector
                            mode="minor"
                            label="Modo menor"
                            selectedTokens={selectedAlteredMinorTokens}
                            onToggle={(token) => toggleAlteredToken("minor", token)}
                            onSelectAll={() => selectAllAlteredTokens("minor")}
                            onDeselectAll={() => deselectAllAlteredTokens("minor")}
                          />
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Formas de aparición</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setAlteredForms(ALTERED_FORM_OPTIONS.map((item) => item.key))} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Seleccionar todas</button>
                            <button type="button" onClick={() => setAlteredForms([])} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500">Deseleccionar todas</button>
                            <Badge>{alteredForms.length} activas</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ALTERED_FORM_OPTIONS.map((item) => <SelectionChip key={item.key} active={alteredForms.includes(item.key)} onClick={() => toggleAlteredForm(item.key)}>{item.label}</SelectionChip>)}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-700">Intervalos compuestos</span>
                    <SelectionChip active={compound} onClick={() => setCompound((current) => !current)}>{compound ? "Compuestos activos" : "Sin compuestos"}</SelectionChip>
                  </div>
                </div>

                </>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-zinc-700">Tempo</span><Badge>♩ = {speed} BPM</Badge></div>
                    <input type="range" min={10} max={200} step={1} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="aural-range-input w-full accent-sky-600" style={rangeFillStyle(speed, 10, 200)} />
                    <div className="flex justify-between text-xs text-zinc-500"><span>10 BPM</span><span>200 BPM</span></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-zinc-700">Volumen</span><Badge>{volume}%</Badge></div>
                    <input type="range" min={0} max={100} step={1} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="aural-range-input w-full accent-sky-600" style={rangeFillStyle(volume, 0, 100)} />
                    <div className="flex justify-between text-xs text-zinc-500"><span>0%</span><span>100%</span></div>
                  </div>
                  {twoVoice ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-zinc-700">Voz superior</span><Badge>{upperVoiceVolume}%</Badge></div>
                        <input type="range" min={0} max={100} step={1} value={upperVoiceVolume} onChange={(event) => setUpperVoiceVolume(Number(event.target.value))} className="aural-range-input w-full accent-sky-600" style={rangeFillStyle(upperVoiceVolume, 0, 100)} />
                        <div className="flex justify-between text-xs text-zinc-500"><span>0%</span><span>100%</span></div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-zinc-700">Voz inferior</span><Badge>{lowerVoiceVolume}%</Badge></div>
                        <input type="range" min={0} max={100} step={1} value={lowerVoiceVolume} onChange={(event) => setLowerVoiceVolume(Number(event.target.value))} className="aural-range-input w-full accent-sky-600" style={rangeFillStyle(lowerVoiceVolume, 0, 100)} />
                        <div className="flex justify-between text-xs text-zinc-500"><span>0%</span><span>100%</span></div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="grid gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-zinc-700">Instrumento</span><Badge>{selectedInstrument?.label}</Badge></div>
                    <select
                      value={instrument}
                      onChange={(event) => {
                        const nextInstrument = event.target.value;
                        setRandomInstrumentEnabled(false);
                        setRandomizeInstrumentOnExercise(false);
                        setInstrument(nextInstrument);
                        setExercise((current) => current ? { ...current, playbackInstrument: nextInstrument } : current);
                      }}
                      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700 outline-none focus:border-zinc-500"
                    >
                      {INSTRUMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">ALEATORIZACIÓN</span>
                        <Badge>{randomInstrumentEnabled ? "Cambia por ejercicio" : "Mantener instrumento actual"}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={randomizeCurrentInstrument}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-50"
                          title="Elegir otro instrumento aleatorio ahora"
                        >
                          <ShuffleIcon className="h-4 w-4" /> Aleatorio
                        </button>
                        <SelectionChip active={randomInstrumentEnabled} onClick={toggleRandomizeInstrumentOnExercise}>{randomInstrumentEnabled ? "Cambiar instrumento en cada ejercicio" : "Mantener instrumento actual"}</SelectionChip>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="min-w-0 space-y-4 sm:space-y-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
                  <ActionButton onClick={generateExercise}>
                    <RefreshIcon className="h-4 w-4" /> Generar nueva sucesión
                  </ActionButton>
                  <ActionButton onPointerDown={unlockMobileAudioFromGesture} onTouchStart={unlockMobileAudioFromGesture} onClick={() => (isPlaying ? stopPlayback() : playExercise())} disabled={!exercise} active={isPlaying}>
                    {isPlaying ? <StopIcon className="h-4 w-4" /> : <VolumeIcon className="h-4 w-4" />}
                    {isPlaying ? "Detener" : "Escuchar"}
                  </ActionButton>
                  {!isHarmonicExercise(exercise) ? (
                    <ActionButton onPointerDown={unlockMobileAudioFromGesture} onTouchStart={unlockMobileAudioFromGesture} onClick={() => playExercise({ includeCadence: true, includeSequence: false })} disabled={!exercise}>
                      <VolumeIcon className="h-4 w-4" /> Cadencia
                    </ActionButton>
                  ) : null}
                  <ActionButton onPointerDown={unlockMobileAudioFromGesture} onTouchStart={unlockMobileAudioFromGesture} onClick={() => playExercise({ includeCadence: false, includeSequence: true })} disabled={!exercise}>
                    <VolumeIcon className="h-4 w-4" /> {isHarmonicExercise(exercise) ? "Acordes" : "Grados"}
                  </ActionButton>
                  <ActionButton onClick={handleRevealFullAnswer} disabled={!exercise || reveal} active={reveal}>
                    <EyeIcon className="h-4 w-4" /> {reveal ? "Respuesta completa mostrada" : "Mostrar respuesta completa"}
                  </ActionButton>
                  {exerciseComplete || reveal ? (
                    <ActionButton onClick={generateExercise}>
                      <RefreshIcon className="h-4 w-4" /> Siguiente ejercicio
                    </ActionButton>
                  ) : null}
                </div>

                {runtimeError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{runtimeError}</div> : null}

                {exercise ? (
                  <>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                      <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-bold text-zinc-900 shadow-sm">
                        {isHarmonicExercise(exercise) ? harmonicExerciseModeLabel(exercise.harmonicMode) : <>Tonalidad: {exercise.key.label} {exercise.cadenceMode === "minor" ? "menor" : "mayor"}</>}
                      </div>
                      <Badge>{answeredSlots}/{totalSlots}</Badge>
                    </div>
                    <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-sm sm:p-2">
                      {isHarmonicExercise(exercise) ? (
                        <div className="mb-2">
                          <HarmonicChordPlaybackLine
                            events={harmonicPlaybackEvents}
                            playbackStartIndex={playbackStartIndex}
                            playbackCursorIndex={playbackCursorIndex}
                            isPlaying={isPlaying}
                            onTogglePlay={toggleHarmonicPlaybackFromSelection}
                            onSelectPlaybackPoint={selectHarmonicPlaybackPoint}
                            arpeggioSpeed={harmonicArpeggioSpeed}
                            onChangeArpeggioSpeed={setSafeHarmonicArpeggioSpeed}
                            onPlayArpeggio={playHarmonicArpeggioAt}
                          />
                        </div>
                      ) : null}
                      <SafeRenderBoundary resetKey={exercise?.id}>
                        {(exercise?.compound || exercise?.harmonicMode === "sopranoBass") ? <TonalGrandStaff exercise={exercise} attempts={attempts} reveal={reveal} onNotePress={playSingleNote} /> : <TonalStaff exercise={exercise} attempts={attempts} reveal={reveal} onNotePress={playSingleNote} />}
                      </SafeRenderBoundary>
                      <div className="border-t border-zinc-100 px-2 pb-2 pt-1">
                        <TunerPanel notes={flattenExerciseNotes(exercise).map((note) => ({ ...note, label: noteName(note) }))} visible={reveal || exerciseComplete} />
                        {!reveal && !exerciseComplete ? (
                          <PianoKeyboard onPressStart={unlockMobileAudioFromGesture} onPress={handlePianoPress} disabled={false} />
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">Genera una sucesión para comenzar.</div>
                )}
              </div>

              {exercise && reveal ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {!isHarmonicExercise(exercise) ? <FormulaSummary exercise={exercise} /> : null}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
                    <p className="text-sm font-semibold text-zinc-900">Secuencia correcta</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {exercise.sequence.map((_, index) => {
                        const eventNotes = getEventNotes(exercise, index);
                        return <button key={`${exercise.id}-${index}`} type="button" onClick={() => playSingleNote(eventNotes)} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100">{formatEventLabel(exercise, index)} · {eventNotes.map(noteName).join(" / ")}</button>;
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {showProgressPanel ? (
          <div className="fixed inset-x-0 top-0 bottom-[92px] z-40 overflow-hidden bg-white/95 p-3 backdrop-blur sm:bottom-[108px] sm:p-5">
            <div className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Progreso local</p>
                  <p className="text-sm text-zinc-600">Datos guardados en este ordenador o teléfono.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={clearTimeMarks} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100">Borrar marcas</button>
                  <button type="button" onClick={() => setShowProgressPanel(false)} className="aural-mode-active rounded-xl border px-3 py-2 text-xs font-semibold">Cerrar</button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-6">
                <BottomStat label="Guardados" value={savedTotals.savedCount} />
                <BottomStat label="Tiempo total" value={formatTime(savedTotals.totalSeconds)} />
                <BottomStat label="Ejercicios" value={savedTotals.exercises} />
                <BottomStat label="Aciertos" value={savedTotals.correct} />
                <BottomStat label="Errores" value={savedTotals.incorrect} />
                <BottomStat label="Puntuación" value={`${savedTotals.score}/100`} />
              </div>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {timeMarks.length > 0 ? timeMarks.map((mark) => (
                  <div key={mark.id} className="group rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 transition hover:border-zinc-300 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-zinc-500">
                          <span>{formatDateTime(mark.timestamp)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-zinc-600">
                          <span>Tiempo: {formatTime(mark.totalSeconds)}</span>
                          <span>Ejercicios: {mark.exercises}</span>
                          <span>Aciertos: {mark.correct}</span>
                          <span>Errores: {mark.incorrect}</span>
                          <span>Puntuación: {mark.score}/100</span>
                          <span>Modo: {MODE_LABELS[mark.trainerMode] ?? "Funciones melódicas"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTimeMark(mark.id)}
                        aria-label="Eliminar puntaje guardado"
                        title="Eliminar puntaje guardado"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-xs text-zinc-500">Todavía no hay puntajes guardados. Usa “Guardar puntaje” en la barra inferior para guardar un corte de tu sesión.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-0 py-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur sm:px-4 sm:py-3">
          <div className="mx-auto flex w-full max-w-full flex-nowrap items-stretch justify-start gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 pr-10 [-webkit-overflow-scrolling:touch] sm:w-fit sm:justify-center sm:gap-3 sm:px-0 sm:pb-0 sm:pr-0 md:gap-4">
            <div className="min-w-[168px] shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 sm:px-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-[10px] sm:tracking-[0.16em]">Tiempo</p>
                  <p className="truncate text-sm font-bold text-zinc-900 sm:text-base">{formatTime(stats.totalSeconds)}</p>
                </div>
                <div className="flex shrink-0 flex-row items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTimerPaused((current) => !current)}
                    aria-label={timerPaused ? "Reanudar tiempo" : "Pausar tiempo"}
                    title={timerPaused ? "Reanudar tiempo" : "Pausar tiempo"}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${timerPaused ? "aural-black-button" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-100"}`}
                  >
                    {timerPaused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStats((current) => ({ ...current, totalSeconds: 0 }))}
                    aria-label="Reiniciar tiempo"
                    title="Reiniciar tiempo"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-800 transition hover:border-zinc-500 hover:bg-zinc-100"
                  >
                    <TimerResetIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <BottomStat label="Ejercicios" value={stats.exercises} />
            <BottomStat label="Aciertos" value={stats.correct} />
            <BottomStat label="Errores" value={stats.incorrect} />
            <BottomStat label="Puntuación" value={`${score}/100`} />
            <button type="button" onClick={() => addTimeMark("Puntaje guardado")} className="inline-flex min-w-[108px] shrink-0 items-center justify-center gap-2 whitespace-normal rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center text-xs font-semibold leading-tight text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100"><span>Guardar<br />puntaje</span></button>
            <button type="button" onClick={() => setShowProgressPanel((current) => !current)} className={`inline-flex min-w-[92px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${showProgressPanel ? "aural-black-button" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100"}`}>Progreso</button>
            <button type="button" onClick={resetScores} className="inline-flex min-w-[118px] shrink-0 items-center justify-center gap-2 whitespace-normal rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center text-xs font-semibold leading-tight text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100"><ResetIcon className="h-4 w-4 shrink-0" /> <span>Reiniciar<br />puntaje</span></button>
            <button type="button" onClick={resetParameters} className="inline-flex min-w-[118px] shrink-0 items-center justify-center gap-2 whitespace-normal rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center text-xs font-semibold leading-tight text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100"><ResetIcon className="h-4 w-4 shrink-0" /> <span>Reiniciar<br />parámetros</span></button>
          </div>
        </div>
      </div>
    </>
  );
}
