

// 3rd
const PIXI = require('pixi.js')
// 1st
const util = require('../common/util')


// NOTE: maybe i should use `yi` to mean inverted y.


// GENERAL


// Trying to generalize the clip creation logic you can see in
// makeExplosion(). So far I'm only using this for flags but
// I'll try to use it for future movie clips.
//
// - tilesize: Integer
// - src: String, ex: './img/flags.png'
// - rows: Number of rows in the spritesheet
// - cols: Number of colums in the spritesheet
// - start: [x, y], coords of the starting spritesheet cell (Default: [0, 0])
// - end: [x, y], coords of the ending spritesheet cell (Default: botright frame)
// - clipOpts is optional object for configuring PIXI clip of {
//   loop: Bool, (Default: false)
//   animationSpeed: 0.0 - 1.0, (Default: 1.0)
//   scale: Float (Default: 1.0)
// }
exports.clipFactory = function ({ tilesize, src, rows, cols, start, end, clipOpts }) {
  console.assert(Number.isInteger(tilesize))
  console.assert(typeof src === 'string')
  console.assert(Number.isInteger(rows))
  console.assert(Number.isInteger(cols))
  const { animationSpeed, scale, loop } = clipOpts
  const [startRow, startCol] = (start || [0, 0])
  const [endRow, endCol] = end || [cols - 1, rows - 1]
  const base = new PIXI.Texture.fromImage(src)
  let textures = []
  for (var col = startCol; col <= endCol; col++) {
    for (var row = startRow; row <= endRow; row++) {
      var x = row * tilesize
      var y = col * tilesize
      var rect = new PIXI.Rectangle(x, y, tilesize, tilesize)
      textures.push(new PIXI.Texture(base, rect))
    }
  }
  const clip = new PIXI.extras.MovieClip(textures)
  clip.anchor.set(0.5)
  clip.loop = !!loop
  if (animationSpeed) clip.animationSpeed = animationSpeed
  if (scale) clip.scale.set(scale)
  clip.play()
  return clip
}


// SPRITES


// Returns PIXI.Sprite
exports.makeBomb = function () {
  const sprite = new PIXI.Sprite.fromImage('./img/bomb.png')
  sprite.anchor.set(0.5)
  sprite.height = 18
  sprite.width = 18
  return sprite
}


// TODO: Use clipFactory.
//
// kind is 'A' | 'B' | 'C', aesthetic variations
// level is 1 | 2 | 3 | 4, maps to Continuum bomb levels (red yellow orange purple)
exports.makeBomb = function (kind, level) {
  // Randomize if kind/level aren't set
  kind = kind || util.randNth(['A', 'B', 'C'])
  level = level || Math.floor(Math.random() * 4 + 1)
  var base = new PIXI.Texture.fromImage('./img/bombs.png')
  var textures = []
  var rowIdx = { 'A': 0, 'B': 1, 'C': 2 }
  var offsetY = rowIdx[kind] *
    (16 * 4) +       //  (rowHeight * levelsPerKind)
    ((level - 1) * 16)
  for (var i = 0; i < 10; i++) {
    textures.push(new PIXI.Texture(base, new PIXI.Rectangle(i*16, offsetY, 16, 16)))
  }
  var clip = new PIXI.extras.MovieClip(textures)
  clip.animationSpeed = 0.10
  clip.anchor.set(0.5)
  clip.scale.set(1.30)
  clip.play()
  return clip
}


// Returns PIXI.Container
exports.makeFlag = (function () {
  function makeFlagClip (team) {
    const common = {
      tilesize: 16, rows: 2, cols: 10, src: './img/flags.png',
      clipOpts: { loop: true, animationSpeed: 0.3 }
    }
    if (team === 'BLUE') {
      return exports.clipFactory(Object.assign({}, common, {
        start: [0, 0], end: [9, 0]
      }))
    } else {
      return exports.clipFactory(Object.assign({}, common, {
        start: [0, 1], end: [9, 1]
      }))
    }
  }
  return function (team, tint) {
    const container = new PIXI.Container()
    const clip = makeFlagClip(team)
    const glow = (function () {
      // TODO: how small can the gradient image get without losing fade quality?
      const sprite = new PIXI.Sprite.fromImage('./img/circle-gradient16.png')
      sprite.tint = tint
      sprite.width = 256
      sprite.height = 256
      sprite.anchor.set(0.5)
      return sprite
    })()
    container.addChild(glow)
    container.addChild(clip)
    return container
  }
})()


// Returns PIXI.MovieClip
exports.makeShipExplosion = function () {
  return exports.clipFactory({
    tilesize: 48,
    rows: 6,
    cols: 6,
    src: './img/explode1.png',
    clipOpts: {loop: false, animationSpeed: 0.3}
  })
}


// Returns PIXI.MovieClip
exports.makeBombExplosion = function () {
  return exports.clipFactory({
    tilesize: 16 * 5,
    rows: 2,
    cols: 5,
    src: './img/empburst.gif',
    clipOpts: {
      animationSpeed: 0.25,
      loop: false,
      scale: 1.50
    }
  })
}


// Returns PIXI.Sprite
exports.makeTile = (function () {
  const tileImages = [
    './img/tile1.png',
    './img/tile2.png',
    './img/tile3.png'
  ]
  return function (tilesize) {
    console.assert(Number.isInteger(tilesize))
    const image = util.randNth(tileImages)
    const sprite = new PIXI.Sprite.fromImage(image)
    sprite.width = tilesize
    sprite.height = tilesize
    sprite.anchor.set(0.5)
    return sprite
  }
})()


exports.makeFlagCarrierGlow = function (tint) {
  const sprite = new PIXI.Sprite.fromImage('./img/circle-gradient16.png')
  sprite.tint = tint
  sprite.width = 128
  sprite.height = 128
  sprite.anchor.set(0.5)
  sprite.visible = false
  return sprite
}


// y should already be flipped
exports.makeFilter = function (tilesize, x, yi, tint) {
  const sprite = new PIXI.Sprite.fromImage('./img/filter.png')
  sprite.tint = tint
  sprite.anchor.set(0.5)
  sprite.position.set(x, yi)
  sprite.width = tilesize
  sprite.height = tilesize
  return sprite
}


exports.makeDiode = function (tilesize, direction, x, yi) {
  const sprite = new PIXI.Sprite.fromImage('./img/diode.png')
  sprite.anchor.set(0.5)
  sprite.position.set(x, yi)
  sprite.width = tilesize
  sprite.height = tilesize
  switch (direction) {
    case 'RIGHT':
      sprite.rotation = Math.PI / 2
      break
    case 'DOWN':
      sprite.rotation = Math.PI
      break
    case 'LEFT':
      sprite.rotation = Math.PI * 3 / 2
      break
  }
  return sprite
}
