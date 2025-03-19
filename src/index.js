import Phaser from 'phaser';
import CosmiChordScene from './scenes/CosmiChordScene';
import './index.css';

// Vänta på att DOM laddas
document.addEventListener('DOMContentLoaded', () => {
  // Skapa renderDiv om det inte finns
  let renderDiv = document.getElementById('renderDiv');
  if (!renderDiv) {
    console.log('Creating renderDiv element');
    renderDiv = document.createElement('div');
    renderDiv.id = 'renderDiv';
    document.body.appendChild(renderDiv);
  }

  const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 800,
    backgroundColor: '#000000',
    parent: 'renderDiv',
    physics: {
      default: 'matter',
      matter: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [CosmiChordScene]
  };

  const game = new Phaser.Game(config);
  
  console.log('Game initialized');
}); 