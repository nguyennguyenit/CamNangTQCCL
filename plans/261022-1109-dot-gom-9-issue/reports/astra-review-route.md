**Verdict: sound with fixes — chưa nên thực thi v2 nguyên trạng.**

Tôi xác nhận checkout là `main@5b6014a`, không sửa file. Các lỗi đáng kể nhất: freeze #14 chưa bao phủ generator và các consumer; “free set” không độc lập; gate hiện tại bỏ qua community-worker; giả định #26 sửa `SiteLayout.astro` trái với nhánh local.

**Đối chiếu đầy đủ acceptance criteria của cả 9 issue: [UNVERIFIED].** Tôi không đọc được issue bodies/comments trực tiếp. Những kết luận dưới đây dựa trên code, workflow, docs, plan local và nội dung bạn cung cấp; không coi lời Fable là bằng chứng.

1. **High — #14 chỉ thêm ID vào `books-dict.json` sẽ mất freeze ở lần rebuild tiếp theo.**

   [pipeline/build_books_dict.py:74](/Users/plateau/Project/CamNangTQCCL/pipeline/build_books_dict.py:74) tạo mới record chỉ với `chinese`, `viet`, rồi bổ sung các trường được chọn; [dòng 102](/Users/plateau/Project/CamNangTQCCL/pipeline/build_books_dict.py:102) ghi đè dictionary. Generator không giữ `id`.

   Tôi chạy hàm build trong bộ nhớ: **68 record, 0 record có ID**. Đồng thời xác nhận dictionary hiện có 68 `chinese` duy nhất, 68 ID suy ra duy nhất, ledger có 68 sách, không có retired book hay slug exception.

   **Sửa:** giữ nguyên 68 ID hiện tại, nhưng phải có nguồn ánh xạ bền `chinese → frozen ID` và generator bảo toàn/kiểm ánh xạ đó. Thêm kiểm rebuild và rename; chỉ test `_book_id` là chưa đủ. Sau khi bytes dictionary đổi, cập nhật `booksSha256` trong route ledger: [loader kiểm pin tại dòng 142](/Users/plateau/Project/CamNangTQCCL/src/lib/lookup-detail-routes.ts:142).

2. **High — #14 bỏ sót consumer; làm đúng freeze sẽ chạm file được pin, nên không thuộc free set như mô tả.**

   Các đường còn suy ID từ tên Việt:

   - [js/analyze-map.js:74](/Users/plateau/Project/CamNangTQCCL/js/analyze-map.js:74): chỉ tactics được dùng `record.id`; books vẫn slug tên.
   - [js/season-context.js:134](/Users/plateau/Project/CamNangTQCCL/js/season-context.js:134) và [js/render.js:1014](/Users/plateau/Project/CamNangTQCCL/js/render.js:1014): cùng vấn đề.
   - [pipeline/season_validation.py:80](/Users/plateau/Project/CamNangTQCCL/pipeline/season_validation.py:80): validation vẫn xây ID bằng slug tên.
   - [js/lookup-ids.js:158](/Users/plateau/Project/CamNangTQCCL/js/lookup-ids.js:158): resolver cho book chỉ có tên Việt tìm bằng `book:<slug(tên)>`, không tra tên hiện tại → frozen ID.

   **Bằng chứng thực nghiệm, không ghi file:** gán `id=book:giap-sat`, đổi tên Việt, Soi đội vẫn tạo `book:ten-viet-doi`. Khi giả lập sửa riêng `bookLookupId` để đọc frozen ID, resolver theo chữ Hán trả đúng ID nhưng resolver theo tên Việt trả `null`.

   Persistence bị bỏ sót gồm **link chia sẻ `?doi=` và lịch sử Soi đội**, ngoài D1 `scan_samples`: [js/analyze-state.js:29](/Users/plateau/Project/CamNangTQCCL/js/analyze-state.js:29), [dòng 77](/Users/plateau/Project/CamNangTQCCL/js/analyze-state.js:77).

   **Sửa:** kiểm toàn bộ đường tạo/tra book ID và test rename xuyên qua lookup, Soi đội, lịch sử/link cũ, season validation, MCP. `analyze-map.js` và `render.js` được pin tại [policy:766](/Users/plateau/Project/CamNangTQCCL/pipeline/site-localization-policy.json:766), [policy:786](/Users/plateau/Project/CamNangTQCCL/pipeline/site-localization-policy.json:786); đưa phần hoàn chỉnh của #14 vào lane publish.

   Phía MCP có consumer đã hỗ trợ frozen ID: [entity-identity.ts:20](/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/entity-identity.ts:20). Không cần migration D1 nếu giữ nguyên ID.

