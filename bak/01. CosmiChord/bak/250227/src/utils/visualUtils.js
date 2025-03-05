import { themes, activeTheme } from '../config/themes';

// Skapar UI-elementen för spelet
export function createUI(scene) {
  const sliderContainer = document.createElement('div');
  sliderContainer.id = 'sliderContainer';
  sliderContainer.className = 'slider-container';
  document.getElementById('renderDiv').appendChild(sliderContainer);

  // Lägg till logotyp om den inte redan finns
  const logoImg = document.getElementById('logoImg');
  if (!logoImg) {
    const logo = document.createElement('img');
    logo.id = 'logoImg';
    logo.className = 'logo-img';
    logo.src = '/images/logo.png'; // Testa absolut sökväg
    logo.onload = () => console.log('Logo loaded successfully');
    logo.onerror = (e) => console.error('Failed to load logo.png:', e);
    document.getElementById('renderDiv').appendChild(logo);
  }

  // Partikelantal-slider
  const particleCountContainer = document.createElement('div');
  particleCountContainer.className = 'slider-item';
  particleCountContainer.innerHTML = `
    <label>Particles: <span id="particleCount">20</span></label>
    <input type="range" min="5" max="50" value="20" id="particleSlider">
  `;
  sliderContainer.appendChild(particleCountContainer);

  // Hastighet-slider
  const speedContainer = document.createElement('div');
  speedContainer.className = 'slider-item';
  speedContainer.innerHTML = `
    <label>Speed: <span id="speedValue">1.5</span></label>
    <input type="range" min="0.1" max="5" value="1.5" step="0.1" id="speedSlider">
  `;
  sliderContainer.appendChild(speedContainer);

  // Volym-slider
  const volumeContainer = document.createElement('div');
  volumeContainer.className = 'slider-item';
  volumeContainer.innerHTML = `
    <label>Volume: <span id="volumeValue">0.3</span></label>
    <input type="range" min="0" max="0.5" value="0.3" step="0.1" id="volumeSlider">
  `;
  sliderContainer.appendChild(volumeContainer);

  // Blend-toggle
  const blendContainer = document.createElement('div');
  blendContainer.className = 'toggle-container';
  blendContainer.innerHTML = `
    <label>Blend:</label>
    <button id="blendToggle">Off</button>
  `;
  sliderContainer.appendChild(blendContainer);

  // Pan-toggle
  const panContainer = document.createElement('div');
  panContainer.className = 'toggle-container';
  panContainer.innerHTML = `
    <label>Pan:</label>
    <button id="panToggle">Off</button>
  `;
  sliderContainer.appendChild(panContainer);

  // Ackord-slider
  const chordContainer = document.createElement('div');
  chordContainer.className = 'slider-item';
  chordContainer.innerHTML = `
    <label>Chord: <span id="chordValue" style="color: #0000ff;">Celestial</span></label>
    <input type="range" min="0" max="5" value="0" id="chordSlider">
  `;
  sliderContainer.appendChild(chordContainer);

  // Armlängd-slider (ny slider för nodradie)
  const armLengthContainer = document.createElement('div');
  armLengthContainer.className = 'slider-item';
  armLengthContainer.innerHTML = `
    <label>Arm Length: <span id="armLengthValue">100</span></label>
    <input type="range" min="50" max="200" value="100" id="armLengthSlider">
  `;
  sliderContainer.appendChild(armLengthContainer);

  // Random och Live-knappar
  const randomContainer = document.createElement('div');
  randomContainer.className = 'button-container';
  randomContainer.innerHTML = `
    <button id="randomButton">RANDOM</button>
    <button id="liveButton">LIVE</button>
  `;
  sliderContainer.appendChild(randomContainer);

  // Återställ och Pausa-knappar
  const resetContainer = document.createElement('div');
  resetContainer.className = 'button-container';
  resetContainer.innerHTML = `
    <button id="resetButton">RESET</button>
    <button id="pauseButton">PAUSE</button>
  `;
  sliderContainer.appendChild(resetContainer);

  // Spara-knapp
  const saveContainer = document.createElement('div');
  saveContainer.className = 'button-container';
  saveContainer.innerHTML = `
    <button id="saveConfig">Save & Share</button>
  `;
  sliderContainer.appendChild(saveContainer);

  // Toggle-knapp för meny
  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggleMenu';
  toggleButton.className = 'toggle-menu';
  toggleButton.innerHTML = '<span>←</span>';
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
  document.getElementById('armLengthValue').textContent = scene.nodeRadius; // Update arm length display
  document.getElementById('armLengthSlider').value = scene.nodeRadius; // Update arm length slider

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

  document.getElementById('armLengthSlider').addEventListener('input', (e) => {
    const newRadius = parseInt(e.target.value);
    scene.updateNodeRadius(newRadius);
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
      harmonicEnabled: Math.random() > 0.5,
      panEnabled: Math.random() > 0.5,
      defaultFrequencies: scene.chordColors[Math.floor(Math.random() * 6)].frequencies,
      nodeRadius: Math.floor(Math.random() * 151) + 50 // Random radius between 50 and 200
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
    scene.updateNodeRadius(config.nodeRadius);

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
    document.getElementById('armLengthValue').textContent = scene.nodeRadius;
    document.getElementById('armLengthSlider').value = scene.nodeRadius;
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
    const baseDelay = 5000;
    const speedFactor = Math.pow(1.5 / scene.particleSpeed, 1.5);
    const delay = Math.max(1000, baseDelay * speedFactor);
    
    scene.liveSequence = {
      step: 0,
      patternLength: 8,
      lastActionTime: 0,
      moveSequence: [],
      changeSequence: []
    };
    
    for (let i = 0; i < scene.liveSequence.patternLength; i++) {
      scene.liveSequence.moveSequence.push(Math.random() < 0.4);
      scene.liveSequence.changeSequence.push(Math.random() < 0.3);
    }
    
    scene.liveTimer = scene.time.addEvent({
      delay: delay,
      callback: () => {
        scene.liveSequence.step = (scene.liveSequence.step + 1) % scene.liveSequence.patternLength;
        const currentStep = scene.liveSequence.step;
        
        if (scene.shapes.length === 0) {
          createRandomShapes(scene, Math.floor(Math.random() * 3) + 2);
          return;
        }
        
        const shouldMove = scene.liveSequence.moveSequence[currentStep];
        const shouldChange = scene.liveSequence.changeSequence[currentStep];
        
        if (shouldMove) moveShapes(scene);
        if (shouldChange) changeShapeTones(scene);
        
        const timeSinceLastAction = scene.time.now - scene.liveSequence.lastActionTime;
        if (timeSinceLastAction > delay * 4) {
          if (Math.random() < 0.5 && scene.shapes.length < 8) {
            addComplementaryShape(scene);
          } else if (scene.shapes.length > 3) {
            removeRandomShape(scene);
          }
          scene.liveSequence.lastActionTime = scene.time.now;
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
    
    scene.harmonicEnabled = true;
    scene.panEnabled = true;
    updateUI(scene, scene.particleCount, scene.particleSpeed, scene.masterVolume, true, true);
  }
  
  function moveShapes(scene) {
    const shapesToMove = Phaser.Utils.Array.Shuffle(scene.shapes.slice()).slice(0, Math.min(2, scene.shapes.length));
    if (shapesToMove.length === 0) return;
    
    shapesToMove.forEach(shape => {
      let bestPosition = null;
      let bestDistance = Infinity;
      
      for (let attempt = 0; attempt < 10; attempt++) {
        const gridOffsetI = Phaser.Math.Between(-3, 3);
        const gridOffsetJ = Phaser.Math.Between(-3, 3);
        const newI = Math.max(0, Math.min(scene.gridCols - 1, shape.i + gridOffsetI));
        const newJ = Math.max(0, Math.min(scene.gridRows - 1, shape.j + gridOffsetJ));
        
        const newX = newI * scene.gridSize + scene.gridSize / 2;
        const newY = newJ * scene.gridSize + scene.gridSize / 2;
        if (newX < scene.playAreaLeft || newX > scene.playAreaRight || 
            newY < scene.playAreaTop || newY > scene.playAreaBottom) continue;
        
        if (scene.shapes.some(s => s !== shape && s.i === newI && s.j === newJ)) continue;
        
        const potentialConnections = scene.shapes.filter(s => s !== shape).reduce((sum, other) => {
          const dist = Phaser.Math.Distance.Between(newX, newY, other.x, other.y);
          return sum + (dist < 200 ? 1 : 0);
        }, 0);
        
        const interestScore = Math.abs(potentialConnections - 1);
        if (interestScore < bestDistance) {
          bestDistance = interestScore;
          bestPosition = { i: newI, j: newJ, x: newX, y: newY };
        }
      }

      if (bestPosition) {
        const { i, j, x, y } = bestPosition;
        const baseDuration = 2000;
        const speedFactor = Math.pow(1.5 / scene.particleSpeed, 1.2);
        const duration = Math.max(500, baseDuration * speedFactor);
        
        if (shape.currentTween) shape.currentTween.stop();
        
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
  
  function changeShapeTones(scene) {
    if (scene.shapes.length === 0) return;
    
    const shape = Phaser.Utils.Array.GetRandom(scene.shapes);
    if (!shape) return;
    
    const changeType = Math.random();
    
    if (changeType < 0.7) {
      const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
      const currentIndex = types.indexOf(shape.type);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const newIndex = (currentIndex + direction + types.length) % types.length;
      const newType = types[newIndex];
      const newFrequency = scene.defaultFrequencies[newIndex] || 440;
      
      fadeShapeToNewTone(scene, shape, newType, newFrequency);
    } else {
      const baseFreq = shape.frequency;
      let newFrequency;
      const intervalChoice = Math.random();
      if (intervalChoice < 0.3) newFrequency = baseFreq * 2;
      else if (intervalChoice < 0.6) newFrequency = baseFreq * 1.5;
      else if (intervalChoice < 0.8) newFrequency = baseFreq * 1.25;
      else newFrequency = baseFreq / 2;
      
      const closestType = findClosestFrequencyType(scene, newFrequency);
      fadeShapeToNewTone(scene, shape, closestType.type, closestType.frequency);
    }
  }
  
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
    
    return { type: closestType, frequency: closestFreq };
  }
  
  function fadeShapeToNewTone(scene, shape, newType, newFrequency) {
    shape.gain.gain.cancelScheduledValues(scene.audioContext.currentTime);
    shape.gain.gain.setTargetAtTime(0, scene.audioContext.currentTime, 0.2);
    
    setTimeout(() => {
      shape.type = newType;
      shape.frequency = newFrequency;
      
      const newColor = scene.getShapeColor(newType, activeTheme);
      shape.graphics.clear();
      shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      shape.graphics.fillStyle(newColor, 0.3).fillCircle(0, 0, 25);
      shape.graphics.fillStyle(newColor, 1).fillCircle(0, 0, 20);
      
      shape.oscillator.frequency.cancelScheduledValues(scene.audioContext.currentTime);
      shape.oscillator.frequency.setTargetAtTime(newFrequency, scene.audioContext.currentTime, 0.1);
      
      shape.gain.gain.setTargetAtTime(
        shape.baseVolume * scene.masterVolume * (newFrequency <= 110 ? 1.5 : 1),
        scene.audioContext.currentTime, 0.3
      );
      
      if (scene.panEnabled && shape.stereoPanner) {
        const panValue = scene.calculatePan(shape.i);
        shape.stereoPanner.pan.cancelScheduledValues(scene.audioContext.currentTime);
        shape.stereoPanner.pan.setTargetAtTime(panValue, scene.audioContext.currentTime, 0.1);
      }
    }, 200);
  }
  
  function addComplementaryShape(scene) {
    if (scene.shapes.length === 0) {
      createRandomShapes(scene, 1);
      return;
    }
    
    const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
    const existingTypes = new Set(scene.shapes.map(s => s.type));
    let newType;
    if (existingTypes.size < types.length) {
      newType = types.find(t => !existingTypes.has(t));
    } else {
      const typeCounts = types.reduce((counts, type) => {
        counts[type] = (counts[type] || 0) + scene.shapes.filter(s => s.type === type).length;
        return counts;
      }, {});
      newType = types.reduce((least, type) => typeCounts[type] < typeCounts[least] ? type : least, types[0]);
    }
    
    let bestPosition = null;
    let bestScore = -Infinity;
    
    for (let attempt = 0; attempt < 20; attempt++) {
      const i = Math.floor(Math.random() * scene.gridCols);
      const j = Math.floor(Math.random() * scene.gridRows);
      
      const x = i * scene.gridSize + scene.gridSize / 2;
      const y = j * scene.gridSize + scene.gridSize / 2;
      if (x < scene.playAreaLeft || x > scene.playAreaRight || 
          y < scene.playAreaTop || y > scene.playAreaBottom) continue;
      
      if (scene.shapes.some(s => s.i === i && s.j === j)) continue;
      
      const connections = scene.shapes.filter(s => {
        const dist = Phaser.Math.Distance.Between(x, y, s.x, s.y);
        return dist < 200;
      }).length;
      
      const score = connections === 0 ? 0 : connections === 1 ? 10 : connections === 2 ? 5 : 1;
      if (score > bestScore) {
        bestScore = score;
        bestPosition = { i, j };
      }
    }
    
    if (bestPosition) {
      const { i, j } = bestPosition;
      const mockPointer = { x: i * scene.gridSize + scene.gridSize / 2, y: j * scene.gridSize + scene.gridSize / 2 };
      scene.placeShape(mockPointer, newType);
      
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
  
  function removeRandomShape(scene) {
    if (scene.shapes.length <= 3) return;
    
    const connectedShapes = new Set();
    scene.particles.forEach(particle => {
      const nearbyShapes = scene.shapes.filter(shape => {
        const dist = Phaser.Math.Distance.Between(particle.x, particle.y, shape.x, shape.y);
        return dist < shape.radius;
      });
      if (nearbyShapes.length >= 2) nearbyShapes.forEach(shape => connectedShapes.add(shape));
    });
    
    let shapeToRemove;
    const unconnectedShapes = scene.shapes.filter(shape => !connectedShapes.has(shape));
    if (unconnectedShapes.length > 0) {
      shapeToRemove = Phaser.Utils.Array.GetRandom(unconnectedShapes);
    } else {
      shapeToRemove = Phaser.Utils.Array.GetRandom(scene.shapes);
    }
    
    if (shapeToRemove) {
      shapeToRemove.gain.gain.cancelScheduledValues(scene.audioContext.currentTime);
      shapeToRemove.gain.gain.setTargetAtTime(0, scene.audioContext.currentTime, 0.5);
      
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
    toggleButton.innerHTML = '<span>→</span>';
  } else {
    sliderContainer.style.transform = '';
    logoImg.style.transform = '';
    toggleButton.style.transform = '';
    toggleButton.innerHTML = '<span>←</span>';
  }
}

// Återställer scenen till standardvärden
export function resetScene(scene) {
  scene.shapes.forEach(shape => {
    shape.graphics.destroy();
    shape.oscillator.stop();
    shape.oscillator.disconnect();
    shape.gain.disconnect();
    if (shape.stereoPanner) shape.stereoPanner.disconnect();
  });
  scene.shapes = [];

  scene.particleCount = 20;
  scene.particleSpeed = 1.5;
  scene.masterVolume = 0.3;
  scene.harmonicEnabled = false;
  scene.panEnabled = false;
  scene.isPaused = false;
  scene.isLive = false;
  scene.nodeRadius = 100; // Reset to default arm length
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
  document.getElementById('chordSlider').style.setProperty('--thumb-color', scene.chordColors[0].color);
  document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${scene.chordColors[0].key}"`);
  scene.defaultFrequencies = scene.chordColors[0].frequencies;
}