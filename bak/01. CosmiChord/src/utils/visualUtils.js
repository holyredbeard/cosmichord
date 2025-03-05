import { themes, activeTheme } from '../config/themes';

const sliderStyles = `
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--thumb-color, white);
    border-radius: 50%;
    cursor: grab;
    transition: all 0.2s ease;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
  input[type="range"]::-webkit-slider-thumb::after {
    content: var(--thumb-text, '');
    font-family: Arial;
    font-size: 8px;
    color: black;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  button {
    background: #333;
    color: white;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 4px;
    font-family: Arial;
    letter-spacing: 1px;
  }
  button:hover {
    background: #555;
  }
`;

// Skapar UI-elementen för spelet
export function createUI(scene) {
  const sliderContainer = document.createElement('div');
  sliderContainer.id = 'sliderContainer';
  sliderContainer.style.position = 'absolute';
  sliderContainer.style.top = '150px';
  sliderContainer.style.left = '40px';
  sliderContainer.style.display = 'flex';
  sliderContainer.style.flexDirection = 'column';
  sliderContainer.style.gap = '25px';
  sliderContainer.style.zIndex = '1000';
  sliderContainer.style.transition = 'transform 0.3s ease-in-out';
  document.getElementById('renderDiv').appendChild(sliderContainer);

  // Lägg till logotyp om den inte redan finns
  const logoImg = document.getElementById('logoImg');
  if (!logoImg) {
    const logo = document.createElement('img');
    logo.src = 'https://play.rosebud.ai/assets/logo.png?rVBU';
    logo.style.position = 'absolute';
    logo.style.top = '40px';
    logo.style.left = '30px';
    logo.style.width = '140px';
    logo.style.height = 'auto';
    logo.style.zIndex = '1000';
    logo.style.transition = 'transform 0.3s ease-in-out';
    logo.id = 'logoImg';
    document.getElementById('renderDiv').appendChild(logo);
  }

  // Lägg till CSS-stilar för sliders och knappar
  const styleSheet = document.createElement('style');
  styleSheet.textContent = sliderStyles;
  document.head.appendChild(styleSheet);

  // Partikelantal-slider
  const particleCountContainer = document.createElement('div');
  particleCountContainer.style.display = 'flex';
  particleCountContainer.style.flexDirection = 'column';
  particleCountContainer.style.alignItems = 'flex-start';
  particleCountContainer.innerHTML = `
    <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Particles: <span id="particleCount">20</span></label>
    <input type="range" min="5" max="50" value="20" id="particleSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
  `;
  sliderContainer.appendChild(particleCountContainer);

  // Hastighet-slider
  const speedContainer = document.createElement('div');
  speedContainer.style.display = 'flex';
  speedContainer.style.flexDirection = 'column';
  speedContainer.style.alignItems = 'flex-start';
  speedContainer.innerHTML = `
    <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Speed: <span id="speedValue">1.5</span></label>
    <input type="range" min="0.1" max="5" value="1.5" step="0.1" id="speedSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
  `;
  sliderContainer.appendChild(speedContainer);

  // Volym-slider
  const volumeContainer = document.createElement('div');
  volumeContainer.style.display = 'flex';
  volumeContainer.style.flexDirection = 'column';
  volumeContainer.style.alignItems = 'flex-start';
  volumeContainer.innerHTML = `
    <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Volume: <span id="volumeValue">0.3</span></label>
    <input type="range" min="0" max="0.5" value="0.3" step="0.1" id="volumeSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
  `;
  sliderContainer.appendChild(volumeContainer);

  // Blend-toggle
  const blendContainer = document.createElement('div');
  blendContainer.style.display = 'flex';
  blendContainer.style.flexDirection = 'row';
  blendContainer.style.alignItems = 'center';
  blendContainer.style.gap = '10px';
  blendContainer.style.marginTop = '10px';
  blendContainer.style.marginBottom = '0px';
  blendContainer.innerHTML = `
    <label style="color: white; font-family: Arial; letter-spacing: 1px;">Blend:</label>
    <button id="blendToggle" style="min-width: 60px; background: #333; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-family: Arial; cursor: pointer; transition: all 0.3s ease;">Off</button>
  `;
  sliderContainer.appendChild(blendContainer);

  // Pan-toggle
  const panContainer = document.createElement('div');
  panContainer.style.display = 'flex';
  panContainer.style.flexDirection = 'row';
  panContainer.style.alignItems = 'center';
  panContainer.style.gap = '10px';
  panContainer.style.marginTop = '-8px';
  panContainer.innerHTML = `
    <label style="color: white; font-family: Arial; letter-spacing: 1px;">Pan:</label>
    <button id="panToggle" style="min-width: 60px; background: #333; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-family: Arial; cursor: pointer; transition: all 0.3s ease;">Off</button>
  `;
  sliderContainer.appendChild(panContainer);

  // Ackord-slider
  const chordContainer = document.createElement('div');
  chordContainer.style.display = 'flex';
  chordContainer.style.marginTop = '10px';
  chordContainer.style.flexDirection = 'column';
  chordContainer.style.alignItems = 'flex-start';
  chordContainer.innerHTML = `
    <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Chord: <span id="chordValue" style="color: #0000ff;">Celestial</span></label>
    <input type="range" min="0" max="5" value="0" id="chordSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
  `;
  sliderContainer.appendChild(chordContainer);

  // Random och Live-knappar
  const randomContainer = document.createElement('div');
  randomContainer.style.display = 'flex';
  randomContainer.style.flexDirection = 'row';
  randomContainer.style.alignItems = 'flex-start';
  randomContainer.style.marginTop = '15px';
  randomContainer.style.gap = '10px';
  randomContainer.innerHTML = `
    <button id="randomButton">RANDOM</button>
    <button id="liveButton">LIVE</button>
  `;
  sliderContainer.appendChild(randomContainer);

  // Återställ och Pausa-knappar
  const resetContainer = document.createElement('div');
  resetContainer.style.display = 'flex';
  resetContainer.style.flexDirection = 'row';
  resetContainer.style.alignItems = 'flex-start';
  resetContainer.style.marginTop = '-8px';
  resetContainer.style.gap = '10px';
  resetContainer.innerHTML = `
    <button id="resetButton">RESET</button>
    <button id="pauseButton">PAUSE</button>
  `;
  sliderContainer.appendChild(resetContainer);

  // Spara-knapp
  const saveContainer = document.createElement('div');
  saveContainer.style.display = 'flex';
  saveContainer.style.flexDirection = 'column';
  saveContainer.style.alignItems = 'flex-start';
  saveContainer.style.marginTop = '15px';
  saveContainer.innerHTML = `
    <button id="saveConfig">Save & Share</button>
  `;
  sliderContainer.appendChild(saveContainer);

  // Toggle-knapp för meny
  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggleMenu';
  toggleButton.style.position = 'absolute';
  toggleButton.style.bottom = '30px';
  toggleButton.style.left = '30px';
  toggleButton.style.width = '50px';
  toggleButton.style.zIndex = '1001';
  toggleButton.style.transition = 'transform 0.3s ease-in-out';
  toggleButton.style.background = '#333';
  toggleButton.style.color = 'white';
  toggleButton.style.border = 'none';
  toggleButton.style.padding = '8px 15px';
  toggleButton.style.borderRadius = '4px';
  toggleButton.style.fontFamily = 'Arial';
  toggleButton.style.cursor = 'pointer';
  toggleButton.innerHTML = '<span style="display: inline-block; width: 30px; text-align: center; font-size: 18px;">←</span>';
  document.getElementById('renderDiv').appendChild(toggleButton);
}

