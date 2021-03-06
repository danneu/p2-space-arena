

// 3rd
const io = require('socket.io-client')
const p2 = require('p2')
const vec2 = p2.vec2
// 1st
const util = require('../common/util')
const { pxm, mxp } = util
const Simulation = require('../common/simulation')
const Player = require('../common/player')
const Bomb = require('../common/bomb')
const Physics = require('../common/physics')
const renderer = require('./renderer')
const sounds = require('./sounds')


// STATE


const state = {
  // these get assigned once client has received :init payload
  userId: null,
  render: null,
  simulation: null,
  // Pass into `render` when we need to remove a sprite
  // Remember to reset it after render.
  spritesToRemove: [],
  // list of [bomb] sent to render,
  // should be cleared after render since they're
  // in the renderers hands now
  detonatedBombs: [],
  // players killed this frame, will turn into explosions by
  // the render step
  killedPlayers: [],
  // modified by HUD's #show-hitbox checkbox
  showHitbox: false
}


// SOCKET


const socket = window.location.hostname === 'localhost'
  ? io('ws://localhost:3000')
  : io('ws://p2-space-arena.herokuapp.com')


// socket.on('open', ...)


socket.on(':init', (data) => {
  console.log('[recv :init]', data)
  const {userId, map} = data
  state.userId = userId
  state.simulation = new Simulation(map)

  // The client can enable some optimizations
  // state.simulation.world.sleepMode = p2.World.BODY_SLEEPING
  // state.simulation.world.solver.tolerance = 1 //.001 // default: 0.0000001

  // TODO: I should just change this to renderer.init(simulation, ...)
  //       This is stupid
  state.render = renderer.init({ x: map.width, y: map.height }, state.simulation.tilesize, state.simulation.walls, state.simulation.tiles, state.simulation.filters, state.simulation.diodes, Array.from(state.simulation.redFlag.position), Array.from(state.simulation.blueFlag.position), onStageClick)
  // Start update loop when user is ready
  setInterval(update, 1000 / 60)
  requestAnimationFrame(renderLoop)
  // Boot the client junkdrawer
  startClientStuff()
})


socket.on(':playerJoined', (data) => {
  console.log('[recv :playerJoined]', data)
  const player = Player.fromJson(data)
  state.simulation.addPlayer(player)
})


socket.on(':playerLeft', (userId) => {
  console.log('[recv :playerLeft]', userId)
  state.simulation.removePlayer(userId)
  state.spritesToRemove.push(userId)
})


socket.on(':flagTaken', ([flagTeam, playerId]) => {
  console.log('[recv :flagTaken', flagTeam, playerId)
  // update simulation
  if (flagTeam === 'RED') {
    state.simulation.redCarrier = playerId
  } else {
    state.simulation.blueCarrier = playerId
  }
  // check if we took it
  if (playerId === state.userId) {
    sounds.flagTakenBySelf.play()
  }
})


socket.on(':flagDropped', (flagTeam) => {
  console.log('[recv :flagDropped', flagTeam)
  // update simulation
  if (flagTeam === 'RED') {
    state.simulation.redCarrier = null
  } else {
    state.simulation.blueCarrier = null
  }
})


socket.on(':flagCapture', (team) => {
  console.log('[recv :flagCaptured', team)
  // update simulation
  // TODO: update score
  if (team === 'RED') {
    state.simulation.blueCarrier = null
  } else {
    state.simulation.redCarrier = null
  }
  // play sound
  if (!state.userId) return
  if (team === state.simulation.getPlayer(state.userId).team) {
    sounds.friendlyCapture.play()
  } else {
    sounds.enemyCapture.play()
  }
})


// Server is telling us that somebody else shot a bomb.
// We never get this for our *own* bombs.
//
// When we get this, add it to our simulation
socket.on(':bombShot', ({id, userId, position, velocity}) => {
  const team = state.simulation.getPlayer(userId).team
  const bomb = new Bomb(id, userId, team, position, velocity)
  state.simulation.addBomb(bomb)
})


// Server is broadcasting a bomb->player collision
// For now just remove the bomb from the sim.
// Reminder: bomb and victim are just json data, not instances
socket.on(':bombHit', ({bomb, victim}) => {
  console.log('[recv :bombHit] bomb=', bomb, 'victim=', victim)
  state.simulation.removeBomb(bomb.id)
  detonateBombFx(bomb.id, bomb.position[0], bomb.position[1])
  // Since bombs insta-gib players, create ship explosion here
  state.killedPlayers.push(state.simulation.getPlayer(victim.id))
})


// Note: Since :player_left and :player_joined let the client
// keep their state up to date, the client just has to merge in the snapshot
// rather than check for simulation vs snapshot difference/orphans
//
// `items` is list of player json (Reminder: they aren't Player instances)
socket.on(':snapshot', (playerItems) => {
  for (const item of playerItems) {
    // Ignore our own data
    if (item.id === state.userId) continue
    const player = state.simulation.getPlayer(item.id)
    player.body.position = item.position
    player.body.angle = item.angle
    player.body.velocity = item.velocity
  }
})


