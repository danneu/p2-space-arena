

// Collision groups


exports.Player = {}
exports.Player.RED = Math.pow(2, 0)
exports.Player.BLUE = Math.pow(2, 1)
exports.Player.ANY = exports.Player.RED | exports.Player.BLUE

exports.Bomb = {}
exports.Bomb.RED = Math.pow(2, 2)
exports.Bomb.BLUE = Math.pow(2, 3)
exports.Bomb.ANY = exports.Bomb.RED | exports.Bomb.BLUE

exports.Flag = {}
exports.Flag.RED = Math.pow(2, 4)
exports.Flag.BLUE = Math.pow(2, 5)
exports.Flag.ANY = exports.Flag.RED | exports.Flag.BLUE

exports.Filter = {}
exports.Filter.RED = Math.pow(2, 6)
exports.Filter.BLUE = Math.pow(2, 7)
exports.Filter.ANY = exports.Filter.RED | exports.Filter.BLUE

exports.Diode = {}
exports.Diode.UP = Math.pow(2, 8)
exports.Diode.DOWN = Math.pow(2, 9)
exports.Diode.LEFT = Math.pow(2, 10)
exports.Diode.RIGHT = Math.pow(2, 11)

exports.WALL = Math.pow(2, 12)

// A group that collides with everything
exports.ALL = -1



exports.velocityToDiodeMask = function (velocity) {
  let mask = 0
  if (velocity[0] < 0) {
    // traveling left
    mask = mask | exports.Diode.RIGHT
  } else if (velocity[0] > 0) {
    // traveling right
    mask = mask | exports.Diode.LEFT
  }
  if (velocity[1] < 0) {
    // traveling down
    mask = mask | exports.Diode.UP
  } else if (velocity[1] > 0) {
    // traveling up
    mask = mask | exports.Diode.DOWN
  }
  return mask
}
