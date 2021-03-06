
# p2-space-arena

- Live Multiplayer Demo: http://p2-space-arena.herokuapp.com/

Another naive iteration of my quest to build a multiplayer 2D spaceship CTF 
arena websocket game.

![screenshot](https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/2s7b77gg.png)

Quick .webm video demo: <https://fat.gfycat.com/FrightenedFriendlyFieldmouse.webm>

## Run Locally

    npm install
    nodemon server  # boot the socket server <localhost:3000>
    npm start       # boot the webpack dev server <localhost:8080>

Visit <http://localhost:8080>.

## Previous Iterations:

1. [danneu/space-arena](https://github.com/danneu/space-arena)
   ([live multiplayer demo](https://github.com/danneu/space-arena)):
   100% authoritative server, 100% dumb client. Unplayable due to input lag
   and TCP replay on top of that. Built with JS + Pixi.
2. [danneu/elm-space-arena](https://github.com/danneu/elm-space-arena)
   ([live singleplayer demo](https://www.danneu.com/elm-space-arena/) -- warning: loud):
   I wrote this one with Elm + [elm-graphics][elm-graphics], but the naive
   solution almost maxed out a core on a small viewport. I replaced elm-graphics
   with a port that sends game snapshots to Pixi and got some performance back,
   but ultimately I decided that I don't want Elm in my hot loop.

This repo is the third and best iteration so far, but it won't be the last.

[elm-graphics]: http://package.elm-lang.org/packages/evancz/elm-graphics/1.0.0/Collage

## Tilemap

Here's the current map:

```
.............XXXXXXXXX.............
........XXXXX.........XXXXX........
.......X....→.........←....X.......
......X.....→...XXX...←.....X......
.....X...........X...........X.....
.....X.......................X.....
.....X....X......X......X....X.....
.....X....XXX....X....XXX....X.....
.....X....X.............X....X.....
......X.......XX...XX.......X......
......X.........X.X.........X......
.......X.........X.........X.......
..XXXXXXXX.......X.......XXXXXXXX..
.X>>>>>>>>.......X.......<<<<<<<<X.
X>..............X.X..............<X
X>.............X...X.............<X
X>.....X.....XXX...XXX.....X.....<X
X>.....X(((XX...X.X...XX)))X.....<X
X>.....X.........X.........X.....<X
X>.....X.........X.........X.....<X
.X.........X..r..X..b..X.........X.
..X..............X..............X..
...X.......X.....X.....X.......X...
....XXXXXXXXX...XXX...XXXXXXXXX....
.............XXX...XXX.............
```

| Tile | Image | ASCII | Description |
| ---- | ----- | ----- | ----------- |
| Empty  | -- | `.` | Empty space that all entities can fly through. |
| Block  | ![block][block] | `X` | Entities collide at 90°. |
| Slope `TODO`  | -- | `◢`, `◣`, `◤`, `◥` | Entities collide at 45°. I implemented them on [map2.txt][map2] but removed them for now due to unrelated performance regression when shrinking tiles from 32px to 16px in the same commit. |
| Filter | ![redfilter][redfilter], ![bluefilter][bluefilter] | red=`(`, blue=`)` | Players/bombs may pass through if they are on the team indicated by the filter's color. |
| Diode  | ![leftdiode][leftdiode], ![rightdiode][rightdiode], ... | `←`, `→`, `↑`, `↓` | Players/bombs may pass through if there are moving in the same direction as the diode's arrows. |
| Flag   | ![redflag][redflag], ![blueflag][blueflag] | red=`r`, blue=`b` | Players pick up the opposite team's flag and score by colliding with their own flag. Teams can have more than flag in the game. |
| Spawn  | -- | red=`>`, blue=`<`  | Players spawn at a random spawn tile. If team has no spawn tile, they spawn randomly on their side of the map for now (red = left, blue = right). |

The next step for the tilemap system is to address this performance issue: https://github.com/danneu/p2-space-arena/issues/13

[block]: https://raw.githubusercontent.com/danneu/p2-space-arena/master/static/img/tile2.png
[redfilter]: https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/aqd4ndiq.png
[bluefilter]: https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/3xk_kg16.png
[rightdiode]: https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/3jqedtmd.png
[leftdiode]: https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/co669o1k.png
[redflag]: https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/hs42su7n.png
[blueflag]: https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/s0e9-n0e.png
[map2]: https://github.com/danneu/p2-space-arena/blob/master/map2.txt

## Approach

In my previous two experiments, I rolled the physics myself from scratch,
like the vector math. Not something I'm terribly good at.

This time around, I decided to wrap my simulation around a Javascript
physics library that could run on the server and browser.
I settled on [p2](https://github.com/schteppe/p2.js)
after noticing that [Phaser](http://phaser.io/) uses it.

The chief goal of p2-space-arena is to find a naive but simple
networking model that makes the game bearable over the internet.
I've learned that there's nothing quite as unforgivable as
input lag, and that smoothing over latency/desync
(interpolation, dead reckoning, optimism) is incredibly hard.
In this repo, I try to avoid both.

The crux of my approach here is to give authority to the client.
Obviously in a real game this would open you up to cheaters.

Instead of broadcasting inputs like `KEYDOWN 'left'`, `KEYUP 'left'`
and trying to synchronize the server calculation with the client,
p2-space-arena's empowered client just broadcasts
`POSITION x y angle velocity` in an interval while the client runs
a simulation at 60fps. The client folds in the `POSITION` packets
it receives from other players ~20 times per second.

Bombs are more challenging. What I've come up with so far is for
the shooter to send `BOMB_SHOT x y velocity` to the server and
immediately simulate it locally, which simply involves moving
the bomb by its velocity until it hits a wall or until the
server says it hits a player.

The server runs its own partial simulation for the purpose of
being able to broadcast `BOMB_HIT bomb player` when a bomb
collides with an enemy. It's a partial simulation since
clients are the authority of their position, so the server
just hard-code updates the position of each player in its own
simulation as players broadcast `POSITION`.

The server does simulate/trace bombs at 60fps though, just
not players. This way, clients can trace bombs locally
until they hit a wall or until they receive a `BOMB_HIT`
from the server.

## Lessons Learned

- The broadphase becomes too expensive representing each map tile as its own
  p2.Body. The narrowphase becomes too expensive representing the whole map
  as a few large concave shapes. The former is still much more performant than
  the latter. It seems that the best solution for p2 is to consolidate
  adjacent polygons into convex bodies without going overboard.
  [Read more](http://www.html5gamedevs.com/topic/24183-ideal-way-to-reduce-a-2d-tile-level-into-fewer-p2bodies/)
