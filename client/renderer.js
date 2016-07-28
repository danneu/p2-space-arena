

// 3rd
const PIXI = require('pixi.js')
// 1st
const util = require('../common/util')


// Initialize the renderer by passing in the actual map dimensions,
// which is different from the viewport dimensions.
exports.init = function ({ x: mapX, y: mapY }, walls, tiles, redFlagPos, blueFlagPos) {
  console.assert(Array.isArray(walls))
  console.assert(Array.isArray(tiles))
  console.assert(Array.isArray(redFlagPos))
  console.assert(Array.isArray(blueFlagPos))

  // we assign this soon, but i need to be able to access it
  // in window.onresize.
  let pixiRenderer


  // STATE


  const state = {
    sprites: Object.create(null)
  }


  // VIEWPORT


  const viewport = {
    x: null,
    y: null,
    // Converts p2 y to pixi y
    fixY (y) {
      return mapY - y
    },
    reset () {
      this.x = document.documentElement.clientWidth
      this.y = document.documentElement.clientHeight
    }
  }

  // Init viewport
  viewport.reset()

  window.onresize = function () {
    viewport.reset()
    pixiRenderer.resize(viewport.x, viewport.y)
  }


  // STAGE


  const stage = new PIXI.Container()
  pixiRenderer = PIXI.autoDetectRenderer(viewport.x, viewport.y)
  pixiRenderer.backgroundColor = 0x333333
  document.body.appendChild(pixiRenderer.view)


  // TILING BACKGROUND


  const bg = (function () {
    //const texture = PIXI.Texture.fromImage('./img/starfield.jpg')
    const texture = PIXI.Texture.fromImage('./img/dark-metal-grids/3.jpg')
    const sprite = new PIXI.extras.TilingSprite(texture)
    sprite.height = mapY
    sprite.width = mapX
    return sprite
  })()
  stage.addChild(bg)


  // DRAW WALLS, trying to figure out why the ship often tunnel into the
  // p2.Plane walls


  const [top, bot, left, right] = walls
  let gfx

  gfx = new PIXI.Graphics() // top, red
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0xFF0000)
  gfx.moveTo(-viewport.x * 2, viewport.fixY(top.position[1]))
  gfx.lineTo(viewport.x * 2, viewport.fixY(top.position[1]))
  stage.addChild(gfx)

  gfx = new PIXI.Graphics() // bottom, orange
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0xFFA500)
  gfx.moveTo(-viewport.x * 2, viewport.fixY(bot.position[1]))
  gfx.lineTo(viewport.x * 2, viewport.fixY(bot.position[1]))
  stage.addChild(gfx)

  gfx = new PIXI.Graphics() // left, blue
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0x0000FF)
  gfx.moveTo(left.position[0], -viewport.y * 2)
  gfx.lineTo(left.position[0], viewport.y * 2)
  stage.addChild(gfx)

  gfx = new PIXI.Graphics() // right, green
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0x00FF00)
  gfx.moveTo(right.position[0], -viewport.y * 2)
  gfx.lineTo(right.position[0], viewport.y * 2)
  stage.addChild(gfx)


  const wallWarning = (function () {
    const message = `KNOWN ISSUE: You've tunneled outside of the map.`
    const wallWarning = new PIXI.Text(message, {
      font: '18px Arial',
      fill: 0xFF0000,
      align: 'center'
    })
    wallWarning.anchor.set(0.5)
    wallWarning.visible = false
    stage.addChild(wallWarning)
    return wallWarning
  })()


  // TILES


  const tileImages = [
    './img/tile1.png',
    './img/tile2.png',
    './img/tile3.png'
  ]


  for (const body of tiles) {
    const image = util.randNth(tileImages)
    const sprite = new PIXI.Sprite.fromImage(image)
    sprite.position.set(body.position[0], viewport.fixY(body.position[1]))
    sprite.width = body.tilesize
    sprite.height = body.tilesize
    sprite.anchor.set(0.5)
    stage.addChild(sprite)
  }


  // TEAM COLORS


  const colors = {
    red: 0xFFBBBB,
    blue: 0xA8CFFF
  }


  // EXPLOSIONS


  // list of movieclips
  const explosions = {}

  function makeExplosion () {
    var tilesize = 16 * 5
    var base = new PIXI.Texture.fromImage('./img/empburst.gif')
    var textures = []
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 5; j++) {
        var x = j * tilesize
        var y = i * tilesize
        var rect = new PIXI.Rectangle(x, y, tilesize, tilesize)
        textures.push(new PIXI.Texture(base, rect))
      }
    }
    var clip = new PIXI.extras.MovieClip(textures)
    clip.animationSpeed = 0.25
    clip.anchor.set(0.5)
    clip.loop = false
    clip.scale.set(1.50)
    clip.play()
    return clip
  }


  // FLAGS


  // Trying to generalize the clip creation logic you can see in
  // makeExplosion(). So far I'm only using this for flags but
  // I'll try to use it for future movie clips.
  //
  // - tilesize: Integer
  // - src: String, ex: './img/flags.png'
  // - rows: Number of rows in the spritesheet
  // - cols: Number of colums in the spritesheet
  // - start: [x, y], coords of the starting spritesheet cell
  // - end: [x, y], coords of the ending spritesheet cell
  // - clipOpts is optional object for configuring PIXI clip of {
  //   loop: Bool, (Default: false)
  //   animationSpeed: 0.0 - 1.0, (Default: 1.0)
  //   scale: Float (Default: 1.0)
  // }
  //
  // TODO: Move to another file. renderer.js is getting big...
  function clipFactory ({ tilesize, src, rows, cols, start, end, clipOpts }) {
    const { animationSpeed, scale, loop } = clipOpts
    const [startRow, startCol] = start
    const [endRow, endCol] = end
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


  // Returns PIXI.Container
  const makeFlag = (function () {
    function makeFlagClip (team) {
      const common = {
        tilesize: 16, rows: 2, cols: 10, src: './img/flags.png',
        clipOpts: { loop: true, animationSpeed: 0.3 }
      }
      if (team === 'BLUE') {
        return clipFactory(Object.assign({}, common, { start: [0, 0], end: [9, 0] }))
      } else {
        return clipFactory(Object.assign({}, common, { start: [0, 1], end: [9, 1] }))
      }
    }
    return function (team) {
      const container = new PIXI.Container()
      const clip = makeFlagClip(team)
      const glow = (function () {
        // TODO: how small can the gradient image get without losing fade quality?
        const sprite = new PIXI.Sprite.fromImage('./img/circle-gradient16.png')
        sprite.tint = team === 'RED' ? colors.red : colors.blue
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


  const redFlag = makeFlag('RED')
  redFlag.position.x = redFlagPos[0]
  redFlag.position.y = viewport.fixY(redFlagPos[1])
  stage.addChild(redFlag)

  const blueFlagClip = makeFlag('BLUE')
  blueFlagClip.position.x = blueFlagPos[0]
  blueFlagClip.position.y = viewport.fixY(blueFlagPos[1])
  stage.addChild(blueFlagClip)


  // ENERGY BAR


  // energy bar is the rectangle that appears beneath the player's
  // ship to indicate how much energy they have
  function makeEnergyBar (maxWidth) {
    const gfx = new PIXI.Graphics()
    gfx.beginFill(0xFFFFFF)
    gfx.drawRect(0, 0, maxWidth, 5)
    gfx.alpha = 0
    return gfx
  }


  // 0 is empty, 1 is full
  function getEnergyTint (scale) {
    if (scale < 0.5) {
      // red
      return 0xFF0000
    } else if (scale < 0.75) {
      // yellow
      return 0xF3F315
    } else {
      // green
      return 0x39FF14
    }
  }


  // HELPERS


  // https://gist.github.com/gre/1650294
  const easing = {
    // no easing, no acceleration
    linear: function (t) { return t },
    // accelerating from zero velocity
    easeInQuad: function (t) { return t*t },
    // decelerating to zero velocity
    easeOutQuad: function (t) { return t*(2-t) },
    // acceleration until halfway, then deceleration
    easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
    // accelerating from zero velocity
    easeInCubic: function (t) { return t*t*t },
    // decelerating to zero velocity
    easeOutCubic: function (t) { return (--t)*t*t+1 },
    // acceleration until halfway, then deceleration
    easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
    // accelerating from zero velocity
    easeInQuart: function (t) { return t*t*t*t },
    // decelerating to zero velocity
    easeOutQuart: function (t) { return 1-(--t)*t*t*t },
    // acceleration until halfway, then deceleration
    easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
    // accelerating from zero velocity
    easeInQuint: function (t) { return t*t*t*t*t },
    // decelerating to zero velocity
    easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
    // acceleration until halfway, then deceleration
    easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t }
  }


  // RENDER


  return function render (simulation, currUserId, spritesToRemove, detonatedBombs) {
    // Update / decay / destroy existing explosions
    for (const id in explosions) {
      const clip = explosions[id]
      // if clip is at final frame, destroy it
      if (clip.currentFrame === clip.totalFrames - 1) {
        stage.removeChild(clip)
        clip.destroy()
        delete explosions[id]
      }
    }
    // Create explosions
    for (const [id, x, y] of detonatedBombs) {
      const clip = makeExplosion()
      clip.position.set(x, viewport.fixY(y))
      explosions[id] = clip
      stage.addChild(clip)
    }
    // Update player sprites
    for (const id in simulation.players) {
      const player = simulation.players[id]
      if (state.sprites[id]) {
        // player sprite exists, so update it
        const [x, y] = Array.from(player.body.interpolatedPosition)
        const container = state.sprites[id]
        const sprite = container.getChildAt(0)
        container.position.set(x, viewport.fixY(y))
        sprite.rotation = util.clampRad(player.body.interpolatedAngle)
        // if this player is us, offset stage so that we are centered
        if (player.id === currUserId) {
          stage.position.x = viewport.x/2 - x
          stage.position.y = viewport.y/2 - viewport.fixY(y)
          // also, check if we are out of bounds to display wallWarning
          if (x < 0 || x > mapX || y < 0 || y > mapY) {
            wallWarning.position.x = x
            wallWarning.position.y = viewport.fixY(y + 50)
            wallWarning.visible = true
          } else {
            wallWarning.visible = false
          }
          // update energy bar
          if (container.energyBar) {
            const scalar = player.curEnergy / player.maxEnergy
            container.energyBar.width = sprite.width * scalar
            container.energyBar.alpha = 1 - easing.easeInCubic(scalar)
            // update color
            container.energyBar.tint = getEnergyTint(scalar)
          }
        }
      } else {
        // player sprite must be created
        const [x, y] = Array.from(player.body.position)
        const container = new PIXI.Container()
        // container children (the ship sprite and the username)
        const sprite = new PIXI.Sprite.fromImage('./img/warbird.gif')
        const text = new PIXI.Text(player.uname, {
          font: '12px Arial',
          fill: 0xFFFFFF,
          align: 'left'
        })
        // Apply team tint
        if (player.team === 'RED') {
          sprite.tint = colors.red
          text.tint = colors.red
        } else if (player.team === 'BLUE') {
          sprite.tint = colors.blue
          text.tint = colors.blue
        }
        sprite.anchor.set(0.5)
        sprite.height = 30
        sprite.width = 30
        container.position.set(x, viewport.fixY(y))
        sprite.rotation = util.clampRad(player.body.interpolatedAngle)
        text.position.set(sprite.x + 15, sprite.y + 10)
        container.addChild(sprite)
        container.addChild(text)
        // Mount energy bar if it's current player
        if (player.id === currUserId) {
          const energyBar = makeEnergyBar(sprite.width)
          energyBar.position.set(sprite.x - sprite.width / 2,
                                 sprite.y + sprite.width / 2)
          container.addChild(energyBar)
          container.energyBar = energyBar
        }
        state.sprites[id] = container
        stage.addChild(container)
      }
    }
    // Upsert bomb sprites
    for (const id in simulation.bombs) {
      const bomb = simulation.bombs[id]
      if (state.sprites[id]) {
        // sprite exists, so updated it
        const sprite = state.sprites[id]
        const [x, y] = Array.from(bomb.body.interpolatedPosition)
        sprite.position.set(x, viewport.fixY(y))
      } else {
        // sprite does not exist, so create it
        const sprite = new PIXI.Sprite.fromImage('./img/bomb.png')
        sprite.anchor.set(0.5)
        sprite.height = 18
        sprite.width = 18
        const [x, y] = Array.from(bomb.body.position)
        sprite.position.set(x, viewport.fixY(y))
        state.sprites[id] = sprite
        stage.addChild(sprite)
      }
    }
    // Clean up old sprites
    for (const id of spritesToRemove) {
      const sprite = state.sprites[id]
      stage.removeChild(sprite)
      delete state.sprites[id]
      if (sprite) sprite.destroy()
    }
    // Render
    pixiRenderer.render(stage)
  }
}
