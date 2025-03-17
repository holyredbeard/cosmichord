import { themes, activeTheme } from '../config/themes';

export function createUI(scene) {
  const sliderContainer = document.createElement('div');
  sliderContainer.id = 'sliderContainer';
  sliderContainer.className = 'slider-container';
  document.getElementById('renderDiv').appendChild(sliderContainer);

  const logoImg = document.getElementById('logoImg');
  if (!logoImg) {
    const logo = document.createElement('img');
    logo.id = 'logoImg';
    logo.className = 'logo-img';
    logo.src = '/images/logo.png';
    logo.onload = () => console.log('Logo loaded successfully');
    logo.onerror = (e) => console.error('Failed to load logo.png:', e);
    document.getElementById('renderDiv').appendChild(logo);
  }

  const particleCountContainer = document.createElement('div');
  particleCountContainer.className = 'slider-item';
  particleCountContainer.innerHTML = `
    <label>Particles: <span id="particleCount">20</span></label>
    <input type="range" min="5" max="50" value="20" id="particleSlider">
  `;
  sliderContainer.appendChild(particleCountContainer);

  const speedContainer = document.createElement('div');
  speedContainer.className = 'slider-item';
  speedContainer.innerHTML = `
    <label>BPM: <span id="speedValue">90</span></label>
    <input type="range" min="0.1" max="5" value="1.5" step="0.1" id="speedSlider">
  `;
  sliderContainer.appendChild(speedContainer);

  const volumeContainer = document.createElement('div');
  volumeContainer.className = 'slider-item';
  volumeContainer.innerHTML = `
    <label>Volume: <span id="volumeValue">0.3</span></label>
    <input type="range" min="0" max="0.5" value="0.3" step="0.1" id="volumeSlider">
  `;
  sliderContainer.appendChild(volumeContainer);

  const blendContainer = document.createElement('div');
  blendContainer.className = 'toggle-container';
  blendContainer.innerHTML = `
    <label>Blend:</label>
    <button id="blendToggle">Off</button>
  `;
  sliderContainer.appendChild(blendContainer);

  const panContainer = document.createElement('div');
  panContainer.className = 'toggle-container';
  panContainer.innerHTML = `
    <label>Pan:</label>
    <button id="panToggle">Off</button>
  `;
  sliderContainer.appendChild(panContainer);

  const chordContainer = document.createElement('div');
  chordContainer.className = 'slider-item';
  chordContainer.innerHTML = `
    <label>Chord: <span id="chordValue" style="color: #0000ff;">Celestial</span></label>
    <input type="range" min="0" max="5" value="0" id="chordSlider">
  `;
  sliderContainer.appendChild(chordContainer);

  const armLengthContainer = document.createElement('div');
  armLengthContainer.className = 'slider-item';
  armLengthContainer.innerHTML = `
    <label>Arm Length: <span id="armLengthValue">100</span></label>
    <input type="range" min="50" max="200" value="100" id="armLengthSlider">
  `;
  sliderContainer.appendChild(armLengthContainer);

  const randomContainer = document.createElement('div');
  randomContainer.className = 'button-container';
  randomContainer.innerHTML = `
    <button id="randomButton">RANDOM</button>
    <button id="liveButton">LIVE</button>
    <button id="aiAmbientButton">AI AMBIENT</button>
  `;
  sliderContainer.appendChild(randomContainer);

  const resetContainer = document.createElement('div');
  resetContainer.className = 'button-container';
  resetContainer.innerHTML = `
    <button id="resetButton">RESET</button>
    <button id="pauseButton">PAUSE</button>
  `;
  sliderContainer.appendChild(resetContainer);

  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggleMenu';
  toggleButton.className = 'toggle-menu';
  toggleButton.innerHTML = 'HIDE MENU';
  document.getElementById('renderDiv').appendChild(toggleButton);
}

