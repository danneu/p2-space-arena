
// 3rd
const p2 = require('p2')
const faker = require('faker')
// 1st
const Material = require('./material')
const { ALL, PLAYER } = require('./CollisionGroup')
const util = require('./util')


module.exports = Player


function Player (id, team, position, angle) {
  console.assert(team === 'RED' || team === 'BLUE')
  if (!team) throw new Error('Must initialize player with a team')
  this.id = id
  // TODO: Hook up uname
  this.uname = faker.internet.userName().slice(0, 14)
  this.team = team
  this.lastBombAt = 0  // millisecond timestamp since last bomb shot
  this.bombCost = 1000
  this.maxEnergy = 1500
  this.curEnergy = this.maxEnergy
  // Per seconds
  this.energyPerSecond = 500
  this.turnSpeed = Math.PI // rad per second
  this.thrust =  200
  // The player's clamped angle in degrees. Use this for game logic,
  // like when calculating the trajectory of the bomb they're shooting.
  this.deg = util.rad2deg(angle || 0)
  this.body = (function() {
    const body = new p2.Body({
      id,
      mass: 1,
      position: position || [100, 100]
    })
    body.isPlayer = true
    // TODO: graphic radius is 15, but seems best to make collision
    // radius a lil smaller for wall collisions, but not bomb collisions.
    const shape = new p2.Circle({ radius: 15 })
    // Players don't collide with each other
    shape.collisionGroup = PLAYER
    shape.collisionMask = ALL ^ PLAYER
    shape.material = Material.ship
    body.addShape(shape)
    body.angle = angle || 0
    // TODO: Don't store stuff in the p2 body
    body.team = team
    return body
  })()
  // INPUTS
  this.keysDown = { left: false, right: false, up: false, down: false }
  this.inputs = []
}


// Static


Player.fromJson = function (data) {
  const player = new Player(data.id, data.team, data.position, data.angle)
  player.uname = data.uname
  return player
}


// Instance


Player.prototype.toJson = function () {
  return {
    id: this.id,
    team: this.team,
    uname: this.uname,
    // TODO, send binary
    position: [this.body.position[0], this.body.position[1]],
    velocity: [this.body.velocity[0], this.body.velocity[1]],
    angle: this.body.angle
  }
}


// Clamps the player's angle to 9-degree intervals
Player.prototype.updateDeg = function () {
  this.deg = util.rad2deg(util.clampRad(this.body.angle))
}


Player.prototype.rechargeEnergy = function (deltaTime) {
  if (this.curEnergy === this.maxEnergy) return
  this.curEnergy = Math.min(
    this.maxEnergy,
    Math.round(this.curEnergy + this.energyPerSecond * deltaTime)
  )
}
