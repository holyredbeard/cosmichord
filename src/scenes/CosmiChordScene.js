import Phaser from 'phaser';
import { createAudioContext, createOscillator, updateVolume } from '../utils/audioUtils';
import { createUI, updateUI, handleUIEvents, toggleMenu, resetScene } from '../utils/visualUtils';
import { themes, activeTheme } from '../config/themes';

class CosmiChordScene extends Phaser.Scene {
  constructor() {
    super('CosmiChordScene');
  }

  preload() {
    const particleGraphics = this.add.graphics();
    particleGraphics.fillStyle(0xffffff);
    particleGraphics.fillCircle(5, 5, 5);
    particleGraphics.generateTexture('particle', 10, 10, (texture) => {
      console.log('Particle texture generated:', texture.key);
    });
    particleGraphics.destroy();
  }

  create() {
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

    this.masterVolume = 0.3;
    this.audioContext = null; // Förblir null tills användaren klickar
    this.shapes = [];
    this.connectionGraphics = this.add.graphics({ lineStyle: { width: 4 } });
    this.connectionGraphics.setDepth(0);

    this.particleSpeed = 1.5;
    this.particleCount = 20;
    this.panEnabled = false;
    this.harmonicEnabled = false;
    this.isLive = false;
    this.isPaused = false;
    this.liveTimer = null;

    this.cameras.main.setBackgroundColor('#000000');
    this.gridSize = 60;
    this.gridCols = 10;
    this.gridRows = 10;

    this.playAreaLeft = 30;
    this.playAreaRight = 570;
    this.playAreaTop = 30;
    this.playAreaBottom = 570;

    let attempts = 0;
    const checkTexture = () => {
      if (this.textures.exists('particle') || attempts > 10) {
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
      } else {
        attempts++;
        this.time.delayedCall(50, checkTexture, [], this);
      }
    };
    checkTexture();

    createUI(this);
    handleUIEvents(this);

    this.draggedShape = null;
    this.isDragging = false;
    this.selectedNoteType = null;

    this.setupInputListeners();

    this.matter.world.setBounds(0, 0, 600, 600, 32, true, true, false, true);

    this.defaultFrequencies = this.chordColors[0].frequencies;

    this.activeHarmonics = new Map();

    if (typeof Worker !== 'undefined') {
      this.aiWorker = new Worker('/utils/aiUtils.worker.js');
      this.aiWorker.onmessage = (e) => {
        console.log('Received message from AI Worker:', e.data);
        if (e.data.type === 'controlSequence') {
          this.handleControlSequence(e.data.sequence);
        } else if (e.data.type === 'visualFeedback') {
          this.applyVisualFeedback(e.data.shapes);
        } else if (e.data.type === 'initialized') {
          console.log('AI Worker initialized successfully');
        } else if (e.data.type === 'error') {
          console.error('AI Worker error:', e.data.message);
        }
      };
      this.aiWorker.postMessage({ type: 'initialize' });
    } else {
      console.warn('Web Workers are not supported in this browser. AI features will be disabled.');
    }

    this.bpm = 60;
    this.beatDuration = 60 / this.bpm;
    this.currentBeat = 0;
  }

  update() {
    this.connectionGraphics.clear();

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

      if (speed < 0.5) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
      } else if (Math.abs(speed - this.particleSpeed) > 0.1) {
        const scale = this.particleSpeed / speed;
        particle.setVelocity(velocity.x * scale, velocity.y * scale);
      }

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

    this.shapes.forEach(shape => {
      const originalColor = this.getShapeColor(shape.type, activeTheme);
      shape.graphics.clear();
      shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      shape.graphics.fillStyle(originalColor, 0.3).fillCircle(0, 0, 25);
      shape.graphics.fillStyle(originalColor, 1).fillCircle(0, 0, 20);
      shape.isBlending = false;
    });

    const directConnections = new Map();

    const shapeConnections = new Map();
    this.shapes.forEach(shape => {
      shapeConnections.set(shape, new Set());
    });

