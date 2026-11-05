let audioContext = null;

export function createAudioContext(callback) {
  if (audioContext) return audioContext;

  const create = () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Skapa och konfigurera en convolution reverb för ambient ljud
    createConvolutionReverb(audioContext).then(reverb => {
      audioContext.masterReverb = reverb;
      // Anslut reverben till master output
      reverb.connect(audioContext.destination);
      console.log('Master reverb created');
    });
    
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

async function createConvolutionReverb(audioContext, impulseURL = '/audio/small-hall.wav') {
  try {
    // Skapa en fallback-impulssvar om den externa filen inte kan laddas
    const convolver = audioContext.createConvolver();
    const impulseLength = audioContext.sampleRate * 2.5; // 2.5 sekunder reverb
    const impulse = audioContext.createBuffer(2, impulseLength, audioContext.sampleRate);
    
    // Skapa ett syntesiskt reverb-impulssvar
    for (let channel = 0; channel < 2; channel++) {
      const impulseData = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        // Exponentiellt avtagande brus för reverb-effekt
        impulseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (impulseLength * 0.3));
      }
    }
    
    convolver.buffer = impulse;
    
    try {
      // Försök ladda den externa impulssvarsfilen för bättre kvalitet
      const response = await fetch(impulseURL);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      convolver.buffer = decodedBuffer;
      console.log('Loaded impulse response from:', impulseURL);
    } catch (e) {
      console.warn('Could not load impulse response, using synthetic fallback', e);
    }
    
    return convolver;
  } catch (e) {
    console.error('Error creating reverb:', e);
    return audioContext.createGain(); // Returnera en vanlig gain-nod som fallback
  }
}

export function createOscillator(audioContext, frequency, oscType) {
  if (!audioContext) {
    console.error('AudioContext not initialized. Waiting for user interaction.');
    return null;
  }
  
  // Skapa huvudoscillator
  const oscillator = audioContext.createOscillator();
  
  const freq = isFinite(frequency) && frequency > 0 ? frequency : 440;

  // Rena sinustoner under ~150 Hz (Celestial börjar på 55 Hz) hörs knappt
  // i laptop-högtalare. Sågtand plus en oktav över ger en tydlig ton.
  let type = oscType;
  if (!type) {
    type = freq < 180 ? 'sawtooth' : freq < 360 ? 'triangle' : 'sine';
  }
  if ((type === 'sine' || type === 'triangle') && freq < 150) type = 'sawtooth';
  oscillator.type = type;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq < 180 ? 1400 : 2200;
  filter.Q.value = 0.6;

  const harmonic = audioContext.createOscillator();
  harmonic.type = 'sine';
  const harmonicGain = audioContext.createGain();
  harmonicGain.gain.value = freq < 180 ? 0.55 : 0.22;
  harmonic.frequency.value = freq * 2;
  harmonic.connect(harmonicGain);

  const freqParam = oscillator.frequency;
  const origSetTarget = freqParam.setTargetAtTime.bind(freqParam);
  const origSetValue = freqParam.setValueAtTime.bind(freqParam);
  const trackHarmonic = (value, time, constant) => {
    const harmFreq = Math.max(40, Number(value) * 2);
    if (!isFinite(harmFreq)) return;
    if (constant !== undefined) {
      harmonic.frequency.setTargetAtTime(harmFreq, time, constant);
    } else {
      harmonic.frequency.setValueAtTime(harmFreq, time);
    }
  };
  freqParam.value = freq;
  freqParam.setTargetAtTime = (value, time, constant) => {
    const result = origSetTarget(value, time, constant);
    trackHarmonic(value, time, constant);
    return result;
  };
  freqParam.setValueAtTime = (value, time) => {
    const result = origSetValue(value, time);
    trackHarmonic(value, time);
    return result;
  };

  oscillator.filter = filter;
  oscillator.harmonic = harmonic;

  let connected = false;
  let started = false;
  const originalConnect = oscillator.connect.bind(oscillator);
  oscillator.connect = (destination) => {
    if (!connected) {
      originalConnect(filter);
      connected = true;
    }
    try { filter.connect(destination); } catch (err) { /* redan ansluten */ }
    try { harmonicGain.connect(destination); } catch (err) { /* redan ansluten */ }
    return oscillator;
  };

  const originalStart = oscillator.start.bind(oscillator);
  oscillator.start = (when) => {
    if (started) return oscillator;
    started = true;
    originalStart(when);
    try { harmonic.start(when); } catch (err) { /* redan startad */ }
    return oscillator;
  };

  const originalStop = oscillator.stop.bind(oscillator);
  oscillator.stop = (when) => {
    try { originalStop(when); } catch (err) { /* redan stoppad */ }
    try { harmonic.stop(when); } catch (err) { /* redan stoppad */ }
  };

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

// Funktion för att ansluta ljud till masterreverb
export function connectToReverb(source, audioContext, amount = 0.3) {
  if (!audioContext || !audioContext.masterReverb) {
    return source;
  }
  
  // Skapa dry/wet-mix för reverb
  const dry = audioContext.createGain();
  const wet = audioContext.createGain();
  
  dry.gain.value = 1 - amount;
  wet.gain.value = amount;
  
  source.connect(dry);
  source.connect(wet);
  
  dry.connect(audioContext.destination);
  wet.connect(audioContext.masterReverb);
  
  return source;
}