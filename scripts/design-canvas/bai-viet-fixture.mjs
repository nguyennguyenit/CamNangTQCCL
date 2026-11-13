#!/usr/bin/env node
// Bài viết mẫu để xem / so ảnh / e2e trang bài viết chi tiết khi repo chưa có bài đã xuất bản. Blog chỉ có bài khi
// build gọi `GET {COMMUNITY_API_ORIGIN}/api/posts` (src/lib/blog-posts.ts), nên module này dựng một API cục bộ trả bài
// mẫu rồi chạy `astro dev` trỏ vào nó. Không ghi gì vào dữ liệu thật; bài mẫu chỉ sống trong tiến trình này.
//
//   node scripts/design-canvas/bai-viet-fixture.mjs [--port 4371] [--no-watch]
//     (Playwright tự chạy lệnh này ở cổng FIXTURE_PORT cho e2e bài viết — playwright.config.mjs)
//     Chạy dev server có bài mẫu ở http://127.0.0.1:<port> (Ctrl+C để dừng). So ảnh nhóm bài viết + kho:
//     node scripts/design-canvas/compare-moi.mjs --only bai-viet-kho --base http://127.0.0.1:<port>
//
// Nội dung bài mẫu theo artboard BaiVietDetail (đội, chiến pháp, quân thủ lấy từ mục Khai hoang, tên theo bản game VN).
// Ảnh bìa trỏ `/api/reports/<id>/image`: compare-moi và e2e chặn đường dẫn này bằng ảnh chiến báo mẫu của canvas.
import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FIXTURE_SLUG = 'khai-hoang-khong-can-full-do';
/** Cổng cố định của dev server bài mẫu trong Playwright (`playwright.config.mjs`, webServer thứ hai). */
export const FIXTURE_PORT = 4175;
export const FIXTURE_COVER = '/api/reports/bai-viet-mau/image';

