export function rand(min, max) {
  return Math.floor(Math.random() * (max + 1 - min) + min);
};

export function choice(values) {
  return values[rand(0, values.length - 1)];
};

export function lerp(min, max, t) {
  return min * (1 - t) + max * t;
}

export function lerpClamped(minT, maxT, t) {
  if (t < minT) return 0;
  if (t > maxT) return 1;

  return (t - minT) / (maxT - minT);
}