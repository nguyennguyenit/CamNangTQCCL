import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOOKUP_HUB_TABLES, bookLookupId, bookSourceAliases, createLookupIdResolver, groupForId, lookupHubTarget, lookupProfilePath, lookupSlug,
} from '../js/lookup-ids.js';
import {createTacticIdResolver, createTacticNameIndex} from '../js/lookup-ids.js';

test('tactic name index: tên cũ (hanViet) và tên mới đều ra cùng mã; tên trùng ở hai mã chọn mã có slug khớp', () => {
  const tactics = [
    {id: 'tactic:chan-hai-tu-canh', viet: 'Bốn Bề Rung Động', hanViet: 'Chấn Hãi Tứ Cảnh', aliases: []},
    {id: 'tactic:di-hoa-tiep-moc', viet: 'Lập Lờ Đánh Tráo', hanViet: 'Di Hoa Tiếp Mộc', aliases: []},
    {id: 'tactic:lap-lo-danh-trao', viet: 'Lập Lờ Đánh Tráo', hanViet: 'Lập Lờ Đánh Tráo', aliases: []},
  ];
  const index = createTacticNameIndex(tactics);
  assert.equal(index('Chấn Hãi Tứ Cảnh'), 'tactic:chan-hai-tu-canh');
  assert.equal(index('Bốn Bề Rung Động'), 'tactic:chan-hai-tu-canh');
  assert.equal(index('Di Hoa Tiếp Mộc'), 'tactic:di-hoa-tiep-moc');
  assert.equal(index('Lập Lờ Đánh Tráo'), 'tactic:lap-lo-danh-trao');
  assert.equal(index('Không Có'), null);
  assert.equal(createTacticIdResolver(tactics)('Không Có'), 'tactic:khong-co');
  const resolve = createLookupIdResolver({tactics});
  assert.equal(resolve.tactic(null, 'Bốn Bề Rung Động'), 'tactic:chan-hai-tu-canh');
  assert.equal(resolve.tactic(null, 'Chấn Hãi Tứ Cảnh'), 'tactic:chan-hai-tu-canh');
});

test('tactic name index: tên hiển thị hiện hành thắng tên Hán-Việt cũ trùng chữ của mã khác', () => {
  // Client: Lập Lờ Đánh Tráo = 移花接木; mã lap-lo-danh-trao (暗渡陳倉) nay hiện "Ám Độ Trần Thương", hanViet cũ vẫn là "Lập Lờ Đánh Tráo".
  const index = createTacticNameIndex([
    {id: 'tactic:di-hoa-tiep-moc', viet: 'Lập Lờ Đánh Tráo', hanViet: 'Di Hoa Tiếp Mộc', aliases: []},
    {id: 'tactic:lap-lo-danh-trao', viet: 'Ám Độ Trần Thương', hanViet: 'Lập Lờ Đánh Tráo', aliases: []},
  ]);
  assert.equal(index('Lập Lờ Đánh Tráo'), 'tactic:di-hoa-tiep-moc');
  assert.equal(index('Ám Độ Trần Thương'), 'tactic:lap-lo-danh-trao');
});

test('slug matches pipeline canonical ids (đ, dấu, ký tự lạ)', () => {
  assert.equal(lookupSlug('Đoạt Hồn Hiệp Phách'), 'doat-hon-hiep-phach');
  assert.equal(lookupSlug('  Tinh · Phong Thỉ Trận! '), 'tinh-phong-thi-tran');
  assert.equal(bookLookupId({viet: 'Dĩ Trực Báo Oán'}), 'book:di-truc-bao-oan');
  assert.equal(bookLookupId({viet: '  '}), null);
});

test('resolver maps source Chinese (incl. aliases, modified prefixes) and Vietnamese names to lookup ids', () => {
  const resolve = createLookupIdResolver({
    tactics: [{id: 'tactic:phong-thi-tran', chinese: '锋矢阵', aliases: ['鋒矢陣'], viet: 'Phong Thỉ Trận'}],
    books: [{chinese: '顺天应时', viet: 'Thuận Thiên Thuận Tời'}],
  });
  assert.equal(resolve.tactic('鋒矢陣', null), 'tactic:phong-thi-tran');
  // Chiến pháp cải tạo (`精・`) dẫn về hồ sơ chiến pháp gốc.
  assert.equal(resolve.tactic('精・鋒矢陣', 'Tinh · Phong Thỉ Trận'), 'tactic:phong-thi-tran');
  assert.equal(resolve.tactic(null, 'Tinh · Phong Thỉ Trận'), 'tactic:phong-thi-tran');
  assert.equal(resolve.book('顺天应时', null), 'book:thuan-thien-thuan-toi');
  // Không có hồ sơ thì trả null để trang giữ dạng chữ, không dựng link hỏng.
  assert.equal(resolve.tactic('異族弓', 'Cung Dị Tộc'), null);
  assert.equal(resolve.book('—', null), null);
  assert.equal(lookupProfilePath('book:di-truc-bao-oan'), '/tra-cuu/binh-thu/?id=book%3Adi-truc-bao-oan');
});

