import Phaser from 'phaser';
import { createAudioContext, createOscillator, updateVolume } from '../utils/audioUtils';
import { createUI, updateUI, handleUIEvents, toggleMenu, resetScene } from '../utils/visualUtils';
import { themes, activeTheme } from '../config/themes';

class CosmiChordScene extends Phaser.Scene {
  constructor() {
    super('CosmiChordScene');
  }

  create() {
    // Add logo to top left
    const logoImg = document.createElement('img');
    logoImg.src = '../images/logo.png';
    logoImg.style.position = 'absolute';
    logoImg.style.top = '40px';
    logoImg.style.left = '40px';
    logoImg.style.width = '140px';
    logoImg.style.height = 'auto';
    logoImg.style.zIndex = '1000';
    logoImg.style.transition = 'transform 0.3s ease-in-out';
    logoImg.id = 'logoImg';
    document.getElementById('renderDiv').appendChild(logoImg);

    // Initialize master volume and audio context
    this.masterVolume = 0.3;
    this.audioContext = createAudioContext();
    this.shapes = [];
    this.connectionGraphics = this.add.graphics({ lineStyle: { width: 4 } });
    this.connectionGraphics.setDepth(0);

    // Particle settings
    this.particleSpeed = 1.5;
    this.particleCount = 20;
    this.panEnabled = false;
    this.harmonicEnabled = false;
    this.isLive = false;
    this.isPaused = false;
    this.liveTimer = null;

    // Initialize camera and grid
    this.cameras.main.setBackgroundColor('#000000');
    this.gridSize = 60;
    this.gridCols = 10;
    this.gridRows = 10;
    
    // Define playable area boundaries - FULL SCREEN WITH NO BOUNDARIES
    this.playAreaLeft = 30;    
    this.playAreaRight = 570;  
    this.playAreaTop = 30;     
    this.playAreaBottom = 570;

    // Particle texture
    const particleGraphics = this.add.graphics();
    particleGraphics.fillStyle(0xffffff);
    particleGraphics.fillCircle(5, 5, 5);
    particleGraphics.generateTexture('particle', 10, 10);
    particleGraphics.destroy();

    // Create particles
    this.particles = [];
    for (let k = 0; k < this.particleCount; k++) {
      const x = Phaser.Math.Between(this.playAreaLeft, this.playAreaRight);
      const y = Phaser.Math.Between(this.playAreaTop, this.playAreaBottom);
      const particle = this.matter.add.sprite(x, y, 'particle', null, {
        isStatic: false,
        shape: { type: 'circle', radius: 5 },
        frictionAir: 0,
        friction: 0,
        restitution: 1,
        mass: 1,
        inertia: Infinity,
        collisionFilter: { group: -1 }
      });
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
      this.particles.push(particle);
    }

    // Set up UI
    createUI(this);
    handleUIEvents(this);

    // Dragging and input setup
    this.draggedShape = null;
    this.isDragging = false;
    this.selectedNoteType = null;

    // Input handling
    this.setupInputListeners();

    // Matter physics bounds
    this.matter.world.setBounds(0, 0, 600, 600, 32, true, true, false, true);

    // Set default frequencies and chord colors
    this.defaultFrequencies = this.chordColors[0].frequencies;
    
    // Track active harmonics for blend mode
    this.activeHarmonics = new Map();
    
    // NO BOUNDARY LINES AT ALL
  }

  update() {
    this.connectionGraphics.clear();

    // Ensure shapes are properly positioned during tweens
    this.shapes.forEach(shape => {
      if (!shape.currentTween && shape.graphics) {
        shape.graphics.x = shape.x;
        shape.graphics.y = shape.y;
      }
    });

    this.particles.forEach(particle => {
      if (!particle.body) return;

      const velocity = particle.body.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      // If particle has very low or zero speed, give it a new random direction
      if (speed < 0.5) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
      }
      // Ensure constant speed
      else if (Math.abs(speed - this.particleSpeed) > 0.1) {
        const scale = this.particleSpeed / speed;
        particle.setVelocity(velocity.x * scale, velocity.y * scale);
      }

      // Bounce off walls and stay within the defined play area boundaries
      if (particle.x < this.playAreaLeft) {
        particle.x = this.playAreaLeft;
        particle.setVelocity(Math.abs(velocity.x), velocity.y);
      }
      if (particle.x > this.playAreaRight) {
        particle.x = this.playAreaRight;
        particle.setVelocity(-Math.abs(velocity.x), velocity.y);
      }
      if (particle.y < this.playAreaTop) {
        particle.y = this.playAreaTop;
        particle.setVelocity(velocity.x, Math.abs(velocity.y));
      }
      if (particle.y > this.playAreaBottom) {
        particle.y = this.playAreaBottom;
        particle.setVelocity(velocity.x, -Math.abs(velocity.y));
      }
    });

