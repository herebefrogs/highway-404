import { isMobile } from './mobile';
import { checkMonetization } from './monetization';
import { loadSongs, playSound, playSong } from './sound';
import { initSpeech } from './speech';
import { save, load } from './storage';
import { ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, CHARSET_SIZE, initCharset, renderText } from './text';
import { rand } from './utils';


const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiIndex = 0;

// GAMEPLAY VARIABLES

const TITLE_SCREEN = 0;
const GAME_SCREEN = 1;
const END_SCREEN = 2;
let screen = TITLE_SCREEN;

let countdown; // in seconds
let hero;
let entities;
const SPAWN_DURATION = 0.084; // duration after which an entity spawn another one, in seconds

let speak;

// RENDER VARIABLES

const CTX = c.getContext('2d');         // visible canvas
const MAP = c.cloneNode();              // full map rendered off screen
const MAP_CTX = MAP.getContext('2d');
MAP.width = 160;                        // map size
MAP.height = 640;
const VIEWPORT = c.cloneNode();           // visible portion of map/viewport
const VIEWPORT_CTX = VIEWPORT.getContext('2d');
VIEWPORT.width = 120;                      // viewport size
VIEWPORT.height = 160;

const TILE_SIZE = 20;

// camera-window & edge-snapping settings
const CAMERA_WINDOW_X = 20;
const CAMERA_WINDOW_Y = 50;
const CAMERA_WINDOW_WIDTH = VIEWPORT.width - CAMERA_WINDOW_X;
const CAMERA_WINDOW_HEIGHT = VIEWPORT.height - CAMERA_WINDOW_Y;
let viewportOffsetX = 0;
let viewportOffsetY = 0;

