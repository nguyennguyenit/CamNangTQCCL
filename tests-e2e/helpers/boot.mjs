// Điều hướng rồi chờ trang khởi động xong: js/app.js đặt `body[data-boot="ready"]` ở `finally` của `main()`, kể cả khi boot lỗi.
// Hai trang danh sách đội (/doi-chuan/, /doi-khac/) phát sẵn khung lọc từ build với mọi điều khiển còn khoá (`disabled`) cho tới khi
// app.js gắn sự kiện; `page.goto` chỉ chờ `load` nên spec nào bấm chip, đổi mùa, đổi kiểu hiển thị hay gõ ô tìm ngay sau đó phải
// qua helper này, không thì bấm vào nút còn khoá.
import { expect } from '@playwright/test';

/** `page.goto` + chờ `body[data-boot="ready"]`; trả về response của lần điều hướng, như `page.goto`. */
export async function gotoBooted(page, url, options) {
  const response = await page.goto(url, options);
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  return response;
}
