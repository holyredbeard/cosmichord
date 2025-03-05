export default {
  type: Phaser.AUTO,
  width: 600, // Matcha #renderDiv's 600px
  height: 600, // Matcha #renderDiv's 600px
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