// Uppdaterar UI-element med nya värden
export function updateUI(scene, particleCount, particleSpeed, masterVolume, harmonicEnabled, panEnabled) {
  document.getElementById('particleCount').textContent = particleCount;
  document.getElementById('speedValue').textContent = particleSpeed;
  document.getElementById('volumeValue').textContent = masterVolume;
  document.getElementById('particleSlider').value = particleCount;
  document.getElementById('speedSlider').value = particleSpeed;
  document.getElementById('volumeSlider').value = masterVolume;

  const blendButton = document.getElementById('blendToggle');
  blendButton.textContent = harmonicEnabled ? 'On' : 'Off';
  blendButton.style.background = harmonicEnabled ? '#00cc00' : '#333';

  const panButton = document.getElementById('panToggle');
  panButton.textContent = panEnabled ? 'On' : 'Off';
  panButton.style.background = panEnabled ? '#2ecc71' : '#333';
}

// Hanterar händelser för UI-element
export function handleUIEvents(scene) {
  document.getElementById('particleSlider').addEventListener('input', (e) => {
    const newCount = parseInt(e.target.value);
    scene.updateParticleCount(newCount);
    updateUI(scene, newCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
  });

  document.getElementById('speedSlider').addEventListener('input', (e) => {
    scene.particleSpeed = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = scene.particleSpeed;
    
    // Update interval of live mode if it's on
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
    e.target.textContent = scene.harmonicEnabled ? 'On' : 'Off';
    e.target.style.background = scene.harmonicEnabled ? '#00cc00' : '#333';
    e.target.style.width = '60px';
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
    chordValue.style.color = textColors[label];
    chordSlider.style.setProperty('--thumb-color', color);
    chordSlider.style.setProperty('--thumb-text', `"${key}"`);

    scene.shapes.forEach((shape, index) => {
      if (index < frequencies.length) {
        shape.frequency = frequencies[index];
        shape.oscillator.frequency.cancelScheduledValues(scene.audioContext.currentTime);
        shape.oscillator.frequency.setTargetAtTime(shape.frequency, scene.audioContext.currentTime, 0.1);
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
      harmonicEnabled: Math.random() > 0.5, // 50% chance to enable harmonics
      panEnabled: Math.random() > 0.5,     // 50% chance to enable panning
      defaultFrequencies: scene.chordColors[Math.floor(Math.random() * 6)].frequencies
    };

    scene.shapes.forEach(shape => {
      shape.graphics.destroy();
      shape.oscillator.stop();
      shape.oscillator.disconnect();
      shape.gain.disconnect();
      if (shape.stereoPanner) shape.stereoPanner.disconnect();
    });
    scene.shapes = [];

    const shapeTypes = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
    const numShapes = Math.floor(Math.random() * 8) + 3;
    const placedPositions = new Set(); // Track placed positions to avoid overlap
    
    for (let n = 0; n < numShapes; n++) {
      // Try to find an unoccupied position
      let attempts = 0;
      let i, j;
      do {
        i = Math.floor(Math.random() * scene.gridCols);
        j = Math.floor(Math.random() * scene.gridRows);
        attempts++;
        
        // Break after too many attempts to avoid infinite loop
        if (attempts > 50) break;
      } while (
        placedPositions.has(`${i},${j}`) || 
        // Check if position is outside play area boundaries
        i * scene.gridSize + scene.gridSize / 2 < scene.playAreaLeft ||
        i * scene.gridSize + scene.gridSize / 2 > scene.playAreaRight ||
        j * scene.gridSize + scene.gridSize / 2 < scene.playAreaTop ||
        j * scene.gridSize + scene.gridSize / 2 > scene.playAreaBottom
      );
      
      // If we couldn't find a valid position, skip this shape
      if (attempts > 50) continue;
      
      // Mark position as used
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

    updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, scene.harmonicEnabled, scene.panEnabled);
    scene.updateParticleCount(scene.particleCount);

    const chordIndex = Object.keys(scene.chordColors).find(index =>
      JSON.stringify(scene.chordColors[index].frequencies) === JSON.stringify(scene.defaultFrequencies)
    ) || 0;
    document.getElementById('chordSlider').value = chordIndex;
    document.getElementById('chordValue').textContent = scene.chordColors[chordIndex].label;
    document.getElementById('chordSlider').style.setProperty('--thumb-color', scene.chordColors[chordIndex].color);
    document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${scene.chordColors[chordIndex].key}"`);
    document.getElementById('particleCount').textContent = scene.particleCount;
    document.getElementById('speedValue').textContent = scene.particleSpeed;
    document.getElementById('volumeValue').textContent = scene.masterVolume;
    document.getElementById('particleSlider').value = scene.particleCount;
    document.getElementById('speedSlider').value = scene.particleSpeed;
    document.getElementById('volumeSlider').value = scene.masterVolume;
    const blendButton = document.getElementById('blendToggle');
    blendButton.textContent = scene.harmonicEnabled ? 'On' : 'Off';
    blendButton.style.background = scene.harmonicEnabled ? '#00cc00' : '#333';
    const panButton = document.getElementById('panToggle');
    panButton.textContent = scene.panEnabled ? 'On' : 'Off';
    panButton.style.background = scene.panEnabled ? '#2ecc71' : '#333';
  });

  document.getElementById('resetButton').addEventListener('click', () => resetScene(scene));

  document.getElementById('liveButton').addEventListener('click', () => {
    scene.isLive = !scene.isLive;
    const liveButton = document.getElementById('liveButton');
    liveButton.textContent = scene.isLive ? 'STOP' : 'LIVE';
    liveButton.style.background = scene.isLive ? '#cc0000' : '#333';
    
    if (scene.isLive) {
      setupLiveMode(scene);
    } else {
      if (scene.liveTimer) {
        scene.liveTimer.remove();
        scene.liveTimer = null;
      }
    }
  });

  function setupLiveMode(scene) {
    // Calculate delay based on speed - slower speed means longer delay between changes
    const baseDelay = 5000; // Base delay in ms
    const speedFactor = Math.pow(1.5 / scene.particleSpeed, 1.5);
    const delay = Math.max(1000, baseDelay * speedFactor);
    
    // Create a pattern sequencer for more musical live mode
    scene.liveSequence = {
      step: 0,
      patternLength: 8,
      lastActionTime: 0,
      moveSequence: [],
      changeSequence: []
    };
    
    // Create musical patterns for shape changes and movements
    for (let i = 0; i < scene.liveSequence.patternLength; i++) {
      scene.liveSequence.moveSequence.push(Math.random() < 0.4); // 40% chance to include movement on this step
      scene.liveSequence.changeSequence.push(Math.random() < 0.3); // 30% chance to include tone change on this step
    }
    
    scene.liveTimer = scene.time.addEvent({
      delay: delay,
      callback: () => {
        // Advance sequencer step
        scene.liveSequence.step = (scene.liveSequence.step + 1) % scene.liveSequence.patternLength;
        const currentStep = scene.liveSequence.step;
        
        // If no shapes, create some
        if (scene.shapes.length === 0) {
          createRandomShapes(scene, Math.floor(Math.random() * 3) + 2);
          return;
        }
        
        // Decide what to do on this step
        const shouldMove = scene.liveSequence.moveSequence[currentStep];
        const shouldChange = scene.liveSequence.changeSequence[currentStep];
        
        // Do the action(s)
        if (shouldMove) moveShapes(scene);
        if (shouldChange) changeShapeTones(scene);
        
        // Periodically create or remove shapes to keep things interesting
        const timeSinceLastAction = scene.time.now - scene.liveSequence.lastActionTime;
        if (timeSinceLastAction > delay * 4) { // Add/remove every ~4 steps
          if (Math.random() < 0.5 && scene.shapes.length < 8) {
            // Add a shape in a musically complementary position
            addComplementaryShape(scene);
          } else if (scene.shapes.length > 3) {
            // Remove a shape that's less important to the current sound
            removeRandomShape(scene);
          }
          scene.liveSequence.lastActionTime = scene.time.now;
        }
      },
      loop: true
    });
  }
  
  // Helper function to create random shapes for live mode
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
    
    // Enable blend mode and pan for more interesting effects
    scene.harmonicEnabled = true;
    scene.panEnabled = true;
    updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, true, true);
  }
  
  // Move shapes in a musically coherent way
  function moveShapes(scene) {
    // Choose 1-2 shapes to move
    const shapesToMove = Phaser.Utils.Array.Shuffle(scene.shapes.slice()).slice(0, Math.min(2, scene.shapes.length));
    if (shapesToMove.length === 0) return;
    
    shapesToMove.forEach(shape => {
      // Calculate a musically interesting new position
      // Try to create connections between shapes
      let targetI, targetJ;
      let bestDistance = Infinity;
      let bestPosition = null;
      
      // Try several positions and choose the one that creates the most interesting connections
      for (let attempt = 0; attempt < 10; attempt++) {
        const gridOffsetI = Phaser.Math.Between(-3, 3);
        const gridOffsetJ = Phaser.Math.Between(-3, 3);
        const newI = Math.max(0, Math.min(scene.gridCols - 1, shape.i + gridOffsetI));
        const newJ = Math.max(0, Math.min(scene.gridRows - 1, shape.j + gridOffsetJ));
        
        // Skip if outside play area
        const newX = newI * scene.gridSize + scene.gridSize / 2;
        const newY = newJ * scene.gridSize + scene.gridSize / 2;
        if (newX < scene.playAreaLeft || newX > scene.playAreaRight || 
            newY < scene.playAreaTop || newY > scene.playAreaBottom) {
          continue;
        }
        
        // Skip if position is already occupied
        if (scene.shapes.some(s => s !== shape && s.i === newI && s.j === newJ)) {
          continue;
        }
        
        // Measure potential connections - prefer positions that would connect with other shapes
        const potentialConnections = scene.shapes.filter(s => s !== shape).reduce((sum, other) => {
          const dist = Phaser.Math.Distance.Between(
            newX, newY, 
            other.i * scene.gridSize + scene.gridSize / 2, 
            other.j * scene.gridSize + scene.gridSize / 2
          );
          // Score based on how likely particles are to connect these shapes
          return sum + (dist < 200 ? 1 : 0);
        }, 0);
        
        // We want either very connected positions or very isolated positions for contrast
        const interestScore = Math.abs(potentialConnections - 1);
        if (interestScore < bestDistance) {
          bestDistance = interestScore;
          bestPosition = { i: newI, j: newJ, x: newX, y: newY };
        }
      }
      
      // If we found a good position, move the shape
      if (bestPosition) {
        const { i, j, x, y } = bestPosition;
        
        // Calculate a pleasing duration based on speed setting
        const baseDuration = 2000; // Base duration in ms
        const speedFactor = Math.pow(1.5 / scene.particleSpeed, 1.2);
        const duration = Math.max(500, baseDuration * speedFactor);
        
        // Stop any current animation
        if (shape.currentTween) shape.currentTween.stop();
        
        // Start the new animation with easing for smoother movement
        shape.currentTween = scene.tweens.add({
          targets: shape.graphics,
          x: x,
          y: y,
          duration: duration,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            shape.x = shape.graphics.x;
            shape.y = shape.graphics.y;
          },
          onComplete: () => {
            shape.x = x;
            shape.y = y;
            shape.i = i;
            shape.j = j;
            shape.currentTween = null;
          }
        });
      }
    });
  }
  
  // Change shape tones in a musically coherent way
  function changeShapeTones(scene) {
    // Choose a shape to change
    if (scene.shapes.length === 0) return;
    
    const shape = Phaser.Utils.Array.GetRandom(scene.shapes);
    if (!shape) return;
    
    // Determine what kind of change to make
    const changeType = Math.random();
    
    if (changeType < 0.7) {
      // 70% chance: Change to adjacent tone in the scale for subtle shift
      const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
      const currentIndex = types.indexOf(shape.type);
      
      // Either go up or down the scale, with wrapping
      const direction = Math.random() < 0.5 ? 1 : -1;
      const newIndex = (currentIndex + direction + types.length) % types.length;
      const newType = types[newIndex];
      const newFrequency = scene.defaultFrequencies[newIndex] || 440;
      
      // Apply the change with a fade transition
      fadeShapeToNewTone(scene, shape, newType, newFrequency);
    } else {
      // 30% chance: Change to a harmonically related tone (octave, fifth, etc.)
      const baseFreq = shape.frequency;
      let newFrequency;
      
      // Choose a musically pleasing interval
      const intervalChoice = Math.random();
      if (intervalChoice < 0.3) {
        newFrequency = baseFreq * 2; // Octave up
      } else if (intervalChoice < 0.6) {
        newFrequency = baseFreq * 1.5; // Perfect fifth
      } else if (intervalChoice < 0.8) {
        newFrequency = baseFreq * 1.25; // Major third
      } else {
        newFrequency = baseFreq / 2; // Octave down
      }
      
      // Find the closest matching default frequency
      const closestType = findClosestFrequencyType(scene, newFrequency);
      
      // Apply the change with a fade transition
      fadeShapeToNewTone(scene, shape, closestType.type, closestType.frequency);
    }
  }
  
  // Helper to find the closest matching frequency from the available types
  function findClosestFrequencyType(scene, targetFreq) {
    const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
    let closestDiff = Infinity;
    let closestType = types[0];
    let closestFreq = scene.defaultFrequencies[0];
    
    types.forEach((type, i) => {
      const freq = scene.defaultFrequencies[i];
      const diff = Math.abs(freq - targetFreq);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestType = type;
        closestFreq = freq;
      }
    });
    
    return {type: closestType, frequency: closestFreq};
  }
  
  // Fade a shape to a new tone with smooth transitions
  function fadeShapeToNewTone(scene, shape, newType, newFrequency) {
    // Fade out current sound
    shape.gain.gain.cancelScheduledValues(scene.audioContext.currentTime);
    shape.gain.gain.setTargetAtTime(0, scene.audioContext.currentTime, 0.2);
    
    // After fade out, change the tone and fade back in
    setTimeout(() => {
      shape.type = newType;
      shape.frequency = newFrequency;
      
      // Update the visual appearance
      const newColor = scene.getShapeColor(newType, activeTheme);
      shape.graphics.clear();
      shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      shape.graphics.fillStyle(newColor, 0.3).fillCircle(0, 0, 25);
      shape.graphics.fillStyle(newColor, 1).fillCircle(0, 0, 20);
      
      // Update the audio
      shape.oscillator.frequency.cancelScheduledValues(scene.audioContext.currentTime);
      shape.oscillator.frequency.setTargetAtTime(newFrequency, scene.audioContext.currentTime, 0.1);
      
      // Fade back in
      shape.gain.gain.setTargetAtTime(
        shape.baseVolume * scene.masterVolume * (newFrequency <= 110 ? 1.5 : 1),
        scene.audioContext.currentTime, 0.3
      );
      
      // Update panning if enabled
      if (scene.panEnabled && shape.stereoPanner) {
        const panValue = scene.calculatePan(shape.i);
        shape.stereoPanner.pan.cancelScheduledValues(scene.audioContext.currentTime);
        shape.stereoPanner.pan.setTargetAtTime(panValue, scene.audioContext.currentTime, 0.1);
      }
    }, 200); // Wait for fade out
  }
  
  // Add a new shape that complements the existing ones
  function addComplementaryShape(scene) {
    // If no shapes exist, create a random one
    if (scene.shapes.length === 0) {
      createRandomShapes(scene, 1);
      return;
    }
    
    // Find a good position for the new shape
    const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
    const existingTypes = new Set(scene.shapes.map(s => s.type));
    
    // Choose a type that creates harmonic variety
    let newType;
    if (existingTypes.size < types.length) {
      // Pick a type that's not already in use
      newType = types.find(t => !existingTypes.has(t));
    } else {
      // All types are in use, pick one that's least represented
      const typeCounts = types.reduce((counts, type) => {
        counts[type] = (counts[type] || 0) + scene.shapes.filter(s => s.type === type).length;
        return counts;
      }, {});
      
      newType = types.reduce((least, type) => {
        return (typeCounts[type] < typeCounts[least]) ? type : least;
      }, types[0]);
    }
    
    // Find a position that creates interesting connections
    let bestPosition = null;
    let bestScore = -Infinity;
    
    for (let attempt = 0; attempt < 20; attempt++) {
      const i = Math.floor(Math.random() * scene.gridCols);
      const j = Math.floor(Math.random() * scene.gridRows);
      
      // Skip if outside play area
      const x = i * scene.gridSize + scene.gridSize / 2;
      const y = j * scene.gridSize + scene.gridSize / 2;
      if (x < scene.playAreaLeft || x > scene.playAreaRight || 
          y < scene.playAreaTop || y > scene.playAreaBottom) {
        continue;
      }
      
      // Skip if position is already occupied
      if (scene.shapes.some(s => s.i === i && s.j === j)) {
        continue;
      }
      
      // Calculate how many shapes this position would connect with
      const connections = scene.shapes.filter(s => {
        const dist = Phaser.Math.Distance.Between(
          x, y, 
          s.i * scene.gridSize + scene.gridSize / 2, 
          s.j * scene.gridSize + scene.gridSize / 2
        );
        return dist < 200; // Approximate connection distance
      }).length;
      
      // We want 1-2 connections for best musical effect
      const score = connections === 0 ? 0 : connections === 1 ? 10 : connections === 2 ? 5 : 1;
      
      if (score > bestScore) {
        bestScore = score;
        bestPosition = { i, j };
      }
    }
    
    // If we found a good position, create the shape
    if (bestPosition) {
      const { i, j } = bestPosition;
      const mockPointer = { x: i * scene.gridSize + scene.gridSize / 2, y: j * scene.gridSize + scene.gridSize / 2 };
      scene.placeShape(mockPointer, newType);
      
      // Use a subtle fade-in effect
      const newShape = scene.shapes[scene.shapes.length - 1];
      if (newShape && newShape.gain) {
        newShape.gain.gain.value = 0;
        newShape.gain.gain.setTargetAtTime(
          newShape.baseVolume * scene.masterVolume * (newShape.frequency <= 110 ? 1.5 : 1),
          scene.audioContext.currentTime, 0.5
        );
      }
    }
  }
  
  // Remove a random shape with a nice fade out
  function removeRandomShape(scene) {
    if (scene.shapes.length <= 3) return; // Keep at least 3 shapes
    
    // Prefer to remove shapes that aren't connected
    const connectedShapes = new Set();
    scene.particles.forEach(particle => {
      const nearbyShapes = scene.shapes.filter(shape => {
        const dist = Phaser.Math.Distance.Between(particle.x, particle.y, shape.x, shape.y);
        return dist < shape.radius;
      });
      
      if (nearbyShapes.length >= 2) {
        nearbyShapes.forEach(shape => connectedShapes.add(shape));
      }
    });
    
    // Choose shape to remove - prefer unconnected ones
    let shapeToRemove;
    const unconnectedShapes = scene.shapes.filter(shape => !connectedShapes.has(shape));
    
    if (unconnectedShapes.length > 0) {
      shapeToRemove = Phaser.Utils.Array.GetRandom(unconnectedShapes);
    } else {
      shapeToRemove = Phaser.Utils.Array.GetRandom(scene.shapes);
    }
    
    if (shapeToRemove) {
      // Fade out nicely
      shapeToRemove.gain.gain.cancelScheduledValues(scene.audioContext.currentTime);
      shapeToRemove.gain.gain.setTargetAtTime(0, scene.audioContext.currentTime, 0.5);
      
      // After fade out, remove the shape
      setTimeout(() => {
        shapeToRemove.graphics.destroy();
        shapeToRemove.oscillator.stop();
        shapeToRemove.oscillator.disconnect();
        shapeToRemove.gain.disconnect();
        if (shapeToRemove.stereoPanner) shapeToRemove.stereoPanner.disconnect();
        scene.shapes = scene.shapes.filter(shape => shape !== shapeToRemove);
      }, 1000);
    }
  }

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
		  document.getElementById('saveConfig').addEventListener('click', () => {
		    const config = scene.saveConfiguration();
		    const encodedConfig = btoa(JSON.stringify(config));
		    const shareLink = `${window.location.origin}${window.location.pathname}?config=${encodedConfig}`;
		    alert(`Copy this link to share your configuration:\n${shareLink}`);
		    navigator.clipboard.writeText(shareLink).then(() => {
		      console.log('Link copied to clipboard');
		    }).catch(err => console.error('Failed to copy link:', err));
		  });

		  // Ladda konfiguration från URL-parameter
		  const urlParams = new URLSearchParams(window.location.search);
		  const configParam = urlParams.get('config');
		  if (configParam) {
		    try {
		      const decodedConfig = JSON.parse(atob(configParam));
		      scene.loadConfiguration(decodedConfig);
		    } catch (error) {
		      console.error('Invalid configuration in URL:', error);
		    }
		  }

		  document.getElementById('toggleMenu').addEventListener('click', () => toggleMenu());
		}

		// Hanterar visning/dölj av meny
		export function toggleMenu() {
		  const isMenuVisible = document.getElementById('sliderContainer').style.transform !== 'translateX(-200px)';
		  const toggleButton = document.getElementById('toggleMenu');
		  const sliderContainer = document.getElementById('sliderContainer');
		  const logoImg = document.getElementById('logoImg');

		  if (isMenuVisible) {
		    sliderContainer.style.transform = 'translateX(-200px)';
		    logoImg.style.transform = 'translateX(-200px)';
		    toggleButton.style.transform = 'translateX(-20px)';
		    toggleButton.innerHTML = '<span style="display: inline-block; width: 30px; text-align: center; font-size: 18px;">→</span>';
		  } else {
		    sliderContainer.style.transform = '';
		    logoImg.style.transform = '';
		    toggleButton.style.transform = '';
		    toggleButton.innerHTML = '<span style="display: inline-block; width: 30px; text-align: center; font-size: 18px;">←</span>';
		  }
		}

		// Återställer scenen till standardvärden
		export function resetScene(scene) {
		  // Radera alla former
		  scene.shapes.forEach(shape => {
		    shape.graphics.destroy();
		    shape.oscillator.stop();
		    shape.oscillator.disconnect();
		    shape.gain.disconnect();
		    if (shape.stereoPanner) shape.stereoPanner.disconnect();
		  });
		  scene.shapes = [];

		  // Återställ alla inställningar till standardvärden
		  scene.particleCount = 20;
		  scene.particleSpeed = 1.5;
		  scene.masterVolume = 0.3;
		  scene.harmonicEnabled = false;
		  scene.panEnabled = false;
		  scene.isPaused = false;
		  scene.isLive = false;
		  if (scene.liveTimer) {
		    scene.liveTimer.remove();
		    scene.liveTimer = null;
		  }

		  // Uppdatera UI-element
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
		  document.getElementById('chordSlider').style.setProperty('--thumb-color', scene.chordColors[0].color);
		  document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${scene.chordColors[0].key}"`);
		  scene.defaultFrequencies = scene.chordColors[0].frequencies;
		}