/**
 * 混合逻辑时钟 (HLC) 工具
 * 格式: <timestamp_ms 13位>-<counter 4位>-<deviceId>
 * 例: 1763184000123-0001-dev_macos_01
 */

/**
 * 比较两个 HLC。
 * 若 a > b 返回 1；若 a < b 返回 -1；若 a == b 返回 0。
 * 因前缀是 13 位数字与 4 位补零计数器，直接使用字符串字典序比较即可精确比较先后。
 */
export function compareHlc(a: string, b: string): number {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}

/**
 * 判断 incoming 是否比 existing 更加新（采用严格大于）。
 */
export function isHlcNewer(incoming: string, existing: string): boolean {
  return compareHlc(incoming, existing) > 0;
}
