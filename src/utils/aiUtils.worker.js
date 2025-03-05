importScripts('https://cdn.jsdelivr.net/npm/@magenta/music@^1.23.1');

let musicvae = null;

self.onmessage = async (e) => {
  if (e.data.type === 'initialize') {
    try {
      musicvae = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar');
      await musicvae.initialize();
      console.log('MusicVAE initialized in WebWorker');
      self.postMessage({ type: 'initialized' });
    } catch (err) {
      console.error('Error initializing Magenta models in WebWorker:', err);
      self.postMessage({ type: 'error', message: err.message });
    }
  } else if (e.data.type === 'generateControlSequence' && musicvae) {
    const shapes = e.data.shapes;
    const bpm = e.data.bpm || 60;

    try {
      const noteSequence = analyzePattern(shapes, bpm);
      const quantizedSequence = mm.sequences.quantizeNoteSequence(noteSequence, 4);
      const temperature = 0.7;
      const continuedSequence = await musicvae.continueSequence(quantizedSequence, 32, temperature);

      // Generera kontrollinstruktioner med rörelse, synlighet, frekvens och chord-ändringar
      const controlSequence = [];
      const duration = 16; // Total längd på sekvensen i beats
      const numEvents = 20; // Antal händelser att generera

      for (let i = 0; i < numEvents; i++) {
        const event = {
          shapeIndex: Math.floor(Math.random() * shapes.length), // Slumpvis välja en nod
          startTime: (i * duration / numEvents) / 4, // Fördela över tid (i sekunder)
          duration: (duration / numEvents) / 4, // Varje händelse varar en viss tid
        };

        // Rörelse (slumpvis inom spelområdet)
        event.x = Math.floor(Math.random() * 10) * 60 + 30; // Slumpvis grid-position (30-570)
        event.y = Math.floor(Math.random() * 10) * 60 + 30; // Slumpvis grid-position (30-570)

        // Synlighet (50% chans att tända/släcka)
        event.visible = Math.random() < 0.5;

        // Frekvens (baserat på harmoniska toner från MusicVAE)
        const note = continuedSequence.notes[Math.floor(Math.random() * continuedSequence.notes.length)];
        event.frequency = midiToFrequency(note.pitch);

        // 20% chans att ändra chord
        if (Math.random() < 0.2) {
          event.newChord = Math.floor(Math.random() * 6); // Slumpvis chord-index (0-5)
        }

        controlSequence.push(event);
      }

      console.log('Generated control sequence:', controlSequence);
      self.postMessage({ type: 'controlSequence', sequence: controlSequence });
    } catch (err) {
      console.error('Error generating control sequence in WebWorker:', err);
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

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}