# Favicon logo TQCCL

- Nguồn người dùng: https://thienthuonghoa.com/assets/uploads/images/tqccl-logo.jpg
- JPEG gốc: 490×490; SHA-256 `19874cd267e526dcdb42d57714a4ea307cf8f6593e346ed63dd5f81f4d46cad5`.
- File public: `public/favicon.png`, 128×128 RGBA, 37.559 bytes; SHA-256 `e7447a6ec3d3c7d2c73136bae4bea4bdd167bd38590f0d287db90d992f3c870f`.
- Giữ ảnh gốc/nền đỏ/chữ; chỉ bỏ vùng trắng bên ngoài bốn góc bo.
- Thử built-in imagegen theo skill. Prompt: “background-extraction; remove only white outside rounded red square; preserve all original lettering, red texture, ornament, colors, highlights and placement; genuine transparent PNG; no redraw, no checkerboard.” Kết quả có ô caro giả và không có alpha nên không sử dụng; không dùng CLI/API fallback.
- Bản cuối dùng định dạng SVG được người dùng cho phép: nhúng JPEG gốc, clipPath hình chữ nhật 490×490 rx=100; rasterize bằng `rsvg-convert -w 128 -h 128` sang PNG. Không dùng bản AI làm nguồn và không chỉnh lại chữ.
- Thay data URI emoji trong `src/pages/index.astro` bằng `/favicon.png`; thêm static asset vào dist verifier với byte parity và route cache revalidation vào `_headers`.
- Xem trực tiếp PNG; kiểm alpha góc (0,0)=0, tâm alpha=1, `opaque=False`. Build pass, 7 shell/header checks + 9 dist/header checks pass; verifier xác nhận 36 files. `git diff --check` sạch.
- Chưa commit/deploy. Không thay các WIP ngoài phạm vi.

Câu hỏi còn lại: không.