3. **Medium — không chạm localization pin vẫn chưa có nghĩa là PR độc lập.**

   [workflow-source-manifest.json:16](/Users/plateau/Project/CamNangTQCCL/mcp-worker/workflow-source-manifest.json:16) đưa `lookup-ids.js` vào semantic inputs; dòng 19 có `roster-scan-state.js`; dòng 30–31 có cả publication builder/projection.

   Vì vậy #14, #15 và phần client #21 đều cần regenerate **cùng** `mcp-worker/src/generated/workflow-build.ts`. `check` kiểm artifact này trước: [mcp-worker/package.json:36](/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json:36).

   **Sửa:** có thể phát triển song song, nhưng tích hợp tuần tự: rebase → regenerate trên cây nguồn đã kết hợp → chạy gate. Không chọn một phía của generated-file conflict. Bổ sung bước này vào lane; chuỗi localization publish không thay thế nó.

4. **High — “giữ CI trên PR + final check:repository” không bảo vệ worker PR #21.**

   Bộ lọc [mcp-worker.yml:25](/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-worker.yml:25) không có `community-worker/**`. Một PR chỉ thêm migration, route, schema và test ở đó có thể không kích hoạt workflow.

   Quan trọng hơn, [check-repository.ts:21](/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/check-repository.ts:21) chạy MCP, Astro, JS/Python và **Vision Worker**, nhưng không chạy test/typecheck community-worker. Weekly schedule và dispatch cuối batch cũng không lấp khoảng trống này.

   **Sửa:** trước khi phát hành worker sớm, bắt buộc có kết quả `community-worker` tests, typecheck và migration rehearsal trên revision chuẩn bị deploy, như [phase 02:77](/Users/plateau/Project/CamNangTQCCL/plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-02-worker-roster-route.md:77). Có thể bổ sung CI coverage hoặc giữ gate riêng rõ ràng; không gọi MCP gate là bằng chứng cho Worker này.

5. **High — phát hành worker sớm chỉ hợp lý sau khi khóa hợp đồng của cả #21 và #23.**

   Worker phase không chỉ phục vụ kho: nó kiểm cả `team`, `group`, ID sách, giới hạn byte và nguồn đội. [Phase 01:91](/Users/plateau/Project/CamNangTQCCL/plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-01-schema-contract.md:91) đã ghi rõ `books: []` chứa book IDs — đây **không còn là giả định** nếu thực hiện plan này.

   Phase 01 vẫn yêu cầu đo payload lớn nhất và duyệt hợp đồng trước migration: [dòng 182](/Users/plateau/Project/CamNangTQCCL/plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-01-schema-contract.md:182). Tôi chưa thấy bằng chứng hoàn thành gate này.

   **Sửa:** đưa gate schema/size lên trước worker PR; kiểm worker với payload đại diện của các converter #23. Nếu tới #23 mới phát hiện schema/cap thiếu, mục tiêu “worker release một lần” không còn được bảo đảm.

   `0011` hiện là số phù hợp. `0009/0010` nằm ngoài migrations, và [wrangler.jsonc:22](/Users/plateau/Project/CamNangTQCCL/community-worker/wrangler.jsonc:22) chỉ dùng thư mục `migrations`. Không chạy hai script rollback đó như prerequisite của `0011`.

6. **Medium — chuyển deploy lên sớm phải chuyển cả verification và rollback lên sớm.**

   [Phase 07:27](/Users/plateau/Project/CamNangTQCCL/plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-07-rollout-docs.md:27) yêu cầu kiểm `/api/roster`; [dòng 41](/Users/plateau/Project/CamNangTQCCL/plans/261021-0632-dong-bo-kho-va-doi-cua-toi/phase-07-rollout-docs.md:41) còn yêu cầu Google OAuth thật và lưu/đọc production. “Merge → migrate → deploy ngay” chưa bao gồm những gate này.

   Rollback cũng thiếu một điểm vận hành: rollback Pages deployment mà giữ client mới trên `main` sẽ bị lần `blog-publish` tiếp theo đưa trở lại. Runbook hiện có đã yêu cầu **revert main trước**: [docs/community-worker.md:357](/Users/plateau/Project/CamNangTQCCL/docs/community-worker.md:357).

   **Sửa:** ghi exact Worker revision/version và D1 bookmark; migrate → deploy → xác minh qua Pages proxy → mới cho merge client phụ thuộc. Khi rollback, xử lý cả `main` và Pages; giữ bảng D1. Chọn prior Worker ngay trước #21, tránh vô tình rollback qua mốc Đội cộng đồng.

   Việc client báo lỗi và chuyển chỉ đọc là phương án phục hồi, **không phải bằng chứng một release thiếu backend là an toàn**.