    // Reset all shapes to their original appearance before processing this frame
    this.shapes.forEach(shape => {
      // Reset all shapes to their base appearance
      const originalColor = this.getShapeColor(shape.type, activeTheme);
      shape.graphics.clear();
      shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      shape.graphics.fillStyle(originalColor, 0.3).fillCircle(0, 0, 25);
      shape.graphics.fillStyle(originalColor, 1).fillCircle(0, 0, 20);
      shape.isBlending = false;
    });

    // Initialize direct shape connections tracking
    const directConnections = new Map();

    // Track shapes and their connections for color blending
    const shapeConnections = new Map();
    this.shapes.forEach(shape => {
      shapeConnections.set(shape, new Set());
    });

    // First find all connections between shapes and particles
    this.particles.forEach(particle => {
      const connectedShapes = this.shapes.filter(shape => {
        const dist = Phaser.Math.Distance.Between(particle.x, particle.y, shape.x, shape.y);
        return dist < shape.radius; // Use shape.radius for connection detection
      });

      // Draw connections from shape to particles - thick colored lines
      connectedShapes.forEach(shape => {
        const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
        if (distance < shape.radius) {
          // Draw with shape's color
          const lineColor = this.getShapeColor(shape.type, activeTheme);
          const opacity = Math.pow(1 - (distance / shape.radius), 1.3) * 0.8; // Higher opacity
          this.connectionGraphics.lineStyle(4, lineColor, opacity); // Thick lines
          this.connectionGraphics.beginPath();
          this.connectionGraphics.moveTo(shape.x, shape.y);
          this.connectionGraphics.lineTo(particle.x, particle.y);
          this.connectionGraphics.strokePath();
          
          // Add subtle visual feedback when node is making sound
          // This applies in both normal and BLEND modes
          const activationLevel = 1 - (distance / shape.radius);
          const subtleFactor = this.harmonicEnabled ? 0.15 : 0.25; // Even more subtle in BLEND mode
          
          if (activationLevel > 0) {
            const originalColor = this.getShapeColor(shape.type, activeTheme);
            // Add a very subtle glow effect
            const glowSize = 26 + activationLevel * 4 * subtleFactor;
            shape.graphics.fillStyle(originalColor, 0.15 * activationLevel).fillCircle(0, 0, glowSize);
          }
        }
      });

      // If a particle connects exactly 2 shapes, create a connection for color blending and harmonics
      if (connectedShapes.length === 2) {
        const [shape1, shape2] = connectedShapes;
        shapeConnections.get(shape1).add(shape2);
        shapeConnections.get(shape2).add(shape1);
        
        // Track direct connections for harmony calculation
        const key1 = `${shape1.i},${shape1.j}`;
        const key2 = `${shape2.i},${shape2.j}`;
        
        if (!directConnections.has(key1)) {
          directConnections.set(key1, new Set());
        }
        if (!directConnections.has(key2)) {
          directConnections.set(key2, new Set());
        }
        
        directConnections.get(key1).add(key2);
        directConnections.get(key2).add(key1);

        // Draw connection between connected shapes if blend is on
        if (this.harmonicEnabled) {
          // Get colors for both shapes
          const color1 = this.getShapeColor(shape1.type, activeTheme);
          const color2 = this.getShapeColor(shape2.type, activeTheme);

          // Convert hex colors to RGB for blending
          const rgb1 = {
            r: (color1 >> 16) & 0xFF,
            g: (color1 >> 8) & 0xFF,
            b: color1 & 0xFF
          };
          const rgb2 = {
            r: (color2 >> 16) & 0xFF,
            g: (color2 >> 8) & 0xFF,
            b: color2 & 0xFF
          };

          // Calculate actual blended color (blue + yellow = green, etc.)
          const blendedRgb = {
            r: Math.round((rgb1.r + rgb2.r) / 2),
            g: Math.round((rgb1.g + rgb2.g) / 2),
            b: Math.round((rgb1.b + rgb2.b) / 2)
          };

          // Convert back to hex 
          const blendedColor = (blendedRgb.r << 16) + (blendedRgb.g << 8) + blendedRgb.b;

          // In BLEND mode, ONLY change the arm colors, not the node colors
          // Draw a connection with the properly blended color
          this.connectionGraphics.lineStyle(4, blendedColor, 0.6); 
          this.connectionGraphics.beginPath();
          this.connectionGraphics.moveTo(shape1.x, shape1.y);
          this.connectionGraphics.lineTo(particle.x, particle.y);
          this.connectionGraphics.lineTo(shape2.x, shape2.y);
          this.connectionGraphics.strokePath();

          // Mark these shapes as blending
          shape1.isBlending = true;
          shape2.isBlending = true;
        }
      }
    });