const BODY_VI = `Những ngày đầu mùa quyết định bạn lên thành chính cấp 7 sớm hay muộn. Đội khai hoang tốt không phải đội mạnh nhất trên giấy, mà là đội đánh được đất cấp 5–6 với hột tướng bạn đang có. Bài này dùng điểm từng mốc đất trong [mục Khai hoang](/khai-hoang/) để chọn đội, rồi chỉ ra quân thủ nên né.

## Đội mở đất nên chọn

Bảng dưới lấy bốn đội có điểm tổng cao nhất. Điểm chấm theo thang 10 cho từng mốc đất; cột Tổng gồm cả độ mượt khi chuyển đội sau khai hoang.

| Đội | Binh chủng | Đất 4 | Đất 5 | Đất 6 | Đất 7–8 | Tổng |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Gia Cát Khác · Thái Sử Từ · Tả Từ | Cung | 9 | 10 | 10 | 8,5 | **9,2** |
| Khương Duy · Hạ Hầu Uyên · Gia Cát Khác | Cung | 8 | 9 | 8,5 | 7 | **8,1** |
| Trương Xuân Hoa · Lữ Bố · Tả Từ | Cung | 7,5 | 8 | 8,5 | 7,5 | **8** |
| Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến | Thương | 7 | 8 | 8,5 | 9 | **7,9** |

### Gia Cát Khác · Thái Sử Từ · Tả Từ

Đội khai hoang mạnh nhất cho người chơi không full đỏ. Thái Sử Từ cần từ 3 đỏ; Gia Cát Khác và Tả Từ trắng vẫn dùng được, càng nhiều đỏ càng tốt.

1. **Gia Cát Khác** làm chủ tướng trước và sau cấp 20, mang Võ Phong Trận rồi thêm Thịnh Khí Linh Địch. Cộng toàn Thống Soái.
2. **Thái Sử Từ** mang Thôi Phong Đoạn Nhẫn rồi thêm Mau Giành Lợi Thế. Cộng khoảng 15 điểm Tốc Độ, còn lại Võ Lực.
3. **Tả Từ** mang Vô Đương Phi Quân rồi thêm Thời Cơ Chiến Thắng. Cộng toàn Thống Soái ở giai đoạn đầu.

> Cần đúng Thôi Phong Đoạn Nhẫn, không nhầm với Phá Phong Đoạn Nhẫn. Ưu tiên đất Thương, tránh đội tất trúng hoặc hỗn loạn.

### Không có Thái Sử Từ 3 đỏ

Chuyển sang Khương Duy · Hạ Hầu Uyên · Gia Cát Khác: đánh đất 5 được 9 điểm, chỉ kém đội trên ở đất 6 trở đi. Sau cấp 20 để Gia Cát Khác làm chủ tướng. Nếu đội Thương hợp kho hơn, xem [Gia Cát Khác · SP Mã Siêu · Pháp Chính](/khai-hoang/): sau cấp 20 để Pháp Chính làm chủ tướng.

## Đội Chạm Sứ mang 1 lính

Đội Chạm Sứ chỉ có hai tướng, mỗi tướng một chiến pháp, và mang 1 lính. Cẩm nang ghi riêng đội Hạ Hầu Uyên · Thái Sử Từ · Hoàng Nguyệt Anh nên ưu tiên khai hoang bằng đội Chạm Sứ. Bốn cặp có trong mục Khai hoang:

- **Lữ Mông · Giả Hủ**: Bạch Mã Nghĩa Tòng và Ngụy Thư Tương Gian. Tướng thay thế: Điêu Thuyền, Hoàng Cái, Phùng Kỷ.
- **Mã Siêu · Hoàng Nguyệt Anh**: Lõa Y Huyết Chiến và Phong Thi Trận.
- **Thái Sử Từ · Lăng Thống**: Bách Kỵ Kiếp Doanh và Hổ Báo Kỳ.
- **Hạ Hầu Uyên · Tào Thuận**: Lõa Y Huyết Chiến và Thiết Kỳ Khu Trì.

## Quân thủ mỏ cấp 4 và 5

Mỗi mỏ có 8 đội quân thủ. Ba tướng quân thủ in đậm dưới đây nên tránh khi đội mở đất chưa đủ mạnh.

| Mỏ 4 | Binh chủng | Mỏ 5 | Binh chủng |
| --- | --- | --- | --- |
| Quách Dĩ | Kỵ | Phan Chương | Thương |
| Trương Lương | Thương | Trương Lương | Thương |
| Tưởng Khâm | Cung | Tưởng Khâm | Cung |
| Lăng Tháo | Kỵ | Trần Vũ | Khiên |
| Chu Hoàn | Thương | Tào Chân | Kỵ |
| Trương Dực | Khiên | Lý Thôi | Kỵ |
| **Hoàng Quyền** | Cung | **Hoàng Quyền** | Cung |
| **Tào Chương** | Khiên | **Trần Kiểu** | Khiên |

> Tào Chương Khiên, Hoàng Quyền Cung và Trần Kiểu Khiên nên tránh: dễ gây hỗn loạn, hao binh khó kiểm soát. Càng về cuối danh sách càng khó.

## Lưu đội để chỉnh theo kho

Mở chi tiết đội trong mục Khai hoang và bấm **Lưu vào đội của tôi**. Đội được chép vào nhóm Khai Hoang trong [Đội của tôi](/doi-cua-toi/), món nào chưa có trong kho sẽ được đánh dấu để bạn thay bằng món đang có.
`;

const BODY_ZH = `开局几天决定你能否尽早升到主城 7 级。好的开荒队不是纸面最强，而是能用手上的武将打下 5–6 级地的队伍。本文按[开荒](/zh/khai-hoang/)栏目里各级地的评分选队，并列出应避开的守军。

## 推荐开荒队

下表列出总分最高的四支队伍。

| 队伍 | 兵种 | 4 级地 | 5 级地 | 6 级地 | 总分 |
| --- | --- | ---: | ---: | ---: | ---: |
| 诸葛恪 · 太史慈 · 左慈 | 弓 | 9 | 10 | 10 | **9.2** |
| 姜维 · 夏侯渊 · 诸葛恪 | 弓 | 8 | 9 | 8.5 | **8.1** |

## 碰瓷队只带 1 兵

碰瓷队只有两名武将，每人一个战法，只带 1 兵。
`;

