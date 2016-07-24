

// https://github.com/photonstorm/phaser/blob/8e03fbd5a53ba1a9f094fa0bd7216e7910df3dc0/src/physics/p2/World.js#L1822
function pxmi (v) {
  return -v
}

// https://github.com/photonstorm/phaser/blob/a29cc649327fe57e4eb0c2b89813aadf33ab6e5b/src/physics/p2/Body.js

exports.thrust = function (speed, body) {
  const magnitude = -speed
  const angle = body.angle + Math.PI / 2
  body.force[0] += magnitude * Math.cos(angle)
  // -1 to fix for pixi's inverted y-axis
  body.force[1] += magnitude * Math.sin(angle) * -1
}

//exports.reverse = function (speed, body) {
  //const magnitude = speed
  //const angle = body.angle + Math.PI / 2
  //body.force[0] -= magnitude * Math.cos(angle)
  //body.force[1] -= magnitude * Math.sin(angle)
//}

exports.zeroRotation = function (body) {
  body.angularVelocity = 0
}

exports.rotateLeft = function (speed, body) {
  body.angularVelocity = -speed
}

exports.rotateRight = function (speed, body) {
  body.angularVelocity = speed
}

exports.normalizeAngle = function (body) {
  body.angle = body.angle % (2 * Math.PI)
  if (body.angle < 0) body.angle += (2 * Math.PI)
  return body
}

// returns position [x, y] of body's nose based on its rotation angle
exports.nose = function (body) {
  var r = body.boundingRadius
  var [x, y] = Array.from(body.position)
  var noseX = x + r * Math.cos(body.angle - Math.PI/2)
  // -1 to fix for pixi's inverted y-axis
  var noseY = y + r * Math.sin(body.angle - Math.PI/2) * -1
  return [noseX, noseY]
}
