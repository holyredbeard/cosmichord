/*
This application is an innovative ambient music sequencer that combines geometric shapes, physics, and sound generation.
- The user can place shapes (circle, triangle, square) on a 10x10 grid by clicking on the canvas.
- Each shape represents a different ambient sound: circles (220 Hz), triangles (330 Hz), squares (440 Hz), forming a harmonious chord.
- Physics-based particles bounce around the screen, and when they come near a shape, the associated sound's volume increases based on proximity, creating a smooth, evolving soundscape.
- The shapes cycle through types (circle -> triangle -> square -> remove) with subsequent clicks on the same grid cell.
- The result is a simple yet dynamic ambient music experience that is visually engaging and potentially viral due to its creative approach.
*/

class Example extends Phaser.Scene {
    constructor() {
        super();
    }

    create() {
        // Add logo to top left
        const logoImg = document.createElement('img');
        logoImg.src = 'https://play.rosebud.ai/assets/logo.png?rVBU';
        logoImg.style.position = 'absolute';
        logoImg.style.top = '40px';
        logoImg.style.left = '30px';
        logoImg.style.width = '140px';
        logoImg.style.height = 'auto';
        logoImg.style.zIndex = '1000';
        logoImg.style.transition = 'transform 0.3s ease-in-out';
        logoImg.id = 'logoImg'; // Add ID for easier reference
        document.getElementById('renderDiv').appendChild(logoImg);

        // Initialize master volume
        this.masterVolume = 0.3; // Lowered to prevent clipping from loud volumes
        this.audioContext = new AudioContext();
        this.shapes = []; // Initialize shapes array at the beginning
        // Create graphics for particle lines with lower depth
        this.connectionGraphics = this.add.graphics({
            lineStyle: {
                width: 4
            }
        });
        this.connectionGraphics.setDepth(0); // Set lower depth for lines

        // Particle settings
        this.particleSpeed = 1.5;
        this.particleCount = 20;
        this.panEnabled = false; // Track pan state
        this.harmonicEnabled = false;
        this.isLive = false;
        this.isPaused = false;
        this.liveTimer = null;

        // Slider and save button container setup
        const sliderContainer = document.createElement('div');
        sliderContainer.id = 'sliderContainer'; // Add ID for easier reference
        sliderContainer.style.position = 'absolute';
        sliderContainer.style.top = '150px';
        sliderContainer.style.left = '30px';
        sliderContainer.style.display = 'flex';
        sliderContainer.style.flexDirection = 'column';
        sliderContainer.style.gap = '25px';
        sliderContainer.style.zIndex = '1000';
        sliderContainer.style.transition = 'transform 0.3s ease-in-out';
        document.getElementById('renderDiv').appendChild(sliderContainer);

        const sliderStyles = document.createElement('style');
        sliderStyles.textContent = `
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
        document.head.appendChild(sliderStyles);

        // Particle count slider
        const particleCountContainer = document.createElement('div');
        particleCountContainer.style.display = 'flex';
        particleCountContainer.style.flexDirection = 'column';
        particleCountContainer.style.alignItems = 'flex-start';
        particleCountContainer.innerHTML = `
      <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Particles: <span id="particleCount">20</span></label>
      <input type="range" min="5" max="50" value="20" id="particleSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
    `;
        sliderContainer.appendChild(particleCountContainer);

        // Speed slider
        const speedContainer = document.createElement('div');
        speedContainer.style.display = 'flex';
        speedContainer.style.flexDirection = 'column';
        speedContainer.style.alignItems = 'flex-start';
        speedContainer.innerHTML = `
      <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Speed: <span id="speedValue">1.5</span></label>
      <input type="range" min="0.1" max="5" value="1.5" step="0.1" id="speedSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
    `;
        sliderContainer.appendChild(speedContainer);

        // Volume slider
        const volumeContainer = document.createElement('div');
        volumeContainer.style.display = 'flex';
        volumeContainer.style.flexDirection = 'column';
        volumeContainer.style.alignItems = 'flex-start';
        volumeContainer.innerHTML = `
      <label style="color: white; margin-right: 10px; margin-bottom: 8px; font-family: Arial; letter-spacing: 1px;">Volume: <span id="volumeValue">0.3</span></label>
      <input type="range" min="0" max="0.5" value="0.3" step="0.1" id="volumeSlider" style="width: 150px; cursor: grab; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; outline: none;">
    `;
        sliderContainer.appendChild(volumeContainer);

        // Blend toggle
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

        // Pan toggle
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

        // New chord slider
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

        // Random and live buttons
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

        // Add live functionality
        this.isLive = false;
        this.liveTimer = null;
        document.getElementById('liveButton').addEventListener('click', () => {
            this.isLive = !this.isLive;
            const liveButton = document.getElementById('liveButton');
            liveButton.textContent = this.isLive ? 'STOP' : 'LIVE';
            liveButton.style.background = this.isLive ? '#cc0000' : '#333';
            if (this.isLive) {
                this.liveTimer = this.time.addEvent({
                    delay: Math.max(3000, 10000 * Math.pow(1.5 / this.particleSpeed, 2)), // Slower at low speeds, faster at high speeds
                    callback: () => {
                        let isModifyingShape = false; // Track if we're modifying a shape to ensure only one at a time

                        // Randomly decide to add or remove shapes (40% chance, but only one shape at a time)
                        if (!isModifyingShape && Math.random() < 0.4) {
                            isModifyingShape = true;
                            if (Math.random() < 0.5 && this.shapes.length < 15) { // Add one shape
                                const shapeTypes = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
                                let randomI, randomJ, isPositionFree;
                                do {
                                    randomI = Math.floor(Math.random() * this.gridCols);
                                    randomJ = Math.floor(Math.random() * this.gridRows);
                                    isPositionFree = !this.shapes.some(shape => shape.i === randomI && shape.j === randomJ);
                                } while (!isPositionFree);
                                const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
                                const mockPointer = {
                                    x: randomI * this.gridSize + this.gridSize / 2,
                                    y: randomJ * this.gridSize + this.gridSize / 2
                                };
                                this.placeShape(mockPointer, randomType);
                            } else if (this.shapes.length > 2) { // Remove one shape
                                const shapesToRemove = Phaser.Utils.Array.Shuffle(this.shapes.slice()).slice(0, 1); // Only remove one
                                shapesToRemove.forEach(shape => {
                                    shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                                    shape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
                                    setTimeout(() => {
                                        shape.graphics.destroy();
                                        shape.oscillator.stop();
                                        shape.oscillator.disconnect();
                                        shape.gain.disconnect();
                                        if (shape.stereoPanner) shape.stereoPanner.disconnect();
                                        this.shapes = this.shapes.filter(s => s !== shape);
                                    }, 200);
                                });
                            }
                        }

                        // Update existing shapes with low probability (5% chance per shape to change)
                        this.shapes.forEach(shape => {
                            if (!isModifyingShape && Math.random() < 0.05) { // Reduced to 5% for rarity
                                isModifyingShape = true;
                                const gridOffsetI = Phaser.Math.Between(-1, 1);
                                const gridOffsetJ = Phaser.Math.Between(-1, 1);
                                const targetI = Math.max(0, Math.min(this.gridCols - 1, shape.i + gridOffsetI));
                                const targetJ = Math.max(0, Math.min(this.gridRows - 1, shape.j + gridOffsetJ));
                                const gridAlignedX = targetI * this.gridSize + this.gridSize / 2;
                                const gridAlignedY = targetJ * this.gridSize + this.gridSize / 2;

                                const baseDuration = 8000;
                                const speedFactor = Math.pow(1.5 / this.particleSpeed, 2);
                                const duration = Math.max(2000, baseDuration * speedFactor); // Slower at low speeds, faster at high

                                if (shape.currentTween) shape.currentTween.stop();
                                shape.currentTween = this.tweens.add({
                                    targets: shape.graphics,
                                    x: gridAlignedX,
                                    y: gridAlignedY,
                                    duration,
                                    ease: 'Sine.easeInOut',
                                    onUpdate: () => {
                                        shape.x = shape.graphics.x;
                                        shape.y = shape.graphics.y;
                                    },
                                    onComplete: () => {
                                        shape.x = gridAlignedX;
                                        shape.y = gridAlignedY;
                                        shape.i = targetI;
                                        shape.j = targetJ;
                                        shape.currentTween = null;
                                    }
                                });

                                // Change color and type with low probability
                                const colors = [0xff0000, 0xffff00, 0x00ff00, 0x0000ff, 0x800080, 0xFFA500];
                                const types = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
                                const currentIndex = types.indexOf(shape.type);
                                const nextIndex = (currentIndex + 1) % types.length;

                                // Fade out
                                shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                                shape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.5);

                                const colorChangeDelay = Math.max(1000, 5000 * Math.pow(1.5 / this.particleSpeed, 2));
                                setTimeout(() => {
                                    shape.type = types[nextIndex];
                                    shape.frequency = this.defaultFrequencies[nextIndex];
                                    shape.graphics.clear();
                                    shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
                                    shape.graphics.fillStyle(colors[nextIndex], 0.3).fillCircle(0, 0, 25);
                                    shape.graphics.fillStyle(colors[nextIndex], 1).fillCircle(0, 0, 20);
                                    shape.oscillator.frequency.setTargetAtTime(shape.frequency, this.audioContext.currentTime, 0.1);
                                    shape.gain.gain.setTargetAtTime(
                                        shape.baseVolume * this.masterVolume * (shape.frequency <= 110 ? 1.5 : 1),
                                        this.audioContext.currentTime, 0.5
                                    );
                                }, colorChangeDelay);
                            }
                        });
                    },
                    loop: true
                });
            } else {
                // Stop live animation
                if (this.liveTimer) {
                    this.liveTimer.remove();
                    this.liveTimer = null;
                }
            }
        });

        // Add random functionality
        document.getElementById('randomButton').addEventListener('click', () => {
            // Clear existing shapes
            this.shapes.forEach(shape => {
                shape.graphics.destroy();
                shape.oscillator.stop();
                shape.oscillator.disconnect();
                shape.gain.disconnect();
                if (shape.stereoPanner) shape.stereoPanner.disconnect();
            });
            this.shapes = [];
            // Randomize chord
            const randomChord = Math.floor(Math.random() * 6);
            document.getElementById('chordSlider').value = randomChord;
            document.getElementById('chordSlider').dispatchEvent(new Event('input'));
            // Randomize particle count (between 10 and 40)
            const randomParticles = Math.floor(Math.random() * 31) + 10;
            this.particleCount = randomParticles;
            document.getElementById('particleCount').textContent = randomParticles;
            document.getElementById('particleSlider').value = randomParticles;
            this.updateParticleCount(randomParticles);
            // Randomize speed (between 0.5 and 3)
            const randomSpeed = (Math.random() * 2.5 + 0.5).toFixed(1);
            this.particleSpeed = parseFloat(randomSpeed);
            document.getElementById('speedValue').textContent = randomSpeed;
            document.getElementById('speedSlider').value = randomSpeed;
            // Create random pattern of shapes
            const shapeTypes = ['circle', 'yellowTriangle', 'triangle', 'square', 'purpleSquare', 'orangeSquare'];
            const numShapes = Math.floor(Math.random() * 8) + 3; // 3-10 shapes
            for (let n = 0; n < numShapes; n++) {
                const i = Math.floor(Math.random() * this.gridCols);
                const j = Math.floor(Math.random() * this.gridRows);
                const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

                // Create a mock pointer event for the placeShape method
                const mockPointer = {
                    x: i * this.gridSize + this.gridSize / 2,
                    y: j * this.gridSize + this.gridSize / 2
                };

                this.placeShape(mockPointer, randomType);
            }
        });

        // Reset and pause buttons
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

        // Add pause functionality
        this.isPaused = false;
        document.getElementById('pauseButton').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            const pauseButton = document.getElementById('pauseButton');
            pauseButton.textContent = this.isPaused ? 'RESUME' : 'PAUSE';
            pauseButton.style.background = this.isPaused ? '#cc0000' : '#333';
            if (this.isPaused) {
                // Pause all audio
                this.shapes.forEach(shape => {
                    if (shape.gain) {
                        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                        shape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
                    }
                });
                // Pause all particles
                this.particles.forEach(particle => {
                    particle.savedVelocity = {
                        x: particle.body.velocity.x,
                        y: particle.body.velocity.y
                    };
                    particle.setVelocity(0, 0);
                    particle.body.isStatic = true;
                });
            } else {
                // Resume all audio
                this.shapes.forEach(shape => {
                    if (shape.gain) {
                        const targetVolume = shape.baseVolume * this.masterVolume * (shape.frequency <= 110 ? 1.5 : 1);
                        shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                        shape.gain.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.01);
                    }
                });
                // Resume all particles
                this.particles.forEach(particle => {
                    particle.body.isStatic = false;
                    if (particle.savedVelocity) {
                        particle.setVelocity(particle.savedVelocity.x, particle.savedVelocity.y);
                    } else {
                        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                        particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
                    }
                });
            }
        });

        // Add reset functionality
        document.getElementById('resetButton').addEventListener('click', () => {
            // Clear all shapes
            this.shapes.forEach(shape => {
                shape.graphics.destroy();
                shape.oscillator.stop();
                shape.oscillator.disconnect();
                shape.gain.disconnect();
                if (shape.stereoPanner) shape.stereoPanner.disconnect();
            });
            this.shapes = [];
            // Reset all settings to default values
            this.particleCount = 20;
            this.particleSpeed = 1.5;
            this.masterVolume = 0.3;
            this.harmonicEnabled = false;
            this.panEnabled = false;
            this.isPaused = false;
            this.isLive = false;
            if (this.liveTimer) {
                this.liveTimer.remove();
                this.liveTimer = null;
            }
            // Reset live button
            const liveButton = document.getElementById('liveButton');
            liveButton.textContent = 'LIVE';
            liveButton.style.background = '#333';
            this.defaultFrequencies = this.chordColors[0].frequencies;
            // Reset pause button
            const pauseButton = document.getElementById('pauseButton');
            pauseButton.textContent = 'PAUSE';
            pauseButton.style.background = '#333';
            // Update UI elements
            document.getElementById('particleCount').textContent = this.particleCount;
            document.getElementById('speedValue').textContent = this.particleSpeed;
            document.getElementById('volumeValue').textContent = this.masterVolume;
            document.getElementById('particleSlider').value = this.particleCount;
            document.getElementById('speedSlider').value = this.particleSpeed;
            document.getElementById('volumeSlider').value = this.masterVolume;
            document.getElementById('chordSlider').value = 0;
            document.getElementById('chordValue').textContent = this.chordColors[0].label;
            document.getElementById('chordSlider').style.setProperty('--thumb-color', this.chordColors[0].color);
            document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${this.chordColors[0].key}"`);
            // Reset blend and pan buttons
            const blendButton = document.getElementById('blendToggle');
            blendButton.textContent = 'Off';
            blendButton.style.background = '#333';
            const panButton = document.getElementById('panToggle');
            panButton.textContent = 'Off';
            panButton.style.background = '#333';
            // Update particle count
            this.updateParticleCount(this.particleCount);
        });

        // Save button
        const saveContainer = document.createElement('div');
        saveContainer.style.display = 'flex';
        saveContainer.style.flexDirection = 'column';
        saveContainer.style.alignItems = 'flex-start';
        saveContainer.style.marginTop = '15px';
        saveContainer.innerHTML = `
      <button id="saveConfig">Save & Share</button>
    `;
        sliderContainer.appendChild(saveContainer);

        // Hide/Show toggle button
        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggleMenu';
        toggleButton.style.position = 'absolute';
        toggleButton.style.bottom = '30px';
        toggleButton.style.left = '30px';
        toggleButton.style.width = '50px';
        toggleButton.style.zIndex = '1001'; // Ensure button is always on top
        toggleButton.style.transition = 'transform 0.3s ease-in-out'; // Smooth transition
        toggleButton.style.background = '#333';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.padding = '8px 15px';
        toggleButton.style.borderRadius = '4px';
        toggleButton.style.fontFamily = 'Arial';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.transition = 'transform 0.3s ease';
        toggleButton.style.zIndex = '1001';
        toggleButton.innerHTML = '<span style="display: inline-block; width: 30px; text-align: center; font-size: 18px;">←</span>';
        document.getElementById('renderDiv').appendChild(toggleButton);

        // Hide/Show functionality
        let isMenuVisible = true;
        document.getElementById('toggleMenu').addEventListener('click', () => {
            isMenuVisible = !isMenuVisible;
            const toggleButton = document.getElementById('toggleMenu');
            const sliderContainer = document.getElementById('sliderContainer');
            const logoImg = document.getElementById('logoImg');

            if (isMenuVisible) {
                sliderContainer.style.transform = '';
                logoImg.style.transform = '';
                toggleButton.style.transform = '';
                toggleButton.innerHTML = '<span style="display: inline-block; width: 30px; text-align: center; font-size: 18px;">←</span>';
            } else {
                sliderContainer.style.transform = 'translateX(-200px)';
                logoImg.style.transform = 'translateX(-200px)';
                toggleButton.style.transform = 'translateX(-20px)';
                toggleButton.innerHTML = '<span style="display: inline-block; width: 30px; text-align: center; font-size: 18px;">→</span>';
            }
        });

        this.harmonicEnabled = false;
        document.getElementById('blendToggle').addEventListener('click', (e) => {
            this.harmonicEnabled = !this.harmonicEnabled;
            e.target.textContent = this.harmonicEnabled ? 'On' : 'Off';
            e.target.style.background = this.harmonicEnabled ? '#00cc00' : '#333';
            e.target.style.width = '60px';
        });

        // Pan toggle functionality
        document.getElementById('panToggle').addEventListener('click', (e) => {
            this.panEnabled = !this.panEnabled;
            e.target.textContent = this.panEnabled ? 'On' : 'Off';
            e.target.style.background = this.panEnabled ? '#2ecc71' : '#333';
            e.target.style.width = '60px';

            this.shapes.forEach(shape => {
                if (shape.stereoPanner) {
                    const targetPan = this.panEnabled ? this.calculatePan(shape.i) : 0; // Pan to position or center
                    shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
                    shape.stereoPanner.pan.setTargetAtTime(targetPan, this.audioContext.currentTime, 0.2); // Smooth slide over 200ms
                }
            });
        });

        // Chord slider functionality
        const chordSlider = document.getElementById('chordSlider');
        const chordValue = document.getElementById('chordValue');
        const chordColors = {
            0: {
                color: 'white',
                label: 'Celestial',
                frequencies: [55, 220, 330, 440, 550, 660],
                key: '1'
            }, // A-major skala med bas (A1, A3, E4, A4, C#5, E5)
            1: {
                color: 'blue',
                label: 'Mystical',
                frequencies: [55, 220, 261.63, 330, 392, 466.16],
                key: '2'
            }, // A-minor pentatonisk med bas (A1, A3, C4, E4, G4, A#4)
            2: {
                color: 'green',
                label: 'Minor',
                frequencies: [55, 220, 261.63, 293.66, 349.23, 415.30],
                key: '3'
            }, // A-minor skala med bas (A1, A3, C4, D4, F4, G4)
            3: {
                color: 'red',
                label: 'Bright',
                frequencies: [55, 220, 277.18, 329.63, 415.30, 493.88],
                key: '4'
            }, // A-major skala med bas (A1, A3, C#4, E4, G#4, B4)
            4: {
                color: 'orange',
                label: 'Dreamy',
                frequencies: [55, 220, 246.94, 293.66, 369.99, 440],
                key: '5'
            }, // A-lydian skala med bas (A1, A3, B3, D4, F#4, A4)
            5: {
                color: 'purple',
                label: 'Dark',
                frequencies: [55, 220, 261.63, 311.13, 369.99, 466.16],
                key: '6'
            }, // A-phrygian skala med bas (A1, A3, C4, D#4, F#4, A#4)
        };

        this.chordColors = chordColors; // Store chordColors as a class property

        chordSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const {
                color,
                label,
                frequencies,
                key
            } = this.chordColors[value];
            const textColors = {
                'Celestial': '#0000ff', // Blue
                'Mystical': '#800080', // Purple
                'Minor': '#FFA500', // Orange
                'Bright': '#ffff00', // Yellow
                'Dreamy': '#00ff00', // Green
                'Dark': '#ff0000' // Red
            };
            chordValue.textContent = label;
            chordValue.style.color = textColors[label];
            // Update thumb color and text
            chordSlider.style.setProperty('--thumb-color', color);
            chordSlider.style.setProperty('--thumb-text', `"${key}"`);
            // Apply new frequencies to existing shapes
            this.shapes.forEach((shape, index) => {
                if (index < frequencies.length) {
                    shape.frequency = frequencies[index];
                    shape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime);
                    shape.oscillator.frequency.setTargetAtTime(shape.frequency, this.audioContext.currentTime, 0.1);
                }
            });
            // Update default frequencies for new shapes
            this.defaultFrequencies = frequencies;
        });

        // Set initial chord
        this.defaultFrequencies = chordColors[0].frequencies; // Default harmonisk skala
        chordSlider.dispatchEvent(new Event('input')); // Trigger initial update

        // Boost base note volume slightly to ensure it's audible
        this.shapes.forEach(shape => {
            if (shape.frequency <= 110) { // If it's a basenote (e.g., 55 Hz or 110 Hz)
                shape.gain.gain.setTargetAtTime(shape.baseVolume * this.masterVolume * 1.5, this.audioContext.currentTime, 0.05);
            }
        });

        // Keyboard controls for chord changes, blend toggle, and pan toggle
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
        this.input.keyboard.on('keydown', (event) => {
            // Handle 1-6 keys for shape type selection only
            const keyToShapeType = {
                '1': 'circle',
                '2': 'yellowTriangle',
                '3': 'triangle',
                '4': 'square',
                '5': 'purpleSquare',
                '6': 'orangeSquare'
            };
            const pressedKey = event.key;
            if (keyToShapeType.hasOwnProperty(pressedKey)) {
                this.selectedNoteType = keyToShapeType[pressedKey];
                console.log('Selected note type:', this.selectedNoteType);
            }
        });

        document.getElementById('particleSlider').addEventListener('input', (e) => {
            const newCount = parseInt(e.target.value);
            document.getElementById('particleCount').textContent = newCount;
            this.updateParticleCount(newCount);
        });

        document.getElementById('speedSlider').addEventListener('input', (e) => {
            this.particleSpeed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = this.particleSpeed;
        });

        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.masterVolume = parseFloat(e.target.value);
            document.getElementById('volumeValue').textContent = this.masterVolume;
            this.shapes.forEach(shape => {
                if (shape.gain) {
                    const targetVolume = shape.baseVolume * this.masterVolume * (shape.frequency <= 110 ? 1.5 : 1); // Boost basenotes
                    shape.currentVolume = targetVolume;
                    shape.gain.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.01);
                }
            });
        });

        // Save and share functionality
        document.getElementById('saveConfig').addEventListener('click', () => {
            const config = this.saveConfiguration();
            const encodedConfig = btoa(JSON.stringify(config));
            const shareLink = `${window.location.origin}${window.location.pathname}?config=${encodedConfig}`;
            alert(`Copy this link to share your configuration:\n${shareLink}`);
            navigator.clipboard.writeText(shareLink).then(() => {
                console.log('Link copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy link:', err);
            });
        });

        // Load configuration from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const configParam = urlParams.get('config');
        if (configParam) {
            try {
                const decodedConfig = JSON.parse(atob(configParam));
                this.loadConfiguration(decodedConfig);
            } catch (error) {
                console.error('Invalid configuration in URL:', error);
            }
        }

        this.input.once('pointerdown', () => this.audioContext.resume());
        this.cameras.main.setBackgroundColor('#000000');

        // Grid setup (symmetriskt 60x60 pixlar per cell för 10x10 grid)
        this.gridSize = 60;
        this.gridCols = 10;
        this.gridRows = 10;
        this.shapes = [];

        // Particle texture
        const particleGraphics = this.add.graphics();
        particleGraphics.fillStyle(0xffffff);
        particleGraphics.fillCircle(5, 5, 5);
        particleGraphics.generateTexture('particle', 10, 10);
        particleGraphics.destroy();

        // Create particles
        this.particles = [];
        for (let k = 0; k < this.particleCount; k++) {
            const x = Phaser.Math.Between(30, 570);
            const y = Phaser.Math.Between(30, 570);
            const particle = this.add.sprite(x, y, 'particle');
            this.matter.add.gameObject(particle, {
                friction: 0,
                frictionAir: 0,
                restitution: 1,
                mass: 1,
                shape: {
                    type: 'circle',
                    radius: 5
                }
            });
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
            this.particles.push(particle);
        }

        // Dragging setup
        this.draggedShape = null;
        this.isDragging = false;

        // Store the current note type when using number keys
        this.selectedNoteType = null;

        this.input.keyboard.on('keydown-SHIFT', () => {
            document.getElementById('renderDiv').style.cursor = 'grab';
        });
        // Add keyboard listeners for number keys 1-6
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
                    0: {
                        color: '#ff0000',
                        type: 'circle'
                    }, // Red
                    1: {
                        color: '#ffff00',
                        type: 'yellowTriangle'
                    }, // Yellow
                    2: {
                        color: '#00ff00',
                        type: 'triangle'
                    }, // Green
                    3: {
                        color: '#0000ff',
                        type: 'square'
                    }, // Blue
                    4: {
                        color: '#800080',
                        type: 'purpleSquare'
                    }, // Purple
                    5: {
                        color: '#FFA500',
                        type: 'orangeSquare'
                    } // Orange
                };

                const type = colors[index].type;
                this.selectedNoteType = type;
                console.log('Selected note type from color:', type);
                customCursor.style.backgroundColor = `${colors[index].color}40`; // More transparent
                customCursor.style.border = `2px solid ${colors[index].color}`;
                customCursor.style.boxShadow = `0 0 10px ${colors[index].color}80`; // Subtle glow
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
        // X key for deletion cursor
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

        this.input.on('pointerdown', (pointer) => {
            if (this.input.keyboard.checkDown(this.input.keyboard.addKey('X'))) {
                const clickedShape = this.shapes.find(shape =>
                    Phaser.Math.Distance.Between(pointer.x, pointer.y, shape.x, shape.y) < 25
                );
                if (clickedShape) {
                    // Fade out and remove the shape
                    clickedShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                    clickedShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);

                    // Clean up after brief fade out
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

                // Smooth volume adjustment during drag to prevent clicks
                if (this.draggedShape.gain) {
                    this.draggedShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                    this.draggedShape.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01); // Brief fade out
                    this.draggedShape.gain.gain.setTargetAtTime(this.draggedShape.baseVolume * this.masterVolume * (this.draggedShape.frequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + 0.01, 0.05); // Fade back in with basenote boost

                    // Update pan if pan is enabled
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

        // Matter physics bounds
        this.matter.world.setBounds(0, 0, 600, 600, 32, true, true, false, true);
    }

    placeShape(pointer, selectedType = null) {
        const i = Math.floor(pointer.x / this.gridSize);
        const j = Math.floor(pointer.y / this.gridSize);
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
                                color = 0xff0000;
                                break;
                            case 'yellowTriangle':
                                newFrequency = this.defaultFrequencies[1];
                                color = 0xffff00;
                                break;
                            case 'triangle':
                                newFrequency = this.defaultFrequencies[2];
                                color = 0x00ff00;
                                break;
                            case 'square':
                                newFrequency = this.defaultFrequencies[3];
                                color = 0x0000ff;
                                break;
                            case 'purpleSquare':
                                newFrequency = this.defaultFrequencies[4];
                                color = 0x800080;
                                break;
                            case 'orangeSquare':
                                newFrequency = this.defaultFrequencies[5];
                                color = 0xFFA500;
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
                    case 'circle':
                        newType = 'yellowTriangle';
                        newFrequency = this.defaultFrequencies[1] || 220;
                        color = 0xffff00;
                        break;
                    case 'yellowTriangle':
                        newType = 'triangle';
                        newFrequency = this.defaultFrequencies[2] || 330;
                        color = 0x00ff00;
                        break;
                    case 'triangle':
                        newType = 'square';
                        newFrequency = this.defaultFrequencies[3] || 440;
                        color = 0x0000ff;
                        break;
                    case 'square':
                        newType = 'purpleSquare';
                        newFrequency = this.defaultFrequencies[4] || 110;
                        color = 0x800080;
                        break;
                    case 'purpleSquare':
                        newType = 'orangeSquare';
                        newFrequency = this.defaultFrequencies[5] || 55;
                        color = 0xFFA500;
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

                    // Smooth frequency transition
                    existingShape.oscillator.frequency.cancelScheduledValues(this.audioContext.currentTime);
                    existingShape.oscillator.frequency.setTargetAtTime(newFrequency, this.audioContext.currentTime, 0.1);

                    // Smooth fade back in
                    existingShape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                    existingShape.gain.gain.setTargetAtTime(existingShape.baseVolume * this.masterVolume * (newFrequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + fadeOutTime, 0.1);

                    // Update pan if pan is enabled
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
                // If a type was selected via number keys
                type = selectedType;
                console.log('Placing shape with type:', type);
                switch (type) {
                    case 'circle':
                        frequency = this.defaultFrequencies[0];
                        color = 0xff0000;
                        break;
                    case 'yellowTriangle':
                        frequency = this.defaultFrequencies[1];
                        color = 0xffff00;
                        break;
                    case 'triangle':
                        frequency = this.defaultFrequencies[2];
                        color = 0x00ff00;
                        break;
                    case 'square':
                        frequency = this.defaultFrequencies[3];
                        color = 0x0000ff;
                        break;
                    case 'purpleSquare':
                        frequency = this.defaultFrequencies[4];
                        color = 0x800080;
                        break;
                    case 'orangeSquare':
                        frequency = this.defaultFrequencies[5];
                        color = 0xFFA500;
                        break;
                }
            } else {
                // Default behavior (start with red circle)
                type = 'circle';
                frequency = this.defaultFrequencies[0];
                color = 0xff0000;
            }
            const graphics = this.add.graphics({
                x,
                y
            });
            graphics.setDepth(1); // Ensure shapes are rendered above particle lines
            graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
            graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
            graphics.fillStyle(color, 1).fillCircle(0, 0, 20);

            const oscillator = this.audioContext.createOscillator();
            oscillator.type = 'sine';
            if (isFinite(frequency)) {
                oscillator.frequency.setValueAtTime(frequency || 440, this.audioContext.currentTime);
            } else {
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                console.error('Invalid frequency:', frequency);
            }
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0, 0); // Start silent
            const stereoPanner = this.audioContext.createStereoPanner();
            oscillator.connect(gain);
            gain.connect(stereoPanner);
            stereoPanner.connect(this.audioContext.destination);
            oscillator.start();

            // Set initial pan (centered if pan is off)
            const initialPan = this.panEnabled ? this.calculatePan(i) : 0;
            stereoPanner.pan.setValueAtTime(initialPan, this.audioContext.currentTime);

            // Smooth fade-in for new shapes, with basenote boost if applicable
            gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0);
            gain.gain.setTargetAtTime(0.01 * (frequency <= 110 ? 1.5 : 1), this.audioContext.currentTime + 0.01, 0.1); // Longer fade-in with basenote boost

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
                baseVolume: 0
            });
        }
    }

    update() {
        // Clear and reset connection graphics
        this.connectionGraphics.clear();
        this.connectionGraphics.lineStyle(4, 0xffffff, 1);
        // Ensure shapes are properly positioned
        this.shapes.forEach(shape => {
            if (!shape.currentTween && shape.graphics) {
                // If no tween is active, ensure graphics match shape position
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
                const vx = this.particleSpeed * Math.cos(angle);
                const vy = this.particleSpeed * Math.sin(angle);
                particle.setVelocity(vx, vy);
            }
            // Ensure constant speed
            else if (Math.abs(speed - this.particleSpeed) > 0.1) {
                const scale = this.particleSpeed / speed;
                particle.setVelocity(velocity.x * scale, velocity.y * scale);
            }

            // Bounce off walls
            if (particle.x < 30) particle.setVelocityX(Math.abs(velocity.x));
            if (particle.x > 570) particle.setVelocityX(-Math.abs(velocity.x));
            if (particle.y < 30) particle.setVelocityY(Math.abs(velocity.y));
            if (particle.y > 570) particle.setVelocityY(-Math.abs(velocity.y));
            if (particle.x < 0) particle.setVelocityX(Math.abs(velocity.x));
            if (particle.x > 600) particle.setVelocityX(-Math.abs(velocity.x));
            if (particle.y < 0) particle.setVelocityY(Math.abs(velocity.y));
            if (particle.y > 600) particle.setVelocityY(-Math.abs(velocity.y));
        });

        // Initialize direct shape connections tracking
        const directConnections = new Map();

        // Track shapes and their connections for color blending
        const shapeConnections = new Map();
        this.shapes.forEach(shape => {
            shapeConnections.set(shape, new Set());
        });

        // Find direct connections through particles
        this.particles.forEach(particle => {
            const connectedShapes = this.shapes.filter(shape => {
                const dist = Phaser.Math.Distance.Between(particle.x, particle.y, shape.x, shape.y);
                return dist < 25; // Only consider very close connections
            });

            // If a particle connects exactly 2 shapes, create a connection for color blending
            if (connectedShapes.length === 2) {
                const [shape1, shape2] = connectedShapes;
                shapeConnections.get(shape1).add(shape2);
                shapeConnections.get(shape2).add(shape1);
                // Color blending between connected shapes
                const color1 = this.getShapeColor(shape1.type);
                const color2 = this.getShapeColor(shape2.type);

                // Convert hex colors to RGB
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

                // Calculate blended color
                const blendedRgb = {
                    r: Math.round((rgb1.r + rgb2.r) / 2),
                    g: Math.round((rgb1.g + rgb2.g) / 2),
                    b: Math.round((rgb1.b + rgb2.b) / 2)
                };

                // Convert back to hex
                const blendedColor = (blendedRgb.r << 16) + (blendedRgb.g << 8) + blendedRgb.b;

                // Update graphics for both shapes with blended color
                shape1.graphics.clear();
                shape2.graphics.clear();

                // Draw shapes with blended colors
                shape1.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
                shape1.graphics.fillStyle(blendedColor, 0.3).fillCircle(0, 0, 25);
                shape1.graphics.fillStyle(blendedColor, 1).fillCircle(0, 0, 20);

                shape2.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
                shape2.graphics.fillStyle(blendedColor, 0.3).fillCircle(0, 0, 25);
                shape2.graphics.fillStyle(blendedColor, 1).fillCircle(0, 0, 20);
            }
        });

        // Apply harmonic blending for connected shapes
        this.shapes.forEach(shape => {
            const shapeKey = `${shape.i},${shape.j}`;
            const connections = directConnections.get(shapeKey);

            // If shape has no connections or blend is off, use original frequency
            if (!connections || !connections.size || !this.harmonicEnabled) {
                shape.oscillator.frequency.setTargetAtTime(
                    shape.frequency,
                    this.audioContext.currentTime,
                    0.1
                );
            } else if (this.harmonicEnabled) {
                // Get all directly connected shapes
                const connectedShapeFreqs = Array.from(connections).map(key => {
                    const connectedShape = this.shapes.find(s => `${s.i},${s.j}` === key);
                    return connectedShape ? connectedShape.frequency : null;
                }).filter(freq => freq !== null);

                // Find the lowest frequency among connected shapes
                const lowestFreq = Math.min(shape.frequency, ...connectedShapeFreqs);

                if (connectedShapeFreqs.length > 0) {
                    // Calculate harmonic based on frequency ratios
                    const higherFreq = Math.max(shape.frequency, lowestFreq);
                    const lowerFreq = Math.min(shape.frequency, lowestFreq);
                    const ratio = higherFreq / lowerFreq;

                    let harmonic;
                    if (ratio > 1.8) {
                        harmonic = lowerFreq * 2; // Octave
                    } else if (ratio > 1.4) {
                        harmonic = lowerFreq * 1.5; // Perfect fifth
                    } else {
                        harmonic = lowerFreq * 1.25; // Major third
                    }

                    if (isFinite(harmonic)) {
                        shape.oscillator.frequency.setTargetAtTime(
                            harmonic,
                            this.audioContext.currentTime,
                            0.1
                        );
                    }
                }
            }

            // Reset frequency if not connected to any other shape
            if (!connections || !connections.size || !this.harmonicEnabled) {
                if (isFinite(shape.frequency)) {
                    shape.oscillator.frequency.setTargetAtTime(shape.frequency, this.audioContext.currentTime, 0.1);
                }
            }

            let closestDistance = Infinity; // Initialize for each shape
            this.particles.forEach(particle => {
                const distance = Phaser.Math.Distance.Between(shape.x, shape.y, particle.x, particle.y);
                closestDistance = Math.min(closestDistance, distance);
                if (distance < shape.radius) {
                    const opacity = Math.pow(1 - (distance / shape.radius), 2);
                    let lineColor = {
                        'circle': 0xff0000,
                        'yellowTriangle': 0xffff00,
                        'triangle': 0x00ff00,
                        'square': 0x0000ff,
                        'purpleSquare': 0x800080,
                        'orangeSquare': 0xFFA500
                    } [shape.type] || 0xffffff;
                    this.connectionGraphics.lineStyle(4, lineColor, opacity);
                    this.connectionGraphics.beginPath();
                    this.connectionGraphics.moveTo(shape.x, shape.y);
                    this.connectionGraphics.lineTo(particle.x, particle.y);
                    this.connectionGraphics.strokePath();
                }
            });

            let volume = Math.max(0, Math.min(1, 1 - (closestDistance / shape.radius)));
            const isConnected = connections && connections.size > 0;
            if (isConnected && this.harmonicEnabled) {
                volume *= 1.1;
                volume = Math.min(0.5, volume); // Lower max volume to prevent clipping
                volume *= (1 - Math.exp(-this.time.now / 1000));
            }
            shape.baseVolume = Math.pow(volume, 2) * 0.8; // Slightly lower base volume
            shape.currentVolume = shape.baseVolume * this.masterVolume * (shape.frequency <= 110 ? 1.5 : 1); // Boost basenotes
            if (this.audioContext.state === 'running' && shape.gain && !this.isPaused) {
                const safeVolume = isFinite(shape.currentVolume) ? shape.currentVolume : 0;
                const volumeTransitionTime = Math.max(0.1, 0.5 * (1.5 / this.particleSpeed));
                shape.gain.gain.cancelScheduledValues(this.audioContext.currentTime);
                shape.gain.gain.setTargetAtTime(Math.min(Math.max(safeVolume, 0), 1), this.audioContext.currentTime, volumeTransitionTime);

                // Update pan if pan is enabled
                if (this.panEnabled && shape.stereoPanner) {
                    const panValue = this.calculatePan(shape.i);
                    shape.stereoPanner.pan.cancelScheduledValues(this.audioContext.currentTime);
                    shape.stereoPanner.pan.setTargetAtTime(panValue, this.audioContext.currentTime, 0.05);
                }
            }
        });
        // Reset colors for shapes that are no longer connected
        this.shapes.forEach(shape => {
            if (!shapeConnections.get(shape).size) {
                const originalColor = this.getShapeColor(shape.type);
                shape.graphics.clear();
                shape.graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
                shape.graphics.fillStyle(originalColor, 0.3).fillCircle(0, 0, 25);
                shape.graphics.fillStyle(originalColor, 1).fillCircle(0, 0, 20);
            }
        });
    }

    updateParticleCount(newCount) {
        while (this.particles.length > newCount) {
            this.particles.pop().destroy();
        }
        while (this.particles.length < newCount) {
            const x = Phaser.Math.Between(30, 570);
            const y = Phaser.Math.Between(30, 570);
            const particle = this.matter.add.sprite(x, y, 'particle', null, {
                shape: {
                    type: 'circle',
                    radius: 5
                },
                frictionAir: 0,
                friction: 0,
                restitution: 1,
                mass: 1,
                inertia: Infinity,
                collisionFilter: {
                    group: -1
                }
            });
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            particle.setVelocity(this.particleSpeed * Math.cos(angle), this.particleSpeed * Math.sin(angle));
            this.particles.push(particle);
        }
    }

    getShapeColor(type) {
        const colorMap = {
            'circle': 0xff0000, // Red
            'yellowTriangle': 0xffff00, // Yellow
            'triangle': 0x00ff00, // Green
            'square': 0x0000ff, // Blue
            'purpleSquare': 0x800080, // Purple
            'orangeSquare': 0xFFA500 // Orange
        };
        return colorMap[type] || 0xffffff;
    }
    calculatePan(i) {
        // Map grid column (0-9) to pan value (-1 to 1)
        const pan = (i / (this.gridCols - 1)) * 2 - 1; // 0 -> -1 (left), 9 -> 1 (right)
        return pan;
    }

    saveConfiguration() {
        const shapesData = this.shapes.map(shape => ({
            i: shape.i,
            j: shape.j,
            type: shape.type,
            frequency: shape.frequency
        }));
        return {
            shapes: shapesData,
            particleCount: this.particleCount,
            particleSpeed: this.particleSpeed,
            masterVolume: this.masterVolume,
            harmonicEnabled: this.harmonicEnabled,
            panEnabled: this.panEnabled, // Save pan state
            defaultFrequencies: this.defaultFrequencies // Save the current scale
        };
    }

    loadConfiguration(config) {
        // Clear existing shapes and sounds
        this.shapes.forEach(shape => {
            shape.graphics.destroy();
            shape.oscillator.stop();
            shape.oscillator.disconnect();
            shape.gain.disconnect();
            if (shape.stereoPanner) shape.stereoPanner.disconnect();
        });
        this.shapes = [];

        // Load shapes with smooth transitions
        config.shapes.forEach(shapeData => {
            const x = shapeData.i * this.gridSize + this.gridSize / 2;
            const y = shapeData.j * this.gridSize + this.gridSize / 2;
            const graphics = this.add.graphics({
                x,
                y
            });
            graphics.setDepth(1); // Ensure loaded shapes are rendered above particle lines
            let color, frequency;
            switch (shapeData.type) {
                case 'circle':
                    color = 0xff0000;
                    frequency = shapeData.frequency || 55;
                    break;
                case 'yellowTriangle':
                    color = 0xffff00;
                    frequency = shapeData.frequency || 220;
                    break;
                case 'triangle':
                    color = 0x00ff00;
                    frequency = shapeData.frequency || 330;
                    break;
                case 'square':
                    color = 0x0000ff;
                    frequency = shapeData.frequency || 440;
                    break;
                case 'purpleSquare':
                    color = 0x800080;
                    frequency = shapeData.frequency || 110;
                    break;
                case 'orangeSquare':
                    color = 0xFFA500;
                    frequency = shapeData.frequency || 55;
                    break;
            }
            graphics.fillStyle(0x000000, 0.4).fillCircle(4, 4, 22);
            graphics.fillStyle(color, 0.3).fillCircle(0, 0, 25);
            graphics.fillStyle(color, 1).fillCircle(0, 0, 20);

            const oscillator = this.audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, 0);
            const gain = this.audioContext.createGain();
            const stereoPanner = this.audioContext.createStereoPanner();
            oscillator.connect(gain);
            gain.connect(stereoPanner);
            stereoPanner.connect(this.audioContext.destination);
            oscillator.start();

            // Set initial pan based on current pan state
            const initialPan = config.panEnabled ? this.calculatePan(shapeData.i) : 0;
            stereoPanner.pan.setValueAtTime(initialPan, this.audioContext.currentTime);

            // Smooth fade-in for loaded shapes, with basenote boost if applicable
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
                baseVolume: 0
            });
        });

        // Update global settings
        this.particleCount = config.particleCount;
        this.particleSpeed = config.particleSpeed;
        this.masterVolume = config.masterVolume;
        this.harmonicEnabled = config.harmonicEnabled;
        this.panEnabled = config.panEnabled || false; // Load pan state
        this.defaultFrequencies = config.defaultFrequencies || [55, 220, 330, 440, 110, 55]; // Default to standard with basenote

        // Update UI and particles
        document.getElementById('particleCount').textContent = this.particleCount;
        document.getElementById('speedValue').textContent = this.particleSpeed;
        document.getElementById('volumeValue').textContent = this.masterVolume;
        document.getElementById('particleSlider').value = this.particleCount;
        document.getElementById('speedSlider').value = this.particleSpeed;
        document.getElementById('volumeSlider').value = this.masterVolume;
        const blendButton = document.getElementById('blendToggle');
        blendButton.textContent = this.harmonicEnabled ? 'On' : 'Off';
        blendButton.style.background = this.harmonicEnabled ? '#00cc00' : '#333';
        const panButton = document.getElementById('panToggle');
        panButton.textContent = this.panEnabled ? 'On' : 'Off';
        panButton.style.background = this.panEnabled ? '#2ecc71' : '#333';

        // Update chord slider based on loaded frequencies
        const chordIndex = Object.keys(this.chordColors).find(index =>
            JSON.stringify(this.chordColors[index].frequencies) === JSON.stringify(this.defaultFrequencies)
        ) || 0;
        document.getElementById('chordSlider').value = chordIndex;
        document.getElementById('chordValue').textContent = this.chordColors[chordIndex].label;
        document.getElementById('chordSlider').style.setProperty('--thumb-color', this.chordColors[chordIndex].color);
        document.getElementById('chordSlider').style.setProperty('--thumb-text', `"${this.chordColors[chordIndex].key}"`);

        this.updateParticleCount(this.particleCount);
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'renderDiv',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    width: 600,
    height: 600,
    scene: Example,
    physics: {
        default: 'matter',
        matter: {
            debug: false,
            gravity: {
                y: 0
            }
        }
    }
};

window.phaserGame = new Phaser.Game(config);