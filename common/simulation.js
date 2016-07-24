

// Native
const assert = require('assert')
// 3rd
const p2 = require('p2')
const _ = require('lodash')
// 1st
const Physics = require('./physics')
const Player = require('./player')
const Bomb = require('./bomb')
const Material = require('./material')
const { ALL, WALL } = require('./CollisionGroup')


module.exports = Simulation


// HELPERS


// Returns a p2.Body
function makeWall (id, x, y, angle) {
  // wtf, setting id on wall seems to fix tunnel issue???
  // besides, thought it had to be a number
  const body = new p2.Body({ id, mass: 0, angle })
  const shape = new p2.Plane()
  shape.material = Material.wall
  shape.collisionGroup = WALL
  // Walls collide with everything except walls
  shape.collisionMask = ALL ^ WALL
  body.addShape(shape)
  body.position = [x, y]
  body.isWall = true
  return body
}


// SIMULATION


function Simulation ({x, y}) {
  assert(Number.isInteger(x))
  assert(Number.isInteger(y))
  this.world = (function () {
    const world = new p2.World()
    world.applyGravity = false
    // turn off event we aren't using
    world.emitImpactEvent = false
    return world
  })()
  this.players = Object.create(null) // mapping of userId -> Player
  this.bombs = Object.create(null) // mapping of userId -> Bomb
  // WALLS
  const top = makeWall('top', 0, y, Math.PI)
  const bottom = makeWall('bottom', x, 0, 0)
  const right = makeWall('right', x, y, Math.PI / 2)
  const left = makeWall('left', 0, 0, (3 * Math.PI) / 2)
  // exposed for debug
  this.walls = [top, bottom, left, right]
  for (const body of [top, bottom, left, right]) {
    this.world.addBody(body)
  }
  // MATERIALS
  this.world.addContactMaterial(Material.wallVsShip)
}


// This method should be used to init a Player instance since
// it assigns the team and sets the position based on simulation state.
//
// Returns Player
Simulation.prototype.createPlayer = function (id) {
  assert(Number.isInteger(id))
  // ship x coord determined by how many players are in the game
  // to avoid the tired case of overlapping in development
  const position = [100 * (this.playerCount() + 1), 100]
  return new Player(id, this.getNextTeamAssignment(), position)
}


// Adds player to the simulation. Must call this after creating a player.
Simulation.prototype.addPlayer = function (player) {
  assert(player)
  this.world.addBody(player.body)
  this.players[player.id] = player
}


Simulation.prototype.getPlayer = function (id) {
  assert(id)
  return this.players[id]
}


Simulation.prototype.getBomb = function (id) {
  assert(id)
  return this.bombs[id]
}


Simulation.prototype.addBomb = function (bomb) {
  assert(bomb)
  this.world.addBody(bomb.body)
  this.bombs[bomb.id] = bomb
}


Simulation.prototype.removePlayer = function (id) {
  assert(Number.isInteger(id))
  const body = this.world.getBodyById(id)
  this.world.removeBody(body)
  //this.world.removeBody(this.players[id].body)
  delete this.players[id]
}


Simulation.prototype.removeBomb = function (id) {
  assert(id)
  const body = this.world.getBodyById(id)
  this.world.removeBody(body)
  delete this.bombs[id]
}


Simulation.prototype.playerCount = function () {
  return Object.keys(this.players).length
}


// returns a mapping of team color to array of players
// { 'RED': [], 'BLUE', [] }
Simulation.prototype.getTeams = function () {
  return Object.assign(
    { RED: [], BLUE: [] },
    _.groupBy(_.values(this.players), 'team')
  )
}


// Returns the team that the next player should be added to
Simulation.prototype.getNextTeamAssignment = function () {
  const {RED, BLUE} = this.getTeams()
  if (RED.length === BLUE.length) {
    return 'RED'
  } else {
    return RED.length < BLUE.length ? 'RED' : 'BLUE'
  }
}


Simulation.prototype.enqueueInput = function (userId, [kind, key]) {
  assert(Number.isInteger(userId))
  assert(typeof kind === 'string')
  assert(typeof key === 'string')
  const player = this.getPlayer(userId)
  player.keysDown[key] = kind === 'keydown'
  player.inputs.push([kind, key])
}


// Creates bomb for player and adds it to simulation
//
// Returns Bomb if the player was able to shoot. null means
// they had insufficient cooldown.
Simulation.prototype.shootBomb = function (userId) {
  assert(Number.isInteger(userId))
  const player = this.getPlayer(userId)
  // check cooldown
  if (Date.now() - player.lastBombAt < 1000) return
  const bomb = Bomb.fromPlayer(player)
  this.bombs[bomb.id] = bomb
  this.world.addBody(bomb.body)
  // update cooldown
  player.lastBombAt = Date.now()
  return bomb
}


////////////////////////////////////////////////////////////


const timeStep = 1 / 60

// If deltaTime is not passed in, then there will be interpolation
Simulation.prototype.step = function (deltaTime, maxSubSteps) {
  if (deltaTime) {
    this.world.step(timeStep, deltaTime, maxSubSteps || 10)
  } else {
    this.world.step(timeStep)
  }
  // After the step, enforce player angles
  for (const id in this.players) {
    this.players[id].updateDeg()
  }
}


Simulation.prototype.enqueueInputs = function (userId, inputs) {
  const player = this.players[userId]
  // Update player's keysDown map and enqueue new inputs
  for (const [kind, key] of inputs) {
    player.inputs.push([kind, key])
    player.keysDown[key] = kind === 'keydown'
  }
  // If player is still holding a key, enqueue the input for this frame
  if (player.keysDown.up) {
    player.inputs.push(['keydown', 'up'])
  } else if (player.keysDown.down) {
    player.inputs.push(['keydown', 'down'])
  }
  if (player.keysDown.left) {
    player.inputs.push(['keydown', 'left'])
  } else if (player.keysDown.right) {
    player.inputs.push(['keydown', 'right'])
  }
  if (player.keysDown.bomb) {
    player.inputs.push(['keydown', 'bomb'])
  }
}


// A snapshot is the list of players so that each client can
// draw the other players on their screen.
//
// TODO: Delta compression
Simulation.prototype.toSnapshot = function () {
  const snapshot = []
  for (const id in this.players) {
    snapshot.push(this.players[id].toJson())
  }
  return snapshot
}
