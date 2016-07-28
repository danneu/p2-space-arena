

// Native
const assert = require('assert')
// 3rd
const p2 = require('p2')
const _ = require('lodash')
// 1st
const util = require('./util')
const Physics = require('./physics')
const Player = require('./player')
const Bomb = require('./bomb')
const Material = require('./material')
const { ALL, WALL } = require('./CollisionGroup')


module.exports = Simulation


// HELPERS


// Returns p2.Body
function makeWall (id, x, y, angle) {
  // wtf, setting id on wall seems to fix tunnel issue???
  // besides, thought it had to be a number
  const body = new p2.Body({ id, mass: 0, angle })
  const shape = new p2.Plane()
  shape.material = Material.wall
  shape.collisionGroup = WALL
  // Walls collide with everything except walls
  shape.collisionMask = ALL ^ WALL
  body.addShape(shape)
  body.position = [x, y]
  body.isWall = true
  return body
}


// Returns p2.Body
function makeTile (tilesize, x, y) {
  const body = new p2.Body()
  body.isWall = true
  body.position = [x, y]
  body.tilesize = tilesize
  const shape = new p2.Box({ width: tilesize, height: tilesize })
  shape.material = Material.wall
  // Walls collide with everything except walls
  shape.collisionGroup = WALL
  shape.collisionMask = ALL ^ WALL
  body.addShape(shape)
  return body
}


// SIMULATION


// tiles is array of positions [[x, y], ...]
function Simulation ({
  width, height, tiles, tilesize,
  // each is an [x, y] position
  redFlag, blueFlag,
  // array of [x, y] spawn points
  redSpawns, blueSpawns
  }) {
  console.assert(Number.isInteger(width))
  console.assert(Number.isInteger(height))
  console.assert(Number.isInteger(tilesize))
  console.assert(Array.isArray(tiles))
  console.assert(Array.isArray(redFlag))
  console.assert(Array.isArray(blueFlag))
  console.assert(Array.isArray(redSpawns))
  console.assert(Array.isArray(blueSpawns))
  this.width = width
  this.height = height
  this.tilesize = tilesize
  this.world = (function () {
    const world = new p2.World()
    world.applyGravity = false
    // turn off event we aren't using
    world.emitImpactEvent = false
    return world
  })()
  this.players = Object.create(null) // mapping of userId -> Player
  this.bombs = Object.create(null) // mapping of userId -> Bomb
  // WALLS
  const top = makeWall('top', 0, height, Math.PI)
  const bottom = makeWall('bottom', width, 0, 0)
  const right = makeWall('right', width, height, Math.PI / 2)
  const left = makeWall('left', 0, 0, (3 * Math.PI) / 2)
  // exposed for debug
  this.walls = [top, bottom, left, right]
  for (const body of [top, bottom, left, right]) {
    this.world.addBody(body)
  }
  // TILES
  this.tiles = tiles.map(([x, y]) => makeTile(tilesize, x, y))
  this.tiles.forEach((body) => this.world.addBody(body))
  // SPAWNS
  this.redSpawns = redSpawns
  this.blueSpawns = blueSpawns
  // FLAGS
  this.redFlag = redFlag
  this.blueFlag = blueFlag
  // MATERIALS
  this.world.addContactMaterial(Material.wallVsShip)
}


// This method should be used to init a Player instance since
// it assigns the team and sets the position based on simulation state.
//
// Returns Player
Simulation.prototype.createPlayer = function (id) {
  assert(Number.isInteger(id))
  const team = this.getNextTeamAssignment()

  let position
  if (team === 'RED' && this.redSpawns.length > 0) {
    position = util.randNth(this.redSpawns)
  } else if (team === 'BLUE' && this.blueSpawns.length > 0) {
    position = util.randNth(this.blueSpawns)
  } else {
    // team doesn't have a spawn, so spawn randomly
    // 15 is the ship's hitbox radius to avoid spawning player on edge
    const y = util.randInt(15, this.height - 15)
    // spawn player randomly
    // reds on the left, blues on the right
    let x
    if (team === 'RED') {
      x = util.randInt(15, this.width / 2)
    } else {
      x = util.randInt(this.width / 2, this.width - 15)
    }
    position = [x, y]
  }

  // Face the player towards the opposite team
  const angle = team === 'RED' ? Math.PI/2 : Math.PI/2*3

  return new Player(id, team, position, angle)
}


// Adds player to the simulation. Must call this after creating a player.
Simulation.prototype.addPlayer = function (player) {
  assert(player)
  this.world.addBody(player.body)
  this.players[player.id] = player
}


Simulation.prototype.getPlayer = function (id) {
  assert(id)
  return this.players[id]
}


Simulation.prototype.getBomb = function (id) {
  assert(id)
  return this.bombs[id]
}


Simulation.prototype.addBomb = function (bomb) {
  assert(bomb)
  this.world.addBody(bomb.body)
  this.bombs[bomb.id] = bomb
}


Simulation.prototype.removePlayer = function (id) {
  assert(Number.isInteger(id))
  const body = this.world.getBodyById(id)
  this.world.removeBody(body)
  //this.world.removeBody(this.players[id].body)
  delete this.players[id]
}


Simulation.prototype.removeBomb = function (id) {
  assert(id)
  const body = this.world.getBodyById(id)
  this.world.removeBody(body)
  delete this.bombs[id]
}


Simulation.prototype.playerCount = function () {
  return Object.keys(this.players).length
}


