import { themes, activeTheme } from '../config/themes';

export function createUI(scene) {
  try {
    let sidebar = document.getElementById('sidebar');
    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.id = 'sidebar';
      const renderDiv = document.getElementById('renderDiv');
      if (renderDiv && renderDiv.parentNode) {
        renderDiv.parentNode.insertBefore(sidebar, renderDiv);
      } else {
        document.body.appendChild(sidebar);
      }
    }

    // Kontroller sitter i den vänstra panelen, inte ovanpå canvasen.
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'sliderContainer';
    sliderContainer.className = 'slider-container';
    sliderContainer.style.display = 'block';
    sidebar.appendChild(sliderContainer);
    
    const logoImg = document.getElementById('logoImg');
    if (!logoImg) {
      const logo = document.createElement('img');
      logo.id = 'logoImg';
      logo.className = 'logo-img';
      logo.src = '/images/logo.png';
      logo.alt = 'CosmiChord';
      sliderContainer.appendChild(logo);
    }

    const audioBlock = document.createElement('div');
    audioBlock.className = 'audio-block';
    audioBlock.innerHTML = `
      <button id="startAudioButton" class="control-button" type="button">Enable audio</button>
      <p id="audioHint" class="audio-hint">Click or tap anywhere to enable sound. A placed orb plays right away and swells when a particle passes.</p>
    `;
    sliderContainer.appendChild(audioBlock);

    const modeBlock = document.createElement('div');
    modeBlock.className = 'button-row';
    modeBlock.innerHTML = `
      <button id="manualModeButton" class="control-button mode-button is-active" type="button">Manual</button>
      <button id="aiModeButton" class="control-button mode-button" type="button">AI</button>
    `;
    sliderContainer.appendChild(modeBlock);
    const modeStatus = document.createElement('p');
    modeStatus.id = 'modeStatus';
    modeStatus.className = 'audio-hint';
    modeStatus.textContent = 'Manual. Place orbs and shape the sound yourself.';
    sliderContainer.appendChild(modeStatus);

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
      <label>Volume: <span id="volumeValue">0.50</span></label>
      <input type="range" min="0" max="1" value="0.50" step="0.01" id="volumeSlider">
    `;
    sliderContainer.appendChild(volumeContainer);

    const blendContainer = document.createElement('div');
    blendContainer.className = 'button-row';
    blendContainer.innerHTML = `
      <button id="blendToggle" class="control-button">BLEND</button>
      <button id="panToggle" class="control-button">PAN</button>
    `;
    sliderContainer.appendChild(blendContainer);

    const chordContainer = document.createElement('div');
    chordContainer.className = 'slider-item';
    chordContainer.innerHTML = `
      <label>Chord: <span id="chordValue" style="color: #0000ff;">Celestial</span></label>
      <input type="range" min="0" max="9" value="0" id="chordSlider">
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
    randomContainer.className = 'button-row';
    randomContainer.innerHTML = `
      <button id="randomButton" class="control-button">RANDOM</button>
      <button id="evolveButton" class="control-button">EVOLVE</button>
      <button id="liveButton" class="control-button">LIVE</button>
      <button id="aiAmbientButton" class="control-button">AMBIENT</button>
    `;
    sliderContainer.appendChild(randomContainer);

    const resetContainer = document.createElement('div');
    resetContainer.className = 'button-row';
    resetContainer.innerHTML = `
      <button id="resetButton">RESET</button>
      <button id="pauseButton">PAUSE</button>
    `;
    sliderContainer.appendChild(resetContainer);

    // Lägg till toggleMenu-knappen direkt till body
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggleMenu';
    toggleButton.className = 'toggle-menu';
    toggleButton.innerHTML = 'HIDE MENU';
    document.body.appendChild(toggleButton);
    
    console.log('UI elements created successfully');
  } catch (error) {
    console.error('Error creating UI:', error);
  }
}

export function updateUI(scene, particleCount, bpm, masterVolume, harmonicEnabled, panEnabled) {
  document.getElementById('particleCount').textContent = particleCount;
  document.getElementById('particleSlider').value = particleCount;
  
  document.getElementById('speedValue').textContent = bpm;
  document.getElementById('speedSlider').value = scene.bpmToParticleSpeed(bpm);
  
  document.getElementById('volumeValue').textContent = Number(masterVolume).toFixed(2);
  document.getElementById('volumeSlider').value = masterVolume;
  
  document.getElementById('blendToggle').style.background = harmonicEnabled ? '#00cc00' : '#333';
  
  document.getElementById('panToggle').style.background = panEnabled ? '#2ecc71' : '#333';
  
  document.getElementById('armLengthValue').textContent = scene.nodeRadius;
  document.getElementById('armLengthSlider').value = scene.nodeRadius;
}

