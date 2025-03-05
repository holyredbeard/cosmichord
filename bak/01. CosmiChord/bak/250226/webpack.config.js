const path = require('path');

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  mode: 'development',
  devServer: {
    static: path.join(__dirname, 'src'), // Serverar filer från src/
    compress: true,
    port: 9000,
    headers: {
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https://play.rosebud.ai; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval';"
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  }
};