export function updateUI(scene, particleCount, particleSpeed, masterVolume, harmonicEnabled, panEnabled) {
  document.getElementById('particleCount').textContent = particleCount;
  const minSpeed = 0.1;
  const maxSpeed = 5;
  const minBPM = 30;
  const maxBPM = 180;
  const bpm = Math.round(minBPM + (maxBPM - minBPM) * (particleSpeed - minSpeed) / (maxSpeed - minSpeed));
  document.getElementById('speedValue').textContent = bpm;
  document.getElementById('volumeValue').textContent = masterVolume;
  document.getElementById('particleSlider').value = particleCount;
  document.getElementById('speedSlider').value = particleSpeed;
  document.getElementById('volumeSlider').value = masterVolume;
  document.getElementById('armLengthValue').textContent = scene.nodeRadius || 100;
  document.getElementById('armLengthSlider').value = scene.nodeRadius || 100;

  const blendButton = document.getElementById('blendToggle');
  blendButton.textContent = harmonicEnabled ? 'Ambient' : 'Off';
  blendButton.style.background = harmonicEnabled ? '#00cc00' : '#333';

  const panButton = document.getElementById('panToggle');
  panButton.textContent = panEnabled ? 'On' : 'Off';
  panButton.style.background = panEnabled ? '#2ecc71' : '#333';

  const aiAmbientButton = document.getElementById('aiAmbientButton');
  if (aiAmbientButton) {
    aiAmbientButton.style.background = scene.ambientModeActive ? '#9932CC' : '#333';
  }
}

