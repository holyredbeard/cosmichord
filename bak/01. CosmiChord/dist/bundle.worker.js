/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/utils/aiUtils.worker.js":
/*!*************************************!*\
  !*** ./src/utils/aiUtils.worker.js ***!
  \*************************************/
/***/ (() => {

eval("// src/utils/aiUtils.worker.js\nimportScripts('https://cdn.jsdelivr.net/npm/@magenta/music@^1.23.1');\n\nlet musicvae = null;\nlet magentaPlayer = null;\nlet audioReady = false;\n\nself.onmessage = async (e) => {\n  if (e.data.type === 'initialize') {\n    try {\n      // Initialize MusicVAE with a small, ambient-appropriate checkpoint\n      musicvae = new mm.MusicVAE('https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/trio_4bar');\n      await musicvae.initialize();\n      console.log('MusicVAE initialized in WebWorker');\n\n      // Vänta på resumeAudio innan vi skapar SoundFontPlayer\n      self.postMessage({ type: 'awaitingGesture' });\n    } catch (err) {\n      console.error('Error initializing Magenta models in WebWorker:', err);\n      self.postMessage({ type: 'error', message: err.message });\n    }\n  } else if (e.data.type === 'resumeAudio' && !audioReady) {\n    try {\n      magentaPlayer = new mm.SoundFontPlayer('https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus');\n      magentaPlayer.callbackObject = {\n        noteOn: (time, pitch) => {\n          self.postMessage({\n            type: 'visualFeedback',\n            shapes: [Math.floor(Math.random() * 6)]\n          });\n        },\n        noteOff: (time, pitch) => {}\n      };\n      audioReady = true;\n      self.postMessage({ type: 'audioReady' });\n    } catch (err) {\n      console.error('Error initializing Magenta player:', err);\n      self.postMessage({ type: 'error', message: err.message });\n    }\n  } else if (e.data.type === 'generateSoundscape' && musicvae && magentaPlayer && audioReady) {\n    const shapes = e.data.shapes;\n    const bpm = e.data.bpm || 60;\n\n    try {\n      const noteSequence = analyzePattern(shapes, bpm);\n      const quantizedSequence = mm.sequences.quantizeNoteSequence(noteSequence, 4);\n      const temperature = 0.7;\n      const continuedSequence = await musicvae.continueSequence(quantizedSequence, 32, temperature);\n\n      magentaPlayer.start(continuedSequence);\n      self.postMessage({ type: 'soundscape', sequence: continuedSequence });\n    } catch (err) {\n      console.error('Error generating soundscape in WebWorker:', err);\n      self.postMessage({ type: 'error', message: err.message });\n    }\n  }\n};\n\nfunction analyzePattern(shapes, bpm) {\n  const beatDuration = 60 / bpm;\n  const notes = shapes.map(shape => ({\n    pitch: frequencyToMidi(shape.frequency),\n    startTime: 0,\n    endTime: 4,\n  }));\n\n  return {\n    notes,\n    totalTime: 16,\n    tempos: [{ time: 0, qpm: bpm }],\n  };\n}\n\nfunction frequencyToMidi(frequency) {\n  return 12 * Math.log2(frequency / 440) + 69;\n}\n\n//# sourceURL=webpack://cosmi-chord/./src/utils/aiUtils.worker.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/utils/aiUtils.worker.js"]();
/******/ 	
/******/ })()
;