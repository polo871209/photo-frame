const NOTES_HZ = [659.25, 523.25];
const NOTE_GAP_S = 0.45;
const NOTE_LENGTH_S = 1.4;

/** Plays a two-note chime. Each chime opens its own AudioContext and closes it, so no audio stream stays open. */
export function playChime() {
  const audio = new AudioContext();
  const start = audio.currentTime + 0.05;
  NOTES_HZ.forEach((hz, index) => {
    const at = start + index * NOTE_GAP_S;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.6, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH_S);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_LENGTH_S);
  });
  const endMs =
    (NOTE_GAP_S * (NOTES_HZ.length - 1) + NOTE_LENGTH_S + 0.2) * 1000;
  setTimeout(() => audio.close(), endMs);
}
