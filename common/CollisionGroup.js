

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

exports.WALL = Math.pow(2, 8)

// A group that collides with everything
exports.ALL = -1