// returns a mapping of team color to array of players
// { 'RED': [], 'BLUE', [] }
Simulation.prototype.getTeams = function () {
  return Object.assign(
    { RED: [], BLUE: [] },
    _.groupBy(_.values(this.players), 'team')
  )
}


// Returns the team that the next player should be added to
Simulation.prototype.getNextTeamAssignment = function () {
  const {RED, BLUE} = this.getTeams()
  if (RED.length === BLUE.length) {
    return 'RED'
  } else {
    return RED.length < BLUE.length ? 'RED' : 'BLUE'
  }
}


Simulation.prototype.enqueueInput = function (userId, [kind, key]) {
  assert(Number.isInteger(userId))
  assert(typeof kind === 'string')
  assert(typeof key === 'string')
  const player = this.getPlayer(userId)
  player.keysDown[key] = kind === 'keydown'
  player.inputs.push([kind, key])
}


// Creates bomb for player and adds it to simulation
//
// Returns Bomb if the player was able to shoot. null means
// they had insufficient cooldown.
Simulation.prototype.shootBomb = function (userId) {
  assert(Number.isInteger(userId))
  const player = this.getPlayer(userId)
  // check cooldown
  if (Date.now() - player.lastBombAt < 1000) return
  // check energy
  if (player.curEnergy - player.bombCost < 0) return
  const bomb = Bomb.fromPlayer(player)
  this.bombs[bomb.id] = bomb
  this.world.addBody(bomb.body)
  // update cooldown
  player.lastBombAt = Date.now()
  return bomb
}


////////////////////////////////////////////////////////////


const timeStep = 1 / 60

Simulation.prototype.step = function (deltaTime, maxSubSteps) {
  this.world.step(timeStep, deltaTime, maxSubSteps || 10)
  for (const id in this.players) {
    const player = this.players[id]
    // After the step, enforce player angles
    player.updateDeg()
    // Recharge player energy
    player.rechargeEnergy(deltaTime)
  }
}


Simulation.prototype.enqueueInputs = function (userId, inputs) {
  const player = this.players[userId]
  // Update player's keysDown map and enqueue new inputs
  for (const [kind, key] of inputs) {
    player.inputs.push([kind, key])
    player.keysDown[key] = kind === 'keydown'
  }
  // If player is still holding a key, enqueue the input for this frame
  if (player.keysDown.up) {
    player.inputs.push(['keydown', 'up'])
  } else if (player.keysDown.down) {
    player.inputs.push(['keydown', 'down'])
  }
  if (player.keysDown.left) {
    player.inputs.push(['keydown', 'left'])
  } else if (player.keysDown.right) {
    player.inputs.push(['keydown', 'right'])
  }
  if (player.keysDown.bomb) {
    player.inputs.push(['keydown', 'bomb'])
  }
}


// A snapshot is the list of players so that each client can
// draw the other players on their screen.
//
// TODO: Delta compression
Simulation.prototype.toSnapshot = function () {
  const snapshot = []
  for (const id in this.players) {
    snapshot.push(this.players[id].toJson())
  }
  return snapshot
}


// STATIC


Simulation.fromData = function (tilesize, data) {
  console.assert(Number.isInteger(tilesize))
  console.assert(Array.isArray(data))
  data = data.reverse()
  const width = data[0].length * tilesize
  const height = data.length * tilesize
  let tiles = []
  let redFlag
  let blueFlag
  let redSpawns = []
  let blueSpawns = []
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[0].length; col++) {
      // short-circuit on empty spaces
      if (data[row][col] === '.') continue
      // Everything is anchored at its center
      const x = col * tilesize + tilesize / 2
      const y = row * tilesize + tilesize / 2
      if (data[row][col] === 'X') {
        tiles.push([x, y])
      } else if (data[row][col] === 'r') {
        redFlag = [x, y]
      } else if (data[row][col] === 'b') {
        blueFlag = [x, y]
      } else if (data[row][col] === '>') {
        redSpawns.push([x, y])
      } else if (data[row][col] === '<') {
        blueSpawns.push([x, y])
      }
    }
  }
  if (!redFlag) {
    throw new Error('Map must contain a red flag ("r")')
  }
  if (!blueFlag) {
    throw new Error('Map must contain a blue flag ("b")')
  }
  // Print stats
  console.log('== Initializing map ==')
  console.log('- width: %spx', width)
  console.log('- height:%spx', height)
  console.log('- redSpawns: %s', redSpawns.length)
  console.log('- blueSpawns: %s', blueSpawns.length)
  return new Simulation({
    width, height, tiles, tilesize, redFlag, blueFlag,
    redSpawns, blueSpawns
  })
}


Simulation.default = function () {
  // . = empty
  // X = wall
  // r = red flag
  // b = blue flag
  // > = red spawn
  // < = blue spawn
  // if a team doesn't have a spawn, their players will spawn randomly
  // on their half of the map
  const data = [
    '....................X....................',
    '..>..>..............X.................<..',
    '....XXX.....XXX.....X....X........XXX..<.',
    '...>.>.X.......X....X.......X....X...X...',
    'XX......X......X.............X..X..<.<.<X',
    '.>...X.................X...........X.....',
    '.>.r.X.............X.....X..........X.b..',
    'XX......X................X......X.......X',
    '...>.>.X..........XXXXX..........X.<.<.<.',
    '....XXX....XXXXX.........XXXX.....XXX..<.',
    '..>.>.>..............................<.<.',
    '..................X...X..................',
  ]
  return Simulation.fromData(32, data)
}
