// Chiến pháp tự có của tướng, theo hai chiều. Một quy tắc cho hồ sơ tướng, hồ sơ chiến pháp (`lookup-detail.js`)
// và MCP `tqccl_get_entity` (`innateHeroIds`): `lookup.selfTacticId`, không có thì tên Hán khớp đúng một chiến pháp.

/** ID chiến pháp có tên Hán `chinese`, chỉ khi đúng một chiến pháp mang tên đó. */
export function uniqueTacticIdByChinese(tactics, chinese) {
  if (!chinese) return null;
  const matches = tactics.filter((row) => row.chinese === chinese);
  return matches.length === 1 ? matches[0].id : null;
}

/** ID chiến pháp tự có của một tướng, hoặc null khi không xác định được. */
export function heroSelfTacticId(hero, tactics) {
  return hero.lookup?.selfTacticId ?? uniqueTacticIdByChinese(tactics, hero.selfTacticCn);
}

/** ID chiến pháp → ID các tướng mang nó làm chiến pháp tự có (sắp theo ID). */
export function innateHolderIndex(heroes, tactics) {
  const index = new Map();
  for (const hero of heroes) {
    const tacticId = heroSelfTacticId(hero, tactics);
    if (tacticId) index.set(tacticId, [...(index.get(tacticId) ?? []), hero.id]);
  }
  for (const ids of index.values()) ids.sort();
  return index;
}