test('binh thư: tên Hán nguồn quyết định hồ sơ; tên Việt chỉ dùng khi ô không có tên nguồn', () => {
  const resolve = createLookupIdResolver({
    books: [
      {chinese: '顺天应时', viet: 'Thuận Thiên Thuận Tời', sourceNames: ['順天應時']},
      {chinese: '以直报怨', viet: 'Dĩ Trực Báo Oán', sourceNames: ['以直報怨'], excludedSourceNames: ['以退為進']},
    ],
  });
  // Bản dịch ô lệch tên Việt của từ điển: tên nguồn vẫn dẫn đúng hồ sơ.
  assert.equal(resolve.book('順天應時', 'Thuận Thiên Ứng Thời'), 'book:thuan-thien-thuan-toi');
  // Binh thư khác bị dịch nhầm sang tên Việt của một hồ sơ có sẵn: không dựng link sai.
  assert.equal(resolve.book('以退為進', 'Dĩ Trực Báo Oán'), null);
  assert.equal(resolve.book('以直報怨', 'Dĩ Trực Báo Oán'), 'book:di-truc-bao-oan');
  // Nội dung đội gốc chỉ có tên Việt.
  assert.equal(resolve.book(null, 'Dĩ Trực Báo Oán'), 'book:di-truc-bao-oan');
  assert.equal(resolve.book('—', 'Dĩ Trực Báo Oán'), 'book:di-truc-bao-oan');
});

test('bookSourceAliases: tên nguồn hiện hành không thành "tên cũ", tên loại trừ không gắn vào hồ sơ', () => {
  const books = [
    {chinese: '出奇制胜', viet: 'Đánh Bất Ngờ Thắng', sourceNames: ['出奇制勝']},
    {chinese: '以直报怨', viet: 'Dĩ Trực Báo Oán', sourceNames: ['以直報怨'], excludedSourceNames: ['以退為進']},
    {chinese: '开合', viet: 'Khai Hạp'},
  ];
  const aliases = bookSourceAliases(books, [
    {kind: 'book', aliases: ['出奇制勝'], displayNameVi: 'Đánh Bất Ngờ Thắng'},
    {kind: 'book', aliases: ['以退為進'], displayNameVi: 'Dĩ Trực Báo Oán'},
    {kind: 'book', aliases: ['開闔'], displayNameVi: 'Khai Hạp'},
  ]);
  // Chỉ tên đứng riêng chưa được từ điển nhận là tên nguồn mới còn là "tên cũ".
  assert.deepEqual(aliases, {'book:khai-hap': {aliases: ['開闔'], formerNames: ['開闔']}});
});

test('groupForId và lookupProfilePath đưa mỗi loại mã về đúng trang nhóm; mã sai dạng trả null', () => {
  const cases = [
    ['hero:luu-bi', 'heroes', '/tra-cuu/tuong/?id=hero%3Aluu-bi'],
    ['tactic:phong-thi-tran', 'tactics', '/tra-cuu/chien-phap/?id=tactic%3Aphong-thi-tran'],
    ['equipment:thanh-long-dao', 'equipment', '/tra-cuu/trang-bi/?id=equipment%3Athanh-long-dao'],
    ['equipment-special:ngoc-ti', 'equipment', '/tra-cuu/trang-bi/?id=equipment-special%3Angoc-ti'],
    ['advisor:tuan-uc', 'advisors', '/tra-cuu/quan-su/?id=advisor%3Atuan-uc'],
    ['troop-mod:ho-bao-ky', 'troop-mods', '/tra-cuu/cai-tao-binh-chung/?id=troop-mod%3Aho-bao-ky'],
    ['building:thai-hoc', 'buildings', '/tra-cuu/cong-trinh/?id=building%3Athai-hoc'],
    ['book:di-truc-bao-oan', 'books', '/tra-cuu/binh-thu/?id=book%3Adi-truc-bao-oan'],
  ];
  for (const [id, group, path] of cases) {
    assert.equal(groupForId(id), group, id);
    assert.equal(lookupProfilePath(id), path, id);
  }
  for (const bad of ['', 'hero', 'hero:', ':luu-bi', 'Hero:luu-bi', 'hero:luu bi', 'unit:luu-bi', 'hero:a:b', null, 42]) {
    assert.equal(groupForId(bad), null, String(bad));
    assert.equal(lookupProfilePath(bad), null, String(bad));
  }
});

