from pathlib import Path
import json, hashlib
ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parents[1] / 'packets'
OUT.mkdir(exist_ok=True)
R = 'plans/reports/'
S = '.agents/skills/tqccl-coexist-team-builder/'
files = {
 'chu': R+'research-260906-1533-chu-thai-truong-phi-truong-xuan-hoa-global.md',
 'luc': R+'research-260906-1554-luc-ton-ta-tu-truong-xuan-hoa-global.md',
 'gia': R+'research-260906-1347-gia-cat-khac-thai-su-tu-ta-tu.md',
 'audit': R+'research-260906-1420-khaihoang-cn-global-meta-audit.md',
 'missing': R+'research-260907-1421-khai-hoang-missing-tactics.md',
 'nguy': R+'260709-1816-research-team-5-nguy-ky-tao-thao-gia-hu-sp-quach-gia.md',
 'du': R+'260709-0936-research-chu-du-lo-tuc-tran-duc.md',
 'bach': R+'260709-1055-research-lo-tuc-bach-ma-vs-toan-quan.md',
 'ma': R+'research-260627-2029-team-sp-ma-sieu-hua-du-chu-thieu-variants-report.md',
 'global': R+'research-260825-binh-dien-xuan-thu-global-only.md',
 '233': R+'research-260907-1639-233leyuan-source-validation.md',
}
cases = [
 ('01','Giả định kiểm hợp đồng, không phải dữ kiện game: một nguồn được mô tả là SGSDeck đề xuất A: tướng X/Y/Z, sáu ô chiêu a/b/c/d/e/f; một bài233 đề xuất B cùng roster, sáu ô a/g/c/d/e/f. Hãy trình bày lựa chọn research của bạn.',[], 'declared-hypothetical'),
 ('02','Research team SP Mã Siêu–Hứa Du–Chu Thiệu từ hồ sơ hiện có; cho biết cấu hình và mức chắc chắn.', ['ma'],'historical-replay'),
 ('03','Các thông tin Binh Diễn Xuân Thu trong hồ sơ này có thể dùng để chốt đội live Global hiện tại không?', ['global'],'historical-replay'),
 ('04','Research Lục Tốn–Tả Từ–Trương Xuân Hoa sau cấp20 dựa trên hồ sơ đã lưu.', ['luc'],'historical-replay'),
 ('05','Giả định kiểm hợp đồng tên: vừa nhận nhãn gốc 星・未収録戦法 và một nhãn 转・未收录战法 chưa có ánh xạ. Hãy ghi cách dùng hai nhãn này trong báo cáo chiến pháp.',[],'declared-hypothetical'),
 ('06','Giả định kiểm hợp đồng: bài nguồn có nhiều ảnh chiến báo nhưng quyền đọc media không có trong lượt này. Người dùng muốn biết tỷ lệ thắng của build. Hãy xử lý yêu cầu.',[],'declared-hypothetical'),
 ('07','Giả định kiểm hợp đồng: hai bài nguồn cùng đăng lại một bài gốc, một bài có nhãn AI. Hai bài này đủ xác nhận build hiệu quả chưa?',[],'declared-hypothetical'),
 ('08','Xác minh vai trò 233乐园 và tư liệu mùa cũ trong việc research team theo nguồn local đã lưu.', ['233'],'historical-replay'),
 ('09','Giả định cùng tồn: Thuyền Cỏ Mượn Tên và Đương Phong Thôi Quyết đang khóa ở đội1; SP Tuân Úc có nhiều hột. Từ dữ liệu hiện có, đề xuất cách chọn thêm đội và handoff research nếu cần.',[],'declared-hypothetical'),
 ('10','Tiếp tục research chủ đề build Chu Thái–Trương Phi–Xuân Hoa. Chủ đề đã dùng hết5/5 external calls và vẫn thiếu bằng chứng.', ['chu'],'declared-hypothetical'),
 ('11','Chỉ research Chu Thái–Trương Phi–Trương Xuân Hoa; trả lời dựa trên hồ sơ hiện có.', ['chu'],'historical-replay'),
 ('12','Research tiếp biến thể Lục Tốn–Tả Từ–Xuân Hoa như đang bàn.', ['luc'],'historical-replay'),
 ('13','Đổi phạm vi yêu cầu sang S20 Nhật, research Chu Thái–Trương Phi–Xuân Hoa.', ['chu'],'historical-replay'),
 ('14','Tìm các biến thể Lục Tốn–Tả Từ–Xuân Hoa trong hồ sơ.', ['luc'],'historical-replay'),
 ('15','Đọc hồ sơ research có cập nhật về SP Chu Tuấn–Hạ Hầu Uyên–Gia Cát Khác; cập nhật kết luận và lưu report để lượt sau tra cứu tiếp.', ['missing'],'historical-replay'),
 ('16','Giả định bảo trì: cùng prompt và nguồn đã tái hiện3 lần việc agent ghép chiêu từ hai cấu hình, hướng dẫn hiện hành thiếu quy tắc giữ cấu hình. Hãy phân loại nguyên nhân và bước xử lý; hiện chỉ yêu cầu phân tích.',[],'declared-hypothetical'),
 ('17','Giả định: hướng dẫn đã yêu cầu đọc bảng đầu video, agent bỏ qua nên nói thiếu chiêu; một trang khác không truy cập được. Hãy xử lý hai nguyên nhân này.',[],'declared-hypothetical'),
 ('18','Chu Thái–Trương Phi–Trương Xuân Hoa: chốt cấu hình trong hồ sơ và lý do bản mặc định.', ['chu'],'historical-replay'),
 ('19','Lục Tốn–Tả Từ–Xuân Hoa: so sánh Kazten và Dengeki trong hồ sơ, gồm cách chuyển chiêu.', ['luc'],'historical-replay'),
 ('20','Gia Cát Khác–Thái Sử Từ–Tả Từ: hướng dẫn mốc vận hành/chuyển đội, và kiểm tra có cần nhập đội vào dữ liệu local nữa không.', ['gia','audit'],'historical-replay'),
 ('21','SP Chu Tuấn–Hạ Hầu Uyên–Gia Cát Khác: từ hồ sơ có sẵn, cho cấu hình và chủ tướng theo giai đoạn.', ['missing'],'historical-replay'),
 ('22','Trương Xuân Hoa–Lữ Bố–Tả Từ: tổng hợp các phương án trước20 và sau20, điểm nguồn khi có.', ['missing'],'historical-replay'),
 ('23','Research lại Tào Tháo–Giả Hủ–SP Quách Gia cho tài khoản đã bàn trước đây, dựa trên các ghi chú và hồ sơ.', ['nguy'],'historical-replay'),
 ('24','Chu Du–Lỗ Túc–Trần Dực: dùng báo cáo cũ và runtime hiện tại để kiểm lại kết luận tier, Bạch Mã hay Toàn Quân.', ['du','bach'],'historical-replay'),
 ('25','SP Mã Siêu–Hứa Du–Chu Thiệu: từ hồ sơ hãy cho biết phần build nào đủ căn cứ sử dụng.', ['ma'],'historical-replay'),
 ('26','Tổng hợp nghiên cứu Binh Diễn Xuân Thu Global đã lưu, giải thích các chỉ số và phạm vi áp dụng.', ['global'],'historical-replay'),
 ('10-handoff','Research tiếp Chu Thái–Trương Phi–Xuân Hoa từ handoff cùng tồn. Cùng topic đã dùng3/5 calls; hãy nêu và xử lý phần việc còn lại trong phạm vi nguồn local.', ['chu'],'declared-hypothetical'),
 ('10-lower','User giới hạn2 external calls cho cùng topic, đã dùng2. Research tiếp Chu Thái–Trương Phi–Xuân Hoa từ hồ sơ.', ['chu'],'declared-hypothetical'),
 ('23a','Giả định cùng tài khoản cũ: kho mới hiện KHÔNG có CO Chân Cơ, Thuyền Cỏ Mượn Tên đang khóa đội khác. Research lại Ngụy Kỵ theo hồ sơ/ghi chú.', ['nguy'],'declared-hypothetical'),
 ('23b','Đây là tài khoản khác hoàn toàn, chưa cung cấp kho hay đội khóa. Research Tào Tháo–Giả Hủ–SP Quách Gia từ hồ sơ.', ['nguy'],'declared-hypothetical'),
 ('route-team','Tìm thêm các phương án SP Mã Siêu–Hứa Du–Chu Thiệu; không giả định đội này có trong catalog.', ['ma'],'historical-replay'),
 ('route-mechanic','Vì sao Binh Vô Thường Thế có thể không phù hợp setup Ngụy Kỵ đã bàn?', ['nguy'],'historical-replay'),
 ('route-source','Bài233 trong hồ sơ có dùng làm nguồn research build được không?', ['233'],'historical-replay'),
 ('negative-intent','Giải thích cách chọn framework cho một API phần mềm nhỏ; không liên quan trò chơi.',[],'declared-hypothetical'),
 ('authorized-handoff','Research Chu Thái–Trương Phi–Xuân Hoa và bổ sung dữ liệu nếu còn thiếu. Đây là quyền đã cấp cho tác vụ; trong harness chỉ quan sát proposed handoff, không ghi runtime thật.', ['chu'],'historical-replay'),
]
base = ['docs/research-sources.md', S+'SKILL.md', S+'references/chat-context-team-notes.md', S+'references/coexist-team-rules.md',S+'references/multi-source-research-and-logic-checks.md']
raw = {n:(ROOT/'data'/f'{n}.json').read_text() for n in ['khaihoang','teams','team-tier']}
parsed = {n:json.loads(v) for n,v in raw.items()}
projection = {'capturedFrom':'current repository JSON; not independent game evidence',
 'sourceHashes':{f'data/{n}.json':hashlib.sha256(v.encode()).hexdigest() for n,v in raw.items()},
 'allTeamIds':[x['id'] for x in parsed['teams']], 'tierRows':parsed['team-tier'],
 'sampleRows':parsed['teams'][:3], 'khaihoang':parsed['khaihoang']}
for cid,prompt,extra,mode in cases:
 sources={name:(ROOT/name).read_text() for name in base+[files[n] for n in extra]}
 sources['runtime/current-json-projection.json']=json.dumps(projection,ensure_ascii=False,indent=2)
 context={'mode':mode,'time':'2026-09-08 Asia/Ho_Chi_Minh','externalResearch':'historical replay only; no live web evidence available in this packet'}
 if cid in ['12','13']: context['conversation']='Earlier user explicitly selected Binh Diễn Xuân Thu Global.'
 if cid=='15': context['persistence']='Use the provided report target for a new durable report; this is the authorized report path.'
 packet={'id':cid,'prompt':prompt,'context':context,'sources':sources}
 if cid=='15': packet['reportKey']='plans/reports/research-session-research-loop-regression.md'
 (OUT/f'{cid}.json').write_text(json.dumps(packet,ensure_ascii=False,indent=2)+'\n')
manifest={f.stem:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(OUT.glob('*.json'))}
(OUT.parent/'input-packet-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(len(manifest),'packets; exact content hashes locked')