export function handleUIEvents(scene) {
  document.getElementById('particleSlider').addEventListener('input', (e) => {
    const count = parseInt(e.target.value);
    document.getElementById('particleCount').textContent = count;
    scene.updateParticleCount(count);
    scene.particleCount = count;
  });

  document.getElementById('speedSlider').addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    const bpm = scene.particleSpeedToBPM(speed);
    document.getElementById('speedValue').textContent = bpm;
    scene.particleSpeed = speed;
    scene.bpm = bpm;
    
    // Uppdatera hastigheterna för alla partiklar
    scene.particles.forEach(particle => {
      const currentVelocity = particle.body.velocity;
      const currentSpeed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
      const direction = {
        x: currentVelocity.x / currentSpeed,
        y: currentVelocity.y / currentSpeed
      };
      particle.setVelocity(direction.x * speed, direction.y * speed);
    });
  });

  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    const volume = parseFloat(e.target.value);
    document.getElementById('volumeValue').textContent = volume.toFixed(2);
    scene.masterVolume = volume;
    if (typeof scene.applyMasterVolume === 'function') scene.applyMasterVolume();
  });

  document.getElementById('blendToggle').addEventListener('click', () => {
    scene.harmonicEnabled = !scene.harmonicEnabled;
    document.getElementById('blendToggle').style.background = scene.harmonicEnabled ? '#00cc00' : '#333';
  });

  document.getElementById('panToggle').addEventListener('click', () => {
    scene.panEnabled = !scene.panEnabled;
    document.getElementById('panToggle').style.background = scene.panEnabled ? '#2ecc71' : '#333';
    
    // Uppdatera panning för alla shapes
    if (scene.audioContext) {
      scene.shapes.forEach(shape => {
        if (shape.stereoPanner) {
          const panValue = scene.panEnabled ? scene.calculatePan(shape.i) : 0;
          shape.stereoPanner.pan.cancelScheduledValues(scene.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(panValue, scene.audioContext.currentTime, 0.1);
        }
      });
    }
  });

  document.getElementById('chordSlider').addEventListener('input', (e) => {
    const chordIndex = parseInt(e.target.value);
    const { frequencies, label } = scene.chordColors[chordIndex];
    scene.selectedChord = chordIndex;
    
    document.getElementById('chordValue').textContent = label;
    document.getElementById('chordValue').style.color = scene.getChordColor(label);
    
    // Uppdatera defaultFrequencies
    scene.defaultFrequencies = [...frequencies];
    
    // Uppdatera befintliga shapes med nya frekvenser
    if (scene.shapes.length > 0 && scene.audioContext) {
      scene.shapes.forEach((shape, index) => {
        if (index < frequencies.length) {
          // Uppdatera frekvensen för denna shape
          shape.frequency = frequencies[index];
          shape.homeFrequency = shape.frequency;
          shape._freqTarget = shape.frequency;
          
          // Uppdatera oscillatorn
          if (shape.oscillator) {
            shape.oscillator.frequency.cancelScheduledValues(scene.audioContext.currentTime);
            shape.oscillator.frequency.setTargetAtTime(
              shape.frequency, 
              scene.audioContext.currentTime, 
              0.1
            );
          }
          
          // Uppdatera typen baserat på frekvensen
          const newType = scene.getClosestShapeType(shape.frequency);
          if (newType !== shape.type && shape.visible) {
            shape.type = newType;
            
            // Uppdatera färgen
            if (shape.graphics) {
              const newColor = scene.getShapeColor(newType, activeTheme);
              shape.graphics.clear()
                .fillStyle(0x000000, 0.4).fillCircle(4, 4, 22)
                .fillStyle(newColor, 0.3).fillCircle(0, 0, 25)
                .fillStyle(newColor, 1).fillCircle(0, 0, 20);
            }
          }
        }
      });
    }
  });

  document.getElementById('armLengthSlider').addEventListener('input', (e) => {
    const newRadius = parseInt(e.target.value);
    document.getElementById('armLengthValue').textContent = newRadius;
    scene.updateNodeRadius(newRadius);
  });

  document.getElementById('resetButton').addEventListener('click', () => {
    resetScene(scene);
  });

  document.getElementById('pauseButton').addEventListener('click', () => {
    scene.isPaused = !scene.isPaused;
    document.getElementById('pauseButton').textContent = scene.isPaused ? 'RESUME' : 'PAUSE';
    document.getElementById('pauseButton').style.background = scene.isPaused ? '#ff0000' : '#333';
    
    if (scene.audioContext) {
      if (scene.isPaused) {
        // Mute all sounds
        scene.shapes.forEach(shape => {
          if (shape.gain) {
            shape.gain.gain.setTargetAtTime(0, scene.audioContext.currentTime, 0.05);
          }
        });
      }
    }
  });

  document.getElementById('toggleMenu').addEventListener('click', () => {
    toggleMenu();
  });
}

export function resetScene(scene) {
  // Stoppa alla ljud och rensa alla shapes
  scene.shapes.forEach(shape => {
    shape.graphics.destroy();
    shape.oscillator.stop();
    shape.oscillator.disconnect();
    shape.gain.disconnect();
    if (shape.stereoPanner) shape.stereoPanner.disconnect();
  });
  scene.shapes = [];
  
  // Återställ partiklar
  scene.particles.forEach(particle => particle.destroy());
  scene.particles = [];
  scene.updateParticleCount(scene.particleCount);
  
  // Återställ visuella element
  scene.connectionGraphics.clear();
  
  // Återställ kontroller
  scene.panEnabled = false;
  scene.harmonicEnabled = false;
  scene.ambientModeActive = false;
  scene.isPaused = false;
  
  // Uppdatera UI
  updateUI(scene, scene.particleCount, scene.particleSpeedToBPM(scene.particleSpeed), scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
  
  document.getElementById('pauseButton').textContent = 'PAUSE';
  document.getElementById('pauseButton').style.background = '#333';
}

export function toggleMenu() {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  const toggleButton = document.getElementById('toggleMenu');
  if (toggleButton) {
    toggleButton.textContent = collapsed ? 'SHOW MENU' : 'HIDE MENU';
  }
  // Phaser FIT lyssnar på window resize när sidopanelen ändrar ytan.
  window.dispatchEvent(new Event('resize'));
}