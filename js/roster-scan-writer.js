// Ghi kho Gợi ý đội của người đã đăng nhập vào cache cloud (`js/roster-cloud-store.js`) cho `js/roster-recommend-ui.js`.
// Giữ hai điều mà UI cần nhưng không nên tự theo dõi:
// - `previous`: kho UI ngay trước mỗi lần ghi (nạp từ cloud hoặc lần ghi trước), để xóa mềm CHỈ theo chênh lệch;
// - `busy()`: còn lần ghi đang chờ → UI không nạp lại từ cache (sẽ kéo `state` lùi về trước thao tác kế tiếp).

import { writeScanState } from "./roster-cloud-store.js";

export function createScanWriter({ sync, resolve, boxId }) {
  let pending = 0;
  let baseline = null;
  return {
    /** UI vừa nạp kho từ cache cloud: đây là mốc cho chênh lệch kế tiếp. */
    rebase(scan) {
      baseline = scan;
    },
    busy: () => pending > 0,
    /** Ghi `next`; trả `{outcome, localOnly, idle}` (`idle`: không còn lần ghi nào đang chờ). */
    async write(next) {
      const previous = baseline;
      baseline = next;
      pending += 1;
      let localOnly = null;
      try {
        const outcome = await sync.mutate((cloudState, { now }) => {
          const written = writeScanState(cloudState, boxId(), next, resolve, { now, previous, groups: false }); // Gợi ý đội không kéo `group`: không dựng lại nhóm mặc định
          localOnly = written.localOnly;
          return written.state;
        });
        return { outcome, localOnly, idle: pending === 1 };
      } finally {
        pending -= 1;
      }
    },
  };
}
