importScripts('https://cdn.jsdelivr.net/npm/@magenta/music@^1.23.1');

// Globala variabler för Magenta-modeller
let musicvae = null;    // För musikgenerering
let musicrnn = null;    // För mer kontinuerliga ambient sekvenser
let improv = null;      // För improvisationer inom en tonalitet

// Muser-modellen är bra för ambienta ljud (tonala improvisationer)
const MUSER_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv';
// Ambient-specifik MusicVAE modell
const AMBIENT_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_med_lokl_q2';

self.onmessage = async (e) => {
  if (e.data.type === 'initialize') {
    try {
      // Initiera flera modeller för rikare ambienta ljudmattor
      console.log('Initializing Magenta models...');
      
      // Huvudmodell för melodigenerering
      musicvae = new mm.MusicVAE(AMBIENT_CHECKPOINT);
      await musicvae.initialize();
      console.log('MusicVAE initialized');
      
      // För mer kontinuerliga ambient flöden
      musicrnn = new mm.MusicRNN(MUSER_CHECKPOINT);
      await musicrnn.initialize();
      console.log('MusicRNN initialized');
      
      // För improvisationsbaserad ambient musik
      improv = new mm.PianoGenie('https://storage.googleapis.com/magentadata/js/checkpoints/piano_genie/model/epiano/stp_iq_auto_contour_dt_166006');
      await improv.initialize();
      console.log('PianoGenie initialized');
      
      self.postMessage({ type: 'initialized' });
    } catch (err) {
      console.error('Error initializing Magenta models in WebWorker:', err);
      self.postMessage({ type: 'error', message: err.message });
    }
  } else if (e.data.type === 'generateControlSequence') {
    const shapes = e.data.shapes;
    const bpm = e.data.bpm || 60;
    // Få ambient-parametrar från meddelandet eller använd defaults
    const ambientParams = e.data.ambientParams || {
      temperature: 0.2,
      ambientMode: false,
      noteDuration: 1.0,
      reverb: 0.3,
      isMinor: false,
      ambientPadDensity: 0.3
    };

    try {
      // Generera mer ambient-fokuserade kontrollsekvenser
      await generateAmbientSequence(shapes, bpm, ambientParams);
    } catch (err) {
      console.error('Error generating ambient sequence in WebWorker:', err);
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};

/**
 * Generar en ambient musik- och kontrollsekvens baserat på befintliga former
 */
async function generateAmbientSequence(shapes, bpm, ambientParams) {
  // Steg 1: Analysera befintliga former för att identifiera harmonisk grund
  const rootAnalysis = analyzeHarmonicContext(shapes, ambientParams);
  
  // Steg 2: Skapa en grundläggande musiksekvens baserad på de identifierade formerna
  const seedSequence = createSeedSequence(shapes, rootAnalysis, bpm, ambientParams);
  console.log('Created seed sequence:', seedSequence);
  
  // Steg 3: Generera ambient musikmaterial med MusicVAE och MusicRNN
  const ambientSequence = await generateMusicMaterial(seedSequence, rootAnalysis, bpm, ambientParams);
  console.log('Generated ambient sequence:', ambientSequence);
  
  // Steg 4: Skapa kontrollsekvens för former baserat på den genererade musiken
  const controlSequence = createAmbientControlSequence(shapes, ambientSequence, rootAnalysis, bpm, ambientParams);
  console.log('Generated control sequence:', controlSequence);
  
  // Skicka kontrollsekvensen till huvudtråden
  self.postMessage({ type: 'controlSequence', sequence: controlSequence });
}

/**
 * Analyserar de harmoniska egenskaperna hos formerna för att hitta grundtonen och skalan
 */
function analyzeHarmonicContext(shapes, ambientParams) {
  // Samla alla frekvenser
  const freqs = shapes.map(shape => shape.frequency).filter(f => isFinite(f));
  
  // Konvertera till MIDI-toner
  const midiNotes = freqs.map(freq => frequencyToMidi(freq));
  
  // Hitta grundton (lägsta tonen)
  const lowestNote = Math.min(...midiNotes);
  
  // Bestäm tonart (enkel heuristik baserad på tonfördelning)
  const notesModulo12 = midiNotes.map(note => note % 12).sort();
  
  // Använd antingen dur- eller mollskalor baserat på ambient-parametrar
  let scale = ambientParams.isMinor 
    ? [0, 2, 3, 5, 7, 8, 10] // Naturlig moll
    : [0, 2, 4, 5, 7, 9, 11]; // Dur
  
  // Särskilda ambient-skalor om det anges
  if (ambientParams.scaleType === 'pentatonic') {
    scale = ambientParams.isMinor 
      ? [0, 3, 5, 7, 10]      // Moll-pentatonisk
      : [0, 2, 4, 7, 9];      // Dur-pentatonisk
  } else if (ambientParams.scaleType === 'wholetone') {
    scale = [0, 2, 4, 6, 8, 10]; // Heltonsskala (bra för ambient)
  } else if (ambientParams.scaleType === 'chromatic') {
    scale = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Kromatisk (alla toner)
  }
  
  return {
    rootNote: lowestNote,
    scale: scale,
    isMajor: !ambientParams.isMinor,
    midiNotes: midiNotes,
    duration: 16, // Standard 4 bars för ambient
    ambientParams
  };
}

/**
 * Skapar en grundläggande musiksekvens baserad på befintliga former
 */
function createSeedSequence(shapes, rootAnalysis, bpm, ambientParams) {
  const { rootNote, scale, duration } = rootAnalysis;
  const beatDuration = 60 / bpm;
  
  // Grundläggande noter baserade på formerna
  const notes = shapes.map((shape, index) => {
    const midiNote = frequencyToMidi(shape.frequency);
    // Använd parametrar från ambient-inställningar för not-längd
    const noteLength = ambientParams.noteDuration || 1.5;
    return {
      pitch: midiNote,
      startTime: index * 0.5, // Fördela över tiden
      endTime: index * 0.5 + noteLength, // Längre noter för ambient känsla
      velocity: 50 + Math.floor(Math.random() * 30) // Mjuk dynamik
    };
  });
  
  // Lägg till några långsamma ackord i bakgrunden för ambient känsla
  // Justera täthet baserat på ambient-parametrar
  const padDensity = ambientParams.ambientPadDensity || 0.3;
  const numPads = Math.floor(4 * padDensity) + 1;
  
  for (let i = 0; i < numPads; i++) {
    const chordRoot = rootNote + (i % 3) * 4; // Enkel progression
    
    // Skapa ett ambient-ackord
    notes.push({
      pitch: chordRoot,
      startTime: i * 4,
      endTime: i * 4 + 3.9,
      velocity: 40 // Mycket låg, bakgrundsljud
    });
    
    // Lägg till ters och kvint
    const third = scale.includes(3) ? 3 : 4; // Moll eller dur ters
    notes.push({
      pitch: chordRoot + third,
      startTime: i * 4 + 0.2, // Aningen förskjutet 
      endTime: i * 4 + 3.7,
      velocity: 35
    });
    
    notes.push({
      pitch: chordRoot + 7, // Kvint
      startTime: i * 4 + 0.4, // Ytterligare förskjutet
      endTime: i * 4 + 3.8,
      velocity: 38
    });
  }
  
  return {
    notes,
    totalTime: duration,
    tempos: [{ time: 0, qpm: bpm }]
  };
}

/**
 * Genererar ambient musikmaterial med MusicVAE och MusicRNN
 */
async function generateMusicMaterial(seedSequence, rootAnalysis, bpm, ambientParams) {
  const { rootNote, scale, isMajor, duration } = rootAnalysis;
  
  // Kvantisera sekvensen för Magenta-modellerna (fjärdedelar)
  const quantizedSequence = mm.sequences.quantizeNoteSequence(seedSequence, 4);
  
  // Generera variationer med MusicVAE
  // Använd temperatur från ambient-parametrar
  const temperature = ambientParams.temperature || 0.2;
  let generatedSequence;
  
  if (musicvae) {
    // Försök med MusicVAE först för mer kreativa resultat
    generatedSequence = await musicvae.continueSequence(quantizedSequence, duration, temperature);
  } else if (musicrnn) {
    // Fallback till MusicRNN om MusicVAE inte är tillgänglig
    generatedSequence = await musicrnn.continueSequence(quantizedSequence, duration, temperature);
  } else {
    // Om inga modeller är tillgängliga, använd originalsekvensen
    generatedSequence = quantizedSequence;
  }
  
  // Post-process för att säkerställa att det passar ambient-estetiken
  const ambientSequence = postProcessAmbientSequence(generatedSequence, rootAnalysis);
  
  return ambientSequence;
}

/**
 * Efterbearbetar den genererade sekvensen för att göra den mer ambient
 */
function postProcessAmbientSequence(sequence, rootAnalysis) {
  const { rootNote, scale, midiNotes, ambientParams } = rootAnalysis;
  const notes = sequence.notes.slice(); // Kopiera noter
  
  // Filtrera bort dissonanta toner och normalisera till skalan
  const processedNotes = notes.map(note => {
    // Justera tonhöjd till skalan
    const noteClass = note.pitch % 12;
    const octave = Math.floor(note.pitch / 12);
    
    // Hitta närmaste ton i skalan
    let closestScaleNote = noteClass;
    let minDistance = 100;
    
    for (const scaleNote of scale) {
      const distance = Math.abs(noteClass - scaleNote);
      if (distance < minDistance) {
        minDistance = distance;
        closestScaleNote = scaleNote;
      }
    }
    
    // Uppdatera tonhöjden till den närmaste skaltonen
    note.pitch = (octave * 12) + closestScaleNote;
    
    // Förläng noter för mer ambient känsla (om de är korta)
    // Använd noteDuration från ambient-parametrar
    const minNoteDuration = ambientParams.noteDuration || 0.5;
    const noteDuration = note.endTime - note.startTime;
    if (noteDuration < minNoteDuration) {
      note.endTime = note.startTime + (minNoteDuration + Math.random() * 1.5);
    }
    
    // Minska velocity för mjukare känsla
    note.velocity = Math.min(note.velocity, 80);
    
    return note;
  });
  
  // Lägg till några extra ambient pad-toner med lång duration
  // Justera antal och längd baserat på ambient-parametrar
  const padDensity = ambientParams.ambientPadDensity || 0.6;
  const numPads = Math.floor(8 * padDensity);
  
  for (let i = 0; i < numPads; i++) {
    // Mycket långa pad-toner för mer ambient-känsla
    const padDuration = 3 + Math.random() * 5;
    
    const padNote = {
      pitch: rootNote + Math.floor(Math.random() * 12),
      startTime: i * 2,
      endTime: i * 2 + padDuration,
      velocity: 30 + Math.floor(Math.random() * 20)
    };
    processedNotes.push(padNote);
  }
  
  // Uppdatera sekvensen
  sequence.notes = processedNotes;
  return sequence;
}

/**
 * Skapar kontrollsekvens för former baserat på den genererade musiken
 */
function createAmbientControlSequence(shapes, musicSequence, rootAnalysis, bpm, ambientParams) {
  const { rootNote, scale, duration } = rootAnalysis;
  const controlSequence = [];
  
  // Antalet händelser baserat på noternas densitet och ambient-parametrar
  const densityFactor = ambientParams.ambientMode ? 0.8 : 1.0;
  const numEvents = Math.min(30, Math.max(15, musicSequence.notes.length * densityFactor));
  
  // Gruppera noter efter starttid för att hitta ackordkluster
  const notesByTime = {};
  musicSequence.notes.forEach(note => {
    const timeKey = Math.floor(note.startTime * 4) / 4; // Kvantisera till 16-delar
    if (!notesByTime[timeKey]) {
      notesByTime[timeKey] = [];
    }
    notesByTime[timeKey].push(note);
  });
  
  // Sortera tidpunkterna
  const times = Object.keys(notesByTime)
    .map(Number)
    .sort((a, b) => a - b);
  
  // Skapa händelser baserade på musikala händelser
  let prevChord = null;
  times.forEach((time, timeIndex) => {
    const notes = notesByTime[time];
    if (notes.length < 1) return;
    
    // För ambient-läge, skapa mjukare, mer spatiala rörelser
    const isAmbientMode = ambientParams.ambientMode;
    
    // Hämta en slumpmässig form för varje ton
    notes.forEach((note, noteIndex) => {
      // I ambient-läge, ignorera fler händelser för mer subtil rörelse
      const eventProbability = isAmbientMode ? 0.5 : 0.7;
      if (Math.random() < eventProbability) { 
        // Välj en lämplig form att kontrollera
        const shapeIndex = Math.floor(Math.random() * shapes.length);
        const shape = shapes[shapeIndex];
        
        const event = {
          shapeIndex: shapeIndex,
          startTime: time / 4, // Konvertera till sekunder
          // Längre händelser i ambient-läge
          duration: isAmbientMode 
            ? Math.min(6, (note.endTime - note.startTime) / 2) 
            : Math.min(4, (note.endTime - note.startTime) / 4)
        };
        
        // Frekvens från MIDI-ton
        event.frequency = midiToFrequency(note.pitch);
        
        // Högre sannolikhet för synlighet i ambient-läge
        const visibilityProb = isAmbientMode ? 0.9 : 0.8;
        event.visible = Math.random() < visibilityProb;
        
        // Rörelse - långsam, medveten rörelse för ambient känsla
        if (isAmbientMode) {
          // Skapar mer cirkulära, fluidiska rörelser för ambient läge
          const movePhase = (timeIndex / times.length) * Math.PI * 2;
          const moveRadius = 100 + Math.random() * 200;
          const centerX = 400; // Ungefärlig skärmcenter
          const centerY = 400;
          
          // Använd mjukare sinusrörelser för ambient-läge
          const amplitude = 80 + Math.random() * 120;
          const angle = movePhase + (noteIndex * Math.PI / 8);
          
          event.x = centerX + Math.cos(angle) * moveRadius;
          event.y = centerY + Math.sin(angle) * moveRadius;
        } else {
          // Lite mindre förutsägbara rörelser för icke-ambient läge
          const moveAngle = (timeIndex / times.length) * Math.PI * 2;
          const moveDistance = 100 + Math.random() * 200;
          const centerX = 400;
          const centerY = 400;
          
          event.x = centerX + Math.cos(moveAngle) * moveDistance;
          event.y = centerY + Math.sin(moveAngle) * moveDistance;
        }
        
        // Kontrollera gränser
        event.x = Math.max(30, Math.min(770, event.x));
        event.y = Math.max(80, Math.min(770, event.y));
        
        // För ambient läge, lägg också till volym-parametern
        if (isAmbientMode) {
          // Mjukare, lägre volym för ambient ljud
          event.volume = 0.3 + Math.random() * 0.4;
        }
        
        controlSequence.push(event);
      }
    });
    
    // Ackordförändringar sker mindre ofta i ambient läge
    if (notes.length >= 3) {
      const currentNotes = notes.map(n => n.pitch % 12).sort();
      const currentChord = currentNotes.join(',');
      
      if (currentChord !== prevChord) {
        prevChord = currentChord;
        
        // Identifiera vilken ackordfärg detta mest liknar
        let bestMatchIndex = 0;
        let bestMatchScore = -1;
        
        // Testa mot alla fördefinierade ackord
        for (let chordIndex = 0; chordIndex < 6; chordIndex++) {
          // Förenklad matchning baserad på mollartat vs durartat
          const isMajorChord = [0, 3, 5].includes(chordIndex);
          const score = isMajorChord === rootAnalysis.isMajor ? 5 : 2;
          
          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatchIndex = chordIndex;
          }
        }
        
        // I ambient-läge, färre men tydligare ackordbyten
        const chordChangeProbability = isAmbientMode ? 0.25 : 0.4;
        if (Math.random() < chordChangeProbability) {
          controlSequence.push({
            startTime: time / 4,
            duration: 0.1,
            newChord: bestMatchIndex
          });
        }
      }
    }
  });
  
  // Sortera på starttid
  return controlSequence.sort((a, b) => a.startTime - b.startTime);
}

// Hjälpfunktioner för konvertering mellan frekvens och MIDI
function frequencyToMidi(frequency) {
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}