const DAY = (iso) => `${iso}T01:00:00.000Z`;

/** Payload `GET /api/posts` (hợp đồng `validatePostsPayload`): bài chính + bản Trung + hai bài liên quan cùng chủ đề. */
export function fixturePosts() {
  const base = { status: 'published', author: { name: 'Ban biên tập Cẩm Nang' }, coverImage: null, faq: [] };
  return {
    items: [
      {
        ...base,
        id: 'fixture-khai-hoang-vi',
        slug: FIXTURE_SLUG,
        lang: 'vi',
        translationKey: 'khai-hoang-mo-dat',
        title: 'Khai hoang không cần full đỏ: chọn đội mở đất và đánh mỏ cấp 4–6',
        description: 'Bốn đội khai hoang có điểm cao nhất trong cẩm nang, khi nào ghép thêm đội Chạm Sứ mang 1 lính, và những quân thủ nên tránh ở mỏ cấp 4–5 để không hao binh oan.',
        bodyMarkdown: BODY_VI,
        faq: [
          { q: 'Không có Thái Sử Từ 3 đỏ thì dùng đội nào?', a: 'Dùng Khương Duy · Hạ Hầu Uyên · Gia Cát Khác (8,1 điểm). Cẩm nang ghi đây là một trong các đội khai hoang mạnh nhất khi không dùng Thái Sử Từ, Mã Siêu hoặc SP Lô Trực; tướng trắng vẫn dùng được.' },
          { q: 'Đội Chạm Sứ mang bao nhiêu lính?', a: 'Mỗi đội Chạm Sứ trong mục Khai hoang đều ghi “Mang 1 lính”. Đội chỉ có hai tướng, mỗi tướng một chiến pháp.' },
          { q: 'Điểm khai hoang lấy từ đâu?', a: 'Điểm được tổng hợp từ các website và diễn đàn của game thủ Trung Quốc rồi chấm lại theo từng mốc đất. Đây là nguồn tham khảo, không phải phương án duy nhất: đối chiếu phiên bản chiến pháp, hột tướng và quân thủ của mùa bạn đang chơi.' },
        ],
        tags: ['Khai hoang', 'Chạm Sứ', 'Quân thủ mỏ', 'Binh Diễn Xuân Thu'],
        coverImage: FIXTURE_COVER,
        publishedAt: DAY('2026-11-08'),
        updatedAt: DAY('2026-11-10'),
        createdAt: DAY('2026-11-07'),
      },
      {
        ...base,
        id: 'fixture-khai-hoang-zh',
        slug: FIXTURE_SLUG,
        lang: 'zh',
        translationKey: 'khai-hoang-mo-dat',
        title: '开荒不必满红：选择开荒队与 4–6 级矿',
        description: '攻略中评分最高的四支开荒队、何时加一支只带 1 兵的碰瓷队，以及 4–5 级矿应避开的守军。',
        bodyMarkdown: BODY_ZH,
        faq: [{ q: '没有三红太史慈用哪队？', a: '用姜维 · 夏侯渊 · 诸葛恪（8.1 分）。' }],
        tags: ['开荒', '碰瓷'],
        coverImage: FIXTURE_COVER,
        publishedAt: DAY('2026-11-08'),
        updatedAt: DAY('2026-11-10'),
        createdAt: DAY('2026-11-07'),
      },
      {
        ...base,
        id: 'fixture-on-hau-cung',
        slug: 'chuyen-khai-hoang-sang-on-hau-cung',
        lang: 'vi',
        translationKey: null,
        title: 'Chuyển từ khai hoang sang Ôn Hầu Cung',
        description: 'Trương Xuân Hoa · Lữ Bố · Tả Từ là đội khai hoang bình dân chuyển nhanh sang Ôn Hầu Cung. Bài này đi qua từng mốc thành chính.',
        bodyMarkdown: '## Mốc thành chính\n\nĐội khai hoang bình dân chuyển dần sang Ôn Hầu Cung theo từng mốc thành chính, giữ Lữ Bố làm trụ.\n\n## Đổi chiến pháp\n\nThay chiến pháp khai hoang bằng chiến pháp đánh người khi đã đủ đất.',
        tags: ['Khai hoang', 'Lữ Bố'],
        publishedAt: DAY('2026-11-04'),
        updatedAt: DAY('2026-11-04'),
        createdAt: DAY('2026-11-03'),
      },
      {
        ...base,
        id: 'fixture-goi-y-doi',
        slug: 'doc-kho-bang-goi-y-doi',
        lang: 'vi',
        translationKey: null,
        title: 'Đọc kho bằng Gợi ý đội trong 3 bước',
        description: 'Chụp ảnh kho tướng và chiến pháp, kiểm tra lại từng món rồi để công cụ chọn tối đa 5 đội không trùng tài nguyên.',
        bodyMarkdown: '## Chụp ảnh kho\n\nMở danh sách tướng và chiến pháp trong game rồi chụp màn hình.\n\n## Kiểm tra từng món\n\nSửa các món đọc sai trước khi gợi ý.',
        tags: ['Khai hoang', 'Gợi ý đội'],
        publishedAt: DAY('2026-10-28'),
        updatedAt: DAY('2026-10-28'),
        createdAt: DAY('2026-10-27'),
      },
    ],
  };
}

