

// 3rd
const PIXI = require('pixi.js')


// STATE


const state = {
  sprites: Object.create(null)
}


// VIEWPORT


const viewport = {
  x: 1400,
  y: 400,
  // Converts p2 y to pixi y
  fixY (y) {
    return viewport.y - y
  }
}


// STAGE


const stage = new PIXI.Container()
const renderer = PIXI.autoDetectRenderer(viewport.x, viewport.y)
renderer.backgroundColor = 0x333333
document.body.appendChild(renderer.view)


// TILING BACKGROUND


const bg = (function () {
  //const texture = PIXI.Texture.fromImage('./img/starfield.jpg')
  const texture = PIXI.Texture.fromImage('./img/dark-metal-grids/dark-metal-grid-3.jpg')
  const sprite = new PIXI.extras.TilingSprite(texture)
  sprite.height = viewport.y
  sprite.width = viewport.x
  return sprite
})()
stage.addChild(bg)


// RENDER


module.exports = function render (simulation, spritesToRemove, currUserId) {
  // Update player sprites
  for (const id in simulation.players) {
    const player = simulation.players[id]
    const [x, y] = Array.from(player.body.interpolatedPosition)
    if (state.sprites[id]) {
      // player sprite exists, so update it
      const sprite = state.sprites[id]
      sprite.position.set(x, viewport.fixY(y))
      sprite.rotation = player.body.interpolatedAngle
      // if this player is us, offset stage so that we are centered
      if (player.id === currUserId) {
        stage.position.x = viewport.x/2 - player.body.position[0]
        stage.position.y = viewport.y/2 - viewport.fixY(player.body.position[1])
      }
    } else {
      // player sprite must be created
      const sprite = new PIXI.Sprite.fromImage('./img/warbird.gif')
      // Apply team tint
      if (player.team === 'RED') {
        //sprite.tint = 0xE74C3C  // flatui
        sprite.tint =0xFF9797
        sprite.tint = 0xFFBBBB
      } else if (player.team === 'BLUE') {
        sprite.tint = 0x3498DB //flatui
        sprite.tint = 0xA8CFFF
      }
      sprite.anchor.set(0.5)
      sprite.height = 30
      sprite.width = 30
      sprite.position.set(x, viewport.fixY(y))
      sprite.rotation = player.body.interpolatedAngle
      state.sprites[id] = sprite
      stage.addChild(sprite)
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
  renderer.render(stage)
}