const ATLAS = {
  hero: {
    sprites: [
      { x: 0, y: 0, w: TILE_SIZE / 2, h: TILE_SIZE },
    ],
    speed: {
      x: 100,
      y: 50
    }
  },
  highway: {
    // highway left shoulder and verge
    0: [
      { x: 0, y: TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    6: [
      { x: 0, y: 2*TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    // highway left lane
    1: [
      { x: TILE_SIZE, y: TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    // highway center lane
    2: [
      { x: 2*TILE_SIZE, y: TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    // highway right lane
    3: [
      { x: 3*TILE_SIZE, y: TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    // highway right shoulder and verge
    4: [
      { x: 4*TILE_SIZE, y: TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    7: [
      { x: 4*TILE_SIZE, y: 2*TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    // highway blank lane
    5: [
      { x: 3*TILE_SIZE, y: 2*TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
    speed: {
      y: 200
    },
  },
  404: {
    sprites: [
      // { x: TILE_SIZE, y: 0, w: TILE_SIZE, h: TILE_SIZE },
      { x: 2*TILE_SIZE, y: 0, w: TILE_SIZE, h: TILE_SIZE },
      { x: 3*TILE_SIZE, y: 0, w: TILE_SIZE, h: TILE_SIZE },
      { x: 4*TILE_SIZE, y: 0, w: TILE_SIZE, h: TILE_SIZE },
      { x: 5*TILE_SIZE, y: 0, w: TILE_SIZE, h: TILE_SIZE },
      { x: 5*TILE_SIZE, y: TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE },
      { x: 5*TILE_SIZE, y: 2*TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE }
    ],
  }
};
const FRAME_DURATION = 0.075; // duration of 1 animation frame, in seconds
let tileset = 'DATAURL:src/img/tileset.png';   // characters sprite, embedded as a base64 encoded dataurl by build script

// LOOP VARIABLES

let currentTime;
let elapsedTime;
let lastTime;
let requestId;
let running = true;

// GAMEPLAY HANDLERS

function unlockExtraContent() {
}

function startGame() {
  konamiIndex = 0;
  countdown = 404;
  viewportOffsetX = 5;
  viewportOffsetY = MAP.height - VIEWPORT.height;
  scrolledDistance = 0;
  hero = createEntity('hero', MAP.width / 2, MAP.height - 2*TILE_SIZE);
  entities = [hero];
  spawn404({ x: TILE_SIZE, y: MAP.height - TILE_SIZE, h: TILE_SIZE });
  spawn404({ x: 2*TILE_SIZE, y: MAP.height - TILE_SIZE, h: TILE_SIZE });
  spawn404({ x: 3*TILE_SIZE, y: MAP.height - TILE_SIZE, h: TILE_SIZE });
  spawn404({ x: 4*TILE_SIZE, y: MAP.height - TILE_SIZE, h: TILE_SIZE });
  spawn404({ x: 5*TILE_SIZE, y: MAP.height - TILE_SIZE, h: TILE_SIZE });
  spawn404({ x: 6*TILE_SIZE, y: MAP.height - TILE_SIZE, h: TILE_SIZE });
  renderMap();
  screen = GAME_SCREEN;
};

function testAABBCollision(entity1, entity2) {
  const test = {
    entity1MaxX: entity1.x + entity1.w,
    entity1MaxY: entity1.y + entity1.h,
    entity2MaxX: entity2.x + entity2.w,
    entity2MaxY: entity2.y + entity2.h,
  };

  test.collide = entity1.x < test.entity2MaxX
    && test.entity1MaxX > entity2.x
    && entity1.y < test.entity2MaxY
    && test.entity1MaxY > entity2.y;

  return test;
};

// entity1 collided into entity2
function correctAABBCollision(entity1, entity2, test) {
  const { entity1MaxX, entity1MaxY, entity2MaxX, entity2MaxY } = test;

  const deltaMaxX = entity1MaxX - entity2.x;
  const deltaMaxY = entity1MaxY - entity2.y;
  const deltaMinX = entity2MaxX - entity1.x;
  const deltaMinY = entity2MaxY - entity1.y;

  // AABB collision response (homegrown wall sliding, not physically correct
  // because just pushing along one axis by the distance overlapped)

  // entity1 moving down/right
  if (entity1.moveX > 0 && entity1.moveY > 0) {
    if (deltaMaxX < deltaMaxY) {
      // collided right side first
      entity1.x -= deltaMaxX;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY;
    }
  }
  // entity1 moving up/right
  else if (entity1.moveX > 0 && entity1.moveY < 0) {
    if (deltaMaxX < deltaMinY) {
      // collided right side first
      entity1.x -= deltaMaxX;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY;
    }
  }
  // entity1 moving right
  else if (entity1.moveX > 0) {
    entity1.x -= deltaMaxX;
  }
  // entity1 moving down/left
  else if (entity1.moveX < 0 && entity1.moveY > 0) {
    if (deltaMinX < deltaMaxY) {
      // collided left side first
      entity1.x += deltaMinX;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY;
    }
  }
  // entity1 moving up/left
  else if (entity1.moveX < 0 && entity1.moveY < 0) {
    if (deltaMinX < deltaMinY) {
      // collided left side first
      entity1.x += deltaMinX;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY;
    }
  }
  // entity1 moving left
  else if (entity1.moveX < 0) {
    entity1.x += deltaMinX;
  }
  // entity1 moving down
  else if (entity1.moveY > 0) {
    entity1.y -= deltaMaxY;
  }
  // entity1 moving up
  else if (entity1.moveY < 0) {
    entity1.y += deltaMinY;
  }
};

function updateViewportVerticalScrolling() {
  // TODO build some lerp to speed scrolling up and down at beginning and end of game
  const distanceY = ATLAS.highway.speed.y*elapsedTime;
  viewportOffsetY -= distanceY;
  hero.y -= distanceY;
};

function constrainToViewport(entity) {
  // left
  if (entity.x < TILE_SIZE) {
    entity.x = TILE_SIZE;
  }
  // right
  else if (entity.x > MAP.width - TILE_SIZE - entity.w) {
    entity.x = MAP.width - TILE_SIZE - entity.w;
  }
  // top
  if (entity.y < viewportOffsetY + TILE_SIZE) {
    entity.y = viewportOffsetY + TILE_SIZE;
  }
  // bottom
  else if (entity.y > viewportOffsetY + VIEWPORT.height - entity.h) {
    entity.y = viewportOffsetY + VIEWPORT.height - entity.h;
  }
};


function updateCameraWindow() {
  // horizontal edge-snapping only
  if (0 < viewportOffsetX && hero.x < viewportOffsetX + CAMERA_WINDOW_X) {
    viewportOffsetX = Math.max(0, hero.x - CAMERA_WINDOW_X);
  }
  else if (viewportOffsetX < MAP.width - VIEWPORT.width && hero.x + hero.w > viewportOffsetX + CAMERA_WINDOW_WIDTH) {
    viewportOffsetX = Math.min(MAP.width - VIEWPORT.width, hero.x + hero.w - CAMERA_WINDOW_WIDTH);
  }
  // TODO build in some lerp-smoothing
};

function createEntity(type, x = 0, y = 0, loopAnimation = false) {
  const sprite = ATLAS[type].sprites[0];
  return {
    frame: 0,
    frameTime: 0,
    h: sprite.h,
    loopAnimation,
    moveX: 0,
    moveY: 0,
    speed: ATLAS[type].speed,
    sprites: ATLAS[type].sprites,
    type,
    w: sprite.w,
    x,
    y,
  };
};

function spawn404(entity) {
  const newEntity = createEntity(404, entity.x, entity.y - entity.h);
  newEntity.spawn = spawn404;
  newEntity.spawnTime = 0;
  entities.unshift(newEntity);
}

function spawnMoreEntities(entity) {
  if (entity.spawn) {
    entity.spawnTime += elapsedTime;
    if (entity.spawnTime > SPAWN_DURATION) {
      entity.spawn(entity);
      entity.spawn = null;
    }
  }
}

function updateEntityPosition(entity) {
  // update animation frame
  entity.frameTime += elapsedTime;
  if (entity.frameTime > FRAME_DURATION) {
    entity.frameTime -= FRAME_DURATION;
    if (entity.frame < entity.sprites.length - 1 || entity.loopAnimation) {
      entity.frame += 1;
    }
    if (entity.loopAnimation) {
      entity.frame %= entity.sprites.length;
    }
  }
  // update position
  if (entity.speed) {
    entity.x += entity.speed.x * elapsedTime * entity.moveX;
    entity.y += entity.speed.y * elapsedTime * entity.moveY;
  }
};

function update() {
  switch (screen) {
    case GAME_SCREEN:
      countdown -= elapsedTime;
      if (countdown < 0) {
        screen = END_SCREEN;
      }
      entities.forEach(updateEntityPosition);
      entities.forEach(spawnMoreEntities);
      // entities.slice(1).forEach((entity) => {
      //   const test = testAABBCollision(hero, entity);
      //   if (test.collide) {
      //     correctAABBCollision(hero, entity, test);
      //   }
      // });
      // HACK infinite map
      if (viewportOffsetY < 0) {
        viewportOffsetY += MAP.height - VIEWPORT.height;
        entities.forEach(entity => {
          entity.y += MAP.height - VIEWPORT.height
        });
      }

      //END HACK
      updateViewportVerticalScrolling();
      constrainToViewport(hero);
      updateCameraWindow();
      // remove entities who have fallen past the bottom of the scren
      entities = entities.filter(entity => entity.y < viewportOffsetY + VIEWPORT.height);
      break;
  }
};

// RENDER HANDLERS

function blit() {
  // copy backbuffer onto visible canvas, scaling it to screen dimensions
  CTX.drawImage(
    VIEWPORT,
    0, 0, VIEWPORT.width, VIEWPORT.height,
    0, 0, c.width, c.height
  );
};

function render() {
  VIEWPORT_CTX.fillStyle = '#000';
  VIEWPORT_CTX.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);

  switch (screen) {
    case TITLE_SCREEN:
      renderText(isMobile ? 'tap to start' : 'press any key', VIEWPORT_CTX, VIEWPORT.width / 2, VIEWPORT.height / 2, ALIGN_CENTER);
      if (konamiIndex === konamiCode.length) {
        renderText('konami mode on', VIEWPORT_CTX, VIEWPORT.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);
      }
      renderText('jerome lecomte', VIEWPORT_CTX, VIEWPORT.width / 2, VIEWPORT.height - 3.6*CHARSET_SIZE, ALIGN_CENTER);
      renderText('js13kgames 2020', VIEWPORT_CTX, VIEWPORT.width / 2, VIEWPORT.height - 2*CHARSET_SIZE, ALIGN_CENTER);
      break;
    case GAME_SCREEN:
      VIEWPORT_CTX.drawImage(
        MAP,
        // adjust x/y offset
        viewportOffsetX, viewportOffsetY, VIEWPORT.width, VIEWPORT.height,
        0, 0, VIEWPORT.width, VIEWPORT.height
      );
      entities.forEach(renderEntity);
      renderCountdown();
      // uncomment to debug mobile input handlers
      // renderDebugTouch();
      break;
    case END_SCREEN:
      break;
  }

  renderText('highway 404', VIEWPORT_CTX, CHARSET_SIZE, CHARSET_SIZE);

  blit();
};

function renderCountdown() {
  const minutes = Math.floor(Math.ceil(countdown) / 60);
  const seconds = Math.ceil(countdown) - minutes * 60;
  renderText(`${minutes}:${seconds <= 9 ? '0' : ''}${seconds}`, VIEWPORT_CTX, VIEWPORT.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);

};

function renderEntity(entity) {
  const sprite = entity.sprites[entity.frame];
  // TODO skip draw if image outside of visible canvas
  VIEWPORT_CTX.drawImage(
    tileset,
    sprite.x, sprite.y, sprite.w, sprite.h,
    Math.round(entity.x - viewportOffsetX), Math.round(entity.y - viewportOffsetY), sprite.w, sprite.h
  );
};

const map = [
  // leftmost lane
  [0, 6, 6],
  [1, 5, 5, 5],
  [2, 5, 5, 5],
  [2, 5, 5, 5],
  [2, 5, 5, 5],
  [2, 5, 5, 5],
  [3, 5, 5, 5],
  // rightmost lane
  [7, 4, 7]
]

function renderMap() {
  map.forEach((lane, i) => {
    let y = MAP.height;
    while (y > 0) {
      lane.forEach(n => {
        const sprite = ATLAS.highway[n][0];
        const x = i*sprite.w;
        y -= sprite.h;
        MAP_CTX.drawImage(
          tileset,
          sprite.x, sprite.y, sprite.w, sprite.h,
          x, y, sprite.w, sprite.h
        );
      })
    }
  })
};

// LOOP HANDLERS

function loop() {
  if (running) {
    requestId = requestAnimationFrame(loop);
    render();
    currentTime = Date.now();
    elapsedTime = (currentTime - lastTime) / 1000;
    update();
    lastTime = currentTime;
  }
};

function toggleLoop(value) {
  running = value;
  if (running) {
    lastTime = Date.now();
    loop();
  } else {
    cancelAnimationFrame(requestId);
  }
};

// EVENT HANDLERS

onload = async (e) => {
  // the real "main" of the game
  document.title = 'Highway 404';

  onresize();
  //checkMonetization(unlockExtraContent);

  await initCharset(loadImg);
  tileset = await loadImg(tileset);
  // speak = await initSpeech();

  toggleLoop(true);
};

onresize = onrotate = function() {
  // scale canvas to fit screen while maintaining aspect ratio
  const scaleToFit = Math.min(innerWidth / VIEWPORT.width, innerHeight / VIEWPORT.height);
  c.width = VIEWPORT.width * scaleToFit;
  c.height = VIEWPORT.height * scaleToFit;
  // disable smoothing on image scaling
  CTX.imageSmoothingEnabled = MAP_CTX.imageSmoothingEnabled = VIEWPORT_CTX.imageSmoothingEnabled = false;
};

// UTILS

document.onvisibilitychange = function(e) {
  // pause loop and game timer when switching tabs
  toggleLoop(!e.target.hidden);
};

function loadImg(dataUri) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      resolve(img);
    };
    img.src = dataUri;
  });
};

// INPUT HANDLERS

onkeydown = function(e) {
  // prevent itch.io from scrolling the page up/down
  e.preventDefault();

  if (!e.repeat) {
    switch (screen) {
      case GAME_SCREEN:
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
          case 'KeyQ':  // French keyboard support
            hero.moveX = -1;
            break;
          case 'ArrowUp':
          case 'KeyW':
          case 'KeyZ':  // French keyboard support
            hero.moveY = -1;
            break;
          case 'ArrowRight':
          case 'KeyD':
            hero.moveX = 1;
            break;
          case 'ArrowDown':
          case 'KeyS':
            hero.moveY = 1;
            break;
          case 'KeyP':
            // Pause game as soon as key is pressed
            toggleLoop(!running);
            break;
        }
        break;
    }
  }
};

onkeyup = function(e) {
  switch (screen) {
    case TITLE_SCREEN:
      if (e.which !== konamiCode[konamiIndex] || konamiIndex === konamiCode.length) {
        startGame();
      } else {
        konamiIndex++;
      }
      break;
    case GAME_SCREEN:
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyQ': // French keyboard support
        case 'ArrowRight':
        case 'KeyD':
          hero.moveX = 0;
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyZ': // French keyboard support
        case 'ArrowDown':
        case 'KeyS':
          hero.moveY = 0;
          break;
        }
      break;
    case END_SCREEN:
      switch (e.code) {
        case 'KeyT':
          open(`https://twitter.com/intent/tweet?text=viral%20marketing%20message%20https%3A%2F%2Fgoo.gl%2F${'some tiny Google url here'}`, '_blank');
          break;
        default:
          screen = TITLE_SCREEN;
          break;
      }
      break;
  }
};

// MOBILE INPUT HANDLERS

let minX = 0;
let minY = 0;
let maxX = 0;
let maxY = 0;
let MIN_DISTANCE = 30; // in px
let touches = [];

// adding onmousedown/move/up triggers a MouseEvent and a PointerEvent
// on platform that support both (duplicate event, pointer > mouse || touch)
ontouchstart = onpointerdown = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      [maxX, maxY] = [minX, minY] = pointerLocation(e);
      break;
  }
};

ontouchmove = onpointermove = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      if (minX && minY) {
        setTouchPosition(pointerLocation(e));
      }
      break;
  }
}

ontouchend = onpointerup = function(e) {
  e.preventDefault();
  switch (screen) {
    case TITLE_SCREEN:
      startGame();
      break;
    case GAME_SCREEN:
      // stop hero
      hero.moveX = hero.moveY = 0;
      // end touch
      minX = minY = maxX = maxY = 0;
      break;
    case END_SCREEN:
      screen = TITLE_SCREEN;
      break;
  }
};

// utilities
function pointerLocation(e) {
  return [e.pageX || e.changedTouches[0].pageX, e.pageY || e.changedTouches[0].pageY];
};

function setTouchPosition([x, y]) {
  // touch moving further right
  if (x > maxX) {
    maxX = x;
    if (maxX - minX > MIN_DISTANCE) {
      hero.moveX = 1;
    }
  }
  // touch moving further left
  else if (x < minX) {
    minX = x;
    if (maxX - minX > MIN_DISTANCE) {
      hero.moveX = -1;
    }
  }
  // touch reversing left while hero moving right
  else if (x < maxX && hero.moveX > 0) {
    minX = x;
    hero.moveX = 0;
  }
  // touch reversing right while hero moving left
  else if (minX < x && hero.moveX < 0) {
    maxX = x;
    hero.moveX = 0;
  }

  // touch moving further down
  if (y > maxY) {
    maxY = y;
    if (maxY - minY > MIN_DISTANCE) {
      hero.moveY = 1;
    }
  }
  // touch moving further up
  else if (y < minY) {
    minY = y;
    if (maxY - minY > MIN_DISTANCE) {
      hero.moveY = -1;
    }
  }
  // touch reversing up while hero moving down
  else if (y < maxY && hero.moveY > 0) {
    minY = y;
    hero.moveY = 0;
  }
  // touch reversing down while hero moving up
  else if (minY < y && hero.moveY < 0) {
    maxY = y;
    hero.moveY = 0;
  }

  // uncomment to debug mobile input handlers
  // addDebugTouch(x, y);
};

function addDebugTouch(x, y) {
  touches.push([x / innerWidth * VIEWPORT.width, y / innerHeight * VIEWPORT.height]);
  if (touches.length > 10) {
    touches = touches.slice(touches.length - 10);
  }
};

function renderDebugTouch() {
  let x = maxX / innerWidth * VIEWPORT.width;
  let y = maxY / innerHeight * VIEWPORT.height;
  renderDebugTouchBound(x, x, 0, VIEWPORT.height, '#f00');
  renderDebugTouchBound(0, VIEWPORT.width, y, y, '#f00');
  x = minX / innerWidth * VIEWPORT.width;
  y = minY / innerHeight * VIEWPORT.height;
  renderDebugTouchBound(x, x, 0, VIEWPORT.height, '#ff0');
  renderDebugTouchBound(0, VIEWPORT.width, y, y, '#ff0');

  if (touches.length) {
    VIEWPORT_CTX.strokeStyle = VIEWPORT_CTX.fillStyle =   '#02d';
    VIEWPORT_CTX.beginPath();
    [x, y] = touches[0];
    VIEWPORT_CTX.moveTo(x, y);
    touches.forEach(function([x, y]) {
      VIEWPORT_CTX.lineTo(x, y);
    });
    VIEWPORT_CTX.stroke();
    VIEWPORT_CTX.closePath();
    VIEWPORT_CTX.beginPath();
    [x, y] = touches[touches.length - 1];
    VIEWPORT_CTX.arc(x, y, 2, 0, 2 * Math.PI)
    VIEWPORT_CTX.fill();
    VIEWPORT_CTX.closePath();
  }
};

function renderDebugTouchBound(_minX, _maxX, _minY, _maxY, color) {
  VIEWPORT_CTX.strokeStyle = color;
  VIEWPORT_CTX.beginPath();
  VIEWPORT_CTX.moveTo(_minX, _minY);
  VIEWPORT_CTX.lineTo(_maxX, _maxY);
  VIEWPORT_CTX.stroke();
  VIEWPORT_CTX.closePath();
};
