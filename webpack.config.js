
var path = require('path')
var webpack = require('webpack')
var merge = require('webpack-merge')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var autoprefixer = require('autoprefixer')
var ExtractTextPlugin = require('extract-text-webpack-plugin')
var CopyWebpackPlugin = require('copy-webpack-plugin')
var CompressionPlugin = require("compression-webpack-plugin")

var TARGET_ENV
if (process.env.NODE_ENV === 'production') {
  TARGET_ENV = 'production'
} else {
  TARGET_ENV = process.env.npm_lifecycle_event === 'build'
    ? 'production'
    : 'development'
}

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
        include: [
          path.resolve(__dirname, 'common'),
          path.resolve(__dirname, 'client'),
          path.resolve(__dirname, 'static')
        ],
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


////////////////////////////////////////////////////////////


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


////////////////////////////////////////////////////////////


var production = {
  entry: [
    path.join(__dirname, 'static/index.js')
  ],
  plugins: [
    new CopyWebpackPlugin([
      { from: 'static/img/', to: 'img/' },
      { from: 'static/favicon.ico' }
    ]),
    new webpack.optimize.OccurenceOrderPlugin(),
    // extract CSS into a separate file
    new ExtractTextPlugin( './[hash].css', { allChunks: true } ),
    // minify & mangle JS/CSS
    new webpack.optimize.UglifyJsPlugin({
      minimize: true,
      compressor: { warnings: false }
      // mangle:  true
    }),
    // node-static is configured to look for a [path].gz of js/css files
    new CompressionPlugin({
      asset: '[path].gz',
      algorithm: 'gzip',
      test: /\.(js|css)$/
    })
  ]
}


////////////////////////////////////////////////////////////


if (TARGET_ENV === 'production') {
  console.log('Bundling for production...')
  module.exports = merge(common, production)
} else {
  console.log('Starting dev server...')
  module.exports = merge(common, development)
}
