export const TAU = Math.PI * 2;
export const ALIGNMENT_TOLERANCE = 0.12;
export const FAN_HOLD_MS = 650;
export function validAirPuff(duration, drift) {
  return duration >= 120 && duration <= 900 && drift <= 22;
}
export function angleDelta(previous, next) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
}
export function turnScrew(current, delta, tightening) {
  return Math.max(
    0,
    Math.min(TAU * 2, current + delta * (tightening ? 1 : -1)),
  );
}
export function aligned(position, angle, tolerance = ALIGNMENT_TOLERANCE) {
  const rotation = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  return (
    Math.abs(position.x) < tolerance &&
    Math.abs(position.y) < tolerance &&
    rotation < 0.08
  );
}
export function pushPart(position, angle, distance) {
  // Alignment alone never attaches a part. A separate, deliberate axial push is required.
  if (!aligned(position, angle))
    return { ...position, blocked: true, seated: false };
  const z = Math.max(0, position.z - Math.max(0, distance));
  return { ...position, z, blocked: false, seated: z <= 0.025 };
}
