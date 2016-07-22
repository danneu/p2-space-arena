
var path = require('path')
var webpack = require('webpack')
var merge = require('webpack-merge')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var autoprefixer = require('autoprefixer')
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

var TARGET_ENV = process.env.npm_lifecycle_event === 'build'
  ? 'production'
  : 'development'

var common = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[hash].js'
  },
  resolve: {
    modulesDirectories: ['node_modules'],
    extensions: ['', '.js']
  },
  module: {
    loaders: [
      { test: /\.json$/, loader: 'json' },
      { test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel',
        query: {
          presets: ['es2015']
        }
      }
    ],
    postLoaders: [
      {
        include: path.resolve(__dirname, 'node_modules/pixi.js'),
        loader: 'transform/cacheable?brfs'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'static/index.html',
      inject: 'body',
      filename: 'index.html'
    })
  ]
}

var development = {
  entry: [
    'webpack-dev-server/client?http://localhost:8080',
    path.join(__dirname, 'static/index.js')
  ],
  devServer: {
    inline: true,
    progress: true
  }
}

if (TARGET_ENV === 'development') {
  console.log('Starting dev server...')
  module.exports = merge(common, development)
}
