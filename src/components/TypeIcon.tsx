import { Camera, Handshake, Shirt, Clapperboard } from "./icons";

const MAP: Record<string, any> = { SHOOT: Camera, MEETING: Handshake, FITTING: Shirt, AUDITION: Clapperboard };

export default function TypeIcon({ type, size = 11 }: { type?: string; size?: number }) {
  const I = MAP[type || "SHOOT"] || Camera;
  return <I size={size} strokeWidth={2} style={{ verticalAlign: -1.5, flexShrink: 0 }} />;
}
