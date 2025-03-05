// src/utils/aiUtils.worker.js
importScripts('https://cdn.jsdelivr.net/npm/@magenta/music@^1.23.1');

let musicvae = null;
let magentaPlayer = null;
let audioReady = false;

self.onmessage = async (e) => {
  if (e.data.type === 'initialize') {
    try {
      // Initialize MusicVAE with a small, ambient-appropriate checkpoint
      musicvae = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar');
      await musicvae.initialize();
      console.log('MusicVAE initialized in WebWorker');

      // Vänta på resumeAudio innan vi skapar SoundFontPlayer
      self.postMessage({ type: 'awaitingGesture' });
    } catch (err) {
      console.error('Error initializing Magenta models in WebWorker:', err);
      self.postMessage({ type: 'error', message: err.message });
    }
  } else if (e.data.type === 'resumeAudio' && !audioReady) {
    try {
      magentaPlayer = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');
      magentaPlayer.callbackObject = {
        noteOn: (time, pitch) => {
          self.postMessage({
            type: 'visualFeedback',
            shapes: [Math.floor(Math.random() * 6)]
          });
        },
        noteOff: (time, pitch) => {}
      };
      audioReady = true;
      self.postMessage({ type: 'audioReady' });
    } catch (err) {
      console.error('Error initializing Magenta player:', err);
      self.postMessage({ type: 'error', message: err.message });
    }
  } else if (e.data.type === 'generateSoundscape' && musicvae && magentaPlayer && audioReady) {
    const shapes = e.data.shapes;
    const bpm = e.data.bpm || 60;

    try {
      const noteSequence = analyzePattern(shapes, bpm);
      const quantizedSequence = mm.sequences.quantizeNoteSequence(noteSequence, 4);
      const temperature = 0.7;
      const continuedSequence = await musicvae.continueSequence(quantizedSequence, 32, temperature);

      magentaPlayer.start(continuedSequence);
      self.postMessage({ type: 'soundscape', sequence: continuedSequence });
    } catch (err) {
      console.error('Error generating soundscape in WebWorker:', err);
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};

function analyzePattern(shapes, bpm) {
  const beatDuration = 60 / bpm;
  const notes = shapes.map(shape => ({
    pitch: frequencyToMidi(shape.frequency),
    startTime: 0,
    endTime: 4,
  }));

  return {
    notes,
    totalTime: 16,
    tempos: [{ time: 0, qpm: bpm }],
  };
}

function frequencyToMidi(frequency) {
  return 12 * Math.log2(frequency / 440) + 69;
}