export function handleUIEvents(scene) {
  document.getElementById('particleSlider').addEventListener('input', (e) => {
    const newCount = parseInt(e.target.value);
    scene.updateParticleCount(newCount);
    updateUI(scene, newCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
  });

  document.getElementById('speedSlider').addEventListener('input', (e) => {
    const minSpeed = 0.1;
    const maxSpeed = 5;
    const minBPM = 30;
    const maxBPM = 180;
    scene.particleSpeed = parseFloat(e.target.value);
    const bpm = Math.round(minBPM + (maxBPM - minBPM) * (scene.particleSpeed - minSpeed) / (maxSpeed - minSpeed));
    document.getElementById('speedValue').textContent = bpm;
  
    if (scene.isLive && scene.liveTimer) {
      scene.liveTimer.remove();
      setupLiveMode(scene);
    }
  });

  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    scene.masterVolume = parseFloat(e.target.value);
    document.getElementById('volumeValue').textContent = scene.masterVolume;
    scene.shapes.forEach(shape => {
      if (shape.gain) {
        const targetVolume = shape.baseVolume * scene.masterVolume * (shape.frequency <= 110 ? 1.5 : 1);
        shape.currentVolume = targetVolume;
        shape.gain.gain.setTargetAtTime(targetVolume, scene.audioContext.currentTime, 0.01);
      }
    });
  });

  document.getElementById('blendToggle').addEventListener('click', (e) => {
    scene.harmonicEnabled = !scene.harmonicEnabled;
    e.target.textContent = scene.harmonicEnabled ? 'Ambient' : 'Off';
    e.target.style.background = scene.harmonicEnabled ? '#00cc00' : '#333';
    e.target.style.width = '70px';
    
    scene.shapes.forEach(shape => {
      if (shape.oscillator && scene.audioContext && scene.audioContext.state === 'running') {
        if (!scene.harmonicEnabled) {
          shape.oscillator.frequency.cancelScheduledValues(scene.audioContext.currentTime);
          shape.oscillator.frequency.setTargetAtTime(
            shape.frequency,
            scene.audioContext.currentTime,
            1.0
          );
        }
        
        if (shape.oscillator.filter) {
          const filterFreq = scene.harmonicEnabled ? 1800 : 2200;
          shape.oscillator.filter.frequency.cancelScheduledValues(scene.audioContext.currentTime);
          shape.oscillator.filter.frequency.setTargetAtTime(
            filterFreq,
            scene.audioContext.currentTime,
            0.5
          );
        }
      }
    });
  });

  document.getElementById('panToggle').addEventListener('click', (e) => {
    scene.panEnabled = !scene.panEnabled;
    e.target.textContent = scene.panEnabled ? 'On' : 'Off';
    e.target.style.background = scene.panEnabled ? '#2ecc71' : '#333';
    e.target.style.width = '60px';

    scene.shapes.forEach(shape => {
      if (shape.stereoPanner) {
        const targetPan = scene.panEnabled ? scene.calculatePan(shape.i) : 0;
        shape.stereoPanner.pan.cancelScheduledValues(scene.audioContext.currentTime);
        shape.stereoPanner.pan.setTargetAtTime(targetPan, scene.audioContext.currentTime, 0.2);
      }
    });
  });

  document.getElementById('armLengthSlider').addEventListener('input', (e) => {
    const newRadius = parseInt(e.target.value);
    if (scene.updateNodeRadius) {
      scene.updateNodeRadius(newRadius);
    } else {
      // Fallback för äldre versioner
      scene.nodeRadius = newRadius;
    }
    document.getElementById('armLengthValue').textContent = newRadius;
    updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
  });

  const chordSlider = document.getElementById('chordSlider');
  const chordValue = document.getElementById('chordValue');
  const chordColors = scene.chordColors;

  chordSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    const { color, label, frequencies, key } = chordColors[value];
    const textColors = {
      'Celestial': '#0000ff',
      'Mystical': '#800080',
      'Minor': '#FFA500',
      'Bright': '#ffff00',
      'Dreamy': '#00ff00',
      'Dark': '#ff0000'
    };
    chordValue.textContent = label;
    chordValue.style.color = textColors[label] || '#0000ff'; // Säkerhetsnät för undefined
    chordSlider.style.setProperty('--thumb-color', color);
    chordSlider.style.setProperty('--thumb-text', `"${key}"`);

    scene.shapes.forEach((shape, index) => {
      if (index < frequencies.length) {
        shape.frequency = frequencies[index];
        if (shape.oscillator) {
          shape.oscillator.frequency.cancelScheduledValues(scene.audioContext?.currentTime || 0);
          shape.oscillator.frequency.setTargetAtTime(shape.frequency, scene.audioContext?.currentTime || 0, 0.1);
        }
      }
    });
    scene.defaultFrequencies = frequencies;
  });

  document.getElementById('randomButton').addEventListener('click', () => {
    const config = {
      shapes: [],
      particleCount: Math.floor(Math.random() * 31) + 10,
      particleSpeed: (Math.random() * 2.5 + 0.5).toFixed(1),
      masterVolume: 0.3,
      harmonicEnabled: Math.random() > 0.5,
      panEnabled: Math.random() > 0.5,
      defaultFrequencies: scene.chordColors[Math.floor(Math.random() * 6)].frequencies,
      nodeRadius: Math.floor(Math.random() * 151) + 50
    };

    scene.shapes.forEach(shape => {
      shape.graphics.destroy();
      if (shape.oscillator) shape.oscillator.stop();
      if (shape.oscillator) shape.oscillator.disconnect();
      if (shape.gain) shape.gain.disconnect();
      if (shape.stereoPanner) shape.stereoPanner.disconnect();
    });
    scene.shapes = [];

    const shapeTypes = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
    const numShapes = Math.floor(Math.random() * 8) + 3;
    const placedPositions = new Set();
    
    for (let n = 0; n < numShapes; n++) {
      let attempts = 0;
      let i, j;
      do {
        i = Math.floor(Math.random() * scene.gridCols);
        j = Math.floor(Math.random() * scene.gridRows);
        attempts++;
        if (attempts > 50) break;
      } while (
        placedPositions.has(`${i},${j}`) || 
        i * scene.gridSize + scene.gridSize / 2 < scene.playAreaLeft ||
        i * scene.gridSize + scene.gridSize / 2 > scene.playAreaRight ||
        j * scene.gridSize + scene.gridSize / 2 < scene.playAreaTop ||
        j * scene.gridSize + scene.gridSize / 2 > scene.playAreaBottom
      );
      
      if (attempts > 50) continue;
      
      placedPositions.add(`${i},${j}`);
      const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
      const mockPointer = { x: i * scene.gridSize + scene.gridSize / 2, y: j * scene.gridSize + scene.gridSize / 2 };
      scene.placeShape(mockPointer, randomType);
    }

    scene.particleCount = config.particleCount;
    scene.particleSpeed = parseFloat(config.particleSpeed);
    scene.masterVolume = config.masterVolume;
    scene.harmonicEnabled = config.harmonicEnabled;
    scene.panEnabled = config.panEnabled;
    scene.defaultFrequencies = config.defaultFrequencies;
    scene.nodeRadius = config.nodeRadius;

    updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
    scene.updateParticleCount(scene.particleCount);

    const chordIndex = Object.keys(scene.chordColors).find(index =>
      JSON.stringify(scene.chordColors[index].frequencies) === JSON.stringify(scene.defaultFrequencies)
    ) || 0;
    document.getElementById('chordSlider').value = chordIndex;
    document.getElementById('chordValue').textContent = scene.chordColors[chordIndex].label;
    document.getElementById('chordValue').style.color = textColors[scene.chordColors[chordIndex].label] || '#0000ff';
    document.getElementById('chordSlider').style.setProperty('--thumb-color', scene.chordColors[chordIndex].color);
    document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${scene.chordColors[chordIndex].key}"`);
  });

  document.getElementById('resetButton').addEventListener('click', () => resetScene(scene));

  document.getElementById('liveButton').addEventListener('click', () => {
    scene.isLive = !scene.isLive;
    const liveButton = document.getElementById('liveButton');
    liveButton.textContent = scene.isLive ? 'STOP' : 'LIVE';
    liveButton.style.background = scene.isLive ? '#cc0000' : '#333';
    
    if (scene.isLive) {
      if (scene.audioContext && scene.audioContext.state === 'running' && scene.aiWorker) {
        setupLiveMode(scene); // Starta LIVE direkt om audioContext är redo
        scene.triggerLiveSoundscape(); // Triggera omedelbart
      }
    } else {
      if (scene.liveTimer) {
        scene.liveTimer.remove();
        scene.liveTimer = null;
      }
    }
  });

  document.getElementById('aiAmbientButton').addEventListener('click', () => {
    if (!scene.audioContext) {
      scene.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('AudioContext initialized via AI Ambient button');
      
      // Initiera reverb direkt
      if (typeof scene.initializeReverb === 'function') {
        scene.initializeReverb();
      }
    }
    
    if (scene.audioContext.state === 'suspended') {
      scene.audioContext.resume();
    }
    
    // Om reverb fortfarande inte är initierad, försök igen
    if (!scene.reverbNode && typeof scene.initializeReverb === 'function') {
      scene.initializeReverb();
    }
    
    scene.ambientModeActive = !scene.ambientModeActive;
    const aiAmbientButton = document.getElementById('aiAmbientButton');
    aiAmbientButton.style.background = scene.ambientModeActive ? '#9932CC' : '#333';
    
    if (scene.ambientModeActive) {
      // Välj en ambient-färgschema
      scene.harmonicEnabled = true;
      document.getElementById('blendToggle').textContent = 'Ambient';
      document.getElementById('blendToggle').style.background = '#00cc00';
      
      // Skapa former om det inte finns några
      if (scene.shapes.length === 0) {
        const config = {
          particleCount: 30,
          particleSpeed: 0.8,
          masterVolume: 0.4,
          shapes: Array(4).fill().map(() => ({
            i: Math.floor(Math.random() * scene.gridCols),
            j: Math.floor(Math.random() * scene.gridRows),
            type: Math.floor(Math.random() * 4)
          })),
          ambientMode: true
        };
        scene.loadConfiguration(config);
      } else {
        // Tillämpa reverbeffekten på alla befintliga former
        scene.shapes.forEach(shape => {
          // Om formen redan har en reverbeffekt, hoppa över den
          if (shape.dryGain || !scene.reverbNode) return;
          
          // Skapa dry/wet-mix för reverbeffekten
          const dryGain = scene.audioContext.createGain();
          const wetGain = scene.audioContext.createGain();
          
          // Anpassa mixen för ambient-läge
          const wetLevel = 0.7;
          const dryLevel = 0.3;
          
          dryGain.gain.value = dryLevel;
          wetGain.gain.value = wetLevel;
          
          // Koppla bort den nuvarande anslutningen
          if (shape.gain) {
            shape.gain.disconnect();
            
            // Anslut den nya signalvägen med reverb
            shape.gain.connect(dryGain);
            shape.gain.connect(scene.reverbNode);
            scene.reverbNode.connect(wetGain);
            
            dryGain.connect(shape.stereoPanner);
            wetGain.connect(shape.stereoPanner);
            
            shape.dryGain = dryGain;
            shape.wetGain = wetGain;
            
            // Justera filtret för mjukare ljud i ambient-läge
            if (shape.filter) {
              shape.filter.frequency.cancelScheduledValues(scene.audioContext.currentTime);
              shape.filter.frequency.setTargetAtTime(2000, scene.audioContext.currentTime, 0.5);
            }
          }
        });
        
        // Uppdatera även oscillatortypen för ett mjukare ljud
        scene.shapes.forEach(shape => {
          if (shape.oscillator) {
            // Skapa en ny oscillator med sinus-våg för mjukare ambient-ljud
            const oldOscillator = shape.oscillator;
            
            // Skapa en ny oscillator med samma frekvens men olika vågform
            let newOscType = 'sine';
            if (shape.type === 'triangle' || shape.type === 'yellowTriangle') {
              newOscType = 'triangle';
            }
            
            shape.oscillator = scene.audioContext.createOscillator();
            shape.oscillator.type = newOscType;
            shape.oscillator.frequency.value = oldOscillator.frequency.value;
            
            // Koppla den nya oscillatorn
            if (shape.filter) {
              shape.oscillator.connect(shape.filter);
            } else {
              shape.oscillator.connect(shape.gain);
            }
            
            // Starta den nya oscillatorn och stoppa den gamla
            shape.oscillator.start();
            setTimeout(() => {
              oldOscillator.stop();
              oldOscillator.disconnect();
            }, 50);
            
            // Lägg till suboscillator för mer fyllig bas
            if (!shape.subOscillator) {
              const subOscillator = scene.audioContext.createOscillator();
              subOscillator.type = 'sine';
              subOscillator.frequency.value = shape.frequency / 2; // En oktav ner
              
              const subGain = scene.audioContext.createGain();
              subGain.gain.value = 0.3; // 30% sub-nivå
              
              subOscillator.connect(subGain);
              subGain.connect(shape.gain);
              
              subOscillator.start();
              shape.subOscillator = subOscillator;
              shape.subGain = subGain;
            }
          }
        });
      }
      
      // Trigga ambient-ljudgenerering med en kort fördröjning för att säkerställa att allt är redo
      setTimeout(() => {
        scene.triggerLiveSoundscape();
      }, 200);
    } else {
      // När ambient-läget stängs av, återställ reverb och oscillatortyp
      scene.shapes.forEach(shape => {
        if (shape.dryGain && shape.wetGain) {
          // Koppla bort reverb-effekten
          if (shape.gain) {
            shape.gain.disconnect();
          }
          if (shape.dryGain) {
            shape.dryGain.disconnect();
          }
          if (shape.wetGain) {
            shape.wetGain.disconnect();
          }
          
          // Återanslut direkt till stereoPanner
          if (shape.gain && shape.stereoPanner) {
            shape.gain.connect(shape.stereoPanner);
          }
          
          // Ta bort referenserna
          shape.dryGain = null;
          shape.wetGain = null;
          
          // Återställ filter till standard
          if (shape.filter) {
            shape.filter.frequency.cancelScheduledValues(scene.audioContext.currentTime);
            shape.filter.frequency.setTargetAtTime(5000, scene.audioContext.currentTime, 0.5);
          }
        }
        
        // Stoppa suboscillatorn om den finns
        if (shape.subOscillator) {
          shape.subOscillator.stop();
          shape.subOscillator.disconnect();
          if (shape.subGain) {
            shape.subGain.disconnect();
          }
          shape.subOscillator = null;
          shape.subGain = null;
        }
      });
    }
  });

  document.getElementById('pauseButton').addEventListener('click', () => {
    scene.isPaused = !scene.isPaused;
    const pauseButton = document.getElementById('pauseButton');
    pauseButton.textContent = scene.isPaused ? 'RESUME' : 'PAUSE';
    pauseButton.style.background = scene.isPaused ? '#cc0000' : '#333';
    if (scene.isPaused) {
      scene.shapes.forEach(shape => {
        if (shape.gain) {
          shape.gain.gain.cancelScheduledValues(scene.audioContext.currentTime);
          shape.gain.gain.setTargetAtTime(0, scene.audioContext.currentTime, 0.01);
        }
      });
      scene.particles.forEach(particle => {
        particle.savedVelocity = { x: particle.body.velocity.x, y: particle.body.velocity.y };
        particle.setVelocity(0, 0);
        particle.body.isStatic = true;
      });
    } else {
      scene.shapes.forEach(shape => {
        if (shape.gain) {
          const targetVolume = shape.baseVolume * scene.masterVolume * (shape.frequency <= 110 ? 1.5 : 1);
          shape.gain.gain.cancelScheduledValues(scene.audioContext.currentTime);
          shape.gain.gain.setTargetAtTime(targetVolume, scene.audioContext.currentTime, 0.01);
        }
      });
      scene.particles.forEach(particle => {
        particle.body.isStatic = false;
        if (particle.savedVelocity) {
          particle.setVelocity(particle.savedVelocity.x, particle.savedVelocity.y);
        } else {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          particle.setVelocity(scene.particleSpeed * Math.cos(angle), scene.particleSpeed * Math.sin(angle));
        }
      });
    }
  });

  document.getElementById('toggleMenu').addEventListener('click', () => toggleMenu());
}

