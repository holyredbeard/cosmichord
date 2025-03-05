let audioContext = null;

export function createAudioContext(callback) {
  if (audioContext) return audioContext;

  const create = () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (callback) callback(audioContext);
    return audioContext;
  };

  // Om det redan finns en användarinteraktion, skapa direkt
  if (document.hasFocus() && window.event && window.event.type === 'click') {
    return create();
  }

  // Annars lyssna på första klicket
  window.addEventListener('click', () => {
    create();
  }, { once: true });

  return null; // Returnera null tills användaren klickar
}

export function createOscillator(audioContext, frequency) {
  if (!audioContext) {
    console.error('AudioContext not initialized. Waiting for user interaction.');
    return null;
  }
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
  if (!audioContext) {
    console.error('AudioContext not initialized.');
    return;
  }
  const targetVolume = volume * (isBass && volume <= 110 ? 1.5 : 1);
  gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  gainNode.gain.setTargetAtTime(targetVolume, audioContext.currentTime, 0.01);
}