socket.on('disconnect', () => {
  console.log('disconnected...')
})


// KEYS


let keysDown = {
  up: false, down: false, left: false, right: false, bomb: false
}
window.onkeydown = function (e) {
  if (e.which === 38) { keysDown['up'] = true }
  if (e.which === 40) { keysDown['down'] = true }
  if (e.which === 37) { keysDown['left'] = true }
  if (e.which === 39) { keysDown['right'] = true }
  if (e.which === 70) { keysDown['bomb'] = true }
}
window.onkeyup = function (e) {
  if (e.which === 38) { keysDown['up'] = false }
  if (e.which === 40) { keysDown['down'] = false }
  if (e.which === 37) { keysDown['left'] = false }
  if (e.which === 39) { keysDown['right'] = false }
  if (e.which === 70) { keysDown['bomb'] = false }
}


// KEY HANDLERS


const wasDown = { up: false, down: false, left: false, right: false }

// Returns history item if key transitioned
function handleInput (key) {
  if (keysDown[key] && !wasDown[key]) {
    const historyItem = ['keydown', key]
    /* socket.send(JSON.stringify(historyItem))*/
    wasDown[key] = true
    // play engine sound if we're thrusting
    if (key === 'up' || key === 'down') {
      sounds.engine.play()
    }
    return historyItem
  } else if (!keysDown[key] && wasDown[key]) {
    const historyItem = ['keyup', key]
    /* socket.send(JSON.stringify(historyItem))*/
    wasDown[key] = false
    // Pause engine sound if we aren't holding down other thrust keys
    if (wasDown['up'] === false && wasDown['down'] === false) {
      sounds.engine.pause()
    }
    return historyItem
  }
}


// UPDATE LOOP




let lastUpdate

function update () {
  const now = performance.now()
  // Gather input this frame
  const turnItem = handleInput('left') || handleInput('right')
  const thrustItem = handleInput('up') || handleInput('down')
  // Apply local input
  state.simulation.enqueueInputs(
    state.userId,
    [turnItem, thrustItem].filter(Boolean)
  )
  // Shoot bomb
  if (keysDown.bomb) {
    // Spawn bomb in simulation
    const bomb = state.simulation.shootBomb(state.userId)
    // Tell server about bomb shot (if there was one)
    if (bomb) {
      sounds.bombShoot.play()
      socket.emit(':bombShot', {
        id: bomb.id, // server uses client's id
        position: Array.from(bomb.body.position),
        velocity: Array.from(bomb.body.velocity)
      })
    }
  }
  // Physics
  const deltaTime = lastUpdate ? (now - lastUpdate) / 1000 : 0
  // maxSubStep is 125 to ensure 1/60*maxSubStep is always less than our
  // max deltaTime which should be about 1.00 seconds (when user tabs
  // away from the game)
  state.simulation.step(deltaTime, 125)

  // Prepare for next frame
  lastUpdate = now
}


// EVENT HANDLER WHEN USER CLICKS THE STAGE


// Teleport current user to wherever they click (for debugging)
// yi = inverted y (pixi coords)
function onStageClick ({x, y: yi}) {
  if (!state.userId) return
  // convert back to p2 coords
  const y = mxp(state.simulation.height) - yi
  const player = state.simulation.getPlayer(state.userId)
  player.body.position = [pxm(x), pxm(y)]
  vec2.scale(player.body.velocity, player.body.velocity, 0.60)
}


// RENDER LOOP


let lastRender

// TODO: Relocate to the HUD update function
const fpsNode = document.querySelector('#fps')
let sinceFpsUpdate = 0
let frameDurations = []

function renderLoop (now) {
  requestAnimationFrame(renderLoop)
  state.render(state.simulation, state.userId, state.spritesToRemove, state.detonatedBombs, state.killedPlayers, state.showHitbox)
  state.detonatedBombs = []
  state.spritesToRemove = []
  state.killedPlayers = []

  // Update FPS HUD once per second
  sinceFpsUpdate += lastRender ? (now - lastRender) : 0
  if (lastRender) {
    frameDurations.push(now - lastRender)
  }
  if (sinceFpsUpdate >= 1000) {
    const avgDuration = frameDurations.reduce((memo, n) => memo + n, 0) / frameDurations.length
    fpsNode.innerHTML = Math.round(1000 / avgDuration)
    sinceFpsUpdate = 0
    frameDurations = []
  }

  // Prepare for next frame
  lastRender = now
}


// Junk drawer of all the stuff we must setup after the
// simulation is loaded.
// TODO: Improve.


