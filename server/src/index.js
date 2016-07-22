

// 3rd
const Server = require('socket.io')
// 1st
const Simulation = require('../../common/simulation')
const Player = require('../../common/player')


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


// SERVER


const server = new Server()

server.on('connection', (socket) => {
  console.log('[connection] a client joined')
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
  // Hook up remaining events
  socket.on(':position', (packet) => onPosition(socket, packet))
  socket.on('disconnect', () => onDisconnect(socket))
})


function onDisconnect (socket) {
  console.log('[disconnect] a client left')
  // drop player from simulation
  state.simulation.removePlayer(socket.userId)
  // tell everyone about it
  server.emit(':player_left', socket.userId)
}


function onPosition (socket, packet) {
  const player = state.simulation.getPlayer(socket.userId)
  player.body.position = packet.position
  player.body.angle = packet.angle
  player.body.velocity = packet.velocity
}

////////////////////////////////////////////////////////////

server.listen(3000)
