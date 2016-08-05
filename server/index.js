

// Core
const http = require('http')
const fs = require('fs')
const path = require('path')
// 3rd
const Server = require('socket.io')
const performance = { now: require('performance-now') }
const nodeStatic = require('node-static')
// 1st
const util = require('../common/util')
const { mxp, pxm } = util
const Simulation = require('../common/simulation')
const Player = require('../common/player')
const Bomb = require('../common/bomb')


// STATE


// Load map from file
const map1 = fs.readFileSync(path.join(__dirname, '../map1.txt'), 'utf8')
  .split('\n')
  .filter(Boolean)

const state = {
  simulation: Simulation.fromData(pxm(32), map1, { isServer: true }),
  startTime: Date.now()
}


// HELPERS


const uid = (() => {
  let id = 0
  return () => ++id
})()


// HTTP SERVER


const app = (function () {
  // gzip regexp matches the response's content-type
  const dist = new nodeStatic.Server('dist', { gzip: /\/(javascript|css)/ })
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
  socket.emit(':init', {
    userId,
    // TODO: rofl clean this up
    map: {
      width: state.simulation.width,
      height: state.simulation.height,
      tilesize: state.simulation.tilesize,
      tiles: state.simulation.tiles.map((body) => Array.from(body.position)),
      filters: state.simulation.filters,
      diodes: state.simulation.diodes,
      redFlag: Array.from(state.simulation.redFlag.position),
      blueFlag: Array.from(state.simulation.blueFlag.position),
      redCarrier: state.simulation.redCarrier,
      blueCarrier: state.simulation.blueCarrier
    }
  })
  // Broadcast the newcomer to everyone including newcomer
  server.emit(':playerJoined', player.toJson())
  // Tell newcomer of users already in the game
  for (const id in state.simulation.players) {
    socket.emit(':playerJoined', state.simulation.players[id].toJson())
  }
  // Begin simulating the player (don't want newcomer to appear
  // in snapshots til everyone got :playerJoined to create his sprite)
  state.simulation.addPlayer(player)
  // Hook up game events
  socket.on(':position', (packet) => onPosition(socket, packet))
  socket.on(':bombShot', (bombData) => onBombShot(socket, bombData))
})


function onDisconnect (socket) {
  console.log('[disconnect] a client left')
  // if disconnecting player was a flag carrier, then reset the carrier
  if (socket.userId === state.simulation.redCarrier) {
    state.simulation.redCarrier = null
    server.emit(':flagDropped', 'RED')
  } else if (socket.userId === state.simulation.blueCarrier) {
    state.simulation.blueCarrier = null
    server.emit(':flagDropped', 'BLUE')
  }
  // drop player from simulation
  state.simulation.removePlayer(socket.userId)
  // tell everyone about it
  server.emit(':playerLeft', socket.userId)
}


// Player is broadcasting their position
function onPosition (socket, [position, angle, velocity]) {
  const player = state.simulation.getPlayer(socket.userId)
  player.body.position = position
  player.body.angle = angle
  player.body.velocity = velocity
}


// When a bomb is shot, add it to our simulation
function onBombShot (socket, {id, position, velocity}) {
  console.log('[recv :bombShot]', id, socket.userId, position, velocity)
  // server uses client's bomb id (uuid)
  const team = state.simulation.getPlayer(socket.userId).team
  const bomb = new Bomb(id, socket.userId, team, position, velocity)
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
  state.simulation.step(deltaTime)
  lastTime = now
}

const updatesPerSecond = 60
setInterval(update, 1000 / updatesPerSecond)


// CHECK FOR BOMB COLLISION


state.simulation.on('bomb:hitPlayer', ({bomb, victim, shooter}) => {
  // we only remove bomb from simulation on server when it hits the playe.
  // the client will wait til a wall hit or til server broadcasts player hit.
  // TODO: Handle race condition on client: local wall hit vs server player hit
  state.simulation.removeBomb(bomb.id)
  server.emit(':bombHit', {
    bomb: bomb.toJson(),
    victim: victim.toJson()
  })
  // TODO: In the future, affect victim.curEnergy by shooter.bombDamage
  // and broadcast kills. but for now, bombs just insta-gib players
  // so we can overload :bombHit.
})

state.simulation.on('bomb:hitWall', ({bomb, wallBody}) => {
  if (bomb) state.simulation.removeBomb(bomb.id)
})


// EMIT SIMULATION EVENTS TO CLIENTS


state.simulation.on('flag:take', ({player, flagTeam}) => {
  server.emit(':flagTaken', [flagTeam, player.id])
})


state.simulation.on('flag:capture', ({player}) => {
  // TODO: :flagCaptured
  server.emit(':flagCapture', player.team)
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
