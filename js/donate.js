// Hộp thoại "Ủng hộ tác giả" ở footer (src/layouts/SiteLayout.astro); hành vi mở/đóng ở js/modal-dialog.js.

import { initModalDialog } from './modal-dialog.js';

initModalDialog('donate-dialog', 'donate');
