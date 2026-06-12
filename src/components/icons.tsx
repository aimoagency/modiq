// 자체 내장 라인 아이콘 (lucide 벡터 데이터 기반, 의존성 없음)
import type { CSSProperties } from "react";
type P = { size?: number; strokeWidth?: number; style?: CSSProperties; color?: string };
const I = (inner: string) => ({ size = 16, strokeWidth = 2, style, color }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}
    dangerouslySetInnerHTML={{ __html: inner }} />
);
export const Home = I("<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"></path><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path>");
export const Calendar = I("<path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path>");
export const CalendarDays = I("<path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path><path d=\"M8 14h.01\"></path><path d=\"M12 14h.01\"></path><path d=\"M16 14h.01\"></path><path d=\"M8 18h.01\"></path><path d=\"M12 18h.01\"></path><path d=\"M16 18h.01\"></path>");
export const CalendarOff = I("<path d=\"M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18\"></path><path d=\"M21 15.5V6a2 2 0 0 0-2-2H9.5\"></path><path d=\"M16 2v4\"></path><path d=\"M3 10h7\"></path><path d=\"M21 10h-5.5\"></path><path d=\"m2 2 20 20\"></path>");
export const ClipboardList = I("<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"></rect><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"></path><path d=\"M12 11h4\"></path><path d=\"M12 16h4\"></path><path d=\"M8 11h.01\"></path><path d=\"M8 16h.01\"></path>");
export const User = I("<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"></path><circle cx=\"12\" cy=\"7\" r=\"4\"></circle>");
export const Users = I("<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"></path><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle>");
export const Building2 = I("<path d=\"M10 12h4\"></path><path d=\"M10 8h4\"></path><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\"></path><path d=\"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2\"></path><path d=\"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16\"></path>");
export const Store = I("<path d=\"m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7\"></path><path d=\"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\"></path><path d=\"M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4\"></path><path d=\"M2 7h20\"></path><path d=\"M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7\"></path>");
// ── 메뉴 전용 새 아이콘 세트(2026-06 리디자인) ──
export const Gauge = I("<path d=\"m12 14 4-4\"></path><path d=\"M3.34 19a10 10 0 1 1 17.32 0\"></path>");
export const CalendarCheck = I("<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15.5\" rx=\"2\"></rect><path d=\"M3.5 9.5h17\"></path><path d=\"M8 3v3.5\"></path><path d=\"M16 3v3.5\"></path><path d=\"m9 15 2 2 3.4-3.4\"></path>");
export const ClipboardCheck = I("<rect x=\"5.5\" y=\"4.5\" width=\"13\" height=\"16\" rx=\"2\"></rect><path d=\"M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1\"></path><path d=\"m9 13.2 1.8 1.8L14 11.7\"></path>");
export const Mannequin = I("<circle cx=\"12\" cy=\"3.7\" r=\"1.3\"></circle><path d=\"M9 9.5c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5l-.8 3.5H9.8z\"></path><path d=\"M9.5 13h5\"></path><path d=\"M12 13v6\"></path><path d=\"M9.3 19.5h5.4\"></path>");
export const Building = I("<path d=\"M4 21V6.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2V21\"></path><path d=\"M14 10.5h4a2 2 0 0 1 2 2V21\"></path><path d=\"M3 21h18\"></path><path d=\"M7.5 8.5h3M7.5 12.5h3M7.5 16.5h3\"></path>");
export const BarChart = I("<path d=\"M4 4v16.5h16.5\"></path><rect x=\"7.5\" y=\"12\" width=\"2.4\" height=\"5\" rx=\".4\"></rect><rect x=\"12\" y=\"8.5\" width=\"2.4\" height=\"8.5\" rx=\".4\"></rect><rect x=\"16.5\" y=\"5.5\" width=\"2.4\" height=\"11.5\" rx=\".4\"></rect>");
export const CoinStack = I("<ellipse cx=\"12\" cy=\"6\" rx=\"6\" ry=\"2.5\"></ellipse><path d=\"M6 6v5c0 1.38 2.7 2.5 6 2.5s6-1.12 6-2.5V6\"></path><path d=\"M6 11v5c0 1.38 2.7 2.5 6 2.5s6-1.12 6-2.5v-5\"></path>");
export const Agents = I("<circle cx=\"9\" cy=\"8\" r=\"2.8\"></circle><path d=\"M4 19v-1a5 5 0 0 1 10 0v1\"></path><circle cx=\"16.5\" cy=\"9.5\" r=\"2.3\"></circle><path d=\"M14.7 19v-1a4 4 0 0 1 6.3-3.2\"></path>");
export const CardCheck = I("<rect x=\"2.5\" y=\"5.5\" width=\"16\" height=\"11\" rx=\"2\"></rect><path d=\"M2.5 9.5h16\"></path><circle cx=\"17.5\" cy=\"17\" r=\"4\"></circle><path d=\"m15.8 17 1.2 1.2 2.4-2.6\"></path>");
// Aimo 브랜드 마크 (라임그린 A•) — 외부 링크용, 고정 컬러
export const AimoMark = ({ size = 18, style }: { size?: number; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
    <path d="M8.5 4 L3 20 L14 20 Z M8.5 10 L6 16 L11 16 Z" fill="#CDF24E" fillRule="evenodd" />
    <circle cx="17.4" cy="7" r="2.2" fill="#CDF24E" />
  </svg>
);
export const Settings = I("<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>");
export const Coins = I("<path d=\"M13.744 17.736a6 6 0 1 1-7.48-7.48\"></path><path d=\"M15 6h1v4\"></path><path d=\"m6.134 14.768.866-.5 2 3.464\"></path><circle cx=\"16\" cy=\"8\" r=\"6\"></circle>");
export const CreditCard = I("<rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\"></rect><line x1=\"2\" x2=\"22\" y1=\"10\" y2=\"10\"></line>");
export const Pencil = I("<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"></path><path d=\"m15 5 4 4\"></path>");
export const Save = I("<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"></path><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\"></path><path d=\"M7 3v4a1 1 0 0 0 1 1h7\"></path>");
export const Folder = I("<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"></path>");
export const FolderOpen = I("<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"></path>");
export const Plane = I("<path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\"></path>");
export const Link2 = I("<path d=\"M9 17H7A5 5 0 0 1 7 7h2\"></path><path d=\"M15 7h2a5 5 0 1 1 0 10h-2\"></path><line x1=\"8\" x2=\"16\" y1=\"12\" y2=\"12\"></line>");
export const Banknote = I("<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2\"></circle><path d=\"M6 12h.01M18 12h.01\"></path>");
export const MessageSquare = I("<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"></path>");
export const Crown = I("<path d=\"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z\"></path><path d=\"M5 21h14\"></path>");
export const PartyPopper = I("<path d=\"M5.8 11.3 2 22l10.7-3.79\"></path><path d=\"M4 3h.01\"></path><path d=\"M22 8h.01\"></path><path d=\"M15 2h.01\"></path><path d=\"M22 20h.01\"></path><path d=\"m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10\"></path><path d=\"m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17\"></path><path d=\"m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7\"></path><path d=\"M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z\"></path>");
export const AlertTriangle = I("<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path>");
export const Ban = I("<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M4.929 4.929 19.07 19.071\"></path>");
export const Camera = I("<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\"></path><circle cx=\"12\" cy=\"13\" r=\"3\"></circle>");
export const Clapperboard = I("<path d=\"m12.296 3.464 3.02 3.956\"></path><path d=\"M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z\"></path><path d=\"M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path><path d=\"m6.18 5.276 3.1 3.899\"></path>");
export const Lightbulb = I("<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"></path><path d=\"M9 18h6\"></path><path d=\"M10 22h4\"></path>");
export const MapPin = I("<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"></path><circle cx=\"12\" cy=\"10\" r=\"3\"></circle>");
export const Phone = I("<path d=\"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384\"></path>");
export const Mail = I("<path d=\"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\"></path><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"></rect>");
export const CheckCircle2 = I("<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m9 12 2 2 4-4\"></path>");
export const Clock = I("<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 6v6l4 2\"></path>");
export const Flag = I("<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"></path>");
export const Handshake = I("<path d=\"m11 17 2 2a1 1 0 1 0 3-3\"></path><path d=\"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4\"></path><path d=\"m21 3 1 11h-2\"></path><path d=\"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3\"></path><path d=\"M3 4h8\"></path>");
export const Shirt = I("<path d=\"M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z\"></path>");
export const Sun = I("<circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2\"></path><path d=\"M12 20v2\"></path><path d=\"m4.93 4.93 1.41 1.41\"></path><path d=\"m17.66 17.66 1.41 1.41\"></path><path d=\"M2 12h2\"></path><path d=\"M20 12h2\"></path><path d=\"m6.34 17.66-1.41 1.41\"></path><path d=\"m19.07 4.93-1.41 1.41\"></path>");
export const Moon = I("<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"></path>");
export const Menu = I("<line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\"></line><line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\"></line><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\"></line>");
export const Search = I("<circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"m21 21-4.3-4.3\"></path>");
export const ExternalLink = I("<path d=\"M15 3h6v6\"></path><path d=\"M10 14 21 3\"></path><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"></path>");
export const Download = I("<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><polyline points=\"7 10 12 15 17 10\"></polyline><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\"></line>");
export const TrendingUp = I("<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"></polyline><polyline points=\"16 7 22 7 22 13\"></polyline>");
