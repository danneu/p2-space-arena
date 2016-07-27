

// Core
const assert = require('assert')
// 3rd
const p2 = require('p2')
const vec2 = p2.vec2
// 1st
const Physics = require('./physics')
const Uuid = require('./uuid')
const { ALL, BOMB } = require('./CollisionGroup')
const util = require('./util')


module.exports = Bomb


function Bomb (id, userId, position, velocity) {
  assert(id)
  assert(Number.isInteger(userId))
  assert(position)
  assert(velocity)
  this.id = id
  this.userId = userId
  this.body = (function() {
    const body = new p2.Body({
      id,
      mass: 1,
      position
    })
    // bombs have no air resistance
    body.damping = 0
    // does not produce contact forces
    body.collisionResponse = false
    // only triggers on overlap
    body.sensor = true
    const shape = new p2.Circle({ radius: 1 })
    shape.collisionGroup = BOMB
    // Bombs dont collide with each other
    shape.collisionMask = ALL ^ BOMB
    body.addShape(shape)
    body.velocity = velocity
    body.isBomb = true
    return body
  })()
}


// Static


Bomb.fromJson = function (data) {
  return new Bomb(data.id, data.userId, data.position, data.velocity)
}


Bomb.fromPlayer = function (player) {
  player.curEnergy -= player.bombCost
  const id = Uuid.generate()
  const position = Physics.nose(player.body)
  const velocity = vec2.create()
  vec2.rotate(velocity, vec2.fromValues(0, 300), -util.deg2rad(player.deg))
  vec2.add(velocity, player.body.velocity, velocity)
  return new Bomb(id, player.id, position, velocity)
}


// Instance


Bomb.prototype.toJson = function () {
  return {
    id: this.id,
    userId: this.userId,
    // TODO, send binary
    position: Array.from(this.body.position),
    velocity: Array.from(this.body.velocity)
  }
}
