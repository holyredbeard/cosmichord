export default {
  type: Phaser.AUTO,
  width: 600,
  height: 600,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'matter',
    matter: {
      debug: false,
      gravity: { y: 0 }
    }
  }
};