test('lookupHubTarget chuyển link cũ của mục lục sang trang nhóm, giá trị lặp/lạ/lệch nhóm ở lại mục lục', () => {
  const target = (search, path = '/tra-cuu/', hash = '') =>
    lookupHubTarget(`https://example.test${path}${search}${hash}`, LOOKUP_HUB_TABLES.slugs, LOOKUP_HUB_TABLES.kinds);
  // Không có group/id: ở nguyên mục lục, không đụng query khác.
  assert.equal(target(''), null);
  assert.equal(target('?utm_source=x'), null);
  // Chỉ nhóm, nhóm + mã, chỉ mã.
  assert.equal(target('?group=advisors'), '/tra-cuu/quan-su/');
  assert.equal(target('?group=tactics&id=tactic%3Aphong-thi-tran'), '/tra-cuu/chien-phap/?id=tactic%3Aphong-thi-tran');
  assert.equal(target('?id=equipment-special%3Angoc-ti'), '/tra-cuu/trang-bi/?id=equipment-special%3Angoc-ti');
  // Mã thuộc nhóm khác với `group`, mã sai dạng, nhóm lạ, khóa lặp: mục lục đã bỏ group/id.
  assert.equal(target('?group=heroes&id=tactic%3Aphong-thi-tran'), '/tra-cuu/');
  assert.equal(target('?group=heroes&id=Hero%3Aluu-bi'), '/tra-cuu/');
  assert.equal(target('?id=unit%3Aluu-bi'), '/tra-cuu/');
  assert.equal(target('?group=all&utm_source=x'), '/tra-cuu/?utm_source=x');
  assert.equal(target('?group=heroes&group=heroes'), '/tra-cuu/');
  assert.equal(target('?id=hero%3Aa&id=hero%3Ab&utm_source=x'), '/tra-cuu/?utm_source=x');
  // Khóa khác, tiền tố /zh/ và hash đi theo.
  assert.equal(
    target('?utm_source=x&group=heroes&id=hero%3Aluu-bi', '/zh/tra-cuu/', '#top'),
    '/zh/tra-cuu/tuong/?utm_source=x&id=hero%3Aluu-bi#top',
  );
  assert.equal(target('?group=zz', '/zh/tra-cuu/', '#top'), '/zh/tra-cuu/#top');
});

test('mã chiến pháp đã gộp (lookup.formerIds) tra ra mã còn sống ở cả ba bộ tra', () => {
  const tactics = [
    {id: 'tactic:si-tranh-tien-pho', viet: 'Sĩ Tranh Tiên Phô', hanViet: 'Sĩ Tranh Tiên Phô', aliases: [], lookup: {formerIds: ['tactic:nhanh-chan-tranh-dat']}},
    {id: 'tactic:di-hoa-tiep-moc', viet: 'Di Hoa Tiếp Mộc', hanViet: 'Di Hoa Tiếp Mộc', aliases: [], lookup: {formerIds: []}},
  ];
  assert.equal(createTacticNameIndex(tactics)('Nhánh Chân Tranh Đất'), 'tactic:si-tranh-tien-pho');
  assert.equal(createTacticIdResolver(tactics)('Nhánh Chân Tranh Đất'), 'tactic:si-tranh-tien-pho');
  assert.equal(createLookupIdResolver({tactics}).tactic(null, 'Nhánh Chân Tranh Đất'), 'tactic:si-tranh-tien-pho');
  assert.equal(createTacticIdResolver(tactics)('Không Có'), 'tactic:khong-co');
  // Mã còn là hàng sống không bị coi là đã gộp.
  const stillLive = [...tactics, {id: 'tactic:nhanh-chan-tranh-dat', viet: 'Nhánh Chân Tranh Đất', hanViet: 'x', aliases: []}];
  assert.equal(createTacticIdResolver(stillLive)('Nhánh Chân Tranh Đất'), 'tactic:nhanh-chan-tranh-dat');
});
