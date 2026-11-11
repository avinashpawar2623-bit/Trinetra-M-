function finiteIn(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** Existing Pi drive contract: { speed, steer, estop }. Extra keys are dropped. */
export function sanitizeDrive(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Body must be a JSON object' };
  if (typeof body.estop !== 'boolean') return { error: 'estop must be a boolean' };
  if (!finiteIn(body.speed, -100, 100)) return { error: 'speed must be a number from -100 to 100' };
  if (!finiteIn(body.steer, -100, 100)) return { error: 'steer must be a number from -100 to 100' };
  return { value: { speed: body.speed, steer: body.steer, estop: body.estop } };
}

/** Existing Pi arm contract. Joint axes are the -1, 0, 1 steps the UI already sends. */
export function sanitizeArm(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Body must be a JSON object' };
  const axes = ['base', 'arm', 'wrist', 'clawJ', 'claw', 'rot'];
  const value = { reset: body.reset === true };
  for (const key of axes) {
    if (!finiteIn(body[key], -1, 1)) return { error: `${key} must be a number from -1 to 1` };
    value[key] = body[key];
  }
  if (!finiteIn(body.speed, 0, 10)) return { error: 'speed must be a number from 0 to 10' };
  value.speed = body.speed;
  return { value };
}

export function sanitizeMode(body) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };
  if (body.mode !== 'ONLINE' && body.mode !== 'REMOTE') return { error: 'mode must be ONLINE or REMOTE' };
  return { value: { mode: body.mode } };
}