export function toggleMenu() {
  const isMenuVisible = document.getElementById('sliderContainer').style.transform !== 'translateX(-200px)';
  const toggleButton = document.getElementById('toggleMenu');
  const sliderContainer = document.getElementById('sliderContainer');
  const logoImg = document.getElementById('logoImg');

  if (isMenuVisible) {
    sliderContainer.style.transform = 'translateX(-200px)';
    logoImg.style.transform = 'translateX(-200px)';
    toggleButton.style.transform = 'translateX(-20px)';
    toggleButton.innerHTML = 'SHOW MENU';
  } else {
    sliderContainer.style.transform = '';
    logoImg.style.transform = '';
    toggleButton.style.transform = '';
    toggleButton.innerHTML = 'HIDE MENU';
  }
}

export function resetScene(scene) {
  scene.shapes.forEach(shape => {
    shape.graphics.destroy();
    
    // Stoppa och koppla bort huvudoscillatorn
    if (shape.oscillator) {
      shape.oscillator.stop();
      shape.oscillator.disconnect();
    }
    
    // Koppla bort ljudkomponenter
    if (shape.gain) shape.gain.disconnect();
    if (shape.stereoPanner) shape.stereoPanner.disconnect();
    
    // Rensa eventuella dry/wet-noder för reverb
    if (shape.dryGain) shape.dryGain.disconnect();
    if (shape.wetGain) shape.wetGain.disconnect();
  });
  scene.shapes = [];

  scene.particleCount = 20;
  scene.particleSpeed = 1.5;
  scene.masterVolume = 0.3;
  scene.harmonicEnabled = false;
  scene.panEnabled = false;
  scene.isPaused = false;
  scene.isLive = false;
  scene.ambientModeActive = false;
  
  if (scene.updateNodeRadius) {
    scene.updateNodeRadius(100);
  } else {
    scene.nodeRadius = 100;
  }
  
  if (scene.liveTimer) {
    scene.liveTimer.remove();
    scene.liveTimer = null;
  }

  updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
  scene.updateParticleCount(scene.particleCount);

  const liveButton = document.getElementById('liveButton');
  liveButton.textContent = 'LIVE';
  liveButton.style.background = '#333';

  const pauseButton = document.getElementById('pauseButton');
  pauseButton.textContent = 'PAUSE';
  pauseButton.style.background = '#333';

  const blendButton = document.getElementById('blendToggle');
  blendButton.textContent = 'Off';
  blendButton.style.background = '#333';

  const panButton = document.getElementById('panToggle');
  panButton.textContent = 'Off';
  panButton.style.background = '#333';

  document.getElementById('chordSlider').value = 0;
  document.getElementById('chordValue').textContent = scene.chordColors[0].label;
  document.getElementById('chordValue').style.color = textColors[scene.chordColors[0].label] || '#0000ff';
  document.getElementById('chordSlider').style.setProperty('--thumb-color', scene.chordColors[0].color);
  document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${scene.chordColors[0].key}"`);
  scene.defaultFrequencies = scene.chordColors[0].frequencies;

  const aiAmbientButton = document.getElementById('aiAmbientButton');
  if (aiAmbientButton) {
    aiAmbientButton.style.background = '#333';
  }
}

