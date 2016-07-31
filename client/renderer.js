

// 3rd
const PIXI = require('pixi.js')
// 1st
const util = require('../common/util')
const sprites = require('./sprites')


// Initialize the renderer by passing in the actual map dimensions,
// which is different from the viewport dimensions.
exports.init = function ({ x: mapX, y: mapY }, tilesize, walls, tiles, filters, redFlagPos, blueFlagPos, onStageClick) {
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

  stage.interactive = true
  stage.on('mousedown', (e) => {
    const position = e.data.getLocalPosition(stage)
    onStageClick(position)
  })


  // TILING BACKGROUND


  const bg = (function () {
    //const texture = PIXI.Texture.fromImage('./img/starfield.jpg')
    const texture = PIXI.Texture.fromImage('./img/bg.jpg')
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
    const message = `You've tunneled outside of the map.`
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


  // TEAM COLORS


  const colors = {
    red: 0xFFBBBB,
    blue: 0xA8CFFF
  }

  // TILES


  for (const body of tiles) {
    const sprite = sprites.makeTile(body.tilesize)
    sprite.position.set(body.position[0], viewport.fixY(body.position[1]))
    stage.addChild(sprite)
  }


  // FILTERS


  for (const [x, y] of filters.RED) {
    const sprite = sprites.makeFilter(tilesize, x, viewport.fixY(y), colors.red)
    stage.addChild(sprite)
  }

  for (const [x, y] of filters.BLUE) {
    const sprite = sprites.makeFilter(tilesize, x, viewport.fixY(y), colors.blue)
    stage.addChild(sprite)
  }



  // FLAGS


  const redFlag = sprites.makeFlag('RED', colors.red)
  redFlag.position.x = redFlagPos[0]
  redFlag.position.y = viewport.fixY(redFlagPos[1])
  stage.addChild(redFlag)

  const blueFlag = sprites.makeFlag('BLUE', colors.blue)
  blueFlag.position.x = blueFlagPos[0]
  blueFlag.position.y = viewport.fixY(blueFlagPos[1])
  stage.addChild(blueFlag)

  // These markers become visible when a flag is taken

  const redFlagTaken = (function () {
    const text = new PIXI.Text('Taken', {
      font: '16px Arial',
      fill: colors.red,
      align: 'center'
    })
    text.anchor.set(0.5)
    text.position = redFlag.position
    text.visible = false
    return text
  })()
  stage.addChild(redFlagTaken)

  const blueFlagTaken = (function () {
    const text = new PIXI.Text('Taken', {
      font: '16px Arial',
      fill: colors.blue,
      align: 'center'
    })
    text.anchor.set(0.5)
    text.position = blueFlag.position
    text.visible = true
    return text
  })()
  stage.addChild(blueFlagTaken)



  // EXPLOSIONS
  //
  // Active movieclips are maintained in two maps.
  // On every render, we remove any movieclips that
  // are on their last frame.


  // Map of playerId -> PIXI.MovieClip
  const shipExplosions = {}
  // Map of bombId -> PIXI.MovieClip
  const bombExplosions = {}


  // FLAG CARRIER GLOW


  const redCarrierGlow = sprites.makeFlagCarrierGlow(colors.red)
  const blueCarrierGlow = sprites.makeFlagCarrierGlow(colors.blue)
  stage.addChild(redCarrierGlow)
  stage.addChild(blueCarrierGlow)


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


  return function render (simulation, currUserId, spritesToRemove, detonatedBombs, killedPlayers, showHitbox) {
    // UPDATE FLAG SPAWNS
    if (simulation.redCarrier) {
      redFlag.visible = false
      redCarrierGlow.visible = true
      redFlagTaken.visible = true
    } else {
      redFlag.visible = true
      redCarrierGlow.visible = false
      redFlagTaken.visible = false
    }
    if (simulation.blueCarrier) {
      blueFlag.visible = false
      blueCarrierGlow.visible = true
      blueFlagTaken.visible = true
    } else {
      blueFlag.visible = true
      blueCarrierGlow.visible = false
      blueFlagTaken.visible = false
    }
    // Update / decay / destroy existing bob explosions
    for (const id in bombExplosions) {
      const clip = bombExplosions[id]
      // if clip is at final frame, destroy it
      if (clip.currentFrame === clip.totalFrames - 1) {
        stage.removeChild(clip)
        clip.destroy()
        delete bombExplosions[id]
      }
    }
    // Create bomb explosions
    for (const [id, x, y] of detonatedBombs) {
      const clip = sprites.makeBombExplosion()
      clip.position.set(x, viewport.fixY(y))
      bombExplosions[id] = clip
      stage.addChild(clip)
    }
    // DECAY / REMOVE SHIP EXPLOSIONS
    for (const id in shipExplosions) {
      const clip = shipExplosions[id]
      // if clip is at final frame, destroy it
      if (clip.currentFrame === clip.totalFrames - 1) {
        stage.removeChild(clip)
        clip.destroy()
        delete shipExplosions[id]
      }
    }
    // CREATE SHIP EXPLOSIONS
    for (const player of killedPlayers) {
      const clip = sprites.makeShipExplosion()
      clip.position.set(player.body.position[0],
                        viewport.fixY(player.body.position[1]))
      shipExplosions[player.id] = clip
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
        // if player is flag carrier, give them the flag glow
        if (player.id === simulation.redCarrier) {
          redCarrierGlow.position = container.position
        } else if (player.id === simulation.blueCarrier) {
          blueCarrierGlow.position = container.position
        }
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
          // check for show-hitbox change
          // FIXME: don't rely on container.getChildAt(3) to be hitbox
          if (showHitbox && !container.getChildAt(3).visible) {
            container.getChildAt(3).visible = true
          } else if (!showHitbox && container.getChildAt(3).visible) {
            container.getChildAt(3).visible = false
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
        // TODO: Relocate to sprites.js
        // don't interpolate on sprite spawn, causes weird stuff
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
        // Add hitbox visualization
        const hitbox = new PIXI.Graphics()
        hitbox.lineStyle(1, 0xFFFFFF)
        hitbox.drawCircle(sprite.position.x, sprite.position.y, 15)
        hitbox.visible = false
        container.addChild(hitbox)
        // Add to stage
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
        // don't interpolate on sprite spawn, causes weird stuff
        const [x, y] = Array.from(bomb.body.position)
        const sprite = sprites.makeBomb('A', 3)
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
