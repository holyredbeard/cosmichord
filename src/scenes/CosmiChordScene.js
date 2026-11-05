import Phaser from 'phaser';
import { createAudioContext, createOscillator, updateVolume } from '../utils/audioUtils';
import { createUI, updateUI, handleUIEvents, toggleMenu, resetScene } from '../utils/visualUtils';
import { themes, activeTheme } from '../config/themes';

// Lägg till några konstanter för visuell respons
const VISUAL_MODES = {
  CALM: 'calm',         // Mjuka, långsamma visualiseringar
  HARMONIC: 'harmonic', // Strukturerade, harmoniska mönster
  ENERGETIC: 'energetic', // Livliga, snabba mönster
  CHAOTIC: 'chaotic'    // Oförutsägbara, komplexa mönster
};

const COLOR_PALETTES = {
  CALM: [0x3498db, 0x2980b9, 0x21618c, 0x1b4f72, 0x2e86c1],
  HARMONIC: [0x27ae60, 0x2ecc71, 0x58d68d, 0x82e0aa, 0x229954],
  ENERGETIC: [0xe74c3c, 0xf39c12, 0xd35400, 0xff5733, 0xe67e22],
  CHAOTIC: [0x8e44ad, 0x9b59b6, 0xaf7ac5, 0xbb8fce, 0x7d3c98]
};

class CosmiChordScene extends Phaser.Scene {
  constructor() {
    super('CosmiChordScene');
    this.visualResponses = [];
    this.currentVisualMode = VISUAL_MODES.CALM;
    this.lastAnalysisTime = 0;
    this.visualAnalysisInterval = 2000;
    this.magentaLoaded = false;
    this.modelsLoaded = false;
  }

  preload() {
    // Grundläggande cirkulär partikel
    let particleGraphics = this.add.graphics();
    particleGraphics.fillStyle(0xffffff);
    particleGraphics.fillCircle(5, 5, 5);
    particleGraphics.generateTexture('particle', 10, 10);
    particleGraphics.destroy();
    
    // Stjärnformad partikel för magisk känsla
    particleGraphics = this.add.graphics();
    particleGraphics.fillStyle(0xffffff);
    const starPoints = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? 5 : 2;
      const px = 5 + Math.cos(angle) * radius;
      const py = 5 + Math.sin(angle) * radius;
      starPoints.push(new Phaser.Geom.Point(px, py));
    }
    particleGraphics.fillPoints(starPoints, true);
    particleGraphics.generateTexture('starParticle', 10, 10);
    particleGraphics.destroy();
    
    // Glödande partikel med mjuka kanter (förenkla utan gradient)
    particleGraphics = this.add.graphics();
    particleGraphics.fillStyle(0xffffff, 1);
    particleGraphics.fillCircle(5, 5, 5);
    particleGraphics.fillStyle(0xffffff, 0.5);
    particleGraphics.fillCircle(5, 5, 7);
    particleGraphics.generateTexture('glowParticle', 14, 14);
    particleGraphics.destroy();
    
    // Ringformad partikel
    particleGraphics = this.add.graphics();
    particleGraphics.lineStyle(1, 0xffffff);
    particleGraphics.strokeCircle(5, 5, 4);
    particleGraphics.generateTexture('ringParticle', 10, 10);
    particleGraphics.destroy();
    
