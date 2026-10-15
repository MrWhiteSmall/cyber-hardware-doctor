export const TAU = Math.PI * 2;
export const ALIGNMENT_TOLERANCE = 0.12;
export const FAN_HOLD_MS = 650;
// A reading only proves a cable conductor when the tips touch opposite ends
// of that same conductor. No beep on two different nets is not fault evidence.
export function cableContinuity({
  mode,
  isolated,
  red,
  black,
  shorted,
  replacement,
}) {
  if (mode === "off") return { kind: "off", display: "—", beep: false };
  if (mode !== "continuity")
    return { kind: "mode", display: "选通断档", beep: false };
  if (!isolated)
    return { kind: "connected", display: "先分离两端", beep: false };
  if (shorted) return { kind: "self", display: "0.1 Ω", beep: true };
  if (!red || !black) return { kind: "air", display: "OL", beep: false };
  if (red.net !== black.net)
    return { kind: "cross", display: "OL", beep: false };
  if (red.end === black.end)
    return { kind: "same", display: "0.1 Ω", beep: true };
  const broken = !replacement && red.net === "plus";
  return {
    kind: broken ? "open" : "closed",
    net: red.net,
    display: broken ? "OL" : "0.3 Ω",
    beep: !broken,
  };
}
export function bearingCoast(velocity, seconds, lubricated) {
  const drag = lubricated ? 0.8 : 7.5;
  const dt = Math.max(0, seconds);
  const next = velocity * Math.exp(-drag * dt);
  return { velocity: next, rotation: (velocity - next) / drag };
}
export function validOilDrop(duration, drift) {
  return duration >= 120 && duration <= 600 && drift <= 14;
}
export const CONNECTOR_RELEASE_MS = 400;
export const CONNECTOR_OUT_DEPTH = 0.9;
export function pullConnector(position, distance, releaseHeld) {
  if (!releaseHeld) return { ...position, blocked: true, extracted: false };
  const z = Math.min(CONNECTOR_OUT_DEPTH, position.z + Math.max(0, distance));
  return {
    ...position,
    z,
    blocked: false,
    extracted: z >= CONNECTOR_OUT_DEPTH,
  };
}
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
