

// 3rd
const p2 = require('p2')
const vec2 = p2.vec2
// 1st
const Physics = require('./physics')
const Uuid = require('./uuid')
const Group = require('./CollisionGroup')
const util = require('./util')


module.exports = Bomb


function Bomb (id, userId, team, position, velocity) {
  console.assert(id)
  console.assert(team === 'RED' || team === 'BLUE')
  console.assert(Number.isInteger(userId))
  console.assert(position)
  console.assert(position)
  this.id = id
  this.userId = userId
  this.body = (() => {
    const body = new p2.Body({
      id,
      mass: 1,
      position
    })
    // bombs have no air resistance
    body.damping = 0
    // does not produce contact forces
    body.collisionResponse = false
    // only triggers on overlap FIXME: this belongs on shape
    /* body.sensor = true*/
    const shape = new p2.Circle({ radius: 3 })
    shape.collisionGroup = Group.Bomb[team]
    console.log('%s bomb msk should be targetting %s', team, util.flipTeam(team))
    const otherTeam = util.flipTeam(team)
    shape.collisionMask = Group.WALL | Group.Player[otherTeam] | Group.Filter[otherTeam]
    body.addShape(shape)
    body.velocity = velocity
    body.isBomb = true
    return body
  })()
}


// Static


Bomb.fromJson = function (data) {
  return new Bomb(data.id, data.userId, data.team, data.position, data.velocity)
}


Bomb.fromPlayer = function (player) {
  player.curEnergy -= player.bombCost
  const id = Uuid.generate()
  const position = Physics.nose(player.body)
  const velocity = vec2.create()
  vec2.rotate(velocity, vec2.fromValues(0, 300), -util.deg2rad(player.deg))
  vec2.add(velocity, player.body.velocity, velocity)
  return new Bomb(id, player.id, player.team, position, velocity)
}


// Instance


Bomb.prototype.toJson = function () {
  return {
    id: this.id,
    userId: this.userId,
    team: this.team,
    // TODO, send binary
    position: Array.from(this.body.position),
    velocity: Array.from(this.body.velocity)
  }
}
