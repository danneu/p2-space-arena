

// 3rd
const io = require('socket.io-client')
// 1st
const Simulation = require('../common/simulation')
const Player = require('../common/player')
const Bomb = require('../common/bomb')
const Physics = require('../common/physics')
const renderer = require('./renderer')


// STATE


const state = {
  userId: null,
  simulation: new Simulation({ x: 1400, y: 400 }),
  // Pass into `render` when we need to remove a sprite
  // Remember to reset it after render.
  spritesToRemove: []
}


// SOCKET


const socket = window.location.hostname === 'localhost'
  ? io('ws://localhost:3000')
  : io('ws://p2-space-arena.herokuapp.com')


// socket.on('open', ...)


socket.on(':user_id', (userId) => {
  console.log('[recv :user_id]', userId)
  state.userId = userId
  // Start update loop when user is ready
  requestAnimationFrame(update)
})


socket.on(':player_joined', (data) => {
  console.log('[recv :player_joined]', data)
  const player = Player.fromJson(data)
  state.simulation.addPlayer(player)
})


socket.on(':player_left', (userId) => {
  console.log('[recv :player_left]', userId)
  state.simulation.removePlayer(userId)
  state.spritesToRemove.push(userId)
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
  state.simulation.removeBomb(bomb.id)
  state.spritesToRemove.push(bomb.id)
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


const keysDown = {
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
    return historyItem
  } else if (!keysDown[key] && wasDown[key]) {
    const historyItem = ['keyup', key]
    /* socket.send(JSON.stringify(historyItem))*/
    wasDown[key] = false
    return historyItem
  }
}


// UPDATE LOOP


const render = renderer.init({ x: 1400, y: 400 }, state.simulation.walls)


let lastTime

function update (now) {
  requestAnimationFrame(update)
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
      socket.emit(':bombShot', {
        id: bomb.id, // server uses client's id
        position: Array.from(bomb.body.position),
        velocity: Array.from(bomb.body.velocity)
      })
    }
  }
  // Physics
  //const deltaTime = lastTime ? (now - lastTime) / 1000 : 0
  state.simulation.step()
  // Render
  render(state.simulation, state.spritesToRemove, state.userId)
  // Prepare for next frame
  state.spritesToRemove = []
  lastTime = now
}



// APPLY FORCES TO CURR USER


state.simulation.world.on('postStep', () => {
  const player = state.simulation.getPlayer(state.userId)
  if (!player) { console.log('wtf'); return } // wtf?
  // Convert each input into force
  for (const [kind, key] of player.inputs) {
    if (kind === 'keydown') {
      if (key === 'up') {
        Physics.thrust(200, player.body)
      } else if (key === 'down') {
        Physics.thrust(-200, player.body)
      }
      if (key === 'left') {
        Physics.rotateLeft(3, player.body)
      } else if (key === 'right') {
        Physics.rotateRight(3, player.body)
      }
    } else if (kind === 'keyup' && (key === 'left' || key == 'right')) {
      Physics.zeroRotation(player.body)
    }
  }
  // Clear inputs for next frame
  player.inputs = []
})


// HANDLE BODY CONTACT


// Note: 'impact' event didn't work here with bomb.collisionResponse=false.
state.simulation.world.on('beginContact', ({bodyA, bodyB}) => {
  // when bomb collides with wall, bodyA always seems to be the bomb,
  // bodyB always seems to be the wall. can i depend on this?
  if (bodyA.isWall && bodyB.isBomb) {
    state.simulation.removeBomb(bodyB.id)
    state.spritesToRemove.push(bodyB.id)
  } else if (bodyA.isBomb && bodyB.isWall) {
    throw new Error('Assumption failed: A=bomb B=wall')
  }
})


// TRACK WHETHER PLAYER IS TOUCHING WALL
//
// If player it touching a wall, slow them down



state.simulation.world.on('beginContact', ({bodyA, bodyB}) => {
  if (bodyB.isPlayer && bodyA.isWall) {
    bodyB.damping = 0.75
  }
})

state.simulation.world.on('endContact', ({bodyA, bodyB}) => {
  if (bodyB.isPlayer && bodyA.isWall) {
    bodyB.damping = 0.1 // back to p2 default
  }
})


// BROADCAST POSITION -> SERVER


function broadcastPosition () {
  if (!state.userId) return // bail if user hasnt loaded yet
  const player = state.simulation.getPlayer(state.userId)
  socket.emit(':position', {
    position: player.body.position,
    angle: player.body.angle,
    velocity: player.body.velocity
  })
}

const perSecond = 15
setInterval(broadcastPosition, 1000 / perSecond)
