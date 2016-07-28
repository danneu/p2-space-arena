

// 3rd
const io = require('socket.io-client')
const vec2 = require('p2').vec2
// 1st
const util = require('../common/util')
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
  killedPlayers: []
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
  // TODO: I should just change this to renderer.init(simulation, ...)
  state.render = renderer.init({ x: map.width, y: map.height }, state.simulation.walls, state.simulation.tiles, Array.from(state.simulation.redFlag.position), Array.from(state.simulation.blueFlag.position), onStageClick)
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
  const bomb = new Bomb(id, userId, position, velocity)
  state.simulation.addBomb(bomb)
})


// Server is broadcasting a bomb->player collision
// For now just remove the bomb from the sim.
// Reminder: bomb and victim are just json data, not instances
socket.on(':bombHit', ({bomb, victim}) => {
  console.log('[recv :bombHit] bomb=', bomb, 'victim=', victim)
  const simBomb = state.simulation.getBomb(bomb.id)
  // simBomb was already handled by local simulation (see beginContact)
  if (!simBomb) return
  // avoid duplicate explosions
  if (!simBomb.body.detonated) {
    simBomb.body.detonated = true
    state.detonatedBombs.push([bomb.id, ...bomb.position])
    sounds.bombExplode.play()
  }
  state.simulation.removeBomb(bomb.id)
  state.spritesToRemove.push(bomb.id)
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

  // Move current user
  const player = state.simulation.getPlayer(state.userId)
  // Convert each input into force
  for (const [kind, key] of player.inputs) {
    if (kind === 'keydown') {
      if (key === 'up') {
        Physics.thrust(player.thrust, player.body)
      } else if (key === 'down') {
        Physics.thrust(-player.thrust, player.body)
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

  // Prepare for next frame
  lastUpdate = now
}


// EVENT HANDLER WHEN USER CLICKS THE STAGE


// Teleport current user to wherever they click (for debugging)
// yi = inverted y (pixi coords)
function onStageClick ({x, y: yi}) {
  if (!state.userId) return
  // convert back to p2 coords
  const y = state.simulation.height - yi
  state.simulation.getPlayer(state.userId).body.position = [x, y]
}


// RENDER LOOP


let lastRender

// TODO: Relocate to the HUD update function
const fpsNode = document.querySelector('#fps')
let sinceFpsUpdate = 0
let frameDurations = []

function renderLoop (now) {
  requestAnimationFrame(renderLoop)
  state.render(state.simulation, state.userId, state.spritesToRemove, state.detonatedBombs, state.killedPlayers)
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


  // HANDLE BOMB<->WALL CONTACT


  // Sync body.detonated with :bomb_hit
  // body.detonated used so that :bomb_hit and this callback do not
  // repeat each other's work like spawning two explosions
  //
  // This is a mess
  state.simulation.world.on('beginContact', ({bodyA, bodyB}) => {
    // Check wall<->bomb
    if (bodyA.isWall && bodyB.isBomb) {
      if (bodyB.detonated) return
      bodyB.detonated = true
      state.detonatedBombs.push([bodyB.id, ...Array.from(bodyB.position)])
      state.simulation.removeBomb(bodyB.id)
      state.spritesToRemove.push(bodyB.id)
      sounds.bombExplode.play()
    } else if (bodyA.isBomb && bodyB.isWall) {
      if (bodyA.detonated) return
      bodyA.detonated = true
      state.detonatedBombs.push([bodyA.id, ...Array.from(bodyA.position)])
      state.simulation.removeBomb(bodyA.id)
      state.spritesToRemove.push(bodyA.id)
      sounds.bombExplode.play()
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
      socket.emit(':position', {
        position: player.body.interpolatedPosition,
        angle: player.body.interpolatedAngle,
        velocity: player.body.velocity
      })
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
    // Clear keys pressed when user tabs out
    if (!isVisible) {
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
