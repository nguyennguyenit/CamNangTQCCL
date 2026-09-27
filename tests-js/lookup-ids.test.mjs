import test from 'node:test';
import assert from 'node:assert/strict';
import { bookLookupId, createLookupIdResolver, lookupProfilePath, lookupSlug } from '../js/lookup-ids.js';

test('slug matches pipeline canonical ids (đ, dấu, ký tự lạ)', () => {
  assert.equal(lookupSlug('Đoạt Hồn Hiệp Phách'), 'doat-hon-hiep-phach');
  assert.equal(lookupSlug('  Tinh · Phong Thỉ Trận! '), 'tinh-phong-thi-tran');
  assert.equal(bookLookupId({viet: 'Dĩ Trực Báo Oán'}), 'book:di-truc-bao-oan');
  assert.equal(bookLookupId({viet: '  '}), null);
});

test('resolver maps source Chinese (incl. aliases, modified prefixes) and Vietnamese names to lookup ids', () => {
  const resolve = createLookupIdResolver({
    tactics: [{id: 'tactic:phong-thi-tran', chinese: '锋矢阵', aliases: ['鋒矢陣'], viet: 'Phong Thỉ Trận'}],
    books: [{chinese: '以退为进', viet: 'Dĩ Trực Báo Oán'}],
  });
  assert.equal(resolve.tactic('鋒矢陣', null), 'tactic:phong-thi-tran');
  // Chiến pháp cải tạo (`精・`) dẫn về hồ sơ chiến pháp gốc.
  assert.equal(resolve.tactic('精・鋒矢陣', 'Tinh · Phong Thỉ Trận'), 'tactic:phong-thi-tran');
  assert.equal(resolve.tactic(null, 'Tinh · Phong Thỉ Trận'), 'tactic:phong-thi-tran');
  // Nguồn chữ phồn thể không khớp `chinese` giản thể của binh thư: tên Việt vẫn tra được.
  assert.equal(resolve.book('以退為進', 'Dĩ Trực Báo Oán'), 'book:di-truc-bao-oan');
  assert.equal(resolve.book('以退为进', null), 'book:di-truc-bao-oan');
  // Không có hồ sơ thì trả null để trang giữ dạng chữ, không dựng link hỏng.
  assert.equal(resolve.tactic('異族弓', 'Cung Dị Tộc'), null);
  assert.equal(resolve.book('—', null), null);
  assert.equal(lookupProfilePath('book:di-truc-bao-oan'), '/tra-cuu/?id=book%3Adi-truc-bao-oan');
});
