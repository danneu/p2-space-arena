

// 3rd
const { Howl, Howler } = require('howler')


// API:
//
// - sound.play()
// - sound.pause()


// here we wrap a Howl sound instance so that .play() and .pause()
// only affect that one instance rather than spawn new sounds
exports.engine = (function () {
  const sound = new Howl({
    src: ['./sounds/rev.mp3'],
    loop: true,
    volume: 0.1
  })
  let id
  return {
    play () {
      if (!id) {
        id = sound.play()
        return
      }
      sound.play(id)
    },
    pause () {
      sound.pause(id)
    }
  }
})()


// ship bounces off wall
exports.bounce = new Howl({
  src: ['./sounds/bounce.mp3'],
  volume: 0.5
})


exports.bombExplode = new Howl({
  src: ['./sounds/ebombex.mp3'],
  volume: 0.1
})


exports.bombShoot = new Howl({
  src: ['./sounds/bomb3.mp3'],
  volume: 0.1
})


exports.flagTakenBySelf = new Howl({
  src: ['./sounds/flag.mp3'],
  volume: 0.1
})


// hallelujah
exports.friendlyCapture = new Howl({
  src: ['./sounds/bong5.mp3'],
  volume: 0.1
})


// sheep
exports.enemyCapture = new Howl({
  src: ['./sounds/bong24.mp3'],
  volume: 0.1
})


/* exports.pickupGreen = new Howl({
 *   urls: ['./sounds/prize.mp3'],
 *   volume: 0.25
 * })*/
