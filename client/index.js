

// 3rd
const io = require('socket.io-client')
// 1st
const Simulation = require('../common/simulation')
const Player = require('../common/player')
const render = require('./render')


// STATE


const state = {
  userId: null,
  simulation: new Simulation({ x: 1400, y: 400 }),
  // Pass into `render` when we need to remove a sprite
  // Remember to reset it after render.
  spritesToRemove: []
}


// SOCKET


const socket = io('ws://localhost:3000')


// socket.on('open', ...)


socket.on(':user_id', (userId) => {
  console.log('[recv :user_id]', userId)
  state.userId = userId
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


socket.on(':snapshot', (data) => {
  console.log('[recv :snapshot]')
  applySnapshot(data)
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


let lastTime

function update (now) {
  requestAnimationFrame(update)
  // Gather input this frame
  const turnItem = handleInput('left') || handleInput('right')
  const thrustItem = handleInput('up') || handleInput('down')
  // Apply local input
  ;[turnItem, thrustItem].filter(Boolean).forEach((item) => {
    state.simulation.enqueueInput(state.userId, item)
  })
  // Shoot bomb
  if (keysDown.bomb) {
    // Spawn bomb in simulation
    const body = state.simulation.shootBomb(state.userId)
    // Tell server about bomb shot
    /* socket.emit(':bombShoot', {
     *   position: Array.from(body.position),
     *   velocity: Array.from(body.velocity)
     * })*/
  }
  // Physics
  const deltaTime = lastTime ? (now - lastTime) / 1000 : 0
  state.simulation.step(deltaTime)
  // Render
  render(state.simulation, state.spritesToRemove, state.userId)
  // Prepare for next frame
  state.spritesToRemove = []
  lastTime = now
}

requestAnimationFrame(update)


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