    // Apply harmonic blending for connected shapes
    this.shapes.forEach(shape => {
      const shapeKey = `${shape.i},${shape.j}`;
      const connections = directConnections.get(shapeKey) || new Set();

      // Calculate shape volumes based on particle proximity
      let closestDistance = Infinity;
      this.particles.forEach(particle => {
        const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
        closestDistance = Math.min(closestDistance, distance);
      });

      // Calculate volume based on particle proximity
      let volume = Math.max(0, Math.min(1, 1 - (closestDistance / shape.radius)));
      volume = Math.pow(volume, 1.5) * 0.8; // Smoother volume curve
      
      // If shape has no connections or blend is off, use original frequency
      if (!connections.size || !this.harmonicEnabled) {
        if (isFinite(shape.frequency)) {
          shape.oscillator.frequency.setTargetAtTime(shape.frequency, this.audioContext.currentTime, 0.1);
        } else {
          shape.oscillator.frequency.setTargetAtTime(440, this.audioContext.currentTime, 0.1);
        }
      } 
      // Apply harmonics when connected and blend mode is on - REDUCE SIREN EFFECT
      else if (this.harmonicEnabled) {
        // Get all directly connected shapes
        const connectedShapes = Array.from(connections).map(key => {
          return this.shapes.find(s => `${s.i},${s.j}` === key);
        }).filter(s => s !== null);
        
        if (connectedShapes.length > 0) {
          // Create musically pleasing combinations - REDUCED SIREN EFFECT
          const connectedFreqs = connectedShapes.map(s => s.frequency).filter(f => isFinite(f));
          const baseFreq = shape.frequency;
          
          if (connectedFreqs.length > 0 && isFinite(baseFreq)) {
            // Choose only fixed, stable harmonic relationships - NO MODULATION
            // Instead of continuously adjusting frequency, pick a fixed harmonic ratio
            const targetRatios = [1, 4/3, 3/2, 2]; // Unison, fourth, fifth, octave - stable harmonics
            
            // Find an appropriate target frequency
            const closestFreq = connectedFreqs[0];
            const ratio = closestFreq / baseFreq;
            
            // Find the closest stable ratio
            let bestRatio = targetRatios[0];
            let minDiff = Math.abs(ratio - bestRatio);
            
            for (const r of targetRatios) {
              const diff = Math.abs(ratio - r);
              if (diff < minDiff) {
                minDiff = diff;
                bestRatio = r;
              }
            }
            
            // Apply a fixed harmonic relationship - NO SIRENS
            const harmonicFreq = baseFreq * bestRatio;
            
            // Apply with VERY long transition to avoid sirens (1.5 seconds)
            shape.oscillator.frequency.setTargetAtTime(
              harmonicFreq, 
              this.audioContext.currentTime, 
              1.5 // Very long transition time to eliminate sirens
            );
            
            // Slightly reduce volume
            volume *= 0.8;
          }
        }
      }
      
      // Apply calculated volume to the shape's sound
      shape.baseVolume = volume;
      const frequencyBoost = (shape.frequency <= 110) ? 1.2 : (shape.frequency <= 220 ? 1.1 : 1);
      shape.currentVolume = shape.baseVolume * this.masterVolume * frequencyBoost;
      
      if (this.audioContext.state === 'running' && shape.gain && !this.isPaused) {
        // Ensure volume is valid
        const safeVolume = isFinite(shape.currentVolume) ? shape.currentVolume : 0;
        const clampedVolume = Math.min(Math.max(safeVolume, 0), 1);
        
        // Apply smooth volume transition
        const volumeTransitionTime = Math.max(0.1, 0.3 * (1.5 / this.particleSpeed));
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
        shape.gain.gain.setTargetAtTime(clampedVolume, this.audioContext.currentTime, volumeTransitionTime);

        // Apply stereo panning if enabled
        if (this.panEnabled && shape.stereoPanner) {
          const panValue = this.calculatePan(shape.i);
          shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.05);
        }
      }
    });
  }

  // Reset a shape to its original color
  resetShapeToOriginalColor(shape) {
    const originalColor = this.getShapeColor(shape.type, activeTheme);
    shape.graphics.clear();
    shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
    shape.graphics.fillStyle(originalColor, 0.3).fillCircle(0, 0, 25);
    shape.graphics.fillStyle(originalColor, 1).fillCircle(0, 0, 20);
  }

  setupInputListeners() {
    this.input.once('pointerdown', () => this.audioContext.resume());

    this.draggedShape = null;
    this.isDragging = false;
    this.selectedNoteType = null;

    this.input.keyboard.on('keydown-SHIFT', () => {
      document.getElementById('renderDiv').style.cursor = 'grab';
    });
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((key, index) => {
      this.input.keyboard.on(`keydown-${key}`, () => {
        let customCursor = document.getElementById('customCursor');
        if (customCursor) customCursor.remove();

        customCursor = document.createElement('div');
        customCursor.id = 'customCursor';
        customCursor.style.position = 'fixed';
        customCursor.style.pointerEvents = 'none';
        customCursor.style.zIndex = '9999';
        customCursor.style.userSelect = 'none';
        customCursor.style.width = '40px';
        customCursor.style.height = '40px';
        customCursor.style.borderRadius = '50%';
        customCursor.style.transform = 'translate(-50%, -50%)';

        const colors = {
          0: { color: this.getShapeColor('circle', activeTheme), type: 'circle' },
          1: { color: this.getShapeColor('yellowTriangle', activeTheme), type: 'yellowTriangle' },
          2: { color: this.getShapeColor('triangle', activeTheme), type: 'triangle' },
          3: { color: this.getShapeColor('square', activeTheme), type: 'square' },
          4: { color: this.getShapeColor('purpleSquare', activeTheme), type: 'purpleSquare' },
          5: { color: this.getShapeColor('orangeSquare', activeTheme), type: 'orangeSquare' }
        };

        const type = colors[index].type;
        this.selectedNoteType = type;
        const rgbColor = {
          r: (colors[index].color >> 16) & 0xFF,
          g: (colors[index].color >> 8) & 0xFF,
          b: colors[index].color & 0xFF
        };
        customCursor.style.backgroundColor = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.25)`; // More transparent
        customCursor.style.border = `2px solid rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`;
        customCursor.style.boxShadow = `0 0 10px rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.5)`; // Subtle glow
        document.body.appendChild(customCursor);
        customCursor.style.display = 'block';
        document.getElementById('renderDiv').style.cursor = 'none';
        const updatePosition = (e) => {
          requestAnimationFrame(() => {
            customCursor.style.left = `${e.clientX}px`;
            customCursor.style.top = `${e.clientY}px`;
          });
        };
        document.addEventListener('mousemove', updatePosition);
        this.updateCursorPosition = updatePosition;
        const currentEvent = this.input.activePointer.event;
        if (currentEvent) updatePosition(currentEvent);
      });
      this.input.keyboard.on(`keyup-${key}`, () => {
        const customCursor = document.getElementById('customCursor');
        if (customCursor) customCursor.remove();
        document.getElementById('renderDiv').style.cursor = 'default';
        document.removeEventListener('mousemove', this.updateCursorPosition);
        this.updateCursorPosition = null;
        this.selectedNoteType = null;
      });
    });
    this.input.keyboard.on('keydown-CTRL', () => {
      document.getElementById('renderDiv').style.cursor = '➖';
    });
    this.input.keyboard.on('keydown-X', () => {
      let customCursor = document.getElementById('customCursor');
      if (customCursor) customCursor.remove();
      customCursor = document.createElement('div');
      document.getElementById('renderDiv').style.cursor = 'none';
      customCursor.id = 'customCursor';
      customCursor.style.position = 'fixed';
      customCursor.style.fontSize = '16px';
      customCursor.style.pointerEvents = 'none';
      customCursor.style.zIndex = '9999';
      customCursor.style.color = '#ffffff';
      customCursor.style.userSelect = 'none';
      customCursor.textContent = '⌫';
      document.body.appendChild(customCursor);
      customCursor.style.display = 'block';
      const updatePosition = (e) => {
        requestAnimationFrame(() => {
          customCursor.style.left = `${e.clientX}px`;
          customCursor.style.top = `${e.clientY}px`;
        });
      };
      const currentEvent = this.input.activePointer.event;
      if (currentEvent) updatePosition(currentEvent);
      document.addEventListener('mousemove', updatePosition);
      this.updateCursorPosition = updatePosition;
    });
    this.input.keyboard.on('keyup-X', () => {
      document.getElementById('renderDiv').style.cursor = 'default';
      const customCursor = document.getElementById('customCursor');
      if (customCursor) customCursor.remove();
      document.removeEventListener('mousemove', this.updateCursorPosition);
      this.updateCursorPosition = null;
    });
    this.input.keyboard.on('keyup-CTRL', () => {
      if (!this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) {
        document.getElementById('renderDiv').style.cursor = 'default';
      }
    });
    this.input.keyboard.on('keyup-SHIFT', () => {
      document.getElementById('renderDiv').style.cursor = 'default';
      this.isDragging = false;
      this.draggedShape = null;
    });

    this.input.keyboard.on('keydown-Q', () => {
      const chordIndex = 0;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-W', () => {
      const chordIndex = 1;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-E', () => {
      const chordIndex = 2;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-R', () => {
      const chordIndex = 3;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-T', () => {
      const chordIndex = 4;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-Y', () => {
      const chordIndex = 5;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-B', () => {
      const blendButton = document.getElementById('blendToggle');
      this.harmonicEnabled = !this.harmonicEnabled;
      blendButton.textContent = this.harmonicEnabled ? 'On' : 'Off';
      blendButton.style.background = this.harmonicEnabled ? '#00cc00' : '#333';
      blendButton.style.width = '60px';
    });
    this.input.keyboard.on('keydown-P', () => {
      const panButton = document.getElementById('panToggle');
      this.panEnabled = !this.panEnabled;
      panButton.textContent = this.panEnabled ? 'On' : 'Off';
      panButton.style.background = this.panEnabled ? '#2ecc71' : '#333';
      panButton.style.width = '60px';
      this.shapes.forEach(shape => {
        if (shape.stereoPanner) {
          const targetPan = this.panEnabled ? this.calculatePan(shape.i) : 0;
          shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(targetPan, this.audioContext.currentTime, 0.2);
        }
      });
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) {
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < 25
        );
        if (clickedShape) {
          clickedShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
          clickedShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
          setTimeout(() => {
            clickedShape.graphics.destroy();
            clickedShape.oscillator.stop();
            clickedShape.oscillator.disconnect();
            clickedShape.gain.disconnect();
            if (clickedShape.stereoPanner) clickedShape.stereoPanner.disconnect();
            this.shapes = this.shapes.filter(shape => shape !== clickedShape);
          }, 50);
          return;
        }
      } else if (this.input.keyboard.checkDown(this.input.keyboard.addKey('SHIFT'))) {
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < 25
        );
        if (clickedShape) {
          this.draggedShape = clickedShape;
          this.isDragging = true;
          document.getElementById('renderDiv').style.cursor = 'grabbing';
        }
      } else {
        this.placeShape(pointer, this.selectedNoteType);
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (this.isDragging && this.draggedShape && this.input.keyboard.checkDown(this.input.keyboard.addKey('SHIFT'))) {
        const i = Math.floor(pointer.x / this.gridSize);
        const j = Math.floor(pointer.y / this.gridSize);
        const clampedI = Math.max(0, Math.min(i, this.gridCols - 1));
        const clampedJ = Math.max(0, Math.min(j, this.gridRows - 1));
        const newX = clampedI * this.gridSize + this.gridSize / 2;
        const newY = clampedJ * this.gridSize + this.gridSize / 2;

        this.draggedShape.x = newX;
        this.draggedShape.y = newY;
        this.draggedShape.graphics.setPosition(newX, newY);
        this.draggedShape.i = clampedI;
        this.draggedShape.j = clampedJ;

        if (this.draggedShape.gain) {
          this.draggedShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
          this.draggedShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
          this.draggedShape.gain.gain.setTargetAtTime(
            this.draggedShape.baseVolume * this.masterVolume * (this.draggedShape.frequency <= 110 ? 1.5 : 1),
            this.audioContext.currentTime + 0.01, 0.05
          );

          if (this.panEnabled && this.draggedShape.stereoPanner) {
            const panValue = this.calculatePan(clampedI);
            this.draggedShape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
            this.draggedShape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.1);
          }
        }
      }
    });

    this.input.on('pointerup', () => {
      if (this.input.keyboard.checkDown(this.input.keyboard.addKey('SHIFT'))) {
        document.getElementById('renderDiv').style.cursor = 'grab';
      }
      this.isDragging = false;
      this.draggedShape = null;
    });
  }

  placeShape(pointer, selectedType = null) {
    const i = Math.floor(pointer.x / this.gridSize);
    const j = Math.floor(pointer.y / this.gridSize);
    
    // Allow placement anywhere within playable area
    if (i * this.gridSize + this.gridSize / 2 < this.playAreaLeft || 
        i * this.gridSize + this.gridSize / 2 > this.playAreaRight || 
        j * this.gridSize + this.gridSize / 2 < this.playAreaTop || 
        j * this.gridSize + this.gridSize / 2 > this.playAreaBottom) {
      return; // Don't place shape outside boundaries
    }
    
    const x = i * this.gridSize + this.gridSize / 2;
    const y = j * this.gridSize + this.gridSize / 2;

    const existingShape = this.shapes.find(shape => shape.i === i && shape.j === j);
    if (existingShape) {
      if (selectedType) {
        if (existingShape.type !== selectedType) {
          const fadeOutTime = 0.1;
          existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
          existingShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
          setTimeout(() => {
            let newFrequency, color;
            switch (selectedType) {
              case 'circle': newFrequency = this.defaultFrequencies[0]; color = this.getShapeColor('circle', activeTheme); break;
              case 'yellowTriangle': newFrequency = this.defaultFrequencies[1]; color = this.getShapeColor('yellowTriangle', activeTheme); break;
              case 'triangle': newFrequency = this.defaultFrequencies[2]; color = this.getShapeColor('triangle', activeTheme); break;
              case 'square': newFrequency = this.defaultFrequencies[3]; color = this.getShapeColor('square', activeTheme); break;
              case 'purpleSquare': newFrequency = this.defaultFrequencies[4]; color = this.getShapeColor('purpleSquare', activeTheme); break;
              case 'orangeSquare': newFrequency = this.defaultFrequencies[5]; color = this.getShapeColor('orangeSquare', activeTheme); break;
            }
            existingShape.type = selectedType;
            existingShape.frequency = newFrequency;
            existingShape.graphics.clear();
            existingShape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
            existingShape.graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
            existingShape.graphics.fillStyle(color, 1).fillCircle(0, 0, 20);
            existingShape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime);
            existingShape.oscillator.frequency.setTargetAtTime(newFrequency, this.audioContext.currentTime, 0.1);
            existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
            existingShape.gain.gain.setTargetAtTime(
              existingShape.baseVolume * this.masterVolume * (newFrequency <= 110 ? 1.5 : 1),
              this.audioContext.currentTime + fadeOutTime, 0.1
            );
            if (this.panEnabled && existingShape.stereoPanner) {
              const panValue = this.calculatePan(existingShape.i);
              existingShape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
              existingShape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.1);
            }
          }, fadeOutTime * 1000);
        }
        return;
      }
      const fadeOutTime = 0.1;
      existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
      existingShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
      setTimeout(() => {
        let newType, newFrequency, color;
        switch (existingShape.type) {
          case 'circle': newType = 'yellowTriangle'; newFrequency = this.defaultFrequencies[1] || 220; color = this.getShapeColor('yellowTriangle', activeTheme); break;
          case 'yellowTriangle': newType = 'triangle'; newFrequency = this.defaultFrequencies[2] || 330; color = this.getShapeColor('triangle', activeTheme); break;
          case 'triangle': newType = 'square'; newFrequency = this.defaultFrequencies[3] || 440; color = this.getShapeColor('square', activeTheme); break;
          case 'square': newType = 'purpleSquare'; newFrequency = this.defaultFrequencies[4] || 110; color = this.getShapeColor('purpleSquare', activeTheme); break;
          case 'purpleSquare': newType = 'orangeSquare'; newFrequency = this.defaultFrequencies[5] || 55; color = this.getShapeColor('orangeSquare', activeTheme); break;
          case 'orangeSquare':
            existingShape.graphics.destroy();
            existingShape.oscillator.stop();
            existingShape.oscillator.disconnect();
            existingShape.gain.disconnect();
            if (existingShape.stereoPanner) existingShape.stereoPanner.disconnect();
            this.shapes = this.shapes.filter(shape => shape !== existingShape);
            return;
        }
        if (newType) {
          existingShape.type = newType;
          existingShape.frequency = newFrequency;
          existingShape.graphics.clear();
          existingShape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
          existingShape.graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
          existingShape.graphics.fillStyle(color, 1).fillCircle(0, 0, 20);
          existingShape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime);
          existingShape.oscillator.frequency.setTargetAtTime(newFrequency, this.audioContext.currentTime, 0.1);
          existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
          existingShape.gain.gain.setTargetAtTime(
            existingShape.baseVolume * this.masterVolume * (newFrequency <= 110 ? 1.5 : 1),
            this.audioContext.currentTime + fadeOutTime, 0.1
          );
          if (this.panEnabled && existingShape.stereoPanner) {
            const panValue = this.calculatePan(existingShape.i);
            existingShape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
            existingShape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.1);
          }
        }
      }, fadeOutTime * 1000);
    } else {
      let type, frequency, color;
      if (selectedType) {
        type = selectedType;
        switch (type) {
          case 'circle': frequency = this.defaultFrequencies[0]; color = this.getShapeColor('circle', activeTheme); break;
          case 'yellowTriangle': frequency = this.defaultFrequencies[1]; color = this.getShapeColor('yellowTriangle', activeTheme); break;
          case 'triangle': frequency = this.defaultFrequencies[2]; color = this.getShapeColor('triangle', activeTheme); break;
          case 'square': frequency = this.defaultFrequencies[3]; color = this.getShapeColor('square', activeTheme); break;
          case 'purpleSquare': frequency = this.defaultFrequencies[4]; color = this.getShapeColor('purpleSquare', activeTheme); break;
          case 'orangeSquare': frequency = this.defaultFrequencies[5]; color = this.getShapeColor('orangeSquare', activeTheme); break;
        }
      } else {
        type = 'circle';
        frequency = this.defaultFrequencies[0];
        color = this.getShapeColor('circle', activeTheme);
      }
      const graphics = this.add.graphics({ x, y });
      graphics.setDepth(1);
      graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
      graphics.fillStyle(color, 1).fillCircle(0, 0, 20);

      const oscillator = createOscillator(this.audioContext, frequency);
      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0, 0);
      const stereoPanner = this.audioContext.createStereoPanner();
      oscillator.connect(gain);
      gain.connect(stereoPanner);
      stereoPanner.connect(this.audioContext.destination);
      oscillator.start();

      const initialPan = this.panEnabled ? this.calculatePan(i) : 0;
      stereoPanner.pan.setValueAtTime(initialPan, this.audioContext.currentTime);

      gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0);
      gain.gain.setTargetAtTime(0.01 * (frequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + 0.01, 0.1);

      this.shapes.push({ i, j, x, y, type, frequency, graphics, oscillator, gain, stereoPanner, radius: 200, baseVolume: 0, isBlending: false });
    }
  }

  updateParticleCount(newCount) {
    while (this.particles.length > newCount) {
      this.particles.pop().destroy();
    }
    while (this.particles.length < newCount) {
      const x = Phaser.Math.Between(this.playAreaLeft, this.playAreaRight);
      const y = Phaser.Math.Between(this.playAreaTop, this.playAreaBottom);
      const particle = this.matter.add.sprite(x, y, 'particle', null, {
        shape: { type: 'circle', radius: 5 },
        frictionAir: 0,
        friction: 0,
        restitution: 1,
        mass: 1,
        inertia: Infinity,
        collisionFilter: { group: -1 }
      });
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
      this.particles.push(particle);
    }
  }

  getShapeColor(type, theme = activeTheme) {
    return themes[theme][type] || 0xffffff;
  }

  calculatePan(i) {
    return (i / (this.gridCols - 1)) * 2 - 1;
  }

  saveConfiguration() {
    const shapesData = this.shapes.map(shape => ({
      i: shape.i, j: shape.j, type: shape.type, frequency: shape.frequency
    }));
    return {
      shapes: shapesData,
      particleCount: this.particleCount,
      particleSpeed: this.particleSpeed,
      masterVolume: this.masterVolume,
      harmonicEnabled: this.harmonicEnabled,
      panEnabled: this.panEnabled,
      defaultFrequencies: this.defaultFrequencies
    };
  }

  loadConfiguration(config) {
    this.shapes.forEach(shape => {
      shape.graphics.destroy();
      shape.oscillator.stop();
      shape.oscillator.disconnect();
      shape.gain.disconnect();
      if (shape.stereoPanner) shape.stereoPanner.disconnect();
    });
    this.shapes = [];

    config.shapes.forEach(shapeData => {
      const x = shapeData.i * this.gridSize + this.gridSize / 2;
      const y = shapeData.j * this.gridSize + this.gridSize / 2;
      const graphics = this.add.graphics({ x, y });
      graphics.setDepth(1);
      let color, frequency;
      switch (shapeData.type) {
        case 'circle': color = this.getShapeColor('circle', activeTheme); frequency = shapeData.frequency || 55; break;
        case 'yellowTriangle': color = this.getShapeColor('yellowTriangle', activeTheme); frequency = shapeData.frequency || 220; break;
        case 'triangle': color = this.getShapeColor('triangle', activeTheme); frequency = shapeData.frequency || 330; break;
        case 'square': color = this.getShapeColor('square', activeTheme); frequency = shapeData.frequency || 440; break;
        case 'purpleSquare': color = this.getShapeColor('purpleSquare', activeTheme); frequency = shapeData.frequency || 110; break;
        case 'orangeSquare': color = this.getShapeColor('orangeSquare', activeTheme); frequency = shapeData.frequency || 55; break;
      }
      graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
      graphics.fillStyle(color, 1).fillCircle(0, 0, 20);

      const oscillator = createOscillator(this.audioContext, frequency);
      const gain = this.audioContext.createGain();
      const stereoPanner = this.audioContext.createStereoPanner();
      oscillator.connect(gain);
      gain.connect(stereoPanner);
      stereoPanner.connect(this.audioContext.destination);
      oscillator.start();

      const initialPan = config.panEnabled ? this.calculatePan(shapeData.i) : 0;
      stereoPanner.pan.setValueAtTime(initialPan, this.audioContext.currentTime);

      gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0);
      gain.gain.setTargetAtTime(0.01 * (frequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + 0.01, 0.1);

      this.shapes.push({ 
        i: shapeData.i, 
        j: shapeData.j, 
        x, 
        y, 
        type: shapeData.type, 
        frequency, 
        graphics, 
        oscillator, 
        gain, 
        stereoPanner, 
        radius: 200, 
        baseVolume: 0,
        isBlending: false
      });
    });

    this.particleCount = config.particleCount;
    this.particleSpeed = config.particleSpeed;
    this.masterVolume = config.masterVolume;
    this.harmonicEnabled = config.harmonicEnabled;
    this.panEnabled = config.panEnabled || false;
    this.defaultFrequencies = config.defaultFrequencies || [55, 220, 330, 440, 110, 55];

    updateUI(this, this.particleCount, this.particleSpeed, this.masterVolume, this.harmonicEnabled, this.panEnabled);
    this.updateParticleCount(this.particleCount);
  }

  // Chord colors (defined here for convenience, could be moved to config)
  chordColors = {
    0: { color: 'white', label: 'Celestial', frequencies: [55, 220, 330, 440, 550, 660], key: '1' },
    1: { color: 'blue', label: 'Mystical', frequencies: [55, 220, 261.63, 330, 392, 466.16], key: '2' },
    2: { color: 'green', label: 'Minor', frequencies: [55, 220, 261.63, 293.66, 349.23, 415.30], key: '3' },
    3: { color: 'red', label: 'Bright', frequencies: [55, 220, 277.18, 329.63, 415.30, 493.88], key: '4' },
    4: { color: 'orange', label: 'Dreamy', frequencies: [55, 220, 246.94, 293.66, 369.99, 440], key: '5' },
    5: { color: 'purple', label: 'Dark', frequencies: [55, 220, 261.63, 311.13, 369.99, 466.16], key: '6' }
  };
}

export default CosmiChordScene;