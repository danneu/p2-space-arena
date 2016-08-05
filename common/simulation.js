

// Native
const assert = require('assert')
// 3rd
const p2 = require('p2')
const _ = require('lodash')
// 1st
const util = require('./util')
const { pxm, mxp } = util
const Physics = require('./physics')
const Player = require('./player')
const Bomb = require('./bomb')
const Material = require('./material')
const Group = require('./CollisionGroup')


module.exports = Simulation


// HELPERS


// Returns p2.Body
function makeWall (id, x, y, angle) {
  // wtf, setting id on wall seems to fix tunnel issue???
  // besides, thought it had to be a number
  const body = new p2.Body({ id, angle })
  const shape = new p2.Plane()
  shape.material = Material.wall
  shape.collisionGroup = Group.WALL
  shape.collisionMask = Group.Player.ANY | Group.Bomb.ANY
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
  shape.collisionGroup = Group.WALL
  shape.collisionMask = Group.Player.ANY | Group.Bomb.ANY
  body.addShape(shape)
  return body
}


function makeFilter (team, tilesize, x, y) {
  const body = new p2.Body()
  body.isWall = true // get picked up by our beginContact wall/bomb check
  body.position = [x, y]
  body.tilesize = tilesize
  const shape = new p2.Box({ width: tilesize, height: tilesize })
  shape.material = Material.wall
  shape.collisionGroup = Group.Filter[team]
  // Filters only collide with the other team
  const otherTeam = util.flipTeam(team)
  shape.collisionMask = Group.Player[otherTeam] | Group.Bomb[otherTeam]
  body.addShape(shape)
  return body
}


// direction is 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
function makeDiode (tilesize, direction, x, y) {
  const body = new p2.Body()
  body.isWall = true
  body.isDiode = direction
  body.position = [x, y]
  body.tilesize = tilesize
  const shape = new p2.Box({ width: tilesize, height: tilesize })
  //shape.material = Material.wall
  shape.collisionGroup = Group.Diode[direction]
  // FIXME: Diodes should also work for players not just bombs.
  // Couldn't get it working within a couple hours though, so just
  // bombs for now.
  shape.collisionMask = Group.Bomb.ANY | Group.Player.ANY
  shape.material = Material.wall
  body.addShape(shape)
  return body
}


// Returns p2.Body
function makeFlag (team, [x, y]) {
  console.assert(typeof team === 'string')
  const body = new p2.Body()
  const shape = (() => {
    const shape = new p2.Circle({ radius: pxm(8) })
    // flags only collide with players
    shape.collisionGroup = Group.Flag[team]
    shape.collisionMask = Group.Player.ANY
    return shape
  })()
  // only triggers overlaps, not contacts
  //shape.sensor = true
  body.addShape(shape)
  body.position = [x, y]
  // does not produce contact forces
  body.collisionResponse = false
  // TODO: Move this stuff out of the p2 body
  body.isFlag = true
  body.team = team
  return body
}


// SIMULATION