    this.particles.forEach(particle => {
      const connectedShapes = this.shapes.filter(shape => {
        const dist = Phaser.Math.Distance.Between(particle.x, particle.y, shape.x, shape.y);
        return dist < shape.radius;
      });

      connectedShapes.forEach(shape => {
        const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
        if (distance < shape.radius) {
          const lineColor = this.getShapeColor(shape.type, activeTheme);
          const opacity = Math.pow(1 - (distance / shape.radius), 1.3) * 0.8;
          this.connectionGraphics.lineStyle(4, lineColor, opacity);
          this.connectionGraphics.beginPath();
          this.connectionGraphics.moveTo(shape.x, shape.y);
          this.connectionGraphics.lineTo(particle.x, particle.y);
          this.connectionGraphics.strokePath();

          const activationLevel = 1 - (distance / shape.radius);
          const subtleFactor = this.harmonicEnabled ? 0.15 : 0.25;
          if (activationLevel > 0) {
            const originalColor = this.getShapeColor(shape.type, activeTheme);
            const glowSize = 26 + activationLevel * 4 * subtleFactor;
            shape.graphics.fillStyle(originalColor, 0.15 * activationLevel).fillCircle(0, 0, glowSize);
          }
        }
      });

      if (connectedShapes.length === 2) {
        const [shape1, shape2] = connectedShapes;
        shapeConnections.get(shape1).add(shape2);
        shapeConnections.get(shape2).add(shape1);

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

        if (this.harmonicEnabled) {
          const color1 = this.getShapeColor(shape1.type, activeTheme);
          const color2 = this.getShapeColor(shape2.type, activeTheme);

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

          const blendedRgb = {
            r: Math.round((rgb1.r + rgb2.r) / 2),
            g: Math.round((rgb1.g + rgb2.g) / 2),
            b: Math.round((rgb1.b + rgb2.b) / 2)
          };

          const blendedColor = (blendedRgb.r << 16) + (blendedRgb.g << 8) + blendedRgb.b;

          this.connectionGraphics.lineStyle(4, blendedColor, 0.6);
          this.connectionGraphics.beginPath();
          this.connectionGraphics.moveTo(shape1.x, shape1.y);
          this.connectionGraphics.lineTo(particle.x, particle.y);
          this.connectionGraphics.lineTo(shape2.x, shape2.y);
          this.connectionGraphics.strokePath();

          shape1.isBlending = true;
          shape2.isBlending = true;
        }
      }
    });