function setupLiveMode(scene) {
  const baseDelay = 5000;
  const speedFactor = Math.pow(1.5 / scene.particleSpeed, 1.5);
  const delay = Math.max(1000, baseDelay * speedFactor);

  scene.liveTimer = scene.time.addEvent({
    delay: delay,
    callback: () => {
      console.log('Triggering live soundscape in setupLiveMode');
      if (scene.shapes.length === 0) {
        createRandomShapes(scene, Math.floor(Math.random() * 5) + 3); // Skapa noder om inga finns
      }
      scene.triggerLiveSoundscape();
    },
    loop: true
  });
}

function createRandomShapes(scene, count) {
  const shapeTypes = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
  const placedPositions = new Set();

  for (let n = 0; n < count; n++) {
    let attempts = 0;
    let i, j;
    do {
      i = Math.floor(Math.random() * scene.gridCols);
      j = Math.floor(Math.random() * scene.gridRows);
      attempts++;
      if (attempts > 30) break;
    } while (
      placedPositions.has(`${i},${j}`) ||
      i * scene.gridSize + scene.gridSize / 2 < scene.playAreaLeft ||
      i * scene.gridSize + scene.gridSize / 2 > scene.playAreaRight ||
      j * scene.gridSize + scene.gridSize / 2 < scene.playAreaTop ||
      j * scene.gridSize + scene.gridSize / 2 > scene.playAreaBottom
    );
  
    if (attempts > 30) continue;
  
    placedPositions.add(`${i},${j}`);
    const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    const mockPointer = { x: i * scene.gridSize + scene.gridSize / 2, y: j * scene.gridSize + scene.gridSize / 2 };
    scene.placeShape(mockPointer, randomType);
  }

  scene.harmonicEnabled = false;
  scene.panEnabled = true;
  updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
}