7. **Medium — #15 cần ngoại lệ cho `equipment-special`, không thể đổi mọi entity sang item path.**

   [lookupDerivedSlug:269](/Users/plateau/Project/CamNangTQCCL/js/lookup-ids.js:269) cố ý không tạo trang riêng cho `equipment-special:*`. Kiểm trực tiếp trả:

   ```text
   lookupItemPath("equipment-special:long-tuong") → null
   lookupHref(...) → /tra-cuu/trang-bi/?id=equipment-special%3Along-tuong
   ```

   Builder và projection hiện cùng yêu cầu profile URL: [publication-builder.ts:821](/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/publication-builder.ts:821), [publication-projection.ts:799](/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/publication-projection.ts:799).

   **Sửa:** thống nhất builder, validator và tests theo `lookupHref` hoặc hợp đồng tương đương: item path khi tồn tại, profile fallback cho specials; kiểm cả vi/zh và retired tactic IDs. Không chỉ sửa nơi sinh URL.

8. **Medium — phần #6 còn thiếu các đầu việc tích hợp build quan trọng.**

   Thêm `/doi-chuan/mua/.../` chưa tự đưa route vào sitemap hoặc verifier. Sitemap hiện chỉ tổng hợp các tập route đã biết: [sitemap.xml.ts:159](/Users/plateau/Project/CamNangTQCCL/src/pages/sitemap.xml.ts:159). Verifier dùng exact output allowlist và từ chối file ngoài tập đó: [verify-astro-dist.mjs:268](/Users/plateau/Project/CamNangTQCCL/scripts/verify-astro-dist.mjs:268), [dòng 295](/Users/plateau/Project/CamNangTQCCL/scripts/verify-astro-dist.mjs:295).

   **Sửa:** ghi rõ season/pagination route inventory, sitemap, canonical/hreflang, verifier, SSR không JS, và giữ filter/Back/return-link state. Kiểm các giá trị `all`, `unknown`, mùa không hợp lệ, cùng redirect query cũ. Không thể chỉ thêm page và đổi dropdown.

   Đây là thiếu chi tiết thực thi đã xác minh; liệu còn thiếu acceptance criterion khác của #6: **[UNVERIFIED]**.

9. **Low — lý do bắt buộc merge #26 trước lane hiện sai với nhánh local.**

   `git diff main...feat/nut-dang-nhap-noi-bat --name-only` tại `0550b6a` chỉ có:

   ```text
   css/styles.css
   tests-e2e/responsive.spec.mjs
   ```

   Không có `SiteLayout.astro`; hai file trên không nằm trong `sourceFiles`. [Journal local:20](/Users/plateau/Project/CamNangTQCCL/plans/journals/261022-1200-nut-dang-nhap-noi-bat.md:20) cũng mô tả CSS và responsive test.

   **Sửa:** vẫn có thể merge trước vì thuận tiện, nhưng không coi đây là prerequisite của localization lane. Remote head hiện tại của PR #26: **[UNVERIFIED]**.

Các điểm kiểm tra còn lại:

