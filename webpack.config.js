const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/',
    globalObject: 'this', // För Web Worker-kompatibilitet
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          outputPath: 'images/',
        },
      },
      {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' }, // Hanterar worker-filer
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      inject: 'body',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/utils/aiUtils.worker.js', to: 'utils/' },
        { from: 'src/images/logo.png', to: 'images/' },
      ],
    }),
  ],
  devServer: {
    static: path.join(__dirname, 'dist'),
    compress: true,
    port: 8080,
    hot: false, // Håller det avstängt temporärt
    open: true,
    historyApiFallback: true,
    watchFiles: ['src/**/*'],
    client: {
      overlay: false, // Stänger av overlay för att utesluta falska nätverksfel
    },
  },
  devtool: 'inline-source-map',
  target: 'web',
  resolve: {
    extensions: ['.js'],
  },
  mode: 'development',
};