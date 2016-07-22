
// 3rd
const p2 = require('p2')


module.exports = Player


function Player (id, team, position, angle) {
  if (!team) throw new Error('Must initialize player with a team')
  this.id = id
  this.team = team
  this.body = (function() {
    const body = new p2.Body({
      id,
      //mass: 5,
      mass: 1,
      position: position || [100, 100]
    })
    body.isPlayer = true
    body.addShape(new p2.Circle({ radius: 15 }))
    body.angle = angle || 0
    return body
  })()
  // INPUTS
  this.keysDown = { left: false, right: false, up: false, down: false }
  this.inputs = []
}


// Static


Player.fromJson = function (data) {
  return new Player(data.id, data.team, data.position, data.angle)
}


// Instance


Player.prototype.toJson = function () {
  return {
    id: this.id,
    team: this.team,
    // TODO, send binary
    position: [this.body.position[0], this.body.position[1]],
    angle: this.body.angle,
    velocity: [this.body.velocity[0], this.body.velocity[1]]
  }
}