/** API bài viết cục bộ: chỉ trả `GET /api/posts`; đường khác 404. `port` 0 = cổng trống bất kỳ. */
export async function startPostsApi({ port = 0, host = '127.0.0.1' } = {}) {
  const body = JSON.stringify(fixturePosts());
  const server = createServer((request, response) => {
    if (request.method === 'GET' && new URL(request.url, 'http://x').pathname === '/api/posts') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(body);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const origin = `http://${host}:${server.address().port}`;
  return { origin, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

/**
 * Dev server Astro có bài mẫu: API cục bộ + `astro dev` (API lập trình, tắt dev toolbar để ảnh chụp sạch).
 * `COMMUNITY_API_ORIGIN` chỉ đặt trong tiến trình này. `watch: false` tắt theo dõi file (Playwright chạy server này
 * song song với `astro build` ghi vào cùng thư mục). Trả `{ base, stop }`.
 */
export async function startFixtureSite({ port = 4371, host = '127.0.0.1', watch = true } = {}) {
  const api = await startPostsApi({ host });
  process.env.COMMUNITY_API_ORIGIN = api.origin;
  const { dev } = await import('astro');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const server = await dev({
    root,
    logLevel: 'warn',
    server: { host, port },
    devToolbar: { enabled: false },
    ...(watch ? {} : { vite: { server: { watch: null } } }),
  });
  return {
    base: `http://${host}:${server.address.port}`,
    async stop() {
      await server.stop();
      await api.close();
    },
  };
}

// So bằng URL của đường dẫn thật: `import.meta.url` đã mã hoá phần trăm (dấu cách, chữ có dấu) và đi qua symlink
// (`/tmp` → `/private/tmp`), còn `argv[1]` là đường dẫn thô. Lệch thì script thoát êm và webServer của Playwright chờ mãi.
const invokedPath = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const at = process.argv.indexOf('--port');
  const site = await startFixtureSite({ port: at > 0 ? Number(process.argv[at + 1]) : 4371, watch: !process.argv.includes('--no-watch') });
  console.log(`Bài viết mẫu: ${site.base}/bai-viet/${FIXTURE_SLUG}/ (Ctrl+C để dừng)`);
  const shutdown = () => site.stop().finally(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
