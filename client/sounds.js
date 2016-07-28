

// 3rd
const { Howl, Howler } = require('howler')


// API:
//
// - sound.play()
// - sound.pause()
//
// TODO: Add volume control, adjust each sound by a ratio since they
//       shouldn't all be the same volume.
//       Setting everything to volume 0.1 for now


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
  src: ['./sounds/bounce.mp3']
})


exports.bombExplode = new Howl({
  src: ['./sounds/ebombex.mp3'],
  // volume: 0.3
  volume: 0.1
})


exports.bombShoot = new Howl({
  src: ['./sounds/bomb3.mp3'],
  //volume: 0.25
  volume: 0.1
})

/* exports.pickupGreen = new Howl({
 *   urls: ['./sounds/prize.mp3'],
 *   volume: 0.25
 * })*/
