export const themes = {
  default: {
    circle: 0xff0000,         // Red
    yellowTriangle: 0xffff00, // Yellow
    triangle: 0x00ff00,       // Green
    square: 0x0000ff,         // Blue
    purpleSquare: 0x800080,   // Purple
    orangeSquare: 0xFFA500    // Orange
  },
  pastel: {
    circle: 0xffa1a1,         // Light pink
    yellowTriangle: 0xffffb3, // Light yellow
    triangle: 0xb3ffb3,       // Light green
    square: 0xb3b3ff,         // Light blue
    purpleSquare: 0xe6b3e6,   // Light purple
    orangeSquare: 0xffd9b3    // Light orange
  }
};

// Aktivt tema (kan ändras dynamiskt via UI senare)
export const activeTheme = 'default';