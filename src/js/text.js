// available alphabet (must match characters in the alphabet sprite exactly)
// U = up arrow
// D = down arrow
// L = left arrow
// R = right arrow
// T = teapot icon
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789.:!-%,/#[]UDLR?\'';

export const ALIGN_LEFT = 0;
export const ALIGN_CENTER = 1;
export const ALIGN_RIGHT = 2;

// alphabet sprite, embedded as a base64 encoded dataurl by build script
export let charset = 'DATAURL:src/img/charset.png';
export const CHARSET_SIZE = 5; // in px

let ctx;

export const initCharset = async (loadImg, textCtx) => {
  charset = await loadImg(charset);
  ctx = textCtx;
}

/**
 * Render a message on the canvas context using a pixelart alphabet sprite
 * @param {*} msg 
 * @param {*} ctx 
 * @param {*} x 
 * @param {*} y 
 * @param {*} align 
 * @param {*} scale 
 */
export function renderText(msg, x, y, align = ALIGN_LEFT, scale = 1) {
  const SCALED_SIZE = scale * CHARSET_SIZE;
  const MSG_WIDTH = msg.length * (scale + SCALED_SIZE);
  const ALIGN_OFFSET = align === ALIGN_RIGHT ? MSG_WIDTH :
                       align === ALIGN_CENTER ? MSG_WIDTH / 2 :
                       0;
  [...msg].forEach((c, i) => {
    ctx.drawImage(
      charset,
      // TODO could memoize the characters index or hardcode a lookup table
      ALPHABET.indexOf(c)*CHARSET_SIZE, 0, CHARSET_SIZE, CHARSET_SIZE,
      x + i*(SCALED_SIZE + 1) - ALIGN_OFFSET, y, SCALED_SIZE, SCALED_SIZE
    );
  });
};