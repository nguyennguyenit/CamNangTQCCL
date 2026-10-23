/**
 * Icon nét 24×24 của từng mục (nội dung SVG tĩnh, render kèm `aria-hidden`): dùng chung cho lưới lối vào
 * của Landing và menu mobile để cùng một mục luôn mang cùng một hình.
 */
export const SECTION_ICONS = {
  standard: '<path d="M5 21V4"></path><path d="M5 4h11l-2 4 2 4H5"></path>',
  other: '<circle cx="9" cy="8" r="3.5"></circle><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7"></path><path d="M18 14c2 .8 3 2.8 3 6"></path>',
  community: '<circle cx="12" cy="7.5" r="3"></circle><path d="M6.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"></path><circle cx="4.5" cy="10.5" r="2"></circle><circle cx="19.5" cy="10.5" r="2"></circle><path d="M1.5 18c0-1.8 1.3-3.2 3-3.5M22.5 18c0-1.8-1.3-3.2-3-3.5"></path>',
  coexist: '<path d="M12 3 3 8l9 5 9-5-9-5z"></path><path d="m3 13 9 5 9-5"></path>',
  khaihoang: '<path d="m3 20 6-11 4 7 3-4 5 8z"></path><circle cx="16" cy="6" r="2"></circle>',
  lookup: '<circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path>',
  recruit: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>',
  analyze: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>',
  roster: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect><path d="M17 14v6M14 17h6"></path>',
  report: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"></path><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"></path><path d="M12 13v4M8 20h8"></path>',
  post: '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="m13.5 6.5 4 4"></path>',
  comment: '<path d="M4 5h16v11H9l-5 4z"></path><path d="M8 9h8M8 12h5"></path>',
} as const;

export type SectionIcon = keyof typeof SECTION_ICONS;
