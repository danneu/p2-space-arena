
# p2-space-arena

- Live Multiplayer Demo: http://p2-space-arena.herokuapp.com/

Another naive iteration of my quest to build a multiplayer 2D spaceship arena
websocket game.

![](https://dl.dropboxusercontent.com/spa/quq37nq1583x0lf/pqs8213g.png)

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
   I wrote this one with Elm +[elm-graphics][elm-graphics], but the naive
   solution almost maxed out a core on a small viewport. I replaced elm-graphics
   with a port that sends game snapshots to Pixi and got some performance back,
   but ultimately I decided that I don't want Elm in my hot loop.

[elm-graphics]: http://package.elm-lang.org/packages/evancz/elm-graphics/1.0.0/Collage

## Approach

In my previous two experiments, I rolled the physics myself from scratch,
like the vector math. Not something I'm terribly good.

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

## Hangups

- p2's (0, 0) origin is on the bottom-left and increases up and
  to the right. Pixi's origin is on the top-left and increases
  down and to the right. It's painful having to flip the `y`.
- [Giving each p2.Plane an id seemed to fix it...?!] 
  Ships can go out of bounds for some reason. I enclosed
  the `p2.World` with a `p2.Panel` on each side which, in
  my early testing, seemed impossible to tunnel through.
  Maybe something changed during a rewrite I did today, but
  not ships will often just drift across the panel border.
- When the user switches to another tab and then back to
  the game (accumulating frames at a slow rate), weird things
  happen. Bombs that were in fight before the tab-away will
  still be in flight when the player tabs back even though they
  detonated long ago. Stuff like that needs to be fixed.

## Notes to self

- I set `heroku config:set NPM_CONFIG_PRODUCTION=false` on Heroku so that
  Heroku would download devDeps. That way I can just build with webpack
  on prod boot.
