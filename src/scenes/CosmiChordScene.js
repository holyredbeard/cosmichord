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
    this.playMode = 'manual';
    this.aiLoopOn = false;
    this.aiBusy = false;
    this.aiChordStep = 0;
    this.aiBeat = 0;
    this.lifeLinks = [];
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

    if (this.playMode === 'ai') {
      this.stepAiLife();
      this.collectLifeLinks();
      this.drawLifeLinks();
      this.tickAiSong();
    } else {
      this.lifeLinks = [];
      this.linkedShapes = null;
    }

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
      if (this.playMode === 'ai') {
        const linked = this.linkedShapes && this.linkedShapes.has(shape);
        if (shape.aiOwned) volume = shape.aiLead ? 0.95 : (linked ? 0.8 : 0.4);
        else volume = linked ? 0.55 : 0.12;
        if (shape.graphics) {
          shape.graphics.setScale(linked ? 1 + 0.05 * Math.sin(this.time.now / 280 + shape.x) : 1);
        }
      } else if (shape.graphics && shape.graphics.scaleX !== 1) {
        shape.graphics.setScale(1);
      }

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

      const manualModeButton = document.getElementById('manualModeButton');
      if (manualModeButton) {
        manualModeButton.addEventListener('click', () => this.setPlayMode('manual'));
      }
      const aiModeButton = document.getElementById('aiModeButton');
      if (aiModeButton) {
        aiModeButton.addEventListener('click', () => this.setPlayMode('ai'));
      }

      // EVOLVE-knapp
      const evolveButton = document.getElementById('evolveButton');
      if (evolveButton) {
        evolveButton.addEventListener('click', async () => {
          await this.ensureAudio();
          if (this.playMode === 'ai') this.advanceFormation();
          else this.continueFromConnections({ temperature: 0.5, steps: 16 });
        });
      }

      // AI AMBIENT-knapp
      const aiAmbientButton = document.getElementById('aiAmbientButton');
      if (aiAmbientButton) {
        aiAmbientButton.addEventListener('click', async () => {
          await this.ensureAudio();
          if (this.playMode === 'ai') this.beginFormation(2);
          else this.continueFromConnections({ temperature: 0.25, steps: 24, noteHold: 1.8 });
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

  // LIVE brukade anropa en metod som inte fanns (och en äldre variant läste this.Stat).
  // Knappen växlar nu samma AI-slinga som läget, utan slumpmässiga gain-pulser.
  toggleLiveMode() {
    const rnnReady = !!this.music_rnn;
    console.log('LIVE toggle, MusicRNN ready:', rnnReady);
    this.setPlayMode(this.playMode === 'ai' ? 'manual' : 'ai');
  }

  setPlayMode(mode) {
    const next = mode === 'ai' ? 'ai' : 'manual';
    if (next === 'ai') this.ensureAudio();
    this.playMode = next;
    this.isLive = next === 'ai';
    const manualBtn = document.getElementById('manualModeButton');
    const aiBtn = document.getElementById('aiModeButton');
    const liveBtn = document.getElementById('liveButton');
    if (manualBtn) manualBtn.classList.toggle('is-active', next === 'manual');
    if (aiBtn) aiBtn.classList.toggle('is-active', next === 'ai');
    if (liveBtn) liveBtn.style.background = next === 'ai' ? '#245c8a' : '';
    if (next === 'manual') {
      this.aiFormation = null;
      this.aiFormationIndex = 0;
      this.stopAiLoop();
      this.shapes.filter(shape => shape.aiOwned).forEach(shape => this.removeShape(shape));
      this.restoreHomePitches();
      this.setModeStatus('Manual. Place orbs and shape the sound yourself.');
    } else {
      this.setModeStatus('AI is alive. It will gather nodes and grow a piece.');
      this.aiFormation = null;
      this.aiFormationIndex = 0;
      this.songBeat = -1;
      this.startAiLoop();
    }
  }

  setModeStatus(text) {
    const el = document.getElementById('modeStatus');
    if (el && el.textContent !== text) el.textContent = text;
  }

  stopAiLoop() {
    this.aiLoopOn = false;
    if (this.aiTimer) {
      this.aiTimer.remove();
      this.aiTimer = null;
    }
  }

  startAiLoop() {
    this.aiLoopOn = true;
    if (!this.aiFormation) this.beginFormation(0);
  }

  aiNodes() {
    return (this.shapes || []).filter(shape => shape.aiOwned && !shape.retiring);
  }

  beginFormation(index) {
    const kinds = ['converge', 'cluster', 'orbit', 'release'];
    const kind = kinds[((index % kinds.length) + kinds.length) % kinds.length];
    const centers = [
      { x: 340, y: 320 },
      { x: 540, y: 400 },
      { x: 400, y: 560 },
      { x: 480, y: 260 }
    ];
    this.aiFormationIndex = index;
    this.aiFormation = {
      kind,
      index,
      started: this.time.now,
      duration: kind === 'release' ? 5200 : kind === 'orbit' ? 8400 : 7000,
      center: centers[index % centers.length],
      phrase: index % 2 === 0 ? 'call' : 'answer'
    };
    this.songBeat = -1;
    this._nextSongBeat = 0;
    if (this._pendingContour && this._pendingContour.length >= 4) {
      this._activeContour = this._pendingContour;
      this._pendingContour = null;
    } else if (index % 2 === 0) {
      this._activeContour = null;
    }
    const population = kind === 'converge' ? 2 : 4;
    this.ensureAiPopulation(population, kind === 'converge');
    const names = { converge: 'converging pair', cluster: 'cluster', orbit: 'orbit', release: 'breaking apart' };
    this.setModeStatus(`AI · ${names[kind]}. A phrase is growing.`);
    this.suggestNextContour();
  }

  advanceFormation() {
    const index = (this.aiFormationIndex || 0) + 1;
    if (this.aiFormation && this.aiFormation.kind === 'release') {
      this.aiNodes().forEach(shape => this.removeShape(shape));
    }
    this.beginFormation(index);
  }

  ensureAiPopulation(count, spread) {
    if (!this.audioContext) return;
    const center = (this.aiFormation && this.aiFormation.center) || { x: 400, y: 400 };
    let nodes = this.aiNodes();
    while (nodes.length > count) {
      this.removeShape(nodes.pop());
      nodes = this.aiNodes();
    }
    const types = ['circle', 'yellowTriangle', 'triangle', 'square'];
    while (nodes.length < count) {
      const i = nodes.length;
      const angle = spread ? (i === 0 ? Math.PI : 0) : (-Math.PI / 2 + i * (Math.PI * 2 / count));
      const radius = spread ? 200 : 170;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      const shape = this.createShapeAt(x, y, types[i % types.length]);
      if (!shape) break;
      shape.aiOwned = true;
      shape.targetX = x;
      shape.targetY = y;
      nodes.push(shape);
    }
  }

  stepAiLife() {
    if (!this.aiLoopOn) return;
    if (!this.audioContext) {
      this.setModeStatus('AI is waking up. One click unlocks the sound.');
      return;
    }
    if (!this.aiFormation) this.beginFormation(this.aiFormationIndex || 0);
    const formation = this.aiFormation;
    const elapsed = this.time.now - formation.started;
    if (elapsed >= formation.duration) {
      this.advanceFormation();
      return;
    }
    const t = Math.max(0, Math.min(1, elapsed / formation.duration));
    const ease = t * t * (3 - 2 * t);
    if (!this.aiNodes().length) {
      this.ensureAiPopulation(formation.kind === 'converge' ? 2 : 4, formation.kind === 'converge');
    }
    const nodes = this.aiNodes();
    const center = formation.center;
    nodes.forEach((shape, i) => {
      shape.aiLead = i === 0;
      let tx = center.x;
      let ty = center.y;
      if (formation.kind === 'converge') {
        const gap = Phaser.Math.Linear(210, 42, ease);
        const side = i % 2 === 0 ? -1 : 1;
        tx = center.x + side * gap;
        ty = center.y + (i > 1 ? side * 30 : 0);
      } else if (formation.kind === 'cluster') {
        const radius = Phaser.Math.Linear(150, 58, ease);
        const ang = -Math.PI / 2 + i * (Math.PI * 2 / Math.max(nodes.length, 1));
        tx = center.x + Math.cos(ang) * radius;
        ty = center.y + Math.sin(ang) * radius;
      } else if (formation.kind === 'orbit') {
        const spin = elapsed / 1000 * 0.65;
        const ang = spin + i * (Math.PI * 2 / Math.max(nodes.length, 1));
        tx = center.x + Math.cos(ang) * 110;
        ty = center.y + Math.sin(ang) * 78;
      } else {
        const ang = i * (Math.PI * 2 / Math.max(nodes.length, 1));
        const radius = Phaser.Math.Linear(64, 230, ease);
        tx = center.x + Math.cos(ang) * radius;
        ty = center.y + Math.sin(ang) * radius;
      }
      shape.targetX = Math.max(this.playAreaLeft + 20, Math.min(this.playAreaRight - 20, tx));
      shape.targetY = Math.max(this.playAreaTop + 20, Math.min(this.playAreaBottom - 20, ty));
    });
    const dt = Math.min(0.05, (this.game.loop.delta || 16) / 1000);
    const follow = formation.kind === 'orbit' ? 3.2 : 1.6;
    const k = 1 - Math.exp(-follow * dt);
    nodes.forEach(shape => {
      shape.x += ((shape.targetX || shape.x) - shape.x) * k;
      shape.y += ((shape.targetY || shape.y) - shape.y) * k;
      shape.i = Math.max(0, Math.min(this.gridCols - 1, Math.floor(shape.x / this.gridSize)));
      shape.j = Math.max(0, Math.min(this.gridRows - 1, Math.floor(shape.y / this.gridSize)));
      if (shape.graphics) shape.graphics.setPosition(shape.x, shape.y);
    });
  }

  formationCloseness(nodes) {
    if (!nodes || nodes.length < 2) return 0;
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        total += Phaser.Math.Distance.Between(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        pairs++;
      }
    }
    const avg = total / Math.max(pairs, 1);
    return Math.max(0, Math.min(1, (220 - avg) / 170));
  }

  degreeToMidi(degree, octave) {
    const pcs = this.scalePitchClasses();
    const len = pcs.length || 1;
    let d = degree;
    let oct = octave;
    while (d < 0) {
      d += len;
      oct -= 1;
    }
    oct += Math.floor(d / len);
    return oct * 12 + pcs[d % len];
  }

  tickAiSong() {
    const nodes = this.aiNodes();
    if (!this.audioContext || this.audioContext.state !== 'running' || !nodes.length || !this.aiFormation) return;
    const now = this.audioContext.currentTime;
    const bpm = Math.max(52, Math.min(104, this.particleSpeedToBPM(this.particleSpeed)));
    const beat = 60 / bpm;
    if (this._nextSongBeat && now < this._nextSongBeat) return;
    this._nextSongBeat = now + beat;
    this.songBeat = (this.songBeat || 0) + 1;

    const formation = this.aiFormation;
    const call = [0, 2, 4, 2, 5, 4, 2, 0];
    const answer = [4, 2, 0, 2, -1, 0, 2, 4];
    const contour = this._activeContour && this._activeContour.length >= 4
      ? this._activeContour
      : (formation.phrase === 'answer' ? answer : call);
    const root = [0, 5, 3, 4][formation.index % 4];
    const step = contour[this.songBeat % contour.length];
    const closeness = this.formationCloseness(nodes);
    const resolving = formation.kind === 'release';

    const leadMidi = resolving ? this.degreeToMidi(root, 4) : this.degreeToMidi(root + step, 4);
    this.retuneShape(nodes[0], leadMidi, 0);
    this.requestAccent(nodes[0], resolving ? 0.45 : 1, beat * 0.92);

    if (nodes[1] && (closeness > 0.35 || formation.kind === 'cluster' || formation.kind === 'orbit')) {
      const harmony = resolving ? this.degreeToMidi(root, 3) : this.degreeToMidi(root + 2, 4);
      this.retuneShape(nodes[1], harmony, 0);
      this.requestAccent(nodes[1], resolving ? 0.3 : 0.72, beat);
    }
    if (closeness > 0.62 || formation.kind === 'orbit' || formation.kind === 'cluster') {
      nodes.slice(2).forEach((node, i) => {
        const deg = [4, 2, 6][i % 3];
        const midi = resolving ? this.degreeToMidi(root, 5) : this.degreeToMidi(root + deg, i % 2 === 0 ? 5 : 3);
        this.retuneShape(node, midi, 0);
        this.requestAccent(node, resolving ? 0.2 : 0.58, beat * 1.1);
      });
    }

    const label = (this.chordColors[this.selectedChord] || {}).label || 'Chord';
    const names = { converge: 'converging pair', cluster: 'cluster', orbit: 'orbit', release: 'resolving' };
    const chordName = [0, 2, 4].map(deg => this.pitchName(this.degreeToMidi(root + deg, 4) % 12)).join(' ');
    this.setModeStatus(`AI · ${names[formation.kind]} · ${label} · ${chordName}`);
  }

  async suggestNextContour() {
    if (!this.magentaLoaded || !this.modelsLoaded || !this.music_rnn || typeof mm === 'undefined' || this._motifPending) return;
    const nodes = this.aiNodes();
    if (nodes.length < 2) return;
    this._motifPending = true;
    try {
      const bpm = Math.max(52, this.particleSpeedToBPM(this.particleSpeed));
      const chord = this.currentChordClasses();
      const seedNotes = nodes.slice(0, 4).map((shape, index) => ({
        pitch: shape.aiMidi || this.frequencyToMidi(shape.frequency),
        startTime: index * 0.5,
        endTime: index * 0.5 + 0.45
      }));
      const quantized = mm.sequences.quantizeNoteSequence({
        notes: seedNotes,
        totalTime: seedNotes.length * 0.5,
        tempos: [{ time: 0, qpm: bpm }]
      }, 4);
      const continued = await this.music_rnn.continueSequence(quantized, 8, 0.45);
      const degrees = (continued.notes || []).slice(0, 8).map(note => {
        const snapped = this.snapPitch(note.pitch, chord);
        const pc = ((snapped % 12) + 12) % 12;
        const pcs = this.scalePitchClasses();
        let best = 0;
        let gap = 99;
        pcs.forEach((candidate, index) => {
          const d = Math.min((pc - candidate + 12) % 12, (candidate - pc + 12) % 12);
          if (d < gap) {
            gap = d;
            best = index;
          }
        });
        return best;
      });
      if (degrees.length >= 4 && this.playMode === 'ai') this._pendingContour = degrees;
    } catch (error) {
      console.warn('Magenta motif skipped; the written phrase continues', error);
    } finally {
      this._motifPending = false;
    }
  }

  scheduleAiPhrase(seconds) {
    if (!this.aiLoopOn) return;
    if (this.aiTimer) this.aiTimer.remove();
    this.aiTimer = this.time.delayedCall(Math.max(seconds, 0.3) * 1000, () => {
      this.runAiPhrase();
    });
  }

  async runAiPhrase() {
    if (!this.aiLoopOn || this.aiBusy) return;
    this.aiBusy = true;
    try {
      const grown = !!this._linkGrew;
      this._linkGrew = false;
      const seconds = await this.continueFromConnections({
        temperature: grown ? 0.5 : 0.3,
        steps: 16
      });
      if (this.aiLoopOn) this.scheduleAiPhrase(seconds || 3);
    } finally {
      this.aiBusy = false;
    }
  }

  collectLifeLinks() {
    const links = [];
    const linked = new Set();
    const shapes = this.shapes || [];
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i];
        const b = shapes[j];
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const reach = Math.max(a.radius || this.nodeRadius || 100, b.radius || this.nodeRadius || 100) * 1.25;
        if (dist < reach) {
          links.push({ a, b });
          linked.add(a);
          linked.add(b);
        }
      }
    }
    if (this._prevLinkCount !== links.length) {
      if (this._prevLinkCount != null && links.length > this._prevLinkCount) this._linkGrew = true;
      this._prevLinkCount = links.length;
    }
    this.lifeLinks = links;
    this.linkedShapes = linked;
    return links;
  }

  drawLifeLinks() {
    if (!this.connectionGraphics || !this.lifeLinks) return;
    const time = this.time.now / 1000;
    this.lifeLinks.forEach((link, index) => {
      const { a, b } = link;
      const colorA = this.getShapeColor(a.type, activeTheme);
      const colorB = this.getShapeColor(b.type, activeTheme);
      const color = this.mixColors(colorA, colorB);
      const pulse = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * 2 + index));
      this.connectionGraphics.lineStyle(2 + pulse * 2, color, pulse);
      this.connectionGraphics.beginPath();
      this.connectionGraphics.moveTo(a.x, a.y);
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const lift = Math.sin(Math.PI * t) * (18 + 8 * Math.sin(time * 1.4 + index));
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t - lift;
        this.connectionGraphics.lineTo(x, y);
      }
      this.connectionGraphics.strokePath();
    });
  }

  mixColors(a, b) {
    const mix = (shift) => {
      const ca = (a >> shift) & 255;
      const cb = (b >> shift) & 255;
      return (ca + cb) >> 1;
    };
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
  }

  orderedVoices() {
    if (!this.linkedShapes) return [];
    return Array.from(this.linkedShapes).sort((a, b) => a.x - b.x || a.y - b.y);
  }

  scalePitchClasses() {
    const chord = this.chordColors[this.selectedChord] || this.chordColors[0];
    const pcs = chord.frequencies.map(freq => ((this.frequencyToMidi(freq) % 12) + 12) % 12);
    return [...new Set(pcs)].sort((a, b) => a - b);
  }

  currentChordClasses() {
    const pcs = this.scalePitchClasses();
    if (!pcs.length) return [0, 4, 7];
    const richness = Math.min(pcs.length, 3 + Math.floor((this.lifeLinks ? this.lifeLinks.length : 0) / 3));
    const offsets = [0, 2, 4, 6].slice(0, Math.max(3, richness));
    const root = (this.aiChordStep || 0) % pcs.length;
    return offsets.map(offset => pcs[(root + offset) % pcs.length]);
  }

  pitchName(pc) {
    return ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][((pc % 12) + 12) % 12];
  }

  advanceAiHarmony() {
    if (!this.audioContext || this.audioContext.state !== 'running') return;
    const voices = this.orderedVoices();
    if (voices.length < 2) {
      this.setModeStatus('AI. Move orbs within arm’s reach so a harmony can form.');
      return;
    }
    const chord = this.currentChordClasses();
    const signature = voices.map(voice => `${voice.i},${voice.j}`).join('|') + ':' + chord.join(',');
    if (signature !== this._voiceSig) {
      this._voiceSig = signature;
      this.assignVoices(voices, chord);
    }
    const now = this.audioContext.currentTime;
    const bpm = Math.max(40, this.particleSpeedToBPM(this.particleSpeed));
    const beat = 60 / bpm;
    if (!this._nextAiBeat || now >= this._nextAiBeat) {
      this._nextAiBeat = now + beat;
      this.aiBeat = (this.aiBeat || 0) + 1;
      const lead = voices[this.aiBeat % voices.length];
      this.requestAccent(lead, 0.95, beat * 0.95);
      if (this.aiBeat % 4 === 0) {
        voices.forEach(voice => this.requestAccent(voice, 0.75, beat * 1.8));
      }
      const label = (this.chordColors[this.selectedChord] || {}).label || 'Chord';
      const names = chord.map(pc => this.pitchName(pc)).join(' ');
      const links = this.lifeLinks.length;
      this.setModeStatus(`AI. ${label} · ${names} · ${links} link${links === 1 ? '' : 's'}`);
    }
  }

  assignVoices(voices, pitchClasses) {
    const used = new Set();
    voices.forEach(shape => {
      const midi = shape.aiMidi || this.frequencyToMidi(shape.frequency || shape.homeFrequency || 220);
      let best = midi;
      let bestScore = Infinity;
      for (let octave = 3; octave <= 6; octave++) {
        pitchClasses.forEach(pc => {
          const candidate = octave * 12 + pc;
          const score = Math.abs(candidate - midi) + (used.has(candidate) ? 7 : 0);
          if (score < bestScore) {
            bestScore = score;
            best = candidate;
          }
        });
      }
      used.add(best);
      this.retuneShape(shape, best, 0);
    });
  }

  retuneShape(shape, midi, delay = 0) {
    if (!shape) return;
    const freq = this.midiToFrequency(midi);
    shape.aiMidi = midi;
    shape.frequency = freq;
    shape._freqTarget = freq;
    if (shape.oscillator && this.audioContext) {
      shape.oscillator.frequency.setTargetAtTime(freq, this.audioContext.currentTime + delay, 0.12);
    }
  }

  restoreHomePitches() {
    this.shapes.forEach(shape => {
      shape.accent = 0;
      if (!shape.homeFrequency) return;
      shape.frequency = shape.homeFrequency;
      shape._freqTarget = shape.homeFrequency;
      shape.aiMidi = this.frequencyToMidi(shape.homeFrequency);
      if (shape.oscillator && this.audioContext) {
        shape.oscillator.frequency.setTargetAtTime(shape.homeFrequency, this.audioContext.currentTime, 0.15);
      }
    });
  }

  snapPitch(midi, pitchClasses) {
    const pc = ((midi % 12) + 12) % 12;
    let best = pitchClasses[0];
    let distance = 99;
    pitchClasses.forEach(candidate => {
      const gap = Math.min((pc - candidate + 12) % 12, (candidate - pc + 12) % 12);
      if (gap < distance) {
        distance = gap;
        best = candidate;
      }
    });
    let snapped = Math.round(midi / 12) * 12 + best;
    if (snapped - midi > 6) snapped -= 12;
    if (midi - snapped > 6) snapped += 12;
    return Math.max(48, Math.min(84, snapped));
  }

  noteTime(note, bpm) {
    if (typeof note.startTime === 'number') return note.startTime;
    const step = note.quantizedStartStep || 0;
    return (step / 4) * (60 / bpm);
  }

  async continueFromConnections({ temperature = 0.4, steps = 16, noteHold = 1 } = {}) {
    await this.ensureAudio();
    if (!this.lifeLinks || !this.lifeLinks.length) this.collectLifeLinks();
    const voices = this.orderedVoices();
    const chord = this.currentChordClasses();
    if (voices.length < 2) {
      this.setModeStatus('AI needs a connection. Bring two orbs within arm’s reach.');
      return 2.5;
    }
    this.assignVoices(voices, chord);
    const bpm = Math.max(40, this.particleSpeedToBPM(this.particleSpeed));
    let notes = null;
    if (this.magentaLoaded && this.modelsLoaded && this.music_rnn && typeof mm !== 'undefined') {
      try {
        const seedNotes = voices.slice(0, 8).map((shape, index) => ({
          pitch: shape.aiMidi,
          startTime: index * 0.5,
          endTime: index * 0.5 + 0.45
        }));
        const seed = {
          notes: seedNotes,
          totalTime: seedNotes.length * 0.5,
          tempos: [{ time: 0, qpm: bpm }]
        };
        const quantized = mm.sequences.quantizeNoteSequence(seed, 4);
        const continued = await this.music_rnn.continueSequence(quantized, steps, temperature);
        notes = (continued && continued.notes ? continued.notes : []).map(note => ({
          ...note,
          pitch: this.snapPitch(note.pitch, chord)
        }));
      } catch (error) {
        console.warn('Magenta continuation failed, holding the connected chord', error);
      }
    }
    if (!notes || !notes.length) {
      notes = voices.map((shape, index) => ({
        pitch: shape.aiMidi,
        startTime: index * 0.5,
        endTime: index * 0.5 + 0.9
      }));
    }
    const stretched = notes.map(note => {
      const start = this.noteTime(note, bpm);
      const end = typeof note.endTime === 'number'
        ? note.endTime
        : start + ((note.quantizedEndStep || 1) - (note.quantizedStartStep || 0)) / 4 * (60 / bpm);
      return {
        ...note,
        startTime: start * noteHold,
        endTime: Math.max(end, start + 0.3) * noteHold
      };
    });
    this.playSoundscape(stretched, voices);
    const last = stretched[stretched.length - 1];
    const label = (this.chordColors[this.selectedChord] || {}).label || 'Chord';
    this.setModeStatus(`AI. ${label} · ${chord.map(pc => this.pitchName(pc)).join(' ')} · melody across ${voices.length} linked orbs`);
    return (last ? last.endTime : 2) + 0.4;
  }

  startEvolutionProcess() {
    this.continueFromConnections({ temperature: 0.5, steps: 16 });
  }

  startAmbientGeneration() {
    this.continueFromConnections({ temperature: 0.25, steps: 24, noteHold: 1.8 });
  }

  playSoundscape(sequence, voices) {
    if (!this.audioContext || this.audioContext.state !== 'running') {
      console.warn('AudioContext not ready');
      return;
    }

    const roster = voices && voices.length ? voices : this.shapes;
    if (!roster.length || !sequence || !sequence.length) return;
    sequence.forEach((note, index) => {
      const shape = roster[index % roster.length];
      if (shape && shape.oscillator) {
        const frequency = this.midiToFrequency(note.pitch);
        const when = this.audioContext.currentTime + (note.startTime || 0);
        shape.frequency = frequency;
        shape._freqTarget = frequency;
        shape.oscillator.frequency.setTargetAtTime(frequency, when, 0.08);
        const duration = Math.max((note.endTime || 1) - (note.startTime || 0), 0.2);
        this.requestAccent(shape, 0.8, (note.startTime || 0) + duration);
      }
    });
  }

  midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  createShapeAt(x, y, type) {
    if (!this.audioContext) return null;
    let i = Math.max(0, Math.min(this.gridCols - 1, Math.floor(x / this.gridSize)));
    let j = Math.max(0, Math.min(this.gridRows - 1, Math.floor(y / this.gridSize)));
    for (let n = 0; n < 20 && this.shapes.some(shape => !shape.retiring && shape.i === i && shape.j === j); n++) {
      i = Math.max(0, Math.min(this.gridCols - 1, i + 1));
      if (i >= this.gridCols - 1) j = Math.max(0, Math.min(this.gridRows - 1, j + 1));
    }
    const sx = i * this.gridSize + this.gridSize / 2;
    const sy = j * this.gridSize + this.gridSize / 2;
    const shape = {
      i, j, x: sx, y: sy,
      radius: this.nodeRadius || 100,
      type: type || 'circle',
      visible: true,
      baseVolume: 0
    };
    const frequencies = [...(this.chordColors[this.selectedChord] || {}).frequencies || this.defaultFrequencies];
    const frequency = this.getFrequencyForType(shape.type, frequencies);
    shape.oscillator = createOscillator(this.audioContext, frequency, this.getOscTypeForShape(shape.type));
    if (!shape.oscillator) return null;
    this.setupShapeAudio(shape, frequency);
    shape.homeFrequency = frequency;
    shape.graphics = this.add.graphics();
    this.updateShapeGraphics(shape);
    this.shapes.push(shape);
    return shape;
  }

  async generateRandomShapes() {
    try {
      await this.ensureAudio();
      if (!this.audioContext) return;

      this.shapes.slice().forEach(shape => this.removeShape(shape));

      const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
      const count = Phaser.Math.Between(4, 8);
      const placed = [];
      let attempts = 0;
      while (placed.length < count && attempts < 48) {
        attempts += 1;
        const x = Phaser.Math.Between(this.playAreaLeft + 50, this.playAreaRight - 50);
        const y = Phaser.Math.Between(this.playAreaTop + 50, this.playAreaBottom - 50);
        const crowded = placed.some(shape => Phaser.Math.Distance.Between(shape.x, shape.y, x, y) < 100);
        if (crowded) continue;
        const shape = await this.placeShape({ x, y }, types[placed.length % types.length]);
        if (shape) placed.push(shape);
      }
    } catch (error) {
      console.error('generateRandomShapes failed', error);
    }
  }

  async placeShape(pointer, type) {
    try {
      await this.ensureAudio();
      if (!this.audioContext) return null;

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
      const existingShape = this.shapes.find(shape => shape.i === i && shape.j === j && !shape.retiring);
      if (existingShape) {
        this.updateExistingShape(existingShape, i, j);
        return existingShape;
      }
      return this.createShapeAt(pointer.x, pointer.y, type || this.selectedNoteType);
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
      if (!shape || shape.retiring) return;
      shape.retiring = true;
      shape.accent = 0;
      if (shape.gain && this.audioContext) {
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
        shape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05);
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
