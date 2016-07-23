

const p2 = require('p2')


// MATERIALS


exports.wall = new p2.Material()

exports.ship = new p2.Material()


// CONTACT MATERIALS


exports.wallVsShip = new p2.ContactMaterial(exports.wall, exports.ship, {
  restitution: 0.5,
  stiffness: Number.MAX_VALUE,
  friction: 0, // prevent wall from turning the ship
  frictionRelaxation: 0
})
