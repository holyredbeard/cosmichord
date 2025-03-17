export default {
  type: Phaser.AUTO,
  width: 800, // Ökat från 600px
  height: 800, // Ökat från 600px
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  parent: 'renderDiv'
};