    this.shapes.forEach(shape => {
      const shapeKey = `${shape.i},${shape.j}`;
      const connections = directConnections.get(shapeKey) || new Set();

      let closestDistance = Infinity;
      this.particles.forEach(particle => {
        const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
        closestDistance = Math.min(closestDistance, distance);
      });

      let volume = Math.max(0, Math.min(1, 1 - (closestDistance / shape.radius)));
      volume = Math.pow(volume, 1.5) * 0.8;

      if (!connections.size || !this.harmonicEnabled) {
        if (isFinite(shape.frequency) && this.audioContext && this.audioContext.state === 'running') {
          shape.oscillator.frequency.setTargetAtTime(shape.frequency, this.audioContext.currentTime, 0.1);
        }
      } else if (this.harmonicEnabled) {
        const connectedShapes = Array.from(connections).map(key => {
          return this.shapes.find(s => `${s.i},${s.j}` === key);
        }).filter(s => s !== null);

        if (connectedShapes.length > 0 && this.audioContext && this.audioContext.state === 'running') {
          const connectedFreqs = connectedShapes.map(s => s.frequency).filter(f => isFinite(f));
          const baseFreq = shape.frequency;

          if (connectedFreqs.length > 0 && isFinite(baseFreq)) {
            const targetRatios = [1, 4 / 3, 3 / 2, 2];
            const closestFreq = connectedFreqs[0];
            const ratio = closestFreq / baseFreq;

            let bestRatio = targetRatios[0];
            let minDiff = Math.abs(ratio - bestRatio);

            for (const r of targetRatios) {
              const diff = Math.abs(ratio - r);
              if (diff < minDiff) {
                minDiff = diff;
                bestRatio = r;
              }
            }

            const harmonicFreq = baseFreq * bestRatio;
            shape.oscillator.frequency.setTargetAtTime(harmonicFreq, this.audioContext.currentTime, 1.5);
            volume *= 0.8;
          }
        }
      }

      shape.baseVolume = volume;
      const frequencyBoost = (shape.frequency <= 110) ? 1.2 : (shape.frequency <= 220 ? 1.1 : 1);
      shape.currentVolume = shape.baseVolume * this.masterVolume * frequencyBoost;

      if (this.audioContext && this.audioContext.state === 'running' && shape.gain && !this.isPaused) {
        const safeVolume = isFinite(shape.currentVolume) ? shape.currentVolume : 0;
        const clampedVolume = Math.min(Math.max(safeVolume, 0), 1);
        const volumeTransitionTime = Math.max(0.1, 0.3 * (1.5 / this.particleSpeed));
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
        shape.gain.gain.setTargetAtTime(clampedVolume, this.audioContext.currentTime, volumeTransitionTime);

        if (this.panEnabled && shape.stereoPanner) {
          const panValue = this.calculatePan(shape.i);
          shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.05);
        }
      }
    });

    this.currentBeat = Math.floor(this.time.now / 1000 / this.beatDuration) % 4;
  }

  resetShapeToOriginalColor(shape) {
    const originalColor = this.getShapeColor(shape.type, activeTheme);
    shape.graphics.clear();
    shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
    shape.graphics.fillStyle(originalColor, 0.3).fillCircle(0, 0, 25);
    shape.graphics.fillStyle(originalColor, 1).fillCircle(0, 0, 20);
  }

  setupInputListeners() {
    this.input.on('pointerdown', () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Initiera vid klick
        console.log('AudioContext initialized');
        if (this.isLive && this.aiWorker) {
          this.triggerLiveSoundscape(); // Trigga LIVE direkt efter klick om aktiverat
        }
      } else if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('AudioContext resumed');
          this.shapes.forEach(shape => {
            if (shape.oscillator && shape.gain && shape.oscillator.state === 'suspended') {
              shape.oscillator.start();
            }
          });
          if (this.isLive && this.aiWorker) {
            this.triggerLiveSoundscape(); // Trigga LIVE vid återupptag
          }
        });
      }
    });

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
        customCursor.style.backgroundColor = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.25)`;
        customCursor.style.border = `2px solid rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`;
        customCursor.style.boxShadow = `0 0 10px rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.5)`;
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
            this.audioContext.currentTime + 0.01,
            0.05
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

    if (
      i * this.gridSize + this.gridSize / 2 < this.playAreaLeft ||
      i * this.gridSize + this.gridSize / 2 > this.playAreaRight ||
      j * this.gridSize + this.gridSize / 2 < this.playAreaTop ||
      j * this.gridSize + this.gridSize / 2 > this.playAreaBottom
    ) {
      return;
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
              case 'circle':
                newFrequency = this.defaultFrequencies[0];
                color = this.getShapeColor('circle', activeTheme);
                break;
              case 'yellowTriangle':
                newFrequency = this.defaultFrequencies[1];
                color = this.getShapeColor('yellowTriangle', activeTheme);
                break;
              case 'triangle':
                newFrequency = this.defaultFrequencies[2];
                color = this.getShapeColor('triangle', activeTheme);
                break;
              case 'square':
                newFrequency = this.defaultFrequencies[3];
                color = this.getShapeColor('square', activeTheme);
                break;
              case 'purpleSquare':
                newFrequency = this.defaultFrequencies[4];
                color = this.getShapeColor('purpleSquare', activeTheme);
                break;
              case 'orangeSquare':
                newFrequency = this.defaultFrequencies[5];
                color = this.getShapeColor('orangeSquare', activeTheme);
                break;
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
              this.audioContext.currentTime + fadeOutTime,
              0.1
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
          case 'circle':
            newType = 'yellowTriangle';
            newFrequency = this.defaultFrequencies[1] || 220;
            color = this.getShapeColor('yellowTriangle', activeTheme);
            break;
          case 'yellowTriangle':
            newType = 'triangle';
            newFrequency = this.defaultFrequencies[2] || 330;
            color = this.getShapeColor('triangle', activeTheme);
            break;
          case 'triangle':
            newType = 'square';
            newFrequency = this.defaultFrequencies[3] || 440;
            color = this.getShapeColor('square', activeTheme);
            break;
          case 'square':
            newType = 'purpleSquare';
            newFrequency = this.defaultFrequencies[4] || 110;
            color = this.getShapeColor('purpleSquare', activeTheme);
            break;
          case 'purpleSquare':
            newType = 'orangeSquare';
            newFrequency = this.defaultFrequencies[5] || 55;
            color = this.getShapeColor('orangeSquare', activeTheme);
            break;
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
            this.audioContext.currentTime + fadeOutTime,
            0.1
          );
          if (this.panEnabled && existingShape.stereoPanner) {
            const panValue = this.calculatePan(existingShape.i);
            existingShape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
            existingShape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.1);
          }
        }
      }, fadeOutTime * 1000);
    } else {
      const createNewShape = () => {
        let type, frequency, color;
        if (selectedType) {
          type = selectedType;
          switch (type) {
            case 'circle':
              frequency = this.defaultFrequencies[0];
              color = this.getShapeColor('circle', activeTheme);
              break;
            case 'yellowTriangle':
              frequency = this.defaultFrequencies[1];
              color = this.getShapeColor('yellowTriangle', activeTheme);
              break;
            case 'triangle':
              frequency = this.defaultFrequencies[2];
              color = this.getShapeColor('triangle', activeTheme);
              break;
            case 'square':
              frequency = this.defaultFrequencies[3];
              color = this.getShapeColor('square', activeTheme);
              break;
            case 'purpleSquare':
              frequency = this.defaultFrequencies[4];
              color = this.getShapeColor('purpleSquare', activeTheme);
              break;
            case 'orangeSquare':
              frequency = this.defaultFrequencies[5];
              color = this.getShapeColor('orangeSquare', activeTheme);
              break;
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
        if (!oscillator) {
          console.error('Failed to create oscillator');
          graphics.destroy();
          return;
        }
        const gain = this.audioContext.createGain();
        const stereoPanner = this.audioContext.createStereoPanner();

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        oscillator.connect(gain);
        gain.connect(stereoPanner);
        stereoPanner.connect(this.audioContext.destination);

        const startTime = this.audioContext.currentTime + 0.01;
        oscillator.start(startTime);
        const volumeBoost = frequency <= 110 ? 1.5 : 1;
        const targetVolume = 0.01 * volumeBoost;
        gain.gain.setTargetAtTime(targetVolume, startTime, 0.2);

        const initialPan = this.panEnabled ? this.calculatePan(i) : 0;
        stereoPanner.pan.setValueAtTime(initialPan, this.audioContext.currentTime);

        this.shapes.push({
          i,
          j,
          x,
          y,
          type,
          frequency,
          graphics,
          oscillator,
          gain,
          stereoPanner,
          radius: 200,
          baseVolume: 0,
          visible: true,
          isBlending: false
        });
        console.log('New shape created at:', { x, y, type, frequency });
      };

      if (!this.audioContext) {
        console.log('AudioContext not ready, initializing...');
        this.audioContext = createAudioContext((context) => {
          this.audioContext = context;
          createNewShape();
        });
      } else {
        createNewShape();
      }
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

  frequencyToMidi(frequency) {
    return 12 * Math.log2(frequency / 440) + 69;
  }

  applyVisualFeedback(shapesToBlink) {
    console.log('Applying visual feedback to shapes:', shapesToBlink);
    shapesToBlink.forEach(index => {
      const shape = this.shapes[index];
      if (shape) {
        const originalColor = this.getShapeColor(shape.type, activeTheme);
        shape.graphics.clear();
        shape.graphics.fillStyle(0xFFFF00, 0.5).fillCircle(0, 0, 25);
        setTimeout(() => {
          this.resetShapeToOriginalColor(shape);
        }, 500);
      } else {
        console.warn('No shape found at index:', index);
      }
    });
  }

  saveConfiguration() {
    const shapesData = this.shapes.map(shape => ({
      i: shape.i,
      j: shape.j,
      type: shape.type,
      frequency: shape.frequency,
      visible: shape.visible
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
        case 'circle':
          color = this.getShapeColor('circle', activeTheme);
          frequency = shapeData.frequency || 55;
          break;
        case 'yellowTriangle':
          color = this.getShapeColor('yellowTriangle', activeTheme);
          frequency = shapeData.frequency || 220;
          break;
        case 'triangle':
          color = this.getShapeColor('triangle', activeTheme);
          frequency = shapeData.frequency || 330;
          break;
        case 'square':
          color = this.getShapeColor('square', activeTheme);
          frequency = shapeData.frequency || 440;
          break;
        case 'purpleSquare':
          color = this.getShapeColor('purpleSquare', activeTheme);
          frequency = shapeData.frequency || 110;
          break;
        case 'orangeSquare':
          color = this.getShapeColor('orangeSquare', activeTheme);
          frequency = shapeData.frequency || 55;
          break;
      }
      graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22)
        .fillStyle(color, 0.3).fillCircle(0, 0, 25)
        .fillStyle(color, 1).fillCircle(0, 0, 20);

      const oscillator = createOscillator(this.audioContext, frequency);
      if (!oscillator) return;
      const gain = this.audioContext.createGain();
      const stereoPanner = this.audioContext.createStereoPanner();
      oscillator.connect(gain).connect(stereoPanner).connect(this.audioContext.destination);
      oscillator.start();
      stereoPanner.pan.setValueAtTime(this.panEnabled ? this.calculatePan(shapeData.i) : 0, this.audioContext.currentTime);
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
        visible: shapeData.visible,
        isBlending: false
      });
    });

    this.particleCount = config.particleCount;
    this.particleSpeed = this.bpmToParticleSpeed(config.particleSpeed);
    this.masterVolume = config.masterVolume;
    this.harmonicEnabled = config.harmonicEnabled || false;
    this.panEnabled = config.panEnabled || false;
    this.defaultFrequencies = config.defaultFrequencies || [55, 220, 330, 440, 110, 55];

    updateUI(this, this.particleCount, this.particleSpeedToBPM(this.particleSpeed), this.masterVolume, this.harmonicEnabled, this.panEnabled);
    this.updateParticleCount(this.particleCount);
  }

  bpmToParticleSpeed(bpm) {
    const minBPM = 30;
    const maxBPM = 180;
    const minSpeed = 0.1;
    const maxSpeed = 5;
    return minSpeed + (maxSpeed - minSpeed) * (bpm - minBPM) / (maxBPM - minBPM);
  }

  particleSpeedToBPM(particleSpeed) {
    const minBPM = 30;
    const maxBPM = 180;
    const minSpeed = 0.1;
    const maxSpeed = 5;
    return Math.round(minBPM + (maxBPM - minBPM) * (particleSpeed - minSpeed) / (maxSpeed - minBPM));
  }

  chordColors = {
    0: { color: 'white', label: 'Celestial', frequencies: [55, 220, 330, 440, 550, 660], key: '1' },
    1: { color: 'blue', label: 'Mystical', frequencies: [55, 220, 261.63, 330, 392, 466.16], key: '2' },
    2: { color: 'green', label: 'Minor', frequencies: [55, 220, 261.63, 293.66, 349.23, 415.30], key: '3' },
    3: { color: 'red', label: 'Bright', frequencies: [55, 220, 277.18, 329.63, 415.30, 493.88], key: '4' },
    4: { color: 'orange', label: 'Dreamy', frequencies: [55, 220, 246.94, 293.66, 369.99, 440], key: '5' },
    5: { color: 'purple', label: 'Dark', frequencies: [55, 220, 261.63, 311.13, 369.99, 466.16], key: '6' }
  };

  triggerLiveSoundscape() {
    if (!this.audioContext || this.audioContext.state !== 'running' || !this.aiWorker || !this.isLive) {
      console.warn('Cannot trigger live soundscape: AudioContext, AI Worker, or Live mode not ready', {
        audioContext: !!this.audioContext,
        audioContextState: this.audioContext ? this.audioContext.state : 'null',
        aiWorker: !!this.aiWorker,
        isLive: this.isLive
      });
      return;
    }
    const shapesData = this.shapes.map(shape => ({
      frequency: shape.frequency,
      type: shape.type,
      x: shape.x || (shape.body ? shape.body.position.x : shape.x),
      y: shape.y || (shape.body ? shape.body.position.y : shape.y),
      visible: shape.visible !== undefined ? shape.visible : true
    }));
    console.log('Sending shapes data to AI Worker:', shapesData);
    this.aiWorker.postMessage({ 
      type: 'generateControlSequence', 
      shapes: shapesData, 
      bpm: this.particleSpeedToBPM(this.particleSpeed) 
    });
  }

  handleControlSequence(sequence) {
    if (!this.audioContext || this.audioContext.state !== 'running' || !this.isLive) {
      console.warn('Cannot handle control sequence: AudioContext or Live mode not ready');
      return;
    }

    console.log('Received control sequence from AI Worker:', sequence);
    this.shapes.forEach(shape => {
      if (shape.gain) {
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setValueAtTime(0, this.audioContext.currentTime);
      }
    });

    sequence.forEach(event => {
      console.log('Processing event:', event);
      const shape = this.shapes[event.shapeIndex];
      if (shape) {
        // Smidig rörelse med tween
        if (event.x !== undefined && event.y !== undefined) {
          const gridX = Math.round(event.x / this.gridSize) * this.gridSize + this.gridSize / 2;
          const gridY = Math.round(event.y / this.gridSize) * this.gridSize + this.gridSize / 2;
          if (shape.currentTween) shape.currentTween.stop();
          shape.currentTween = this.tweens.add({
            targets: shape.body || shape,
            x: gridX,
            y: gridY,
            duration: 1000, // 1 sekund för smidig övergång
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              if (shape.body) {
                shape.body.position.x = (shape.body.position.x + (gridX - shape.body.position.x) * 0.1);
                shape.body.position.y = (shape.body.position.y + (gridY - shape.body.position.y) * 0.1);
              } else {
                shape.x = (shape.x + (gridX - shape.x) * 0.1);
                shape.y = (shape.y + (gridY - shape.y) * 0.1);
              }
              shape.graphics.x = shape.x || (shape.body ? shape.body.position.x : shape.x);
              shape.graphics.y = shape.y || (shape.body ? shape.body.position.y : shape.y);
            },
            onComplete: () => {
              shape.x = gridX;
              shape.y = gridY;
              shape.i = Math.floor(gridX / this.gridSize);
              shape.j = Math.floor(gridY / this.gridSize);
              shape.currentTween = null;
              console.log('Shape movement completed:', { x: gridX, y: gridY });
            }
          });
        }

        // Synlighet
        if (event.visible !== undefined) {
          shape.visible = event.visible;
          shape.graphics.visible = event.visible;
          if (!event.visible) {
            shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setValueAtTime(0, this.audioContext.currentTime);
          }
        }

        // Ton (frekvens)
        if (event.frequency !== undefined) {
          shape.frequency = event.frequency;
          shape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(event.frequency, this.audioContext.currentTime, 0.1);
          const newType = this.getClosestShapeType(event.frequency);
          if (newType !== shape.type && shape.visible) {
            shape.type = newType;
            const newColor = this.getShapeColor(newType, activeTheme);
            shape.graphics.clear()
              .fillStyle(0x000000, 0.4).fillCircle(4, 4, 22)
              .fillStyle(newColor, 0.3).fillCircle(0, 0, 25)
              .fillStyle(newColor, 1).fillCircle(0, 0, 20);
          }
        }

        // Volym
        const volumeBoost = event.frequency <= 110 ? 1.5 : 1;
        const targetVolume = this.masterVolume * volumeBoost * (shape.visible ? 1 : 0);
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setValueAtTime(0, this.audioContext.currentTime);
        shape.gain.gain.linearRampToValueAtTime(targetVolume, this.audioContext.currentTime + (event.duration || 1));
        shape.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + (event.duration || 1) + 0.5);

        // Pan (om aktiverat)
        if (this.panEnabled && shape.stereoPanner) {
          const panValue = this.calculatePan(shape.i);
          shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.1);
        }

        // Ackord-ändring
        if (event.newChord !== undefined) {
          const newChordIndex = event.newChord;
          const { frequencies, label } = this.chordColors[newChordIndex];
          document.getElementById('chordSlider').value = newChordIndex;
          document.getElementById('chordValue').textContent = label;
          document.getElementById('chordValue').style.color = this.getChordColor(label);
          document.getElementById('chordSlider').style.setProperty('--thumb-color', this.chordColors[newChordIndex].color);
          document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${this.chordColors[newChordIndex].key}"`);

          this.shapes.forEach((s, index) => {
            if (index < frequencies.length) {
              s.frequency = frequencies[index];
              s.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime);
              s.oscillator.frequency.setTargetAtTime(s.frequency, this.audioContext.currentTime, 0.1);
              const newType = this.getClosestShapeType(s.frequency);
              if (newType !== s.type && s.visible) {
                s.type = newType;
                const newColor = this.getShapeColor(newType, activeTheme);
                s.graphics.clear()
                  .fillStyle(0x000000, 0.4).fillCircle(4, 4, 22)
                  .fillStyle(newColor, 0.3).fillCircle(0, 0, 25)
                  .fillStyle(newColor, 1).fillCircle(0, 0, 20);
              }
            }
          });
          this.defaultFrequencies = frequencies;
        }
      } else {
        console.warn('No shape found at index:', event.shapeIndex);
      }
    });
  }

  getClosestShapeType(frequency) {
    const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
    const defaultFreqs = this.defaultFrequencies;
    let closestIndex = 0;
    let minDiff = Math.abs(frequency - defaultFreqs[0]);
    for (let i = 1; i < defaultFreqs.length; i++) {
      const diff = Math.abs(frequency - defaultFreqs[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    return types[closestIndex];
  }

  getChordColor(label) {
    const textColors = {
      'Celestial': '#0000ff',
      'Mystical': '#800080',
      'Minor': '#FFA500',
      'Bright': '#ffff00',
      'Dreamy': '#00ff00',
      'Dark': '#ff0000'
    };
    return textColors[label] || '#0000ff';
  }
}

export default CosmiChordScene;