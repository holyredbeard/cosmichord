import Phaser from 'phaser';
import CosmiChordScene from './scenes/CosmiChordScene';
import phaserConfig from './config/phaserConfig';

const config = {
  ...phaserConfig,
  parent: 'renderDiv',
  scene: [CosmiChordScene]
};

window.phaserGame = new Phaser.Game(config);