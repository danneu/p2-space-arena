

// Native
const assert = require('assert')
// 3rd
const p2 = require('p2')
const _ = require('lodash')
// 1st
const Physics = require('./physics')
const Player = require('./player')


module.exports = Simulation


// HELPERS


// Returns a p2.Body
function makeWall (x, y, angle) {
  const body = new p2.Body({ mass: 0, angle })
  body.addShape(new p2.Plane())
  body.position = [x, y]
  return body
}


// SIMULATION


function Simulation ({x, y}) {
  assert(Number.isInteger(x))
  assert(Number.isInteger(y))
  this.world = new p2.World({ gravity: [0, 0] })
  this.players = Object.create(null) // mapping of userId -> Player
  // WALLS
  const top = makeWall(0, y, Math.PI)
  const bottom = makeWall(0, 0, 0)
  const right = makeWall(x, 0, Math.PI / 2)
  const left = makeWall(0, 0, (3 * Math.PI) / 2)
  ;[top, bottom, left, right].forEach((wall) => this.world.addBody(wall))
}


// Returns Player
Simulation.prototype.createPlayer = function (id) {
  assert(Number.isInteger(id))
  return new Player(id, this.getNextTeamAssignment())
}


// Adds player to the simulation. Must call this after creating a player.
Simulation.prototype.addPlayer = function (player) {
  assert(player)
  this.world.addBody(player.body)
  this.players[player.id] = player
}


Simulation.prototype.getPlayer = function (id) {
  assert(Number.isInteger(id))
  return this.players[id]
}


Simulation.prototype.removePlayer = function (id) {
  assert(Number.isInteger(id))
  const body = this.world.getBodyById(id)
  this.world.removeBody(body)
  //this.world.removeBody(this.players[id].body)
  delete this.players[id]
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
  console.log('userId', userId)
  const player = this.getPlayer(userId)
  player.keysDown[key] = kind === 'keydown'
  player.inputs.push([kind, key])
}


Simulation.prototype.step = function (dt) {
  for (const id in this.players) {
    const player = this.players[id]
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
    // Convert each input into force
    for (const [kind, key] of player.inputs) {
      if (kind === 'keydown') {
        if (key === 'up') {
          Physics.thrust(6000 * dt, player.body)
        } else if (key === 'down') {
          Physics.thrust(-6000 * dt, player.body)
        }
        if (key === 'left') {
          Physics.rotateLeft(180 * dt, player.body)
        } else if (key === 'right') {
          Physics.rotateRight(180 * dt, player.body)
        }
      } else if (kind === 'keyup' && (key === 'left' || key == 'right')) {
        Physics.zeroRotation(player.body)
      }
      // Clear inputs for next frame
      player.inputs = []
    }
  }
  // Now we simulate a step with our new forces

  // On the client, no matter how far behind we are, we only want to
  // do one step, we don't want to 'catch them up'.
  const maxSubSteps = 1
  this.world.step(1 / 60, dt, maxSubSteps)
}
