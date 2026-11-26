// Phát một trang HTML thành HAI đoạn qua mạng thật (chunked), để đo trang ở khoảng giữa hai đoạn: `route.fulfill` của Playwright chỉ giao
// trọn gói một lần nên không dựng được "HTML đã về tới sidebar lọc, danh sách còn chưa về". Máy chủ cục bộ đứng trước server preview của
// Playwright: mọi request được chuyển nguyên, riêng tài liệu `documentPath` bị cắt ngay trước `cutBefore` và đoạn sau bị giữ tới khi `release()`.
import http from 'node:http';

// Header mô tả khung truyền của upstream không được chép sang: phản hồi này tự đóng khung (chunked) và nội dung đã được giải nén.
const DROP_HEADERS = new Set(['connection', 'content-encoding', 'content-length', 'keep-alive', 'transfer-encoding']);

/**
 * @param {string} baseURL server preview (`baseURL` của Playwright).
 * @param {{documentPath: string, cutBefore: string}} options `documentPath`: pathname của trang bị cắt (query bỏ qua);
 *   `cutBefore`: chuỗi HTML mở đầu đoạn hai (đoạn một là mọi thứ đứng trước nó).
 * @returns {Promise<{origin: string, release: () => void, close: () => Promise<void>}>} `origin` để `page.goto`; `release` thả đoạn hai;
 *   `close` thả (nếu chưa) rồi tắt máy chủ.
 */
export async function serveHtmlInTwoChunks(baseURL, { documentPath, cutBefore }) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const server = http.createServer(async (request, response) => {
    try {
      const target = new URL(request.url, baseURL);
      const upstream = await fetch(target, { headers: { accept: request.headers.accept ?? '*/*' } });
      const headers = Object.fromEntries([...upstream.headers].filter(([name]) => !DROP_HEADERS.has(name)));
      const body = Buffer.from(await upstream.arrayBuffer());
      if (target.pathname !== documentPath) {
        response.writeHead(upstream.status, headers).end(body);
        return;
      }
      const html = body.toString('utf8');
      const cut = html.indexOf(cutBefore);
      if (cut <= 0) throw new Error(`${documentPath}: không thấy điểm cắt ${cutBefore}`);
      response.writeHead(upstream.status, headers);
      response.write(html.slice(0, cut));
      await gate;
      response.end(html.slice(cut));
    } catch (error) {
      if (response.headersSent) response.destroy(error);
      else response.writeHead(502, { 'content-type': 'text/plain' }).end(String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    release,
    async close() {
      release();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
