
// mod(-1, 100) -> 99
// mod(101, 100) -> 1
exports.mod = function (n, d) {
  return ((n % d) + d) % d;
}

// nearestMulitple(8, 9) => 9
// nearestMultiple(10, 9) => 9
// nearestMultiple(15, 9) => 18
// nearestMultiple(1, 9) => 0
//
// (Float, Int) => Int
exports.nearestMultiple = function (n, mult) {
  return mult * Math.round(n / mult)
}



exports.rad2deg = function (rad) {
  return rad * 180 / Math.PI
}


exports.deg2rad = function (deg) {
  return deg * Math.PI / 180
}


exports.clampDeg = function (deg) {
  return exports.mod(exports.nearestMultiple(deg, 9), 360)
}


exports.clampRad = function (rad) {
  return exports.deg2rad(exports.clampDeg(exports.rad2deg(rad)))
}


// cheaper mod
exports.normalizeRad = function (rad) {
  rad = rad % (Math.PI * 2)
  if (rad < 0){
    rad += (Math.PI * 2)
  }
  return rad
}


exports.randInt = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}


exports.randNth = function (items) {
  return items[Math.floor(Math.random() * items.length)]
}
