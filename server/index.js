

// Core
const http = require('http')
// 3rd
const Server = require('socket.io')
const performance = { now: require('performance-now') }
const nodeStatic = require('node-static')
// 1st
const Simulation = require('../common/simulation')
const Player = require('../common/player')
const Bomb = require('../common/bomb')


// STATE


const state = {
  simulation: new Simulation({ x: 1400, y: 400 }),
  startTime: Date.now()
}


// HELPERS


const uid = (() => {
  let id = 0
  return () => ++id
})()


// HTTP SERVER


const app = (function () {
  const dist = new nodeStatic.Server('dist')
  return http.createServer((req, res) => {
    req.addListener('end', () => dist.serve(req, res)).resume()
  })
})()


// SOCKET SERVER


const server = Server(app)

server.on('connection', (socket) => {
  console.log('[connection] a client joined')
  socket.on('disconnect', () => onDisconnect(socket))
  // Create player
  const userId = uid()
  const player = state.simulation.createPlayer(userId)
  socket.userId = userId
  // Broadcast the newcomer to everyone including newcomer
  server.emit(':player_joined', player.toJson())
  // Tell newcomer of users already in the game
  for (const id in state.simulation.players) {
    socket.emit(':player_joined', state.simulation.players[id].toJson())
  }
  // Begin simulating the player (don't want newcomer to appear
  // in snapshots til everyone got :player_joined to create his sprite)
  state.simulation.addPlayer(player)
  // Tell newcomer their id
  socket.emit(':user_id', userId)
  // Hook up game events
  socket.on(':position', (packet) => onPosition(socket, packet))
  socket.on(':bombShot', (bombData) => onBombShot(socket, bombData))
})


function onDisconnect (socket) {
  console.log('[disconnect] a client left')
  // drop player from simulation
  state.simulation.removePlayer(socket.userId)
  // tell everyone about it
  server.emit(':player_left', socket.userId)
}


// Player is broadcasting their position
function onPosition (socket, packet) {
  const player = state.simulation.getPlayer(socket.userId)
  player.body.position = packet.position
  player.body.angle = packet.angle
  player.body.velocity = packet.velocity
}


// When a bomb is shot, add it to our simulation
function onBombShot (socket, {id, position, velocity}) {
  console.log('[recv :bombShot]', id, socket.userId, position, velocity)
  // server uses client's bomb id (uuid)
  const bomb = new Bomb(id, socket.userId, position, velocity)
  state.simulation.addBomb(bomb)
  // broadcast bombShot to all players except for the shooter
  socket.broadcast.emit(':bombShot', {
    id, position, velocity,
    userId: socket.userId
  })
}


////////////////////////////////////////////////////////////


// UPDATE LOOP
//
// The server does not simulate players. It just hard-codes their
// position/angle as players broadcast it.
//
// However, the server does simulate bomb velocity and is the authority
// on bomb<->player collision in which case it broadcasts a ':bombHit'
// packet. Players only broadcast :bombShot.


let lastTime

function update () {
  const now = performance.now()
  const deltaTime = lastTime ? (now - lastTime) / 1000 : 0
  state.simulation.world.step(1 / 60, deltaTime)
  // Prepare for next frame
  lastTime = now
}


const updatesPerSecond = 60
setInterval(update, 1000 / updatesPerSecond)


// CHECK FOR BOMB COLLISION


state.simulation.world.on('beginContact', ({bodyA, bodyB}) => {
  // Bomb is hitting a player
  let bomb
  let victim
  let shooter
  if (bodyA.isBomb && bodyB.isPlayer) {
    bomb = state.simulation.getBomb(bodyA.id)
    victim = state.simulation.getPlayer(bodyB.id)
  } else if (bodyA.isPlayer && bodyB.isBomb) {
    bomb = state.simulation.getBomb(bodyB.id)
    victim = state.simulation.getPlayer(bodyA.id)
  } else {
    // No collision, so bail
    return
  }
  // HACK: I need to figure out why the player cannot be found.
  // It's causing a runtime error. For now I'll hack in a short-circuit.
  if (!victim) {
    return
  }
  // Ignore our own bombs
  if (bomb.userId === victim.id) {
    return
  }
  // We can load the shooter now
  shooter = state.simulation.getPlayer(bomb.userId)
  // Ignore friendly-fire
  if (victim.team === shooter.team) {
    return
  }
  // Okay, it was a legit hit on an enemy
  // Remove the bomb from the simulation
  state.simulation.removeBomb(bomb.id)
  // And broadcast :bombHit to everyone
  server.emit(':bombHit', {
    bomb: bomb.toJson(),
    victim: victim.toJson()
  })
})


// BROADCAST SNAPSHOT

// TODO: Only broadcast the *other* players to each user.
// Right now the client has to manually ignore their own data
// (since the client is the authority).
function broadcastSnapshot () {
  server.emit(':snapshot', state.simulation.toSnapshot())
}

(function () {
  const perSecond = 20
  setInterval(broadcastSnapshot, 1000 / perSecond)
})()


////////////////////////////////////////////////////////////


app.listen(process.env.PORT || 3000, () => {
  console.log('Listening on', app.address().port)
})
