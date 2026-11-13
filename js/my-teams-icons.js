// Icon nét của trang "Đội của tôi" (artboard DoiCuaToi): mỗi hàm trả một `<svg aria-hidden>` mới, nét tròn 1.8.
// Chỉ là hình trang trí: chữ của nút/nhãn luôn nằm ngoài icon.

import { icon, svgNode } from "./render.js";

const path = (d) => svgNode("path", { d });

const SHAPES = {
  // Năm trang nguồn của nút "Lưu vào đội của tôi".
  flag: () => [path("M5 21V4"), path("M5 4h11l-2 4 2 4H5")],
  people: () => [svgNode("circle", { cx: 9, cy: 8, r: 3.5 }), path("M2.5 20c1-3.5 3.6-5 6.5-5s5.5 1.5 6.5 5"), path("M16 4.5a3.5 3.5 0 0 1 0 7"), path("M18 15c2 .6 3.2 2.2 3.8 5")],
  spark: () => [path("M12 3v4"), path("M12 17v4"), path("M3 12h4"), path("M17 12h4"), path("M6 6l2.5 2.5"), path("M15.5 15.5L18 18"), path("M18 6l-2.5 2.5"), path("M8.5 15.5L6 18")],
  box: () => [svgNode("rect", { x: 3, y: 4, width: 18, height: 5, rx: 1 }), path("M5 9v10h14V9"), path("M10 13h4")],
  scan: () => [path("M4 8V5a1 1 0 0 1 1-1h3"), path("M16 4h3a1 1 0 0 1 1 1v3"), path("M20 16v3a1 1 0 0 1-1 1h-3"), path("M8 20H5a1 1 0 0 1-1-1v-3"), path("M8 12h8")],
  // Thao tác.
  chevron: () => [svgNode("polyline", { points: "6 9 12 15 18 9" })],
  plus: () => [path("M12 5v14"), path("M5 12h14")],
  pencil: () => [path("M4 20h4L19 9l-4-4L4 16z"), path("M13.5 6.5l4 4")],
  lock: () => [svgNode("rect", { x: 5, y: 11, width: 14, height: 9, rx: 2 }), path("M8 11V8a4 4 0 0 1 8 0v3")],
  warn: () => [path("M12 3.5l9 15.5H3z"), path("M12 10v4"), path("M12 16.8v.2")],
  cloud: () => [path("M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z")],
  trash: () => [path("M4 7h16"), path("M9 7V4h6v3"), path("M6 7l1 13h10l1-13")],
  close: () => [path("M6 6l12 12"), path("M18 6L6 18")],
  search: () => [svgNode("circle", { cx: 11, cy: 11, r: 7 }), svgNode("line", { x1: 16.5, y1: 16.5, x2: 21, y2: 21 })],
  check: () => [path("M5 12l5 5L20 7")],
  arrow: () => [svgNode("line", { x1: 5, y1: 12, x2: 19, y2: 12 }), svgNode("polyline", { points: "13 6 19 12 13 18" })],
  copy: () => [svgNode("rect", { x: 8, y: 8, width: 12, height: 12, rx: 2 }), path("M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3")],
  swap: () => [path("M4 8h13l-3-3"), path("M20 16H7l3 3")],
  refresh: () => [path("M20 11a8 8 0 1 0-2.3 5.7"), path("M20 5v6h-6")],
  shield: () => [path("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z")],
  info: () => [svgNode("circle", { cx: 12, cy: 12, r: 9 }), path("M12 11v5"), path("M12 7.8v.2")],
};

/** Icon theo tên (`SHAPES`), cỡ mặc định 16 như artboard. */
export const mtIcon = (name, size = 16) => icon(SHAPES[name](), { size });
