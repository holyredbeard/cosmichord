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
    // Skapa logo
    const logoImg = document.getElementById('logoImg');
    if (!logoImg) {
      const logo = document.createElement('img');
      logo.id = 'logoImg';
      logo.className = 'logo-img';
      logo.src = '/images/logo.png';
      logo.style.width = '180px';
      document.body.appendChild(logo);
    }

    this.masterVolume = 0.3;
    this.audioContext = null;
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
    
    // Ekosystem-inställningar
    this.ecosystemEnabled = false;
    this.orbitGraphics = null; // Graphics för orbit-banor
    this.maxNodes = 6; // Max antal noder i ekosystemet (lugnt)
    this.minNodes = 2; // Minimum antal noder
    this.nodeProximityTime = {}; // Spårar hur länge noder varit nära varandra
    this.nodeIsolationTime = {}; // Spårar hur länge noder varit isolerade
    this.birthThreshold = 10000; // 10 sekunder nära varandra för att föda ny nod
    this.deathThreshold = 30000; // 30 sekunder isolerad innan nod dör
    this.proximityDistance = 50; // Avstånd för "nära" (mindre = svårare att trigga)
    this.isolationDistance = 250; // Avstånd för "isolerad"
    this.lastBirthTime = 0; // Förhindra för snabb födelse
    this.birthCooldown = 15000; // 15 sekunder mellan födslar

    // Skapa reverb-nod för ambient-ljud
    this.reverbNode = null;
    this.reverbBuffer = null;

    // Lägg till en knapp för att initiera AudioContext och Magenta.js
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Audio & AI';
    startButton.className = 'control-button';
    startButton.style.position = 'absolute';
    startButton.style.top = '20px';
    startButton.style.left = '50%';
    startButton.style.transform = 'translateX(-50%)';
    startButton.style.zIndex = '1000';
    startButton.onclick = async () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext initialized via Start button');
        this.initializeReverb();
        
        // Initiera Magenta.js efter att AudioContext är redo
        await this.initializeMagenta();
        
        startButton.style.display = 'none';
      } else if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    };
    document.body.appendChild(startButton);

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
      handleUIEvents(this);
      console.log('UI elements created successfully');
    }, [], this);

    this.activeHarmonics = new Map();

    this.bpm = 60;
    this.beatDuration = 60 / this.bpm;
    this.currentBeat = 0;
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
    
    // Uppdatera ekosystem om aktiverat
    if (this.ecosystemEnabled) {
      this.updateEcosystem();
    }

    // Uppdatera positioner för shapes
    this.shapes.forEach(shape => {
      // Uppdatera orbit-position om ekosystem är aktiverat
      if (this.ecosystemEnabled && shape.orbit) {
        this.updateOrbitPosition(shape);
      }
      
      if (shape.graphics) {
        shape.graphics.x = shape.x;
        shape.graphics.y = shape.y;
        
        // Uppdatera labels så de följer noden
        if (shape.waveformLabel) {
          shape.waveformLabel.x = shape.x;
          shape.waveformLabel.y = shape.y - 30;
        }
        if (shape.filterLabel) {
          shape.filterLabel.x = shape.x;
          shape.filterLabel.y = shape.y - 30;
        }
        if (shape.lfoLabel) {
          shape.lfoLabel.x = shape.x;
          shape.lfoLabel.y = shape.y - 30;
        }
        
        // Pulsering i ambient-läge eller ekosystem
        if (this.ambientModeActive || this.ecosystemEnabled) {
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
        } else if (!this.ambientModeActive && !this.ecosystemEnabled && shape.pulseScale !== 1) {
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
            // Harmoniska intervaller
            const harmonicIntervals = [1, 5/4, 3/2, 2];
            
            // Hitta alla möjliga harmoniska toner genom att analysera frekvensförhållanden
            const rootFrequency = Math.min(baseFreq, ...connectedFreqs);
            
            // Välj en harmonisk ton
            const interval = harmonicIntervals[Math.floor(Math.random() * harmonicIntervals.length)];
            const targetFreq = rootFrequency * interval;
            
            // Mjuk övergång till den harmoniska tonen
            shape.oscillator.frequency.setTargetAtTime(targetFreq, this.audioContext.currentTime, 2.0);
            
            volume *= 0.9;
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
      
      // Anslut oscillator -> gain -> destination
      shape.oscillator.connect(shape.gain);
      shape.gain.connect(this.audioContext.destination);
      
      // Starta oscillatorn
      shape.oscillator.start();
      
      // Sätt frekvens
      shape.frequency = frequency;
      
      // Lägg till organiska modulationer för ambient känsla
      this.addOrganicModulation(shape);
      
      return shape;
    } catch (error) {
      console.error('Error in setupShapeAudio:', error);
      return null;
    }
  }

  // Lägg till organiska modulationer för mer levande ljud
  addOrganicModulation(shape) {
    if (!shape || !this.audioContext || !shape.oscillator) return;
    
    try {
      // 1. Långsam filter-svep (evolving texture)
      const filterLfo = this.audioContext.createOscillator();
      filterLfo.type = 'sine';
      filterLfo.frequency.value = 0.1 + Math.random() * 0.15; // 0.1-0.25 Hz (mycket långsam)
      
      const filterLfoGain = this.audioContext.createGain();
      filterLfoGain.gain.value = 300; // ±300 Hz filter-svep
      
      filterLfo.connect(filterLfoGain);
      if (shape.oscillator.filter) {
        filterLfoGain.connect(shape.oscillator.filter.frequency);
      }
      filterLfo.start();
      shape.filterLfo = filterLfo;
      shape.filterLfoGain = filterLfoGain;
      
      // 2. Subtil pitch-drift (organisk känsla)
      const pitchDrift = this.audioContext.createOscillator();
      pitchDrift.type = 'sine';
      pitchDrift.frequency.value = 0.05 + Math.random() * 0.1; // 0.05-0.15 Hz
      
      const pitchDriftGain = this.audioContext.createGain();
      pitchDriftGain.gain.value = 2 + Math.random() * 3; // ±2-5 Hz drift
      
      pitchDrift.connect(pitchDriftGain);
      pitchDriftGain.connect(shape.oscillator.frequency);
      pitchDrift.start();
      shape.pitchDrift = pitchDrift;
      shape.pitchDriftGain = pitchDriftGain;
      
      // 3. Subtil amplitud-andning (breathing effect) - DISABLED för nu
      // Denna kan störa LIVE-lägets volymkontroll
      // const breathLfo = this.audioContext.createOscillator();
      // breathLfo.type = 'sine';
      // breathLfo.frequency.value = 0.08 + Math.random() * 0.12;
      // const breathGain = this.audioContext.createGain();
      // breathGain.gain.value = 0.15;
      // breathLfo.connect(breathGain);
      // breathGain.connect(shape.gain.gain);
      // breathLfo.start();
      // shape.breathLfo = breathLfo;
      // shape.breathGain = breathGain;
      
    } catch (err) {
      console.error('Error adding organic modulation:', err);
    }
  }

  // ==================== EKOSYSTEM ====================
  
  // Toggle ekosystem-läge
  toggleEcosystem() {
    this.ecosystemEnabled = !this.ecosystemEnabled;
    const ecoButton = document.getElementById('ecosystemButton');
    
    if (this.ecosystemEnabled) {
      console.log('Ecosystem mode activated');
      if (ecoButton) {
        ecoButton.style.background = '#00cc00';
        ecoButton.textContent = 'ECO ON';
      }
      
      // Initiera orbit-graphics
      if (!this.orbitGraphics) {
        this.orbitGraphics = this.add.graphics();
        this.orbitGraphics.setDepth(0);
      }
      
      // Ge alla existerande noder orbits
      this.shapes.forEach(shape => {
        if (!shape.orbit) {
          this.initializeOrbit(shape);
        }
      });
      
      // Aktivera ljud på alla noder - LUGN volym
      this.shapes.forEach(shape => {
        if (shape.gain) {
          shape.gain.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
        }
      });
      
    } else {
      console.log('Ecosystem mode deactivated');
      if (ecoButton) {
        ecoButton.style.background = 'linear-gradient(135deg, #1a4a1a, #2a6a2a)';
        ecoButton.textContent = 'ECOSYSTEM';
      }
      
      // Rensa orbit-graphics
      if (this.orbitGraphics) {
        this.orbitGraphics.clear();
      }
      
      // Rensa proximity/isolation timers
      this.nodeProximityTime = {};
      this.nodeIsolationTime = {};
      this.lastBirthTime = 0;
      
      // Ta bort orbits från alla noder
      this.shapes.forEach(shape => {
        shape.orbit = null;
        shape.dying = false;
        if (shape.graphics) shape.graphics.alpha = 1;
      });
      
      // Tysta alla noder
      this.shapes.forEach(shape => {
        if (shape.gain) {
          shape.gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        }
      });
    }
  }
  
  // Initiera orbit för en nod
  initializeOrbit(shape) {
    const centerX = (this.playAreaLeft + this.playAreaRight) / 2;
    const centerY = (this.playAreaTop + this.playAreaBottom) / 2;
    
    // Beräkna avstånd från centrum
    const dx = shape.x - centerX;
    const dy = shape.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Skapa elliptisk orbit - långsam men synlig för ambient känsla
    shape.orbit = {
      centerX: centerX + (Math.random() - 0.5) * 50, // Lite offset för variation
      centerY: centerY + (Math.random() - 0.5) * 50,
      radiusX: Math.max(60, distance * (0.5 + Math.random() * 0.3)),
      radiusY: Math.max(50, distance * (0.4 + Math.random() * 0.3)),
      angle: Math.atan2(dy, dx), // Startvinkel
      speed: 0.002 + Math.random() * 0.003, // Långsam men synlig rotation
      direction: Math.random() > 0.5 ? 1 : -1 // Medurs eller moturs
    };
    
    console.log(`Orbit initialized for node: speed=${shape.orbit.speed.toFixed(4)}, radiusX=${shape.orbit.radiusX.toFixed(0)}`);
    
    // Initiera isolation-timer
    shape.id = shape.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.nodeIsolationTime[shape.id] = 0;
  }
  
  // Uppdatera orbit-position för en nod
  updateOrbitPosition(shape) {
    if (!shape.orbit) return;
    
    const orbit = shape.orbit;
    
    // Uppdatera vinkel
    orbit.angle += orbit.speed * orbit.direction;
    
    // Beräkna ny position
    const newX = orbit.centerX + Math.cos(orbit.angle) * orbit.radiusX;
    const newY = orbit.centerY + Math.sin(orbit.angle) * orbit.radiusY;
    
    // Begränsa till spelområdet
    shape.x = Math.max(this.playAreaLeft + 30, Math.min(this.playAreaRight - 30, newX));
    shape.y = Math.max(this.playAreaTop + 30, Math.min(this.playAreaBottom - 30, newY));
  }
  
  // Uppdatera ekosystem (kallas varje frame)
  updateEcosystem() {
    if (!this.ecosystemEnabled || this.shapes.length === 0) return;
    
    const now = Date.now();
    
    // Rita orbit-banor
    this.drawOrbits();
    
    // Kolla interaktioner mellan noder
    this.checkNodeInteractions(now);
    
    // Kolla isolerade noder
    this.checkIsolatedNodes(now);
    
    // Uppdatera ljud baserat på proximitet
    this.updateProximitySound();
  }
  
  // Rita orbit-banor
  drawOrbits() {
    if (!this.orbitGraphics) return;
    this.orbitGraphics.clear();
    
    this.shapes.forEach(shape => {
      if (!shape.orbit) return;
      
      const orbit = shape.orbit;
      const alpha = shape.dying ? 0.1 : 0.15;
      
      // Rita ellips
      this.orbitGraphics.lineStyle(1, 0x4444ff, alpha);
      this.orbitGraphics.strokeEllipse(orbit.centerX, orbit.centerY, orbit.radiusX * 2, orbit.radiusY * 2);
    });
  }
  
  // Kolla interaktioner mellan noder
  checkNodeInteractions(now) {
    for (let i = 0; i < this.shapes.length; i++) {
      for (let j = i + 1; j < this.shapes.length; j++) {
        const shape1 = this.shapes[i];
        const shape2 = this.shapes[j];
        
        const dx = shape1.x - shape2.x;
        const dy = shape1.y - shape2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const pairKey = `${shape1.id}_${shape2.id}`;
        
        if (distance < this.proximityDistance) {
          // Noder är nära varandra
          if (!this.nodeProximityTime[pairKey]) {
            this.nodeProximityTime[pairKey] = now;
          }
          
          const proximityDuration = now - this.nodeProximityTime[pairKey];
          
          // Rita koppling mellan nära noder
          const intensity = Math.min(1, proximityDuration / this.birthThreshold);
          this.connectionGraphics.lineStyle(2 + intensity * 3, 0x00ff88, 0.3 + intensity * 0.5);
          this.connectionGraphics.lineBetween(shape1.x, shape1.y, shape2.x, shape2.y);
          
          // Harmonisk resonans - justera volym (lugnt)
          if (shape1.gain && shape2.gain) {
            const resonanceBoost = 0.05 * intensity;
            shape1.gain.gain.setTargetAtTime((0.1 + resonanceBoost) * this.masterVolume, this.audioContext.currentTime, 0.5);
            shape2.gain.gain.setTargetAtTime((0.1 + resonanceBoost) * this.masterVolume, this.audioContext.currentTime, 0.5);
          }
          
          // Föd ny nod om de varit nära tillräckligt länge (med cooldown)
          const now_ms = Date.now();
          if (proximityDuration > this.birthThreshold && 
              this.shapes.length < this.maxNodes &&
              now_ms - this.lastBirthTime > this.birthCooldown) {
            this.birthNode(shape1, shape2);
            this.lastBirthTime = now_ms;
            delete this.nodeProximityTime[pairKey];
          }
          
          // Återställ isolation-timers
          this.nodeIsolationTime[shape1.id] = 0;
          this.nodeIsolationTime[shape2.id] = 0;
          
        } else {
          // Noder är inte nära längre
          delete this.nodeProximityTime[pairKey];
        }
      }
    }
  }
  
  // Kolla isolerade noder
  checkIsolatedNodes(now) {
    this.shapes.forEach(shape => {
      if (!shape.id) return;
      
      // Kolla om noden är isolerad (ingen annan nod inom isolationDistance)
      const isIsolated = !this.shapes.some(other => {
        if (other === shape) return false;
        const dx = shape.x - other.x;
        const dy = shape.y - other.y;
        return Math.sqrt(dx * dx + dy * dy) < this.isolationDistance;
      });
      
      if (isIsolated) {
        if (!this.nodeIsolationTime[shape.id]) {
          this.nodeIsolationTime[shape.id] = now;
        }
        
        const isolationDuration = now - this.nodeIsolationTime[shape.id];
        
        // Börja blekna
        if (isolationDuration > this.deathThreshold * 0.5) {
          shape.dying = true;
          const fadeProgress = (isolationDuration - this.deathThreshold * 0.5) / (this.deathThreshold * 0.5);
          
          // Fade ut ljud
          if (shape.gain) {
            shape.gain.gain.setTargetAtTime(0.2 * this.masterVolume * (1 - fadeProgress), this.audioContext.currentTime, 0.1);
          }
          
          // Visuell fade
          if (shape.graphics) {
            shape.graphics.alpha = 1 - fadeProgress * 0.7;
          }
        }
        
        // Dö om isolerad för länge (men behåll minst minNodes)
        if (isolationDuration > this.deathThreshold && this.shapes.length > this.minNodes) {
          this.killNode(shape);
        }
      } else {
        // Inte isolerad längre - återställ
        this.nodeIsolationTime[shape.id] = 0;
        shape.dying = false;
        if (shape.graphics) {
          shape.graphics.alpha = 1;
        }
      }
    });
  }
  
  // Uppdatera ljud baserat på proximitet - LUGNT
  updateProximitySound() {
    // Justera basvolym för alla noder - uppdatera bara var 10:e frame för prestanda
    if (Math.random() > 0.1) return;
    
    this.shapes.forEach(shape => {
      if (!shape.gain || shape.dying) return;
      
      // Hitta närmaste granne
      let minDistance = Infinity;
      this.shapes.forEach(other => {
        if (other === shape) return;
        const dx = shape.x - other.x;
        const dy = shape.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) minDistance = dist;
      });
      
      // Justera volym baserat på avstånd till närmaste granne - LÄGRE volymer
      const proximityFactor = Math.max(0, 1 - minDistance / this.isolationDistance);
      const targetVolume = (0.08 + proximityFactor * 0.07) * this.masterVolume;
      shape.gain.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 1.0); // Långsam övergång
    });
  }
  
  // Föd en ny nod
  birthNode(parent1, parent2) {
    console.log('🌱 New node being born!');
    
    // Beräkna position (mitt emellan föräldrarna, med lite offset)
    const x = (parent1.x + parent2.x) / 2 + (Math.random() - 0.5) * 40;
    const y = (parent1.y + parent2.y) / 2 + (Math.random() - 0.5) * 40;
    
    // Blanda frekvenser (harmoniskt) - använd chord-frekvenser om tillgängliga
    const freq1 = parent1.frequency || 440;
    const freq2 = parent2.frequency || 440;
    
    // Välj harmonisk relation
    const harmonicOptions = [
      (freq1 + freq2) / 2,           // Genomsnitt
      Math.sqrt(freq1 * freq2),      // Geometriskt medelvärde
      freq1 * 1.5,                   // Kvint upp
      freq2 * 0.75,                  // Kvart ner
      (freq1 * 2 + freq2) / 3        // Viktad blandning
    ];
    const newFreq = harmonicOptions[Math.floor(Math.random() * harmonicOptions.length)];
    
    // Begränsa frekvens till rimligt intervall
    const clampedFreq = Math.max(80, Math.min(800, newFreq));
    
    // Ärv inställningar från en av föräldrarna
    const inheritFrom = Math.random() > 0.5 ? parent1 : parent2;
    const inheritedSettings = {
      waveformType: inheritFrom.waveformType || 'sine',
      filterType: inheritFrom.filterType || 'none',
      lfoMode: inheritFrom.lfoMode || 'none'
    };
    
    // Skapa ny nod med ärvda inställningar
    this.createEcosystemNode(x, y, clampedFreq, inheritedSettings);
  }
  
  // Skapa en ekosystem-nod med ärvda inställningar
  createEcosystemNode(x, y, frequency, inheritedSettings = {}) {
    if (!this.audioContext) return;
    
    const color = Phaser.Display.Color.HSLToColor(Math.random(), 0.7, 0.5).color;
    
    const shape = {
      x: x,
      y: y,
      type: 'circle',
      frequency: frequency,
      color: color,
      oscillator: createOscillator(this.audioContext, frequency),
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      // Ärv inställningar
      waveformType: inheritedSettings.waveformType || 'sine',
      filterType: inheritedSettings.filterType || 'none',
      lfoMode: inheritedSettings.lfoMode || 'none'
    };
    
    // Skapa grafik
    shape.graphics = this.add.graphics();
    shape.graphics.fillStyle(color, 0.8);
    shape.graphics.fillCircle(0, 0, 15);
    shape.graphics.x = x;
    shape.graphics.y = y;
    shape.graphics.setDepth(1);
    
    // Fade-in effekt
    shape.graphics.alpha = 0;
    this.tweens.add({
      targets: shape.graphics,
      alpha: 1,
      duration: 1000,
      ease: 'Sine.easeIn'
    });
    
    // Setup audio
    this.setupShapeAudio(shape, frequency);
    
    // Applicera ärvd vågform
    if (shape.waveformType && shape.waveformType !== 'sine' && shape.oscillator) {
      shape.oscillator.type = shape.waveformType;
    }
    
    // Applicera ärvt filter
    if (shape.filterType && shape.filterType !== 'none') {
      this.updateShapeFilter(shape);
    }
    
    // Applicera ärvd LFO
    if (shape.lfoMode && shape.lfoMode !== 'none') {
      this.updateShapeLFO(shape);
    }
    
    // Initiera orbit
    this.initializeOrbit(shape);
    
    // Starta med låg volym och LÅNGSAM fade in
    if (shape.gain) {
      shape.gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      shape.gain.gain.linearRampToValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime + 3);
    }
    
    this.shapes.push(shape);
    console.log(`✨ Node born at (${x.toFixed(0)}, ${y.toFixed(0)}) with freq ${frequency.toFixed(0)}Hz, waveform: ${shape.waveformType}, filter: ${shape.filterType}, lfo: ${shape.lfoMode}`);
  }
  
  // Döda en nod
  killNode(shape) {
    console.log(`💀 Node dying at (${shape.x.toFixed(0)}, ${shape.y.toFixed(0)})`);
    
    // Fade ut ljud
    if (shape.gain) {
      shape.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1);
    }
    
    // Fade ut grafik
    if (shape.graphics) {
      this.tweens.add({
        targets: shape.graphics,
        alpha: 0,
        duration: 1000,
        ease: 'Sine.easeOut',
        onComplete: () => {
          // Cleanup
          if (shape.oscillator) {
            shape.oscillator.stop();
            shape.oscillator.disconnect();
          }
          if (shape.gain) shape.gain.disconnect();
          if (shape.graphics) shape.graphics.destroy();
          
          // Cleanup organic modulation
          if (shape.filterLfo) { shape.filterLfo.stop(); shape.filterLfo.disconnect(); }
          if (shape.pitchDrift) { shape.pitchDrift.stop(); shape.pitchDrift.disconnect(); }
          
          // Ta bort från array
          this.shapes = this.shapes.filter(s => s !== shape);
          delete this.nodeIsolationTime[shape.id];
        }
      });
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
      convolver.connect(this.audioContext.destination);
      this.reverbNode = convolver;
      
      console.log('Improved reverb initialized');
    } catch (error) {
      console.warn('Failed to initialize reverb, ignoring:', error);
      this.reverbNode = null;
    }
  }

  // Toggle Live-läge
  toggleLiveMode() {
    console.log('toggleLiveMode called, current isLive:', this.isLive);
    console.log('AudioContext state:', this.audioContext ? this.audioContext.state : 'no audioContext');
    console.log('Number of shapes:', this.shapes ? this.shapes.length : 0);
    
    this.isLive = !this.isLive;
    const liveButton = document.getElementById('liveButton');
    
    if (this.isLive) {
      console.log('Live mode activated');
      if (liveButton) {
        liveButton.style.background = '#00cc00';
        liveButton.textContent = 'LIVE ON';
      }
      
      // Säkerställ att AudioContext är igång
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('Resuming AudioContext...');
        this.audioContext.resume().then(() => {
          console.log('AudioContext resumed');
          this.startLiveTimer();
        });
      } else {
        this.startLiveTimer();
      }
    } else {
      console.log('Live mode deactivated');
      if (liveButton) {
        liveButton.style.background = '#333';
        liveButton.textContent = 'LIVE';
      }
      
      // Stoppa live-timer
      if (this.liveTimer) {
        clearInterval(this.liveTimer);
        this.liveTimer = null;
      }
    }
  }

  // Starta live-timer
  startLiveTimer() {
    console.log('Starting live timer...');
    
    // Starta live-timer som triggar soundscape regelbundet
    this.liveTimer = setInterval(() => {
      this.triggerLiveSoundscape();
    }, 4000); // Var 4:e sekund
    
    // Trigga direkt första gången
    this.triggerLiveSoundscape();
  }

  // Förbättrad triggerLiveSoundscape
  triggerLiveSoundscape() {
    console.log('triggerLiveSoundscape called');
    console.log('audioContext:', this.audioContext ? this.audioContext.state : 'null');
    console.log('isLive:', this.isLive, 'ambientModeActive:', this.ambientModeActive);
    console.log('shapes count:', this.shapes ? this.shapes.length : 0);
    
    try {
      if (!this.audioContext || this.audioContext.state !== 'running') {
        console.warn('Cannot trigger live soundscape: AudioContext not ready');
        return;
      }
      
      if (!this.isLive && !this.ambientModeActive) {
        console.warn('Cannot trigger live soundscape: Live/ambient mode not active');
        return;
      }
      
      // Säkerställ att reverb finns tillgänglig för ambient-läge
      if ((this.ambientModeActive || this.harmonicEnabled) && !this.reverbNode) {
        this.initializeReverb();
      }
      
      // LIVE-läge: Aktivera slumpmässiga noder med fade in/out
      if (this.shapes.length === 0) {
        console.warn('No shapes to trigger');
        return;
      }
      
      // Välj 1-3 slumpmässiga shapes att aktivera
      const numToActivate = Math.min(this.shapes.length, 1 + Math.floor(Math.random() * 3));
      const shuffled = [...this.shapes].sort(() => Math.random() - 0.5);
      const selectedShapes = shuffled.slice(0, numToActivate);
      
      console.log(`Live mode: Activating ${numToActivate} shapes`);
      
      selectedShapes.forEach((shape, index) => {
        if (!shape.gain) {
          console.warn('Shape has no gain node');
          return;
        }
        if (!shape.oscillator) {
          console.warn('Shape has no oscillator');
          return;
        }
        
        const targetVolume = (0.3 + Math.random() * 0.4) * this.masterVolume;
        
        console.log(`Activating shape: freq=${shape.frequency}, targetVolume=${targetVolume}, masterVolume=${this.masterVolume}`);
        console.log(`Current gain value: ${shape.gain.gain.value}`);
        
        // Direkt sätt volymen för att testa
        shape.gain.gain.value = targetVolume;
        
        // Schemalägg fade out efter 2-4 sekunder
        const duration = 2 + Math.random() * 2;
        setTimeout(() => {
          if (shape.gain) {
            shape.gain.gain.value = 0;
          }
        }, duration * 1000);
        
        console.log(`Set gain to ${targetVolume}, will fade out in ${duration}s`);
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

      // ECOSYSTEM-knapp
      const ecosystemButton = document.getElementById('ecosystemButton');
      if (ecosystemButton) {
        ecosystemButton.addEventListener('click', () => {
          if (!this.audioContext || this.audioContext.state !== 'running') {
            console.warn('AudioContext not ready - click Start Audio first');
            return;
          }
          this.toggleEcosystem();
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

    this.input.on('pointerdown', (pointer) => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext initialized');
        this.initializeReverb();
        
        // Initiera Magenta.js efter att AudioContext är redo
        this.initializeMagenta();
      } else if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('AudioContext resumed');
        });
      }
    });

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
      const clickRadius = 35; // Större klickradie för enklare träff
      
      if (this.input.keyboard.checkDown(this.input.keyboard.addKey('ENTER'))) {
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < clickRadius
        );
        if (clickedShape) {
          this.cycleWaveform(clickedShape);
          return;
        }
      } else if (this.input.keyboard.checkDown(this.input.keyboard.addKey('F'))) {
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < clickRadius
        );
        if (clickedShape) {
          this.cycleFilter(clickedShape);
          return;
        }
      } else if (this.input.keyboard.checkDown(this.input.keyboard.addKey('L'))) {
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < clickRadius
        );
        if (clickedShape) {
          this.cycleLFO(clickedShape);
          return;
        }
      } else if (this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) {
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < clickRadius
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
            if (clickedShape.customFilter) clickedShape.customFilter.disconnect();
            if (clickedShape.lfo) { clickedShape.lfo.stop(); clickedShape.lfo.disconnect(); }
            if (clickedShape.lfoGain) clickedShape.lfoGain.disconnect();
            if (clickedShape.tremoloGain) clickedShape.tremoloGain.disconnect();
            if (clickedShape.tremoloOffset) { clickedShape.tremoloOffset.stop(); clickedShape.tremoloOffset.disconnect(); }
            // Cleanup organic modulation
            if (clickedShape.filterLfo) { clickedShape.filterLfo.stop(); clickedShape.filterLfo.disconnect(); }
            if (clickedShape.filterLfoGain) clickedShape.filterLfoGain.disconnect();
            if (clickedShape.pitchDrift) { clickedShape.pitchDrift.stop(); clickedShape.pitchDrift.disconnect(); }
            if (clickedShape.pitchDriftGain) clickedShape.pitchDriftGain.disconnect();
            if (clickedShape.breathLfo) { clickedShape.breathLfo.stop(); clickedShape.breathLfo.disconnect(); }
            if (clickedShape.breathGain) clickedShape.breathGain.disconnect();
            if (clickedShape.waveformLabel) clickedShape.waveformLabel.destroy();
            if (clickedShape.filterLabel) clickedShape.filterLabel.destroy();
            if (clickedShape.lfoLabel) clickedShape.lfoLabel.destroy();
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
    this.input.keyboard.on('keydown-ENTER', () => {
      this.showWaveformLabels();
    });
    this.input.keyboard.on('keyup-ENTER', () => {
      this.hideWaveformLabels();
    });
    this.input.keyboard.on('keydown-F', () => {
      this.showFilterLabels();
    });
    this.input.keyboard.on('keyup-F', () => {
      this.hideFilterLabels();
    });
    this.input.keyboard.on('keydown-L', () => {
      this.showLFOLabels();
    });
    this.input.keyboard.on('keyup-L', () => {
      this.hideLFOLabels();
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

    sequence.forEach(note => {
      const shape = this.shapes[Math.floor(Math.random() * this.shapes.length)];
      if (shape && shape.oscillator) {
        const frequency = this.midiToFrequency(note.pitch);
        shape.oscillator.frequency.setTargetAtTime(frequency, this.audioContext.currentTime + note.startTime, 0.1);
        
        const duration = note.endTime - note.startTime;
        const volume = 0.3 * this.masterVolume;
        
        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
        shape.gain.gain.setTargetAtTime(volume, this.audioContext.currentTime + note.startTime, 0.1);
        shape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime + note.endTime, 0.1);
      }
    });
  }

  midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  placeShape(pointer, type) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext initialized on shape placement');
        this.initializeReverb();
      }
 
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      if (this.ecosystemEnabled) {
        const clickRadius = 35;
        const clickedShape = this.shapes.find(shape =>
          Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < clickRadius
        );
        if (clickedShape) {
          this.updateExistingShape(clickedShape, clickedShape.i, clickedShape.j);
          return;
        }
      }
  
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
      shape.oscillator = createOscillator(this.audioContext, frequency, this.getOscTypeForShape(shape.type, shape));
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
      
      // Om ekosystem är aktiverat, initiera orbit för nya noder
      console.log('placeShape: ecosystemEnabled =', this.ecosystemEnabled);
      if (this.ecosystemEnabled) {
        console.log('Initializing orbit for newly placed node');
        this.initializeOrbit(shape);
        // Aktivera ljud direkt
        if (shape.gain) {
          shape.gain.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
        }
      }
  
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
   
  // Vågformer som kan cyklas igenom
  waveformTypes = ['sine', 'triangle', 'sawtooth', 'square'];

  // ASCII-symboler för vågformer
  waveformSymbols = {
    'sine': '∿',      // Sinusvåg
    'triangle': '△',  // Triangelvåg
    'sawtooth': '⩘',  // Sågtandsvåg
    'square': '⊓'     // Fyrkantvåg
  };

  // Visa vågform-etiketter på alla shapes
  showWaveformLabels() {
    this.shapes.forEach(shape => {
      if (!shape.visible) return;
      
      const waveform = shape.waveformType || 'sine';
      const symbol = this.waveformSymbols[waveform] || '?';
      
      // Skapa text-etikett om den inte finns
      if (!shape.waveformLabel) {
        shape.waveformLabel = this.add.text(shape.x, shape.y - 35, symbol, {
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
      } else {
        shape.waveformLabel.setText(symbol);
        shape.waveformLabel.setPosition(shape.x, shape.y - 35);
        shape.waveformLabel.setVisible(true);
      }
    });
  }

  // Dölj vågform-etiketter
  hideWaveformLabels() {
    this.shapes.forEach(shape => {
      if (shape.waveformLabel) {
        shape.waveformLabel.setVisible(false);
      }
    });
  }

  // Filter-typer som kan cyklas igenom
  filterTypes = ['none', 'lowpass', 'highpass', 'bandpass'];

  // ASCII-symboler för filter
  filterSymbols = {
    'none': '○',       // Inget filter
    'lowpass': '▼',    // Lowpass (släpper igenom låga)
    'highpass': '▲',   // Highpass (släpper igenom höga)
    'bandpass': '◆'    // Bandpass (släpper igenom mitt)
  };

  // Visa filter-etiketter på alla shapes
  showFilterLabels() {
    this.shapes.forEach(shape => {
      if (!shape.visible) return;
      
      const filterType = shape.filterType || 'none';
      const symbol = this.filterSymbols[filterType] || '○';
      
      // Skapa text-etikett om den inte finns
      if (!shape.filterLabel) {
        shape.filterLabel = this.add.text(shape.x, shape.y - 35, symbol, {
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffcc00',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
      } else {
        shape.filterLabel.setText(symbol);
        shape.filterLabel.setPosition(shape.x, shape.y - 35);
        shape.filterLabel.setVisible(true);
      }
    });
  }

  // Dölj filter-etiketter
  hideFilterLabels() {
    this.shapes.forEach(shape => {
      if (shape.filterLabel) {
        shape.filterLabel.setVisible(false);
      }
    });
  }

  // Cykla filter för en shape
  cycleFilter(shape) {
    if (!shape || !this.audioContext) return;
    
    // Sätt default filter om det inte finns
    if (!shape.filterType) {
      shape.filterType = 'none';
    }
    
    // Hitta nästa filter i cykeln
    const currentIndex = this.filterTypes.indexOf(shape.filterType);
    const nextIndex = (currentIndex + 1) % this.filterTypes.length;
    shape.filterType = this.filterTypes[nextIndex];
    
    // Uppdatera audio-kedjan med nytt filter
    this.updateShapeFilter(shape);
    
    // Uppdatera etiketten om den visas
    if (shape.filterLabel && shape.filterLabel.visible) {
      const symbol = this.filterSymbols[shape.filterType] || '○';
      shape.filterLabel.setText(symbol);
    }
    
    console.log(`Shape filter changed to: ${shape.filterType}`);
  }

  // Uppdatera filter för en shape
  updateShapeFilter(shape) {
    if (!shape || !this.audioContext || !shape.oscillator || !shape.gain) return;
    
    try {
      // Oscillatorn från audioUtils har ett internt filter (shape.oscillator.filter)
      // Vi modifierar det interna filtret direkt för att ändra ljudet
      const internalFilter = shape.oscillator.filter;
      
      if (!internalFilter) {
        console.warn('No internal filter found on oscillator');
        return;
      }
      
      if (shape.filterType === 'none') {
        // Återställ till standard mjukt lowpass
        internalFilter.type = 'lowpass';
        internalFilter.frequency.value = 2000;
        internalFilter.Q.value = 0.5;
      } else if (shape.filterType === 'lowpass') {
        internalFilter.type = 'lowpass';
        internalFilter.frequency.value = 200; // Mycket lågt cutoff för mörkt ljud
        internalFilter.Q.value = 8;
      } else if (shape.filterType === 'highpass') {
        internalFilter.type = 'highpass';
        internalFilter.frequency.value = 600; // Högt cutoff för tunt ljud
        internalFilter.Q.value = 8;
      } else if (shape.filterType === 'bandpass') {
        internalFilter.type = 'bandpass';
        internalFilter.frequency.value = 350; // Mittfrekvens
        internalFilter.Q.value = 15; // Smal bandbredd för nasalt ljud
      }
    } catch (err) {
      console.error('Error updating shape filter:', err);
    }
  }

  // LFO-lägen som kan cyklas igenom
  lfoModes = ['none', 'vibrato', 'tremolo'];

  // ASCII-symboler för LFO
  lfoSymbols = {
    'none': '—',       // Ingen LFO
    'vibrato': '〰',   // Vibrato (frekvensmodulation)
    'tremolo': '⏦'    // Tremolo (volymmodulation)
  };

  // Visa LFO-etiketter på alla shapes
  showLFOLabels() {
    this.shapes.forEach(shape => {
      if (!shape.visible) return;
      
      const lfoMode = shape.lfoMode || 'none';
      const symbol = this.lfoSymbols[lfoMode] || '—';
      
      // Skapa text-etikett om den inte finns
      if (!shape.lfoLabel) {
        shape.lfoLabel = this.add.text(shape.x, shape.y - 35, symbol, {
          fontSize: '24px',
          fontFamily: 'Arial, sans-serif',
          color: '#00ffcc',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
      } else {
        shape.lfoLabel.setText(symbol);
        shape.lfoLabel.setPosition(shape.x, shape.y - 35);
        shape.lfoLabel.setVisible(true);
      }
    });
  }

  // Dölj LFO-etiketter
  hideLFOLabels() {
    this.shapes.forEach(shape => {
      if (shape.lfoLabel) {
        shape.lfoLabel.setVisible(false);
      }
    });
  }

  // Cykla LFO för en shape
  cycleLFO(shape) {
    if (!shape || !this.audioContext) return;
    
    // Sätt default LFO om det inte finns
    if (!shape.lfoMode) {
      shape.lfoMode = 'none';
    }
    
    // Hitta nästa LFO-läge i cykeln
    const currentIndex = this.lfoModes.indexOf(shape.lfoMode);
    const nextIndex = (currentIndex + 1) % this.lfoModes.length;
    shape.lfoMode = this.lfoModes[nextIndex];
    
    // Uppdatera LFO
    this.updateShapeLFO(shape);
    
    // Uppdatera etiketten om den visas
    if (shape.lfoLabel && shape.lfoLabel.visible) {
      const symbol = this.lfoSymbols[shape.lfoMode] || '—';
      shape.lfoLabel.setText(symbol);
    }
    
    console.log(`Shape LFO changed to: ${shape.lfoMode}`);
  }

  // Uppdatera LFO för en shape
  updateShapeLFO(shape) {
    if (!shape || !this.audioContext || !shape.oscillator || !shape.gain) return;
    
    try {
      // Stoppa och ta bort gammal LFO om den finns
      if (shape.lfo) {
        shape.lfo.stop();
        shape.lfo.disconnect();
        shape.lfo = null;
      }
      if (shape.lfoGain) {
        shape.lfoGain.disconnect();
        shape.lfoGain = null;
      }
      if (shape.tremoloGain) {
        shape.tremoloGain.disconnect();
        shape.tremoloGain = null;
      }
      if (shape.tremoloOffset) {
        shape.tremoloOffset.stop();
        shape.tremoloOffset.disconnect();
        shape.tremoloOffset = null;
        // Återställ audio-kedjan när tremolo stängs av
        shape.oscillator.disconnect();
        if (shape.customFilter) {
          shape.customFilter.disconnect();
          shape.oscillator.connect(shape.customFilter);
          shape.customFilter.connect(shape.gain);
        } else {
          shape.oscillator.connect(shape.gain);
        }
      }
      
      if (shape.lfoMode === 'none') {
        return;
      }
      
      // Skapa LFO oscillator
      shape.lfo = this.audioContext.createOscillator();
      shape.lfo.type = 'sine';
      shape.lfo.frequency.value = 5; // 5 Hz modulation
      
      // Skapa gain för LFO-djup
      shape.lfoGain = this.audioContext.createGain();
      
      if (shape.lfoMode === 'vibrato') {
        // Vibrato - modulera frekvens
        shape.lfoGain.gain.value = 20; // ±20 Hz variation (mer märkbart)
        shape.lfo.connect(shape.lfoGain);
        shape.lfoGain.connect(shape.oscillator.frequency);
      } else if (shape.lfoMode === 'tremolo') {
        // Tremolo - pulsera volymen genom att modulera gain direkt
        // LFO oscillerar mellan -1 och 1, vi skalar till 0.5-1.0 range
        shape.lfoGain.gain.value = 0.25; // Amplitud
        shape.lfo.connect(shape.lfoGain);
        
        // Skapa en konstant offset på 0.75 så volymen går 0.5-1.0
        shape.tremoloOffset = this.audioContext.createConstantSource();
        shape.tremoloOffset.offset.value = 0.75;
        
        // Skapa en gain-nod som multiplicerar signalen
        shape.tremoloGain = this.audioContext.createGain();
        shape.tremoloGain.gain.value = 0; // Börja på 0, styrs av LFO + offset
        
        // Koppla LFO och offset till tremoloGain
        shape.lfoGain.connect(shape.tremoloGain.gain);
        shape.tremoloOffset.connect(shape.tremoloGain.gain);
        shape.tremoloOffset.start();
        
        // Koppla om audio-kedjan: oscillator -> [filter] -> tremoloGain -> gain -> destination
        shape.oscillator.disconnect();
        if (shape.customFilter) {
          shape.customFilter.disconnect();
          shape.oscillator.connect(shape.customFilter);
          shape.customFilter.connect(shape.tremoloGain);
        } else {
          shape.oscillator.connect(shape.tremoloGain);
        }
        shape.tremoloGain.connect(shape.gain);
      }
      
      shape.lfo.start();
    } catch (err) {
      console.error('Error updating shape LFO:', err);
    }
  }

  // Cykla vågform för en shape
  cycleWaveform(shape) {
    if (!shape || !this.audioContext) return;
    
    // Sätt default waveform om den inte finns
    if (!shape.waveformType) {
      shape.waveformType = 'sine';
    }
    
    // Hitta nästa vågform i cykeln
    const currentIndex = this.waveformTypes.indexOf(shape.waveformType);
    const nextIndex = (currentIndex + 1) % this.waveformTypes.length;
    shape.waveformType = this.waveformTypes[nextIndex];
    
    // Uppdatera oscillatorn med ny vågform
    if (shape.oscillator) {
      shape.oscillator.type = shape.waveformType;
    }
    
    // Uppdatera etiketten om den visas
    if (shape.waveformLabel && shape.waveformLabel.visible) {
      const symbol = this.waveformSymbols[shape.waveformType] || '?';
      shape.waveformLabel.setText(symbol);
    }
    
    console.log(`Shape waveform changed to: ${shape.waveformType}`);
  }

  // Hjälpmetod för att få oscillatortyp baserat på form
  getOscTypeForShape(type, shape) {
    // Om shape har en custom waveform, använd den
    if (shape && shape.waveformType) {
      return shape.waveformType;
    }
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
      shape.oscillator = createOscillator(this.audioContext, shape.frequency, this.getOscTypeForShape(shape.type, shape));
      
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
