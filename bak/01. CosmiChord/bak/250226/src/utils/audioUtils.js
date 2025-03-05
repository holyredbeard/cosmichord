export function createAudioContext() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

export function createOscillator(audioContext, frequency) {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';
  if (isFinite(frequency)) {
    oscillator.frequency.setValueAtTime(frequency || 440, audioContext.currentTime);
  } else {
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    console.error('Invalid frequency:', frequency);
  }
  return oscillator;
}

export function updateVolume(gainNode, volume, audioContext, isBass = false) {
  const targetVolume = volume * (isBass && volume <= 110 ? 1.5 : 1);
  gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  gainNode.gain.setTargetAtTime(targetVolume, audioContext.currentTime, 0.01);
}