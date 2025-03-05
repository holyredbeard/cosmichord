// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  context: path.resolve(__dirname),
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
    assetModuleFilename: '[hash][ext][query]', // Bilder hamnar i dist/images/ via generator
  },
  mode: 'development',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
      publicPath: '/',
    },
    compress: true,
    port: 8080,
    hot: true,
    historyApiFallback: true,
    headers: {
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net blob:; worker-src 'self' blob:; default-src 'self'; img-src 'self' data: *; style-src 'self' 'unsafe-inline';"
    },
  },
  module: {
    rules: [
      { test: /\.html$/, use: ['html-loader'] },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env'] },
        },
      },
      { test: /\.worker\.js$/, use: { loader: 'worker-loader' } },
      {
        test: /\.(png|jpg|jpeg|gif|ico)$/i,
        type: 'asset/resource',
        generator: { outputPath: 'images/' }, // Bilder hamnar i dist/images/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: { extensions: ['.js', '.json'] },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
  ],
};