    console.log('Alla partikeltexturer genererade');
  }

  create() {
    this.masterVolume = 0.5;
    this.maxSoundingVoices = 6;
    // Summan av rösternas gain * osc-topp ska hålla sig under ~0.7 före master.
    this.voicePeakBudget = 0.7;
    this.oscPeak = 1.25;
    this.audioContext = null;
    this.audioUnlocked = false;
    this.shapes = [];
    this.connectionGraphics = this.add.graphics({ lineStyle: { width: 4 } });
    this.connectionGraphics.setDepth(0);

    this.particleSpeed = 1.5;
    this.particleCount = 20;
    this.panEnabled = false;
    this.harmonicEnabled = false;
    this.ambientModeActive = false;
    this.isLive = false;
    this.isPaused = false;
    this.liveTimer = null;
    this.nodeRadius = 100;
    this.selectedChord = 0;

    // Skapa reverb-nod för ambient-ljud
    this.reverbNode = null;
    this.reverbBuffer = null;

    // Första klick/tap (var som helst) låser upp Web Audio, Phaser och Magentas Tone-kontext.
    window.addEventListener('pointerdown', () => {
      this.ensureAudio();
    }, true);

    this.cameras.main.setBackgroundColor('#000000');
    this.gridSize = 60;
    this.gridCols = 13;
    this.gridRows = 13;

    this.playAreaLeft = 30;
    this.playAreaRight = 770;
    this.playAreaTop = 80;
    this.playAreaBottom = 770;

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

    this.draggedShape = null;
    this.isDragging = false;
    this.selectedNoteType = null;

    this.setupInputListeners();

    this.matter.world.setBounds(0, 0, 800, 800, 32, true, true, false, true);

    this.defaultFrequencies = this.chordColors[0].frequencies;

    this.time.delayedCall(300, () => {
      // Kontrollera att renderDiv finns innan vi skapar UI
      const renderDiv = document.getElementById('renderDiv');
      if (!renderDiv) {
        console.error('renderDiv not found, cannot create UI!');
        return;
      }
      
      console.log('Creating UI elements...');
      createUI(this);
      const startButton = document.getElementById('startAudioButton');
      if (startButton) {
        startButton.onclick = () => this.ensureAudio();
      }
      handleUIEvents(this);
      console.log('UI elements created successfully');
    }, [], this);

    this.activeHarmonics = new Map();

    this.bpm = 60;
    this.beatDuration = 60 / this.bpm;
    this.currentBeat = 0;
  }

  ensureAudio() {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.markAudioReady();
      return Promise.resolve(true);
    }
    if (!this._audioPromise) {
      this._audioPromise = this._ensureAudioInner().finally(() => {
        this._audioPromise = null;
      });
    }
    return this._audioPromise;
  }

  async _ensureAudioInner() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioCtx();
      console.log('AudioContext initialized');
      this.installMasterBus();
      this.initializeReverb();
      this.initializeMagenta();
    }
    const jobs = [];
    if (this.audioContext.state !== 'running') {
      jobs.push(this.audioContext.resume());
    }
    if (this.sound && this.sound.context && this.sound.context.state === 'suspended' && this.sound.context.resume) {
      jobs.push(this.sound.context.resume());
    }
    if (this.sound && typeof this.sound.unlock === 'function') {
      try { this.sound.unlock(); } catch (err) { /* Phaser kan redan vara upplåst */ }
    }
    this.resumeMagentaContext();
    try {
      await Promise.all(jobs);
    } catch (err) {
      console.warn('Audio resume failed', err);
    }
    const running = this.audioContext.state === 'running';
    if (running) this.markAudioReady();
    return running;
  }

  installMasterBus() {
    if (!this.audioContext || this.masterGain) return;
    const ctx = this.audioContext;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = Math.min(Math.max(this.masterVolume, 0), 1);

    // Mjuk begränsare efter mastern. Vanliga nivåer passerar; toppar kläms före destination.
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -8;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.22;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(ctx.destination);
  }

  applyMasterVolume() {
    if (!this.audioContext) return;
    this.installMasterBus();
    const level = Math.min(Math.max(this.masterVolume || 0, 0), 1);
    this.masterGain.gain.setTargetAtTime(level, this.audioContext.currentTime, 0.05);
  }

  outputNode() {
    this.installMasterBus();
    return this.masterGain;
  }

  // LIVE / Magenta sätter en önskad styrka (0–1). Mixern skalar den inom budgeten.
  requestAccent(shape, strength, duration) {
    if (!shape) return;
    const now = this.audioContext ? this.audioContext.currentTime : 0;
    shape.accent = Math.min(Math.max(strength, 0), 1);
    shape.accentUntil = now + Math.max(duration || 0.4, 0.05);
  }

  mixVoices() {
    if (!this.audioContext || this.audioContext.state !== 'running') return;
    this.installMasterBus();
    const now = this.audioContext.currentTime;
    const voices = this.shapes.filter(shape => shape && shape.gain);
    if (!voices.length) return;

    voices.forEach(shape => {
      if (!shape.accentUntil || shape.accentUntil < now) shape.accent = 0;
      const proximity = Math.min(Math.max(shape._proximityLevel || 0, 0), 1);
      shape._desired = Math.min(1, Math.max(proximity, shape.accent || 0));
    });

    const ranked = voices.slice().sort((a, b) => b._desired - a._desired);
    ranked.forEach((shape, index) => {
      if (index >= this.maxSoundingVoices) shape._desired = 0;
    });

    const maxSumGain = this.voicePeakBudget / this.oscPeak;
    const soloCap = Math.min(0.32, maxSumGain);
    const sumDesired = voices.reduce((sum, shape) => sum + shape._desired, 0);
    const unit = sumDesired > 0 ? Math.min(soloCap, maxSumGain / sumDesired) : 0;

    voices.forEach(shape => {
      const target = this.isPaused ? 0 : Math.min(soloCap, shape._desired * unit);
      shape.currentVolume = target;
      if (Math.abs(shape.gain.gain.value - target) > 0.015) {
        shape.gain.gain.setTargetAtTime(target, now, this.isPaused ? 0.05 : 0.08);
      }
    });
  }

  resumeMagentaContext() {
    try {
      if (typeof mm === 'undefined' || !mm.Player) return;
      // Magenta/Tone skapar en egen AudioContext vid sidladdning (ofta suspended).
      // resumeContext måste anropas från en användargest.
      if (!this._magentaPlayer) this._magentaPlayer = new mm.Player();
      const pending = this._magentaPlayer.resumeContext();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch (err) {
      console.warn('Magenta audio resume failed', err);
    }
  }

  markAudioReady() {
    this.audioUnlocked = true;
    const hint = document.getElementById('audioHint');
    if (hint) {
      hint.textContent = 'Audio on. Orbs play as soon as you place them, and get louder when particles pass.';
    }
    const startButton = document.getElementById('startAudioButton');
    if (startButton) startButton.style.display = 'none';
  }

  async initializeMagenta() {
    try {
      if (typeof mm === 'undefined') {
        console.warn('Magenta.js not loaded yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.initializeMagenta();
      }

      console.log('Initializing Magenta.js models...');
      
      // Initiera endast MusicRNN modellen
      this.music_rnn = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
      await this.music_rnn.initialize();
      console.log('MusicRNN model initialized');
      
      this.magentaLoaded = true;
      this.modelsLoaded = true;
    } catch (error) {
      console.error('Error initializing Magenta.js:', error);
      // Försök igen om det misslyckades
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.initializeMagenta();
    }
  }

  update() {
    // Rensa tidigare linjer
    this.connectionGraphics.clear();

    // Uppdatera positioner för shapes
    this.shapes.forEach(shape => {
      if (!shape.currentTween && shape.graphics) {
        shape.graphics.x = shape.x;
        shape.graphics.y = shape.y;
        
        // Pulsering i ambient-läge
        if (this.ambientModeActive) {
          if (!shape.pulseDirection) {
            shape.pulseDirection = 1;
            shape.pulseScale = 1;
          }
          
          shape.pulseScale += 0.001 * shape.pulseDirection;
          if (shape.pulseScale > 1.05) {
            shape.pulseDirection = -1;
          } else if (shape.pulseScale < 0.95) {
            shape.pulseDirection = 1;
          }
          
          shape.graphics.scale = shape.pulseScale;
        } else if (!this.ambientModeActive && shape.pulseScale !== 1) {
          shape.pulseScale = 1;
          shape.graphics.scale = 1;
        }
      }
    });

    // Uppdatera partiklar
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.body) continue;
      
      const velocity = particle.body.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      // Justera hastighet för jämnare rörelse
      if (Math.abs(speed - this.particleSpeed) > 0.5) {
        const scaleFactor = this.particleSpeed / speed;
        particle.setVelocity(velocity.x * scaleFactor, velocity.y * scaleFactor);
      }
      
      // Kantdetektering
      if (particle.x < this.playAreaLeft) {
        particle.x = this.playAreaLeft;
        particle.setVelocity(Math.abs(velocity.x), velocity.y);
      } else if (particle.x > this.playAreaRight) {
        particle.x = this.playAreaRight;
        particle.setVelocity(-Math.abs(velocity.x), velocity.y);
      }
      
      if (particle.y < this.playAreaTop) {
        particle.y = this.playAreaTop;
        particle.setVelocity(velocity.x, Math.abs(velocity.y));
      } else if (particle.y > this.playAreaBottom) {
        particle.y = this.playAreaBottom;
        particle.setVelocity(velocity.x, -Math.abs(velocity.y));
      }
      
      // Rotation för ambient-läge
      if (this.ambientModeActive) {
        if (!particle.rotationSpeed) {
          particle.rotationSpeed = Phaser.Math.FloatBetween(-0.005, 0.005);
        }
        particle.rotation += particle.rotationSpeed;
      } else if (particle.rotation !== 0) {
        particle.rotation = 0;
      }
    }

    // Rita shapes med bättre grafik
    this.shapes.forEach(shape => {
      if (!shape.graphics) return;
      
      const color = this.getShapeColor(shape.type, activeTheme);
      
      // Endast rita om shapes vid behov
      if (this.time.now % 5 === 0 || shape.isBlending) {
        shape.graphics.clear();
        
        if (this.ambientModeActive) {
          // Ambient-läge med mer detalj
          shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
          shape.graphics.fillStyle(color, 0.2).fillCircle(0, 0, 28);
          shape.graphics.fillStyle(color, 0.4).fillCircle(0, 0, 24);
          shape.graphics.fillStyle(color, 1.0).fillCircle(0, 0, 20);
        } else {
          // Standard grafik
          shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
          shape.graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
          shape.graphics.fillStyle(color, 1).fillCircle(0, 0, 20);
        }
      }
      
      shape.isBlending = false;
    });

    const directConnections = new Map();
    const shapeConnections = new Map();
    this.shapes.forEach(shape => {
      shapeConnections.set(shape, new Set());
    });

    // Rita anslutningar mellan partiklar och shapes
    this.particles.forEach(particle => {
      const connectedShapes = this.shapes.filter(shape => {
        const dist = Phaser.Math.Distance.Between(particle.x, particle.y, shape.x, shape.y);
        return dist < shape.radius;
      });

      connectedShapes.forEach(shape => {
        const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
        if (distance < shape.radius) {
          const lineColor = this.getShapeColor(shape.type, activeTheme);
          
          // Beräkna opacitet och bredd baserat på avstånd
          const distanceRatio = distance / shape.radius;
          const opacity = (1 - distanceRatio) * 0.8;
          const lineWidth = 2 + (1 - distanceRatio) * 2;
          
          // Rita linje med förbättrad stil
          this.connectionGraphics.lineStyle(lineWidth, lineColor, opacity);
          this.connectionGraphics.beginPath();
          this.connectionGraphics.moveTo(shape.x, shape.y);
          this.connectionGraphics.lineTo(particle.x, particle.y);
          this.connectionGraphics.strokePath();
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

        // Rita förbättrade harmonic-kopplingar
        if (this.harmonicEnabled) {
          const color1 = this.getShapeColor(shape1.type, activeTheme);
          
          this.connectionGraphics.lineStyle(3, color1, 0.5);
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

    // Uppdatera ljudparametrar
    this.shapes.forEach(shape => {
      const shapeKey = `${shape.i},${shape.j}`;
      const connections = directConnections.get(shapeKey) || new Set();

      let closestDistance = Infinity;
      this.particles.forEach(particle => {
        const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
        closestDistance = Math.min(closestDistance, distance);
      });

      const radius = shape.radius || this.nodeRadius || 100;
      let proximity = 0;
      if (isFinite(closestDistance) && radius > 0) {
        proximity = Math.max(0, Math.min(1, 1 - (closestDistance / radius)));
      }
      proximity = Math.pow(proximity, 1.15);
      // Relativ styrka 0–1. Mastern och röstbudgeten skalar den faktiska gainen.
      let volume = 0.75 + 0.25 * proximity;

      if (!connections.size || !this.harmonicEnabled) {
        if (isFinite(shape.frequency) && shape.oscillator && this.audioContext && this.audioContext.state === 'running') {
          if (shape._freqTarget !== shape.frequency) {
            shape.oscillator.frequency.setTargetAtTime(shape.frequency, this.audioContext.currentTime, 0.08);
            shape._freqTarget = shape.frequency;
          }
        }
      } else if (this.harmonicEnabled) {
        const connectedShapes = Array.from(connections).map(key => {
          return this.shapes.find(s => `${s.i},${s.j}` === key);
        }).filter(s => s !== null);

        if (connectedShapes.length > 0 && this.audioContext && this.audioContext.state === 'running') {
          const connectedFreqs = connectedShapes.map(s => s.frequency).filter(f => isFinite(f));
          const baseFreq = shape.frequency;

          if (connectedFreqs.length > 0 && isFinite(baseFreq)) {
            // Harmoniska intervaller
            const harmonicIntervals = [1, 5/4, 3/2, 2];
            
            // Hitta alla möjliga harmoniska toner genom att analysera frekvensförhållanden
            const rootFrequency = Math.min(baseFreq, ...connectedFreqs);
            
            // Välj en harmonisk ton
            const interval = harmonicIntervals[connections.size % harmonicIntervals.length];
            const targetFreq = rootFrequency * interval;
            if (shape.oscillator && shape._freqTarget !== targetFreq) {
              shape.oscillator.frequency.setTargetAtTime(targetFreq, this.audioContext.currentTime, 0.4);
              shape._freqTarget = targetFreq;
            }
            volume *= 0.9;
          }
        }
      }

      shape.baseVolume = volume;
      shape._proximityLevel = Math.min(Math.max(volume, 0), 1);

      if (this.panEnabled && shape.stereoPanner && this.audioContext && this.audioContext.state === 'running') {
        const panValue = this.calculatePan(shape.i);
        if (shape._panTarget !== panValue) {
          shape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.08);
          shape._panTarget = panValue;
        }
      }
    });

    this.mixVoices();
    
    // Uppdatera beat för timing
    this.currentBeat = Math.floor(this.time.now / 1000 / this.beatDuration) % 4;
  }
  
  // Förbättrad updateShapeGraphics
  updateShapeGraphics(shape) {
    if (!shape || !shape.graphics) return;
    
    shape.graphics.clear();
    const color = this.getShapeColor(shape.type, activeTheme);
    
    shape.graphics.x = shape.x;
    shape.graphics.y = shape.y;
    shape.graphics.setDepth(1);
    
    if (this.ambientModeActive) {
      // Ambient-läge med mer detalj
      shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      shape.graphics.fillStyle(color, 0.2).fillCircle(0, 0, 28);
      shape.graphics.fillStyle(color, 0.4).fillCircle(0, 0, 24);
      shape.graphics.fillStyle(color, 1.0).fillCircle(0, 0, 20);
      
      // Lägg till formspecifika detaljer om möjligt
      if (shape.type.includes('Triangle')) {
        const size = 10;
        shape.graphics.fillStyle(color, 0.7).fillTriangle(-size, size, size, size, 0, -size);
      } else if (shape.type.includes('Square')) {
        const size = 8;
        shape.graphics.fillStyle(color, 0.7).fillRect(-size, -size, size*2, size*2);
      }
    } else {
      // Standard grafik - bättre än minimal
      shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
      shape.graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
      shape.graphics.fillStyle(color, 1).fillCircle(0, 0, 20);
    }
  }

  // Återställ lightening-funktion
  lightenColor(color, percent) {
    const r = Math.min(255, ((color >> 16) & 0xFF) + percent);
    const g = Math.min(255, ((color >> 8) & 0xFF) + percent);
    const b = Math.min(255, (color & 0xFF) + percent);
    return (r << 16) | (g << 8) | b;
  }

  // Förbättrad setupShapeAudio
  setupShapeAudio(shape, frequency) {
    if (!shape || !this.audioContext) return;
    
    try {
      // Skapa gain och panner
      shape.gain = this.audioContext.createGain();
      shape.gain.gain.value = 0; // Börja tyst
      
      // Oscillator -> röst-gain -> master -> kompressor -> destination
      shape.oscillator.connect(shape.gain);
      shape.gain.connect(this.outputNode());
      
      // Starta oscillatorn
      shape.oscillator.start();
      
      // Sätt frekvens
      shape.frequency = frequency;
      
      return shape;
    } catch (error) {
      console.error('Error in setupShapeAudio:', error);
      return null;
    }
  }

  // Förbättrad reverbinitiering
  initializeReverb() {
    if (!this.audioContext) return;
    
    try {
      if (this.reverbNode) {
        console.log("Reverb already initialized");
        return;
      }
      
      // Skapa en bättre reverb
      const convolver = this.audioContext.createConvolver();
      const duration = 2.0; // 2 sekunder reverb
      const bufferSize = Math.min(this.audioContext.sampleRate * duration, 48000 * 2);
      const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);
      
      // Skapa impulsrespons
      for (let channel = 0; channel < 2; channel++) {
        const channelData = buffer.getChannelData(channel);
        
        // Fyll med brus som avtar exponentiellt
        for (let i = 0; i < bufferSize; i++) {
          const decay = Math.exp(-i / (bufferSize * 0.33));
          channelData[i] = (Math.random() * 2 - 1) * decay * 0.1;
        }
      }
      
      convolver.buffer = buffer;
      convolver.connect(this.outputNode());
      this.reverbNode = convolver;
      
      console.log('Improved reverb initialized');
    } catch (error) {
      console.warn('Failed to initialize reverb, ignoring:', error);
      this.reverbNode = null;
    }
  }

  // Förbättrad triggerLiveSoundscape
  triggerLiveSoundscape() {
    try {
      if (!this.audioContext || this.audioContext.state !== 'running' || !this.aiWorker || !this.isLive && !this.ambientModeActive) {
        console.warn('Cannot trigger live soundscape: AudioContext, AI Worker, or Live/ambient mode not ready');
        return;
      }
      
      // Säkerställ att reverb finns tillgänglig för ambient-läge
      if ((this.ambientModeActive || this.harmonicEnabled) && !this.reverbNode) {
        this.initializeReverb();
      }
      
      // Begränsa antal shapes för att minimera dataöverföring
      const maxShapesToSend = Math.min(this.shapes.length, 8); // Begränsa till max 8 former
      const shapesData = this.shapes.slice(0, maxShapesToSend).map(shape => ({
        frequency: shape.frequency,
        type: shape.type,
        x: shape.x || 0,
        y: shape.y || 0,
        visible: shape.visible !== undefined ? shape.visible : true
      }));
      
      // Ambient-anpassade parametrar
      const ambientParams = {
        temperature: 0.2,
        ambientMode: this.ambientModeActive,
        noteDuration: 2.0,
        reverb: 0.4,
        isMinor: false
      };
      
      console.log('Sending shapes data to AI Worker:', shapesData);
      this.aiWorker.postMessage({ 
        type: 'generateControlSequence', 
        shapes: shapesData, 
        bpm: this.particleSpeedToBPM(this.particleSpeed),
        ambientParams: ambientParams
      });
      
    } catch (error) {
      console.error('Error in triggerLiveSoundscape:', error);
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

  updateNodeRadius(newRadius) {
    this.nodeRadius = newRadius;
    // Uppdatera radius för alla befintliga shapes
    this.shapes.forEach(shape => {
      shape.radius = newRadius;
    });
  }

  getShapeColor(type, theme = activeTheme) {
    return themes[theme][type] || 0xffffff;
  }

  calculatePan(i) {
    return (i / (this.gridCols - 1)) * 2 - 1;
  }

  frequencyToMidi(frequency) {
    if (!frequency) return 60; // C4 som standard
    return Math.round(12 * Math.log2(frequency / 440) + 69);
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
      defaultFrequencies: this.defaultFrequencies,
      nodeRadius: this.nodeRadius
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
      oscillator.connect(gain);
      gain.connect(stereoPanner);
      stereoPanner.connect(this.outputNode());
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
        radius: this.nodeRadius || 200,
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
    
    // Uppdatera nodeRadius ifall det finns i config
    if (config.nodeRadius) {
      this.updateNodeRadius(config.nodeRadius);
    }

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
    5: { color: 'purple', label: 'Dark', frequencies: [55, 220, 261.63, 311.13, 369.99, 466.16], key: '6' },
    6: { color: 'pink', label: 'Cosmic', frequencies: [55, 165, 220, 277.18, 329.63, 440], key: '7' },
    7: { color: 'teal', label: 'Ethereal', frequencies: [65.41, 195.99, 261.63, 329.63, 392, 523.25], key: '8' },
    8: { color: 'gold', label: 'Stellar', frequencies: [73.42, 110, 220, 293.66, 349.23, 440], key: '9' },
    9: { color: 'silver', label: 'Galactic', frequencies: [82.41, 123.47, 164.81, 220, 329.63, 392], key: '0' }
  };

  handleControlSequence(sequence) {
    if (!this.audioContext || this.audioContext.state !== 'running' || (!this.isLive && !this.ambientModeActive)) {
      console.warn('Cannot handle control sequence: AudioContext or Live/Ambient mode not ready');
      return;
    }

    console.log('Received control sequence from AI Worker:', sequence);

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
          shape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime);
          shape.oscillator.frequency.setTargetAtTime(event.frequency, this.audioContext.currentTime, 0.1);
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

        // Volym går via röstbudgeten, inte rakt till destination.
        if (shape.visible === false) {
          this.requestAccent(shape, 0, 0.05);
        } else {
          this.requestAccent(shape, 0.85, event.duration || 1);
        }

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
      'Dark': '#ff0000',
      'Cosmic': '#ff69b4',
      'Ethereal': '#008080',
      'Stellar': '#ffd700',
      'Galactic': '#c0c0c0'
    };
    return textColors[label] || '#0000ff';
  }

  resetShapeToOriginalColor(shape) {
    const originalColor = this.getShapeColor(shape.type, activeTheme);
    shape.graphics.clear();
    shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
    shape.graphics.fillStyle(originalColor, 0.3).fillCircle(0, 0, 25);
    shape.graphics.fillStyle(originalColor, 1).fillCircle(0, 0, 20);
  }

  setupInputListeners() {
    // Används efter att UI-element skapats
    const setupUIListeners = () => {
      // RANDOM-knapp
      const randomButton = document.getElementById('randomButton');
      if (randomButton) {
        randomButton.addEventListener('click', () => {
          this.generateRandomShapes();
        });
      }

      // LIVE-knapp
      const liveButton = document.getElementById('liveButton');
      if (liveButton) {
        liveButton.addEventListener('click', () => {
          this.toggleLiveMode();
        });
      }

      // EVOLVE-knapp
      const evolveButton = document.getElementById('evolveButton');
      if (evolveButton) {
        evolveButton.addEventListener('click', () => {
          if (!this.audioContext || this.audioContext.state !== 'running') {
            console.warn('AudioContext not ready');
            return;
          }
          if (!this.magentaLoaded || !this.modelsLoaded) {
            console.warn('Magenta.js not ready');
            return;
          }
          this.startEvolutionProcess();
        });
      }

      // AI AMBIENT-knapp
      const aiAmbientButton = document.getElementById('aiAmbientButton');
      if (aiAmbientButton) {
        aiAmbientButton.addEventListener('click', () => {
          if (!this.audioContext || this.audioContext.state !== 'running') {
            console.warn('AudioContext not ready');
            return;
          }
          if (!this.magentaLoaded || !this.modelsLoaded) {
            console.warn('Magenta.js not ready');
            return;
          }
          this.startAmbientGeneration();
        });
      }
    };

    // Försök sätta upp UI-lyssnare efter en kort fördröjning
    setTimeout(setupUIListeners, 500);

    this.draggedShape = null;
    this.isDragging = false;
    this.selectedNoteType = null;

    this.input.keyboard.on('keydown-SHIFT', () => {
      document.body.style.cursor = 'grab';
    });

    // Lägg till tangentbordskontroller för att välja nodtyper
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
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', this.updateCursorPosition);
        this.updateCursorPosition = null;
        this.selectedNoteType = null;
      });
    });

    this.input.keyboard.on('keyup-SHIFT', () => {
      document.body.style.cursor = 'default';
      if (this.isDragging) {
        this.isDragging = false;
        this.draggedShape = null;
      }
    });

    // Lägg till klickhändelse för att placera nya former
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
          document.body.style.cursor = 'grabbing';
        }
      } else {
        this.placeShape(pointer, this.selectedNoteType);
      }
    });

    this.input.keyboard.on('keydown-CTRL', () => {
      document.body.style.cursor = '➖';
    });
    this.input.keyboard.on('keydown-X', () => {
      let customCursor = document.getElementById('customCursor');
      if (customCursor) customCursor.remove();
      customCursor = document.createElement('div');
      document.body.style.cursor = 'none';
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
      document.body.style.cursor = 'default';
      const customCursor = document.getElementById('customCursor');
      if (customCursor) customCursor.remove();
      document.removeEventListener('mousemove', this.updateCursorPosition);
      this.updateCursorPosition = null;
    });
    this.input.keyboard.on('keyup-CTRL', () => {
      if (!this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) {
        document.body.style.cursor = 'default';
      }
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
        document.body.style.cursor = 'grab';
      }
      this.isDragging = false;
      this.draggedShape = null;
    });

    this.input.keyboard.on('keydown-U', () => {
      const chordIndex = 6;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-I', () => {
      const chordIndex = 7;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-O', () => {
      const chordIndex = 8;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
    this.input.keyboard.on('keydown-ZERO', () => {
      const chordIndex = 9;
      document.getElementById('chordSlider').value = chordIndex;
      const event = new Event('input');
      document.getElementById('chordSlider').dispatchEvent(event);
    });
  }

  startEvolutionProcess() {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      console.warn('AudioContext not ready');
      return;
    }

    if (!this.magentaLoaded || !this.modelsLoaded) {
      console.warn('Magenta.js not ready');
      return;
    }

    if (this.shapes.length === 0) {
      console.warn('No shapes to evolve');
      return;
    }

    const shapesData = this.shapes.map(shape => ({
      type: shape.type,
      frequency: shape.frequency,
      position: { x: shape.x, y: shape.y }
    }));

    this.generateEvolution(shapesData);
  }

  async generateEvolution(shapesData) {
    try {
      // Generera en sekvens med MusicRNN
      const seed = {
        notes: shapesData.map(shape => ({
          pitch: this.frequencyToMidi(shape.frequency),
          startTime: 0,
          endTime: 1
        })),
        totalTime: 4
      };

      const result = await this.music_rnn.continueSequence(seed, {
        temperature: 0.8,
        steps: 32
      });

      // Konvertera sekvensen till ljud
      this.playSoundscape(result.notes);
    } catch (error) {
      console.error('Error generating evolution:', error);
    }
  }

  startAmbientGeneration() {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      console.warn('AudioContext not ready');
      return;
    }

    if (!this.magentaLoaded || !this.modelsLoaded) {
      console.warn('Magenta.js not ready');
      return;
    }

    if (this.shapes.length === 0) {
      console.warn('No shapes to generate ambient from');
      return;
    }

    const shapesData = this.shapes.map(shape => ({
      type: shape.type,
      frequency: shape.frequency,
      position: { x: shape.x, y: shape.y }
    }));

    this.generateAmbient(shapesData);
  }

  async generateAmbient(shapesData) {
    try {
      // Generera ambient med MusicRNN
      const seed = {
        notes: shapesData.map(shape => ({
          pitch: this.frequencyToMidi(shape.frequency),
          startTime: 0,
          endTime: 2
        })),
        totalTime: 4
      };

      const result = await this.music_rnn.continueSequence(seed, {
        temperature: 0.2,  // Lägre temperatur för mer förutsägbart resultat
        steps: 64         // Fler steg för längre sekvens
      });

      // Konvertera sekvensen till ljud med längre toner för ambient-känsla
      const ambientNotes = result.notes.map(note => ({
        ...note,
        endTime: note.endTime * 2,  // Dubbla längden på tonerna
        startTime: note.startTime * 2
      }));

      this.playSoundscape(ambientNotes);
    } catch (error) {
      console.error('Error generating ambient:', error);
    }
  }

  playSoundscape(sequence) {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      console.warn('AudioContext not ready');
      return;
    }

    if (!this.shapes.length || !sequence) return;
    const heard = Math.min(sequence.length, this.maxSoundingVoices || 6);
    sequence.slice(0, heard).forEach((note, index) => {
      const shape = this.shapes[index % this.shapes.length];
      if (shape && shape.oscillator) {
        const frequency = this.midiToFrequency(note.pitch);
        const when = this.audioContext.currentTime + (note.startTime || 0);
        shape.oscillator.frequency.setTargetAtTime(frequency, when, 0.08);
        shape._freqTarget = frequency;
        const duration = Math.max((note.endTime || 1) - (note.startTime || 0), 0.2);
        this.requestAccent(shape, 0.8, (note.startTime || 0) + duration);
      }
    });
  }

  midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  async placeShape(pointer, type) {
    try {
      await this.ensureAudio();
      if (!this.audioContext) return null;
  
      // Enkel gränskollidkontroll
      if (
        pointer.x < this.playAreaLeft ||
        pointer.x > this.playAreaRight ||
        pointer.y < this.playAreaTop ||
        pointer.y > this.playAreaBottom
      ) {
        return;
      }
  
      const i = Math.floor(pointer.x / this.gridSize);
      const j = Math.floor(pointer.y / this.gridSize);
      
      // Kolla om det redan finns en form på platsen
      const existingShape = this.shapes.find(shape => shape.i === i && shape.j === j);
      if (existingShape) {
        // Ändra typ på befintlig nod eller ta bort den
        this.updateExistingShape(existingShape, i, j);
        return;
      }
  
      // Skapa ny shape
      let shape = {};
      shape.i = i;
      shape.j = j;
      shape.x = i * this.gridSize + this.gridSize / 2;
      shape.y = j * this.gridSize + this.gridSize / 2;
      shape.radius = this.nodeRadius || 100;
      shape.type = type || 'circle';
      shape.visible = true;
      shape.baseVolume = 0;
  
      // Frekvens- och ljudinställningar
      const frequencies = [...this.chordColors[this.selectedChord]?.frequencies || this.defaultFrequencies];
      let frequency = this.getFrequencyForType(shape.type, frequencies);
      
      // Enkelt ljud setup
      shape.oscillator = createOscillator(this.audioContext, frequency, this.getOscTypeForShape(shape.type));
      if (!shape.oscillator) {
        console.error('Failed to create oscillator');
        return;
      }
  
      this.setupShapeAudio(shape, frequency);
  
      // Enkel grafik
      shape.graphics = this.add.graphics();
      this.updateShapeGraphics(shape);
  
      // Lägg till i shapes
      this.shapes.push(shape);
  
      return shape;
    } catch (err) {
      console.error("Error in placeShape:", err);
      return null;
    }
  }

  // Hjälpmetod för att hantera befintliga shapes
  updateExistingShape(existingShape, i, j) {
    try {
      // Mycket förenklad hantering av shape-uppdateringar
      let newType;
      const frequencies = [...this.chordColors[this.selectedChord]?.frequencies || this.defaultFrequencies];
      
      // Förenkla sekventiell ändring av typ
      switch (existingShape.type) {
        case 'circle': newType = 'yellowTriangle'; break;
        case 'yellowTriangle': newType = 'triangle'; break;
        case 'triangle': newType = 'square'; break;
        case 'square': newType = 'purpleSquare'; break;
        case 'purpleSquare': newType = 'orangeSquare'; break;
        case 'orangeSquare': 
          // Ta bort om redan orangeSquare
          this.removeShape(existingShape);
          return;
      }
  
      // Uppdatera type och frequency
      existingShape.type = newType;
      existingShape.frequency = this.getFrequencyForType(newType, frequencies);
      
      // Uppdatera ljud
      this.updateShapeAudio(existingShape);
      
      // Uppdatera grafik
      this.updateShapeGraphics(existingShape);
    } catch (err) {
      console.error("Error in updateExistingShape:", err);
    }
  }

  // Hjälpmetod för att ta bort shapes säkert
  removeShape(shape) {
    try {
      // Säkert ta bort
      if (shape.gain) {
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
        shape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
      }
      
      // Förenklad cleanup efter kort fördröjning
      setTimeout(() => {
        if (shape.graphics) shape.graphics.destroy();
        if (shape.oscillator) {
          shape.oscillator.stop();
          shape.oscillator.disconnect();
        }
        if (shape.gain) shape.gain.disconnect();
        if (shape.stereoPanner) shape.stereoPanner.disconnect();
        if (shape.subOscillator) {
          shape.subOscillator.stop();
          shape.subOscillator.disconnect();
        }
        
        // Ta bort från shapes array
        this.shapes = this.shapes.filter(s => s !== shape);
      }, 50);
    } catch (err) {
      console.error("Error in removeShape:", err);
    }
  }

  // Hjälpmetod för att få standardfrekvens för en formtyp
  getFrequencyForType(type, frequencies) {
    switch (type) {
      case 'circle': return frequencies[0] || 440;
      case 'yellowTriangle': return frequencies[1] || 220;
      case 'triangle': return frequencies[2] || 330;
      case 'square': return frequencies[3] || 440;
      case 'purpleSquare': return frequencies[4] || 110;
      case 'orangeSquare': return frequencies[5] || 55;
      default: return 440;
    }
  }
   
  // Hjälpmetod för att få oscillatortyp baserat på form
  getOscTypeForShape(type) {
    if (type === 'circle') return 'sine';
    if (type === 'triangle' || type === 'yellowTriangle') return 'triangle';
    if (type === 'purpleSquare') return 'sawtooth';
    return 'square';
  }

  // Uppdatera ljud för en befintlig shape
  updateShapeAudio(shape) {
    try {
      if (!shape.oscillator) return;
      
      // Skapa en ny oscillator med den nya frekvensen och typen
      const oldOscillator = shape.oscillator;
      shape.oscillator = createOscillator(this.audioContext, shape.frequency, this.getOscTypeForShape(shape.type));
      
      // Anslut den nya oscillatorn
      if (shape.filter) {
        shape.oscillator.connect(shape.filter);
      } else {
        shape.oscillator.connect(shape.gain);
      }
      
      // Starta ny och stoppa gammal
      shape.oscillator.start();
      setTimeout(() => {
        oldOscillator.stop();
        oldOscillator.disconnect();
      }, 50);
    } catch (err) {
      console.error("Error in updateShapeAudio:", err);
    }
  }
}

export default CosmiChordScene;// Uppdaterad Tue Mar 18 14:42:03 CET 2025