- **#12 hooks:** relative `core.hooksPath=.githooks` phù hợp worktree. Git manual cài tại máy xác nhận relative path tính từ hook working directory, và `pre-push` chạy ở root worktree. Nhưng **config mặc định dùng chung giữa worktrees**, không tự thành cấu hình riêng từng worktree. Cần hook có executable bit, có mặt trong từng checkout, và hướng dẫn setup. Tôi xác minh phân giải đường dẫn ở hai worktree; việc hook thực sự chặn push: **[UNVERIFIED]**, không thực hiện push.
- **#12 schedule/production:** bỏ `push`, giữ PR, thêm weekly schedule không tự phá `production-release`; job production vẫn chặn theo manual event, main và confirmation. Daily [mcp-edge-security-monitor.yml:3](/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-edge-security-monitor.yml:3) là workflow riêng, phải giữ nguyên. Weekly repository gate không thay thế live edge monitor.
- **#16:** `--check` hiện pass. Thêm vào `verify` sẽ chặn cả Pages deploy và MCP repository gate khi report stale, đúng như quyết định đã chọn. PR chỉ sửa `docs/zh-gaps.md` hiện không kích hoạt MCP workflow: thêm path này vào filter nếu muốn bảo vệ cả sửa tay report. Khi chuyển report, cập nhật generator path/comment và docs cùng PR.
- **Dispatch `confirm_production=false`:** `production_sha` input không được kiểm trong credential-free job; phần kiểm exact SHA nằm trong job production bị skip. Vì vậy phải xác minh **head SHA thực tế của run**, không chỉ tin giá trị đã nhập.
- **MCP → Pages:** không thấy yêu cầu trong hai tài liệu buộc Pages phải đi trước MCP. Tuy nhiên phải giữ `main` bất biến đến khi **cả hai deploy hoàn tất**, không chỉ đến lúc dispatch. Pages checkout `main`, không checkout một input SHA; `blog-publish` còn có thể hủy run đang chạy vì `cancel-in-progress: true`.
- **Số lần release:** worker lên sớm giải quyết dependency `/api/roster`, nhưng không bảo đảm Pages chỉ release một lần. Muốn giữ mục tiêu đó cần thống nhất cửa sổ không publish/edit/unpublish/delete bài kích hoạt deploy. Nếu cho phép blog deploy giữa batch, phải chấp nhận nhiều lần Pages release.
- **Runbook release:** vẫn cần known-good deployment, preview/header checks và production canary theo [deployment-guide.md:131](/Users/plateau/Project/CamNangTQCCL/docs/deployment-guide.md:131). “Cùng SHA” không thay thế các bước này.

**Đối chiếu 10 finding của Fable**

| Fable | Kết luận độc lập |
|---|---|
| 1 | **Đồng ý một phần.** Freeze nguyên 68 ID đúng; D1 có lưu ID. Nhưng bỏ sót generator, resolver tên Việt, Soi đội/history/share link và season consumers. |
| 2 | **Đồng ý trong scope freeze.** Rename giữ ID không cần book redirect migration. Không khẳng định redirect cho book merge tương lai là vô ích. |
| 3 | **Đồng ý có điều kiện.** Worker trước client là đúng. Không đồng ý rằng chỉ endpoint tồn tại là đủ kết luận mọi PR an toàn. |
| 4 | **Không đồng ý free set.** #6 thuộc lane là đúng; #14 hoàn chỉnh cũng chạm pinned consumers. #14/#15 còn tranh chấp workflow-build artifact. |
| 5 | **Đồng ý một phần.** Trigger production được giữ; final gate hữu ích. Fable bỏ sót community-worker không được gate và dispatch false không kiểm input SHA. |
| 6 | **Đồng ý.** `verify` lan sang Pages/MCP; current report pass. Chi phí “nil” không phải bảo đảm lâu dài. |
| 7 | **Đồng ý về thứ tự tích hợp đề xuất.** `conflictedTeams` có thật; #21 sửa semantic input. Đủ scope #5/#20 và dependency theo issue: **[UNVERIFIED]**. |
| 8 | **Đồng ý có điều kiện.** `0011` đúng, rollback scripts riêng, MCP trước Pages được phép. Cần freeze tới completion và đầy đủ release/rollback evidence. |
| 9 | **Đồng ý nhưng chưa đủ.** Season route migration còn phải cập nhật output inventory, sitemap và các trạng thái URL. Đủ acceptance #6: **[UNVERIFIED]**. |
| 10 | **Không đồng ý phần #26.** Nhánh local chỉ đổi CSS/tests. Đồng ý worktree roster ở `1fa81ab` cần rebase và Worker deploy vẫn thủ công. |

Route hợp lý hơn là: **#12/#16 có thể phát triển song song; tích hợp #14 hoàn chỉnh qua localization lane; tuần tự hóa mọi lần regenerate workflow-build; giữ #5 → #20 → #6 → #21 → #23 như thứ tự tích hợp lựa chọn.** Trước worker release sớm phải hoàn thành schema gate, Worker verification và phần rollout tương ứng. Sau cùng xác minh final SHA, release MCP rồi Pages và ghi evidence sau completion.

Chưa thể ký xác nhận “không bỏ sót acceptance criteria” hoặc đóng 9 issue: **body/comments của #5, #6, #12, #14, #15, #16, #20, #21, #23 đều [UNVERIFIED]**. Live D1/Worker state và remote PR head cũng chưa được kiểm. Không chạy full build/test vì yêu cầu chỉ đọc; đã chạy report check và các phép kiểm thuần trong bộ nhớ.

Giới hạn truy cập: `gh` không kết nối được API GitHub; cổng cấp quyền trình duyệt từ chối truy cập `github.com` với lý do người dùng không cấp quyền. Tôi không thử đường vòng.

