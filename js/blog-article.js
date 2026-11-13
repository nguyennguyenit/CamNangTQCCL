// Trang bài viết chi tiết (artboard BaiVietDetail), hai việc nhỏ sau khi trang tải:
// 1. Mục lục: đánh dấu mục đang đọc bằng `aria-current="location"` trên mọi bản mục lục của trang (cột phụ desktop và
//    khối mở/đóng mobile). Mục đang đọc là heading cuối cùng đã cuộn qua mép trên vùng đọc; chưa tới heading nào thì là
//    mục đầu. Không có JavaScript thì mục lục vẫn là danh sách link, không mục nào bị đánh dấu sai.
// 2. Bảng: HTML dựng sẵn để mọi bảng là vùng cuộn có tên (`role=region`, `tabindex=0`) cho bàn phím; bảng vừa khung
//    (không cuộn ngang) thì bỏ hai thuộc tính đó để không thêm điểm dừng Tab vô ích, đổi kích thước thì tính lại.
const TOC_LINKS = ".bv-toc-list a[href^='#']";
const TABLE_FRAMES = ".bv-body .bv-table-wrap";
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

function startTableOfContents() {
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

/** Bảng cuộn ngang được (nội dung rộng hơn khung) thì là vùng có tên tới được bằng Tab; không cuộn thì là khối thường. */
function syncTableFrames(frames) {
  for (const frame of frames) {
    // Tên vùng (chữ hàng tiêu đề) giữ ở data-* để gắn lại; khối thường (generic) không được mang aria-label.
    if (frame.dataset.regionLabel === undefined) frame.dataset.regionLabel = frame.getAttribute("aria-label") ?? "";
    if (frame.scrollWidth > frame.clientWidth + 1) {
      frame.setAttribute("role", "region");
      frame.tabIndex = 0;
      if (frame.dataset.regionLabel) frame.setAttribute("aria-label", frame.dataset.regionLabel);
    } else {
      frame.removeAttribute("role");
      frame.removeAttribute("tabindex");
      frame.removeAttribute("aria-label");
    }
  }
}

function startTableFrames() {
  const frames = [...document.querySelectorAll(TABLE_FRAMES)];
  if (!frames.length) return;
  syncTableFrames(frames);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => syncTableFrames(frames));
    for (const frame of frames) observer.observe(frame);
  } else {
    window.addEventListener("resize", () => syncTableFrames(frames));
  }
}

startTableOfContents();
startTableFrames();
