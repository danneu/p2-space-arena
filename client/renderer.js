

// 3rd
const PIXI = require('pixi.js')


// Initialize the renderer by passing in the actual map dimensions,
// which is different from the viewport dimensions.
exports.init = function ({ x: mapX, y: mapY }, walls) {

  // we assign this soon, but i need to be able to access it
  // in window.onresize.
  let pixiRenderer

  // STATE


  const state = {
    sprites: Object.create(null)
  }

  // VIEWPORT


  const viewport = {
    x: document.documentElement.clientWidth,
    y: document.documentElement.clientHeight,
    // Converts p2 y to pixi y
    fixY (y) {
      return mapY - y
    }
  }

  window.onresize = function () {
    viewport.x = document.documentElement.clientWidth
    viewport.y = document.documentElement.clientHeight
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


  const [topWall, botWall, left, right] = walls
  let gfx

  gfx = new PIXI.Graphics() // top, red
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0xFF0000)
  gfx.moveTo(-viewport.x, viewport.fixY(topWall.position[1]))
  gfx.lineTo(viewport.x, viewport.fixY(topWall.position[1]))
  stage.addChild(gfx)

  gfx = new PIXI.Graphics() // bottom, orange
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0xFFA500)
  gfx.moveTo(-viewport.x, viewport.fixY(botWall.position[1]))
  gfx.lineTo(viewport.x, viewport.fixY(botWall.position[1]))
  stage.addChild(gfx)

  gfx = new PIXI.Graphics() // left, blue
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0x0000FF)
  gfx.moveTo(left.position[0], -viewport.y)
  gfx.lineTo(left.position[0], viewport.y)
  stage.addChild(gfx)

  gfx = new PIXI.Graphics() // right, green
  gfx.beginFill(0x000000)
  gfx.lineStyle(5, 0x00FF00)
  gfx.moveTo(right.position[0], -viewport.y)
  gfx.lineTo(right.position[0], viewport.y)
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



  // COLORS


  const colors = {
    red: 0xFFBBBB,
    blue: 0xA8CFFF
  }


  // RENDER


  return function render (simulation, spritesToRemove, currUserId) {
    // Update player sprites
    for (const id in simulation.players) {
      const player = simulation.players[id]
      const [x, y] = Array.from(player.body.interpolatedPosition)
      if (state.sprites[id]) {
        // player sprite exists, so update it
        const container = state.sprites[id]
        const sprite = container.getChildAt(0)
        container.position.set(x, viewport.fixY(y))
        sprite.rotation = player.body.interpolatedAngle
        // if this player is us, offset stage so that we are centered
        if (player.id === currUserId) {
          stage.position.x = viewport.x/2 - player.body.position[0]
          stage.position.y = viewport.y/2 - viewport.fixY(player.body.position[1])
          // also, check if we are out of bounds to display wallWarning
          if (player.body.position[0] < 0 || player.body.position[0] > mapX || player.body.position[1] < 0 || player.body.position[1] > mapY) {
            wallWarning.position.x = player.body.position[0]
            wallWarning.position.y = viewport.fixY(player.body.position[1] + 50)
            wallWarning.visible = true
          } else {
            wallWarning.visible = false
          }
        }
      } else {
        // player sprite must be created
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
        //sprite.position.set(x, viewport.fixY(y))
        container.position.set(x, viewport.fixY(y))
        sprite.rotation = player.body.interpolatedAngle
        //stage.addChild(sprite)
        //text.rotation = sprite.rotation
        text.position.set(sprite.x + 10, sprite.y + 10)
        container.addChild(sprite)
        container.addChild(text)
        state.sprites[id] = container
        stage.addChild(container)
      }
    }
    // Upsert bomb sprites
    for (const id in simulation.bombs) {
      const bomb = simulation.bombs[id]
      const [x, y] = Array.from(bomb.body.interpolatedPosition)
      if (state.sprites[id]) {
        // sprite exists, so updated it
        const sprite = state.sprites[id]
        sprite.position.set(x, viewport.fixY(y))
      } else {
        // sprite does not exist, so create it
        const sprite = new PIXI.Sprite.fromImage('./img/bomb.png')
        sprite.anchor.set(0.5)
        sprite.height = 18
        sprite.width = 18
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