function startClientStuff () {
  // UPDATE TEMPORARY OVERLAY

  ;(function () {
    const nodes = {
      angle: document.querySelector('#player-angle'),
      bodyAngle: document.querySelector('#body-angle'),
      speed: document.querySelector('#player-speed'),
      curEnergy: document.querySelector('#player-cur-energy'),
      maxEnergy: document.querySelector('#player-max-energy')
    }
    state.simulation.world.on('postStep', () => {
      const player = state.simulation.getPlayer(state.userId)
      nodes.angle.innerHTML = Math.floor(player.deg)
      nodes.bodyAngle.innerHTML = util.rad2deg(util.normalizeRad(player.body.angle)).toFixed(2)
      nodes.speed.innerHTML = vec2.length(player.body.velocity).toFixed(2)
      nodes.curEnergy.innerHTML = player.curEnergy
      nodes.maxEnergy.innerHTML = player.maxEnergy
    })
  })()


  // POST STEP


  state.simulation.world.on('postStep', function () {
    const player = state.simulation.getPlayer(state.userId)

    // Move current user
    // Convert each input into force
    for (const [kind, key] of player.inputs) {
      if (kind === 'keydown') {
        if (key === 'up') {
          Physics.thrust(player.thrust, player.body)
          player.updateCollisionMask()
        } else if (key === 'down') {
          Physics.thrust(-player.thrust, player.body)
          player.updateCollisionMask()
        }
        if (key === 'left') {
          Physics.rotateLeft(player.turnSpeed, player.body)
        } else if (key === 'right') {
          Physics.rotateRight(player.turnSpeed, player.body)
        }
      } else if (kind === 'keyup' && (key === 'left' || key == 'right')) {
        Physics.zeroRotation(player.body)
      }
    }
    // Clear inputs for next frame
    player.inputs = []

    // Ensure user isn't going too fast
    player.enforceMaxSpeed()
  })


  // HANDLE BOMB<->WALL CONTACT

  // state.simulation.on('bomb:hitPlayer', ({bomb, victim, shooter}) => {
  // })

  state.simulation.on('bomb:hitWall', ({bomb, wallBody}) => {
    console.log('bomb:hitWall. bomb:', bomb && bomb.id)
    if (bomb) {
      detonateBombFx(bomb.id, bomb.body.position[0], bomb.body.position[1])
      state.simulation.removeBomb(bomb.id)
    }
  })


  // TRACK WHETHER PLAYER IS TOUCHING WALL
  //
  // If player it touching a wall, slow them down


  state.simulation.world.on('beginContact', ({bodyA, bodyB}) => {
    if (bodyB.isPlayer && bodyA.isWall) {
      bodyB.damping = 0.85
      sounds.bounce.play()
    } else if (bodyA.isPlayer && bodyB.isWall) {
      bodyA.damping = 0.85
      sounds.bounce.play()
    }
  })

  state.simulation.world.on('endContact', ({bodyA, bodyB}) => {
    if (bodyB.isPlayer && bodyA.isWall) {
      bodyB.damping = 0.1 // back to p2 default
    } else if (bodyA.isPlayer && bodyB.isWall) {
      bodyA.damping = 0.1 // back to p2 default
    }
  })


  // BROADCAST POSITION -> SERVER

  ;(function () {
    const perSecond = 15

    function broadcastPosition () {
      const player = state.simulation.getPlayer(state.userId)
      socket.emit(':position', [
        player.body.interpolatedPosition,
        player.body.interpolatedAngle,
        player.body.velocity
      ])
    }

    setInterval(broadcastPosition, 1000 / perSecond)
  })()

}


// DEBUG: PRINT WINDOW VISIBILITY

;(function () {
  let isVisible = true
  document.addEventListener('visibilitychange', () => {
    isVisible = !isVisible
    console.log('*************************** isVisible', isVisible)
    if (isVisible) {
      // Client is tabbing into game

      // Don't render explosions that accumulated while user was away
      // NOTE: We don't want to do this if these arrays are ever responsible
      //       for cleaning up state garbage.
      state.detonatedBombs = []
      state.killedPlayers = []
      // Avoid catchup
      lastUpdate = null
    } else {
      // Client is tabbing out of game

      // Clear keys pressed when user tabs out
      keysDown = { up: false, down: false, left: false, right: false, bomb: false }
    }
  })
})()


// TRACK IF WINDOW HAS FOCUS


;(function () {
  let isFocused = true
  window.onfocus = () => {
    isFocused = true
  }
  window.onblur = () => {
    isFocused = true
    // Clear keys pressed when game loses focus
    keysDown = { up: false, down: false, left: false, right: false, bomb: false }
  }
})()


// TRACK #show-hitbox CHECKBOX

;(function () {
  const node = document.querySelector('#show-hitbox')
  node.addEventListener('change', function (e) {
    state.showHitbox = e.target.checked
  })
})()




function detonateBombFx (id, x, y) {
  state.detonatedBombs.push([id, x, y])
  state.spritesToRemove.push(id)
  sounds.bombExplode.play()
}
