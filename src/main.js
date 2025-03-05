import Phaser from 'phaser';
import CosmiChordScene from './scenes/CosmiChordScene';
import phaserConfig from './config/phaserConfig';
import './styles/visualUtils.css'; // Lägg till denna rad för att importera CSS-filen

const config = {
  ...phaserConfig,
  parent: 'renderDiv',
  scene: [CosmiChordScene]
};

new Phaser.Game(config);