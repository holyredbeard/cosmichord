import Phaser from 'phaser';
import { createAudioContext, createOscillator, updateVolume } from '../utils/audioUtils';
import { createUI, updateUI, handleUIEvents, toggleMenu, resetScene } from '../utils/visualUtils';
import { themes, activeTheme } from '../config/themes';

class CosmiChordScene extends Phaser.Scene {
  constructor() {
    super('CosmiChordScene');
  }

  preload() {
    console.log('Preload started');
    const particleGraphics = this.add.graphics();
    particleGraphics.fillStyle(0xffffff);
    particleGraphics.fillCircle(5, 5, 5);
    particleGraphics.generateTexture('particle', 10, 10);
    particleGraphics.destroy();
  }

  create() {
    console.log('Create started');
    this.masterVolume = 0.5; // Ökat för att ljudet ska höras bättre
    this.audioContext = null;
    this.shapes = [];
    this.connectionGraphics = this.add.graphics({ lineStyle: { width: 8 } }); // Tjockare linjer som i Bild 2
    this.connectionGraphics.setDepth(10);

    this.particleSpeed = 1.5; // Standardhastighet, motsvarar 90 BPM
    this.particleCount = 20;
    this.panEnabled = false;
    this.harmonicEnabled = false;
    this.isLive = false;
    this.isPaused = false;
    this.liveTimer = null;
    this.nodeRadius = 1500; // Återställ till högt värde för långa armar som i Bild 2

    this.cameras.main.setBackgroundColor('#000000');
    this.gridSize = 60;
    this.gridCols = 10;
    this.gridRows = 10;
    this.playAreaLeft = 30;
    this.playAreaRight = 570;
    this.playAreaTop = 30;
    this.playAreaBottom = 570;

    const initClick = document.getElementById('initClick');
    initClick.addEventListener('click', () => {
      if (!this.audioContext) {
        this.audioContext = createAudioContext((context) => {
          this.audioContext = context;
          console.log('AudioContext initialized');
          this.shapes.forEach(shape => {
            if (shape.oscillator && shape.gain) {
              shape.oscillator.connect(shape.gain);
              shape.gain.connect(this.audioContext.destination);
              if (shape.oscillator.state === 'suspended') shape.oscillator.start();
            }
          });
          if (this.aiWorker) this.aiWorker.postMessage({ type: 'resumeAudio' });
        });
      }
      initClick.style.display = 'none';
    });

    let attempts = 0;
    const checkTexture = () => {
      if (this.textures.exists('particle') || attempts > 10) {
        this.particles = [];
        for (let k = 0; k < this.particleCount; k++) {
          const x = Phaser.Math.Between(this.playAreaLeft, this.playAreaRight);
          const y = Phaser.Math.Between(this.playAreaTop, this.playAreaBottom);
          const particle = this.matter.add.sprite(x, y, 'particle', null, {
            isStatic: false, shape: { type: 'circle', radius: 5 }, frictionAir: 0, friction: 0, restitution: 1, mass: 1, inertia: Infinity, collisionFilter: { group: -1 }
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
      this.aiWorker = new Worker(new URL('../utils/aiUtils.worker.js', import.meta.url));
      this.aiWorker.onmessage = (e) => {
        console.log('Worker message:', e.data.type);
        if (e.data.type === 'awaitingGesture') this.aiWorker.postMessage({ type: 'resumeAudio' });
        else if (e.data.type === 'controlSequence') this.handleControlSequence(e.data.sequence);
        else if (e.data.type === 'visualFeedback') this.applyVisualFeedback(e.data.shapes);
        else if (e.data.type === 'error') console.error('Worker error:', e.data.message);
      };
      this.aiWorker.postMessage({ type: 'initialize' });
    }

    this.bpm = 90; // Standard BPM motsvarar particleSpeed = 1.5
    this.beatDuration = 60 / this.bpm;
    this.currentBeat = 0;
  }

  update() {
    console.log('Update loop started');
    this.connectionGraphics.clear();

    this.shapes.forEach(shape => {
      if (shape.body) { // Kontrollera om formen har en Matter-body
        shape.graphics.x = shape.body.position.x;
        shape.graphics.y = shape.body.position.y;
      }
    });

    this.particles.forEach(particle => {
      if (!particle.body) return console.error('Particle without body:', particle);
      const velocity = particle.body.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed < 0.5) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
      } else if (Math.abs(speed - this.particleSpeed) > 0.1) {
        const scale = this.particleSpeed / speed;
        particle.setVelocity(velocity.x * scale, velocity.y * scale);
      }
      if (particle.x < this.playAreaLeft) particle.setVelocity(Math.abs(velocity.x), velocity.y);
      if (particle.x > this.playAreaRight) particle.setVelocity(-Math.abs(velocity.x), velocity.y);
      if (particle.y < this.playAreaTop) particle.setVelocity(velocity.x, Math.abs(velocity.y));
      if (particle.y > this.playAreaBottom) particle.setVelocity(velocity.x, -Math.abs(velocity.y));

      const connectedShapes = this.shapes.filter(shape => shape.body && Phaser.Math.Distance.Between(particle.x, particle.y, shape.body.position.x, shape.body.position.y) < this.nodeRadius);

      connectedShapes.forEach(shape => {
        const dist = Phaser.Math.Distance.Between(shape.body.position.x, shape.body.position.y, particle.x, particle.y);
        if (dist < this.nodeRadius) {
          const color = this.getShapeColor(shape.type, activeTheme);
          const opacity = Math.pow(1 - (dist / this.nodeRadius), 1.5) * 1.0; // Högre opacitet
          this.connectionGraphics.lineStyle(8, color, opacity); // Tjockare linjer som i Bild 2
          this.connectionGraphics.beginPath().moveTo(shape.body.position.x, shape.body.position.y).lineTo(particle.x, particle.y).strokePath();
          const activation = 1 - (dist / this.nodeRadius);
          if (activation > 0 && shape.visible) shape.graphics.fillStyle(color, 0.2 * activation).fillCircle(0, 0, 30 + activation * 15); // Större glow
        }
      });

      if (connectedShapes.length === 2 && this.harmonicEnabled) {
        const [shape1, shape2] = connectedShapes;
        const color1 = this.getShapeColor(shape1.type, activeTheme);
        const color2 = this.getShapeColor(shape2.type, activeTheme);
        const rgb1 = { r: (color1 >> 16) & 0xFF, g: (color1 >> 8) & 0xFF, b: color1 & 0xFF };
        const rgb2 = { r: (color2 >> 16) & 0xFF, g: (color2 >> 8) & 0xFF, b: color2 & 0xFF };
        const blended = { r: Math.round((rgb1.r + rgb2.r) / 2), g: Math.round((rgb1.g + rgb2.g) / 2), b: Math.round((rgb1.b + rgb2.b) / 2) };
        const blendedColor = (blended.r << 16) + (blended.g << 8) + blended.b;
        this.connectionGraphics.lineStyle(8, blendedColor, 0.8).beginPath().moveTo(shape1.body.position.x, shape1.body.position.y).lineTo(particle.x, particle.y).lineTo(shape2.body.position.x, shape2.body.position.y).strokePath();
        if (shape1.visible) shape1.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(blendedColor, 0.4).fillCircle(0, 0, 25).fillStyle(blendedColor, 1).fillCircle(0, 0, 20);
        if (shape2.visible) shape2.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(blendedColor, 0.4).fillCircle(0, 0, 25).fillStyle(blendedColor, 1).fillCircle(0, 0, 20);
        if (this.audioContext?.state === 'running') {
          const freq1 = shape1.frequency, freq2 = shape2.frequency;
          const ratios = [1, 4 / 3, 3 / 2, 2];
          let best1 = ratios[0], minDiff1 = Math.abs(freq2 / freq1 - best1);
          for (const r of ratios) if (Math.abs(freq2 / freq1 - r) < minDiff1 && isFinite(r * freq1)) best1 = r;
          let best2 = ratios[0], minDiff2 = Math.abs(freq1 / freq2 - best2);
          for (const r of ratios) if (Math.abs(freq1 / freq2 - r) < minDiff2 && isFinite(r * freq2)) best2 = r;
          shape1.oscillator.frequency.setTargetAtTime(freq1 * best1, this.audioContext.currentTime, 2.0); // Långsam övergång
          shape2.oscillator.frequency.setTargetAtTime(freq2 * best2, this.audioContext.currentTime, 2.0); // Långsam övergång
        }
      }
    });

    this.shapes.forEach(shape => {
      if (shape.body) {
        const color = this.getShapeColor(shape.type, activeTheme);
        if (shape.visible) {
          shape.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(color, 0.4).fillCircle(0, 0, 25).fillStyle(color, 1).fillCircle(0, 0, 20);
        } else {
          shape.graphics.clear();
        }

        // Slumpmässig rörelse eller dragning mot partiklar
        if (this.isLive && Math.random() < 0.05) { // 5% chans per uppdatering att ändra rörelse
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          shape.body.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
        }

        let closestParticle = null, closestDistance = Infinity;
        this.particles.forEach(p => {
          const dist = Phaser.Math.Distance.Between(shape.body.position.x, shape.body.position.y, p.x, p.y);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestParticle = p;
          }
        });

        if (closestParticle && closestDistance < this.nodeRadius * 0.5) {
          const targetAngle = Math.atan2(closestParticle.y - shape.body.position.y, closestParticle.x - shape.body.position.x);
          const attractionForce = 0.1; // Svag dragkraft mot närmaste partikel
          shape.body.setVelocity(
            shape.body.velocity.x + Math.cos(targetAngle) * attractionForce,
            shape.body.velocity.y + Math.sin(targetAngle) * attractionForce
          );
        }

        // Håll formen inom spelområdet
        if (shape.body.position.x < this.playAreaLeft) shape.body.position.x = this.playAreaLeft;
        if (shape.body.position.x > this.playAreaRight) shape.body.position.x = this.playAreaRight;
        if (shape.body.position.y < this.playAreaTop) shape.body.position.y = this.playAreaTop;
        if (shape.body.position.y > this.playAreaBottom) shape.body.position.y = this.playAreaBottom;

        let volume = 0;
        if (closestDistance < Infinity) {
          volume = Math.max(0, Math.min(1, 1 - (closestDistance / this.nodeRadius))) * 0.9;
        }
        const boost = (shape.frequency <= 110) ? 1.2 : (shape.frequency <= 220 ? 1.1 : 1);
        shape.currentVolume = volume * this.masterVolume * boost;

        if (this.audioContext?.state === 'running' && shape.gain && !this.isPaused) {
          const safeVol = isFinite(shape.currentVolume) ? shape.currentVolume : 0;
          shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(Math.min(1.0, safeVol), this.audioContext.currentTime, 1.0); // Längre övergång
          if (this.panEnabled && shape.stereoPanner) shape.stereoPanner.pan.setTargetAtTime(this.calculatePan(shape.i), this.audioContext.currentTime, 0.05);
        }
      }
    });

    this.currentBeat = Math.floor(this.time.now / 1000 / this.beatDuration) % 4;
    if (this.isLive && this.liveTimer && this.aiWorker) try { this.triggerLiveSoundscape(); } catch (err) { console.error('Live soundscape error:', err); }
  }

  setupInputListeners() {
    this.input.on('pointerdown', (pointer) => {
      console.log('Pointer down at:', pointer.x, pointer.y);
      if (!this.audioContext) {
        return; // Vi hanterar detta via initClick-knappen nu
      }

      const i = Math.floor(pointer.x / this.gridSize);
      const j = Math.floor(pointer.y / this.gridSize);
      if (i >= 0 && i < this.gridCols && j >= 0 && j < this.gridRows) {
        const x = i * this.gridSize + this.gridSize / 2;
        const y = j * this.gridSize + this.gridSize / 2;
        if (x >= this.playAreaLeft && x <= this.playAreaRight && y >= this.playAreaTop && y <= this.playAreaBottom) {
          if (!this.shapes.some(shape => shape.i === i && shape.j === j)) {
            this.placeShape(pointer, this.selectedNoteType);
          }
        }
      }
    });

    this.draggedShape = null;
    this.isDragging = false;
    this.selectedNoteType = null;

    this.input.keyboard.on('keydown-SHIFT', () => document.getElementById('renderDiv').style.cursor = 'grab');
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
        const colors = { 0: { color: this.getShapeColor('circle', activeTheme), type: 'circle' }, 1: { color: this.getShapeColor('yellowTriangle', activeTheme), type: 'yellowTriangle' }, 2: { color: this.getShapeColor('triangle', activeTheme), type: 'triangle' }, 3: { color: this.getShapeColor('square', activeTheme), type: 'square' }, 4: { color: this.getShapeColor('purpleSquare', activeTheme), type: 'purpleSquare' }, 5: { color: this.getShapeColor('orangeSquare', activeTheme), type: 'orangeSquare' } };
        this.selectedNoteType = colors[index].type;
        const rgb = { r: (colors[index].color >> 16) & 0xFF, g: (colors[index].color >> 8) & 0xFF, b: colors[index].color & 0xFF };
        customCursor.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`;
        customCursor.style.border = `2px solid rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        customCursor.style.boxShadow = `0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
        document.body.appendChild(customCursor);
        document.getElementById('renderDiv').style.cursor = 'none';
        const updatePosition = (e) => requestAnimationFrame(() => { customCursor.style.left = `${e.clientX}px`; customCursor.style.top = `${e.clientY}px`; });
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
    this.input.keyboard.on('keydown-CTRL', () => document.getElementById('renderDiv').style.cursor = '➖');
    this.input.keyboard.on('keydown-X', () => {
      let customCursor = document.getElementById('customCursor');
      if (customCursor) customCursor.remove();
      document.getElementById('renderDiv').style.cursor = 'none';
      customCursor = document.createElement('div');
      customCursor.id = 'customCursor';
      customCursor.style.position = 'fixed';
      customCursor.style.fontSize = '16px';
      customCursor.style.pointerEvents = 'none';
      customCursor.style.zIndex = '9999';
      customCursor.style.color = '#ffffff';
      customCursor.style.userSelect = 'none';
      customCursor.textContent = '⌫';
      document.body.appendChild(customCursor);
      const updatePosition = (e) => requestAnimationFrame(() => { customCursor.style.left = `${e.clientX}px`; customCursor.style.top = `${e.clientY}px`; });
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
      if (!this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) document.getElementById('renderDiv').style.cursor = 'default';
    });
    this.input.keyboard.on('keyup-SHIFT', () => {
      document.getElementById('renderDiv').style.cursor = 'default';
      this.isDragging = false;
      this.draggedShape = null;
    });

    this.input.keyboard.on('keydown-Q', () => { document.getElementById('chordSlider').value = 0; document.getElementById('chordSlider').dispatchEvent(new Event('input')); });
    this.input.keyboard.on('keydown-W', () => { document.getElementById('chordSlider').value = 1; document.getElementById('chordSlider').dispatchEvent(new Event('input')); });
    this.input.keyboard.on('keydown-E', () => { document.getElementById('chordSlider').value = 2; document.getElementById('chordSlider').dispatchEvent(new Event('input')); });
    this.input.keyboard.on('keydown-R', () => { document.getElementById('chordSlider').value = 3; document.getElementById('chordSlider').dispatchEvent(new Event('input')); });
    this.input.keyboard.on('keydown-T', () => { document.getElementById('chordSlider').value = 4; document.getElementById('chordSlider').dispatchEvent(new Event('input')); });
    this.input.keyboard.on('keydown-Y', () => { document.getElementById('chordSlider').value = 5; document.getElementById('chordSlider').dispatchEvent(new Event('input')); });
    this.input.keyboard.on('keydown-B', () => {
      this.harmonicEnabled = !this.harmonicEnabled;
      document.getElementById('blendToggle').textContent = this.harmonicEnabled ? 'On' : 'Off';
      document.getElementById('blendToggle').style.background = this.harmonicEnabled ? '#00cc00' : '#333';
    });
    this.input.keyboard.on('keydown-P', () => {
      this.panEnabled = !this.panEnabled;
      document.getElementById('panToggle').textContent = this.panEnabled ? 'On' : 'Off';
      document.getElementById('panToggle').style.background = this.panEnabled ? '#2ecc71' : '#333';
      this.shapes.forEach(shape => {
        if (shape.stereoPanner) {
          const targetPan = this.panEnabled ? this.calculatePan(shape.i) : 0;
          shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(targetPan, this.audioContext.currentTime, 0.2);
        }
      });
    });

    this.input.on('pointerdown', (pointer) => {
      console.log('Pointer down at:', pointer.x, pointer.y);
      if (this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) {
        const clickedShape = this.shapes.find(shape => shape.body && Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.body.position.x, shape.body.position.y) < 25);
        if (clickedShape) {
          clickedShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
          clickedShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
          setTimeout(() => {
            clickedShape.graphics.destroy();
            clickedShape.body.destroy();
            clickedShape.oscillator.stop();
            clickedShape.oscillator.disconnect();
            clickedShape.gain.disconnect();
            if (clickedShape.stereoPanner) clickedShape.stereoPanner.disconnect();
            this.shapes = this.shapes.filter(shape => shape !== clickedShape);
          }, 50);
          return;
        }
      } else if (this.input.keyboard.checkDown(this.input.keyboard.addKey('SHIFT'))) {
        const clickedShape = this.shapes.find(shape => shape.body && Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.body.position.x, shape.body.position.y) < 25);
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

        this.draggedShape.body.position.x = newX;
        this.draggedShape.body.position.y = newY;
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
    console.log('Placing shape at:', pointer.x, pointer.y, 'with type:', selectedType);
    const i = Math.floor(pointer.x / this.gridSize);
    const j = Math.floor(pointer.y / this.gridSize);

    if (
      i * this.gridSize + this.gridSize / 2 < this.playAreaLeft ||
      i * this.gridSize + this.gridSize / 2 > this.playAreaRight ||
      j * this.gridSize + this.gridSize / 2 < this.playAreaTop ||
      j * this.gridSize + this.gridSize / 2 > this.playAreaBottom
    ) return;

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
              case 'circle': newFrequency = this.defaultFrequencies[0] || 55; color = this.getShapeColor('circle', activeTheme); break;
              case 'yellowTriangle': newFrequency = this.defaultFrequencies[1] || 220; color = this.getShapeColor('yellowTriangle', activeTheme); break;
              case 'triangle': newFrequency = this.defaultFrequencies[2] || 330; color = this.getShapeColor('triangle', activeTheme); break;
              case 'square': newFrequency = this.defaultFrequencies[3] || 440; color = this.getShapeColor('square', activeTheme); break;
              case 'purpleSquare': newFrequency = this.defaultFrequencies[4] || 110; color = this.getShapeColor('purpleSquare', activeTheme); break;
              case 'orangeSquare': newFrequency = this.defaultFrequencies[5] || 55; color = this.getShapeColor('orangeSquare', activeTheme); break;
            }
            existingShape.type = selectedType;
            existingShape.frequency = newFrequency;
            existingShape.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(color, 0.4).fillCircle(0, 0, 25).fillStyle(color, 1).fillCircle(0, 0, 20);
            existingShape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(newFrequency, this.audioContext.currentTime, 0.1);
            existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(
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
      existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(0, this.audioContext.currentTime, 0.01);
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
            existingShape.body.destroy();
            existingShape.oscillator.stop();
            existingShape.oscillator.disconnect();
            existingShape.gain.disconnect();
            if (existingShape.stereoPanner) existingShape.stereoPanner.disconnect();
            this.shapes = this.shapes.filter(s => s !== existingShape);
            return;
        }
        if (newType) {
          existingShape.type = newType;
          existingShape.frequency = newFrequency;
          existingShape.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(color, 0.4).fillCircle(0, 0, 25).fillStyle(color, 1).fillCircle(0, 0, 20);
          existingShape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(newFrequency, this.audioContext.currentTime, 0.1);
          existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setTargetAtTime(
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
        switch (selectedType) {
          case 'circle': frequency = this.defaultFrequencies[0] || 55; color = this.getShapeColor('circle', activeTheme); break;
          case 'yellowTriangle': frequency = this.defaultFrequencies[1] || 220; color = this.getShapeColor('yellowTriangle', activeTheme); break;
          case 'triangle': frequency = this.defaultFrequencies[2] || 330; color = this.getShapeColor('triangle', activeTheme); break;
          case 'square': frequency = this.defaultFrequencies[3] || 440; color = this.getShapeColor('square', activeTheme); break;
          case 'purpleSquare': frequency = this.defaultFrequencies[4] || 110; color = this.getShapeColor('purpleSquare', activeTheme); break;
          case 'orangeSquare': frequency = this.defaultFrequencies[5] || 55; color = this.getShapeColor('orangeSquare', activeTheme); break;
        }
      } else {
        type = 'circle';
        frequency = this.defaultFrequencies[0] || 55;
        color = this.getShapeColor('circle', activeTheme);
      }
      const body = this.matter.add.circle(x, y, 20, {
        isStatic: false, frictionAir: 0, friction: 0, restitution: 1, mass: 1, inertia: Infinity, collisionFilter: { group: -1 }
      });
      const graphics = this.add.graphics({ x, y });
      graphics.setDepth(1);
      graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      graphics.fillStyle(color, 0.4).fillCircle(0, 0, 25);
      graphics.fillStyle(color, 1).fillCircle(0, 0, 20);

      const oscillator = createOscillator(this.audioContext, frequency);
      if (!oscillator) return console.error('Failed to create oscillator');
      const gain = this.audioContext.createGain();
      const stereoPanner = this.audioContext.createStereoPanner();
      oscillator.connect(gain);
      gain.connect(stereoPanner);
      stereoPanner.connect(this.audioContext.destination);
      oscillator.start();

      const initialPan = this.panEnabled ? this.calculatePan(i) : 0;
      stereoPanner.pan.setValueAtTime(initialPan, this.audioContext.currentTime);

      gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0);
      gain.gain.setTargetAtTime(0.01 * (frequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + 0.01, 0.1);

      const shape = { i, j, body, x, y, type, frequency, graphics, oscillator, gain, stereoPanner, radius: this.nodeRadius, baseVolume: 0, visible: true, isBlending: false };
      this.tweens.add({ targets: shape.graphics, scale: 1.2, duration: 300, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => shape.graphics.scale = 1 });
      this.shapes.push(shape);
    }
  }

  updateParticleCount(newCount) {
    while (this.particles.length > newCount) this.particles.pop().destroy();
    while (this.particles.length < newCount) {
      const x = Phaser.Math.Between(this.playAreaLeft, this.playAreaRight);
      const y = Phaser.Math.Between(this.playAreaTop, this.playAreaBottom);
      const particle = this.matter.add.sprite(x, y, 'particle', null, { shape: { type: 'circle', radius: 5 }, frictionAir: 0, friction: 0, restitution: 1, mass: 1, inertia: Infinity, collisionFilter: { group: -1 } });
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
      this.particles.push(particle);
    }
  }

  getShapeColor(type, theme = activeTheme) { return themes[theme][type] || 0xffffff; }
  calculatePan(i) { return (i / (this.gridCols - 1)) * 2 - 1; }
  frequencyToMidi(frequency) { return 12 * Math.log2(frequency / 440) + 69; }

  playSoundscape(sequence) {
    if (this.audioContext?.state === 'running' && sequence) try { new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus').start(sequence); } catch (err) { console.error('Soundscape error:', err); }
  }

  applyVisualFeedback(shapesToBlink) {
    shapesToBlink.forEach(index => {
      const shape = this.shapes[index];
      if (shape) {
        const color = this.getShapeColor(shape.type, activeTheme);
        shape.graphics.clear().fillStyle(0xFFFF00, 0.5).fillCircle(0, 0, 25);
        shape.visible = true;
        setTimeout(() => {
          shape.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(color, 0.4).fillCircle(0, 0, 25).fillStyle(color, 1).fillCircle(0, 0, 20);
        }, 500);
      }
    });
  }

  saveConfiguration() {
    return {
      shapes: this.shapes.map(shape => ({
        i: shape.i, j: shape.j, type: shape.type, frequency: shape.frequency, x: shape.body.position.x, y: shape.body.position.y, visible: shape.visible
      })),
      particleCount: this.particleCount, particleSpeed: this.particleSpeed, masterVolume: this.masterVolume,
      harmonicEnabled: this.harmonicEnabled, panEnabled: this.panEnabled, defaultFrequencies: this.defaultFrequencies,
      nodeRadius: this.nodeRadius
    };
  }

  loadConfiguration(config) {
    this.shapes.forEach(shape => {
      shape.graphics.destroy();
      shape.body.destroy();
      shape.oscillator.stop();
      shape.oscillator.disconnect();
      shape.gain.disconnect();
      if (shape.stereoPanner) shape.stereoPanner.disconnect();
    });
    this.shapes = [];

    config.shapes.forEach(shapeData => {
      const x = shapeData.x;
      const y = shapeData.y;
      const body = this.matter.add.circle(x, y, 20, {
        isStatic: false, frictionAir: 0, friction: 0, restitution: 1, mass: 1, inertia: Infinity, collisionFilter: { group: -1 }
      });
      const graphics = this.add.graphics({ x, y }).setDepth(1);
      let color, frequency;
      switch (shapeData.type) {
        case 'circle': frequency = shapeData.frequency || 55; color = this.getShapeColor('circle', activeTheme); break;
        case 'yellowTriangle': frequency = shapeData.frequency || 220; color = this.getShapeColor('yellowTriangle', activeTheme); break;
        case 'triangle': frequency = shapeData.frequency || 330; color = this.getShapeColor('triangle', activeTheme); break;
        case 'square': frequency = shapeData.frequency || 440; color = this.getShapeColor('square', activeTheme); break;
        case 'purpleSquare': frequency = shapeData.frequency || 110; color = this.getShapeColor('purpleSquare', activeTheme); break;
        case 'orangeSquare': frequency = shapeData.frequency || 55; color = this.getShapeColor('orangeSquare', activeTheme); break;
      }
      graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(color, 0.4).fillCircle(0, 0, 25).fillStyle(color, 1).fillCircle(0, 0, 20);

      const oscillator = createOscillator(this.audioContext, frequency);
      if (!oscillator) return;
      const gain = this.audioContext.createGain();
      const stereoPanner = this.audioContext.createStereoPanner();
      oscillator.connect(gain).connect(stereoPanner).connect(this.audioContext.destination);
      oscillator.start();
      stereoPanner.pan.setValueAtTime(this.panEnabled ? this.calculatePan(shapeData.i) : 0, this.audioContext.currentTime);
      gain.gain.setTargetAtTime(0.01 * (frequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + 0.01, 0.1);

      this.shapes.push({
        i: shapeData.i, j: shapeData.j, body, x, y, type: shapeData.type, frequency, graphics, oscillator, gain, stereoPanner, radius: config.nodeRadius || 1500, baseVolume: 0, visible: shapeData.visible, isBlending: false
      });
    });

    this.particleCount = config.particleCount;
    this.particleSpeed = this.bpmToParticleSpeed(config.particleSpeed); // Konvertera från BPM till particleSpeed
    this.masterVolume = config.masterVolume;
    this.harmonicEnabled = config.harmonicEnabled || false;
    this.panEnabled = config.panEnabled || false;
    this.defaultFrequencies = config.defaultFrequencies || [55, 220, 330, 440, 110, 55];
    this.nodeRadius = config.nodeRadius || 1500;

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
    return Math.round(minBPM + (maxBPM - minBPM) * (particleSpeed - minSpeed) / (maxSpeed - minSpeed));
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
    if (!this.audioContext || !this.aiWorker || !this.isLive) return;
    const shapesData = this.shapes.map(shape => ({
      frequency: shape.frequency, type: shape.type, x: shape.body.position.x, y: shape.body.position.y, visible: shape.visible
    }));
    this.aiWorker.postMessage({ type: 'generateControlSequence', shapes: shapesData, bpm: this.particleSpeedToBPM(this.particleSpeed) });
  }

  handleControlSequence(sequence) {
    if (!this.audioContext || !this.isLive) return;
    if (this.audioContext.state !== 'running') {
      this.audioContext.resume();
      return;
    }

    this.shapes.forEach(shape => {
      if (shape.gain) {
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setValueAtTime(0, this.audioContext.currentTime);
      }
    });

    sequence.forEach(event => {
      const shape = this.shapes[event.shapeIndex];
      if (shape) {
        // Rörelse
        if (event.x !== undefined && event.y !== undefined) {
          const duration = 1000; // 1 sekund för rörelseövergång
          if (shape.currentTween) shape.currentTween.stop();
          shape.currentTween = this.tweens.add({
            targets: shape.body,
            x: event.x,
            y: event.y,
            duration: duration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              shape.graphics.x = shape.body.position.x;
              shape.graphics.y = shape.body.position.y;
            },
            onComplete: () => {
              shape.x = shape.body.position.x;
              shape.y = shape.body.position.y;
              shape.currentTween = null;
            }
          });
        }

        // Synlighet (tända/släcka)
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
            shape.graphics.clear().fillStyle(0x000000, 0.4).fillCircle(4, 4, 22).fillStyle(newColor, 0.4).fillCircle(0, 0, 25).fillStyle(newColor, 1).fillCircle(0, 0, 20);
          }
        }

        // Volym
        const volumeBoost = event.frequency <= 110 ? 1.5 : 1;
        const targetVolume = this.masterVolume * volumeBoost * (shape.visible ? 1 : 0);
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime).setValueAtTime(0, this.audioContext.currentTime);
        shape.gain.gain.linearRampToValueAtTime(
          targetVolume,
          this.audioContext.currentTime + (event.duration || 1)
        );
        shape.gain.gain.linearRampToValueAtTime(
          0,
          this.audioContext.currentTime + (event.duration || 1) + 0.5
        );

        // Pan (om aktiverat)
        if (this.panEnabled && shape.stereoPanner) {
          const panValue = this.calculatePan(shape.i);
          shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
          shape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.1);
        }
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
}

export default CosmiChordScene;