// Mục lục của trang bài viết chi tiết (artboard BaiVietDetail): đánh dấu mục đang đọc bằng `aria-current="location"`
// trên mọi bản mục lục của trang (cột phụ desktop và khối mở/đóng mobile). Mục đang đọc là heading cuối cùng đã cuộn
// qua mép trên vùng đọc; chưa cuộn tới heading nào thì là mục đầu. Trang không có JavaScript vẫn đọc được mục lục.
const TOC_LINKS = ".bv-toc-list a[href^='#']";
/** Heading cách mép trên cửa sổ ít hơn khoảng này (px) được coi là đã tới — ngang tầm header dính + một dòng. */
const READING_OFFSET = 120;

function headingTargets(links) {
  const seen = new Map();
  for (const link of links) {
    const id = decodeURIComponent(link.hash.slice(1));
    const heading = id ? document.getElementById(id) : null;
    if (heading && !seen.has(id)) seen.set(id, heading);
  }
  return [...seen.entries()];
}

function markCurrent(links, id) {
  for (const link of links) {
    if (decodeURIComponent(link.hash.slice(1)) === id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

function start() {
  const links = [...document.querySelectorAll(TOC_LINKS)];
  const targets = headingTargets(links);
  if (!targets.length) return;
  let current = null;
  let queued = false;
  const update = () => {
    queued = false;
    let id = targets[0][0];
    for (const [key, heading] of targets) {
      if (heading.getBoundingClientRect().top - READING_OFFSET <= 0) id = key;
      else break;
    }
    if (id === current) return;
    current = id;
    markCurrent(links, id);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("hashchange", schedule);
}

start();