// tiles is array of positions [[x, y], ...]
function Simulation ({
    width, height, tiles, tilesize,
    // each is an [x, y] position
    redFlag, blueFlag,
    // array of [x, y] spawn points
    redSpawns = [], blueSpawns = [],
    // these are optional
    redCarrier = null, blueCarrier = null,
    filters = { RED: [], BLUE: [] },
    diodes = [],
    bounded = false,
    isServer = false
  }) {
  console.assert(typeof width === 'number')
  console.assert(typeof height === 'number')
  console.assert(typeof tilesize === 'number')
  console.assert(Array.isArray(tiles))
  console.assert(Array.isArray(redFlag))
  console.assert(Array.isArray(blueFlag))
  console.assert(Array.isArray(redSpawns))
  console.assert(Array.isArray(blueSpawns))
  // the simulation emits events for client/server to handle
  p2.EventEmitter.apply(this)
  this.isServer = isServer
  // units are in meters
  this.width = width
  this.height = height
  this.tilesize = tilesize
  this.world = (function () {
    const world = new p2.World()
    world.defaultContactMaterial.friction = 0
    world.applyGravity = false
    world.applySpringForces = false
    // turn off event we aren't using
    world.emitImpactEvent = false
    return world
  })()
  this.players = Object.create(null) // mapping of userId -> Player
  this.bombs = Object.create(null) // mapping of userId -> Bomb
  // WALLS
  if (bounded) {
    const top = makeWall('top', 0, height, Math.PI)
    const bottom = makeWall('bottom', width, 0, 0)
    const right = makeWall('right', width, height, Math.PI / 2)
    const left = makeWall('left', 0, 0, (3 * Math.PI) / 2)
    // exposed for debug
    this.walls = [top, bottom, left, right]
    for (const body of [top, bottom, left, right]) {
      this.world.addBody(body)
    }
  }
  // FILTERS - Tiles that only one team can enter
  filters.RED.forEach(([x, y]) => {
    const body = makeFilter('RED', tilesize, x, y)
    this.world.addBody(body)
  })
  filters.BLUE.forEach(([x, y]) => {
    const body = makeFilter('BLUE', tilesize, x, y)
    this.world.addBody(body)
  })
  this.filters = filters
  // TILES
  this.tiles = tiles.map(([x, y]) => makeTile(tilesize, x, y))
  this.tiles.forEach((body) => this.world.addBody(body))
  // DIODES
  this.diodes = diodes
  this.diodes.forEach(([direction, x, y]) => {
    const body = makeDiode(tilesize, direction, x, y)
    this.world.addBody(body)
  })
  // SPAWNS
  this.redSpawns = redSpawns
  this.blueSpawns = blueSpawns
  // FLAGS
  this.redFlag = makeFlag('RED', redFlag)
  this.blueFlag = makeFlag('BLUE', blueFlag)
  ;[this.redFlag, this.blueFlag].forEach((body) => this.world.addBody(body))
  this.redCarrier = redCarrier  // player id that is carrying red flag
  this.blueCarrier = blueCarrier  // player id that is carrying blue flag
  // MATERIALS
  this.world.addContactMaterial(Material.wallVsShip)
  // EVENTS (sim must be an event emitter and have .world populated)
  attachEvents.call(this)
}


Simulation.prototype = _.create(p2.EventEmitter.prototype, {
  'constructor': Simulation
})


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
    // reds on the left, blues on the right
    // 15 is the ship's hitbox radius to avoid spawning player on edge
    const y = util.randInt(15, this.height - 15)
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


