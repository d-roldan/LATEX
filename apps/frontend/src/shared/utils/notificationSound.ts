let audioContext: AudioContext | null = null;
let listenersInstalled = false;

export type NotificationSound = 'campana' | 'suave' | 'digital' | 'industrial' | 'urgente';

export const notificationSoundOptions: Array<{ id: NotificationSound; label: string; description: string }> = [
  { id: 'campana', label: 'Campana', description: 'Doble tono claro' },
  { id: 'suave', label: 'Suave', description: 'Aviso cálido y discreto' },
  { id: 'digital', label: 'Digital', description: 'Tres pulsos electrónicos' },
  { id: 'industrial', label: 'Industrial', description: 'Tono grave de planta' },
  { id: 'urgente', label: 'Urgente', description: 'Alerta rápida y marcada' }
];

type Note = { frequency: number; delay: number; duration: number; gain: number; type: OscillatorType };

const sounds: Record<NotificationSound, Note[]> = {
  campana: [
    { frequency: 880, delay: 0, duration: .17, gain: .18, type: 'sine' },
    { frequency: 1175, delay: .18, duration: .2, gain: .17, type: 'sine' }
  ],
  suave: [
    { frequency: 523, delay: 0, duration: .3, gain: .11, type: 'triangle' },
    { frequency: 659, delay: .16, duration: .36, gain: .1, type: 'triangle' }
  ],
  digital: [
    { frequency: 740, delay: 0, duration: .09, gain: .1, type: 'square' },
    { frequency: 988, delay: .11, duration: .09, gain: .09, type: 'square' },
    { frequency: 1318, delay: .22, duration: .13, gain: .08, type: 'square' }
  ],
  industrial: [
    { frequency: 220, delay: 0, duration: .18, gain: .12, type: 'sawtooth' },
    { frequency: 330, delay: .19, duration: .18, gain: .1, type: 'sawtooth' },
    { frequency: 440, delay: .38, duration: .22, gain: .09, type: 'triangle' }
  ],
  urgente: [
    { frequency: 1047, delay: 0, duration: .12, gain: .14, type: 'square' },
    { frequency: 784, delay: .14, duration: .12, gain: .14, type: 'square' },
    { frequency: 1047, delay: .28, duration: .12, gain: .14, type: 'square' },
    { frequency: 784, delay: .42, duration: .15, gain: .14, type: 'square' }
  ]
};

export async function unlockNotificationSound() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();
}

export function installNotificationSoundUnlock() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  window.addEventListener('pointerdown', unlockNotificationSound, { passive: true });
  window.addEventListener('keydown', unlockNotificationSound);
}

export function playNotificationSound(sound: NotificationSound = 'campana') {
  if (!audioContext || audioContext.state !== 'running') return false;
  const start = audioContext.currentTime;
  sounds[sound].forEach((note) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, start + note.delay);
    gain.gain.setValueAtTime(0.0001, start + note.delay);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + note.delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.delay + note.duration);
    oscillator.connect(gain).connect(audioContext!.destination);
    oscillator.start(start + note.delay);
    oscillator.stop(start + note.delay + note.duration + .01);
  });
  return true;
}

export async function previewNotificationSound(sound: NotificationSound) {
  await unlockNotificationSound();
  return playNotificationSound(sound);
}
