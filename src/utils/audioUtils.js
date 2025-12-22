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

export function createOscillator(audioContext, frequency) {
  if (!audioContext) {
    console.error('AudioContext not initialized. Waiting for user interaction.');
    return null;
  }
  
  // Skapa huvudoscillator
  const oscillator = audioContext.createOscillator();
  
  // Välj oscillatortyp baserat på frekvensen för varierande textur
  if (frequency < 100) {
    oscillator.type = 'sine'; // Ren, mjuk ton för bastoner
  } else if (frequency < 220) {
    oscillator.type = 'triangle'; // Lite rikare för mellanregister
  } else {
    oscillator.type = 'sine'; // Mjuk för högre toner
  }
  
  if (isFinite(frequency)) {
    oscillator.frequency.setValueAtTime(frequency || 440, audioContext.currentTime);
  } else {
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    console.error('Invalid frequency:', frequency);
  }
  
  // Skapa filter för mjukare klang
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  filter.Q.value = 0.5;
  
  // Skapa suboscillator för rikare ljud (oktav under)
  const subOscillator = audioContext.createOscillator();
  subOscillator.type = 'sine';
  if (isFinite(frequency)) {
    subOscillator.frequency.setValueAtTime(frequency / 2 || 220, audioContext.currentTime);
  }
  
  // Gainnode för suboscillator
  const subGain = audioContext.createGain();
  subGain.gain.value = 0.15; // Lägre volym på suboscillatorn
  
  // Anslut oscillatorerna och filtret
  oscillator.subOscillator = subOscillator; // Spara en referens
  oscillator.filter = filter; // Spara en referens
  subOscillator.connect(subGain);
  
  // Spara originalkopplingen för att kunna återgå till den
  oscillator.connect = (function() {
    const originalConnect = oscillator.connect.bind(oscillator);
    return function(destination) {
      originalConnect(filter);
      filter.connect(destination);
      subGain.connect(destination);
      subOscillator.start();
      return oscillator;
    };
  })();
  
  // Överskuggad stop-metod för att även stoppa suboscillatorn
  const originalStop = oscillator.stop.bind(oscillator);
  oscillator.stop = function(when) {
    originalStop(when);
    if (oscillator.subOscillator) {
      oscillator.subOscillator.stop(when);
    }
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