// . = empty
// X = wall
// r = red flag
// b = blue flag
// > = red spawn
// ( = red filter (only red can pass/shoot thru
// < = blue spawn
// ) = blue filter
// ←↑→↓ = diodes, players can only pass/shoot thru tile in that direction
// if a team doesn't have a spawn, their players will spawn randomly
// on their half of the map
//
// tilesize is in meters
Simulation.fromData = function (tilesize, data, opts = {}) {
  console.assert(typeof tilesize === 'number')
  console.assert(Array.isArray(data))
  data = data.reverse()
  // size of game world
  const width = data[0].length * tilesize
  const height = data.length * tilesize
  let tiles = []
  let redFlag
  let blueFlag
  let redSpawns = []
  let blueSpawns = []
  const filters = { RED: [], BLUE: [] }
  const diodes = []
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[0].length; col++) {
      const cell = data[row][col]
      // short-circuit on empty spaces
      if (cell === '.') continue
      // Everything is anchored at its center
      const x = col * tilesize + tilesize / 2
      const y = row * tilesize + tilesize / 2
      if (cell === 'X') {
        tiles.push([x, y])
      } else if (cell === '(') {
        filters.RED.push([x, y])
      } else if (cell === ')') {
        filters.BLUE.push([x, y])
      } else if (['←', '↑', '→', '↓'].includes(cell)) {
        const direction = {'←':'LEFT', '↑': 'UP', '→': 'RIGHT', '↓': 'DOWN'}[cell]
        diodes.push([direction, x, y])
      } else if (cell === 'r') {
        redFlag = [x, y]
      } else if (cell === 'b') {
        blueFlag = [x, y]
      } else if (cell === '>') {
        redSpawns.push([x, y])
      } else if (cell === '<') {
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
  console.log('- width: %s px', mxp(width))
  console.log('- height:%s px', mxp(height))
  console.log('- redSpawns: %s', redSpawns.length)
  console.log('- blueSpawns: %s', blueSpawns.length)
  return new Simulation(Object.assign({}, {
    width, height, tiles, tilesize, redFlag, blueFlag,
    redSpawns, blueSpawns, filters, diodes
  }, opts))
}


//
// HOOK UP EVENTS (an experimental effort to begin deduping logic)
//
// Emitted for server:
// - flag:beginContact ({player, flagTeam})
//   - flag:take ({player, flagTeam})
//   - flag:capture ({player, flagTeam})
//
// - bomb:hitPlayer {victim, shooter, bomb}
// - bomb:hitWall {bomb, wallBody}


// Right now the server/client are responsible for updating the simulation
// via these hooks (like removing entities from the simulation post-
// collision). Not sure if it's the best way but lets me diverge server/client
// in rather straightforward way.


function attachEvents () {
  this.world.on('beginContact', ({bodyA, bodyB}) => {
    let player
    let flagTeam
    if (bodyA.isPlayer && bodyB.isFlag) {
      player = this.getPlayer(bodyA.id)
      flagTeam = bodyB.team
    } else if (bodyB.isPlayer && bodyA.isFlag) {
      player = this.getPlayer(bodyB.id)
      flagTeam = bodyA.team
    }
    // ignore if no player
    // TODO: Investigate why this can happen.
    if (!player) return
    this.emit({ type: 'flag:beginContact', player, flagTeam })
  })

  this.on('flag:beginContact', ({player, flagTeam}) => {
    // ignore collision by same team
    if (player.team === flagTeam) return
    // ignore collision if there already is a carrier
    if (flagTeam === 'RED' && this.redCarrier) return
    if (flagTeam === 'BLUE' && this.blueCarrier) return
    // looks good, so update the simulation and emit
    if (flagTeam === 'RED') {
      this.redCarrier = player.id
    } else {
      this.blueCarrier = player.id
    }
    this.emit({ type: 'flag:take', player, flagTeam })
  })

  this.on('flag:beginContact', ({player, flagTeam}) => {
    // ignore collision by enemy team
    if (player.team !== flagTeam) return
    // ignore collision if player is not carrying a flag
    if (this.blueCarrier !== player.id && this.redCarrier !== player.id) return
    // looks good, so update simulation and emit
    if (player.team === 'BLUE') {
      this.redCarrier = null
    } else {
      this.blueCarrier = null
    }
    this.emit({ type: 'flag:capture', player, flagTeam })
  })


  // Check for bomb<->player collision
  //
  // Emits bomb:hitPlayer
  this.world.on('beginContact', ({bodyA, bodyB}) => {
    let bomb
    let victim
    let shooter
    if (bodyA.isBomb && bodyB.isPlayer) {
      bomb = this.getBomb(bodyA.id)
      victim = this.getPlayer(bodyB.id)
    } else if (bodyA.isPlayer && bodyB.isBomb) {
      bomb = this.getBomb(bodyB.id)
      victim = this.getPlayer(bodyA.id)
    } else {
      // No collision, so bail
      return
    }
    // ignore if victim cannot be found
    // FIXME: why can this happen
    if (!victim) {
      return
    }
    // ignore our own bombs
    // TODO: is this needed now that collision mask consider team colors?
    if (bomb.userId === victim.id) {
      return
    }
    // now let's try to load the shooter
    shooter = this.getPlayer(bomb.userId)
    // FIXME: why can this happen
    if (!shooter) {
      return
    }
    // Ignore friendly-fire
    // TODO: is this needed now that collision mask consider team colors?
    if (victim.team === shooter.team) {
      return
    }
    // Okay, it was a legit hit on an enemy
    // Remove the bomb from the simulation and emit
    // And broadcast :bombHit to everyone
    //this.removeBomb(bomb.id)
    this.emit({ type: 'bomb:hitPlayer', bomb, shooter, victim })
  })


  // Check for and handle bomb<->wall collision
  //
  // Emits bomb:hitWall {bomb}
  this.world.on('beginContact', ({bodyA, bodyB}) => {
    let bomb
    let wallBody  // p2.Body
    if (bodyA.isWall && bodyB.isBomb) {
      bomb = this.getBomb(bodyB.id)
      wallBody = bodyA
    } else if (bodyA.isBomb && bodyB.isWall) {
      bomb = this.getBomb(bodyA.id)
      wallBody = bodyB
    } else {
      // not a collision we care about
      return
    }
    //this.removeBomb(bomb.id)
    this.emit({ type: 'bomb:hitWall', bomb, wallBody })
  })
}
