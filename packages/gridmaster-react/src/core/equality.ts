// Internal structural equality (NOT re-exported from the package entry).
// Language: TypeScript 6 (strict). Handles Date / RegExp / Map / Set / arrays / plain objects and
// cyclic values; any other class instance is equal only by identity.

/** left -> rights currently being compared: a revisited pair is assumed equal (coinduction). */
type Seen = WeakMap<object, WeakSet<object>>;

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

/**
 * Deep equality. Functions compare by identity, or by PRESENCE when `fnByPresence` is set (so
 * inline closures that are new on every render do not count as a change).
 */
export function deepEqual(
  left: unknown,
  right: unknown,
  fnByPresence = false,
  seen?: Seen
): boolean {
  if (typeof left === "function" || typeof right === "function") {
    return fnByPresence
      ? typeof left === "function" && typeof right === "function"
      : Object.is(left, right);
  }
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || typeof right !== "object" || !left || !right) return false;
  // Same prototype also separates Date / Map / Set / array / plain object from each other, which a
  // key-count comparison alone cannot (an empty Map, Set, Date-like and {} all have zero keys).
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;

  const visited = seen ?? new WeakMap<object, WeakSet<object>>();
  let partners = visited.get(left);
  if (partners?.has(right)) return true;
  if (!partners) {
    partners = new WeakSet();
    visited.set(left, partners);
  }
  partners.add(right);

  if (left instanceof Date) return Object.is(left.getTime(), (right as Date).getTime());
  if (left instanceof RegExp) {
    return left.source === (right as RegExp).source && left.flags === (right as RegExp).flags;
  }
  if (left instanceof Map) {
    const other = right as Map<unknown, unknown>;
    if (left.size !== other.size) return false;
    for (const [key, value] of left) {
      if (!other.has(key) || !deepEqual(value, other.get(key), fnByPresence, visited)) return false;
    }
    return true;
  }
  if (left instanceof Set) {
    const other = right as Set<unknown>;
    if (left.size !== other.size) return false;
    for (const value of left) if (!other.has(value)) return false;
    return true;
  }
  if (Array.isArray(left)) {
    const other = right as unknown[];
    if (left.length !== other.length) return false;
    for (let index = 0; index < left.length; index++) {
      if (!deepEqual(left[index], other[index], fnByPresence, visited)) return false;
    }
    return true;
  }

  const proto = Object.getPrototypeOf(left);
  // Any other class instance: no safe way to compare its internals, identity only (already failed).
  if (proto !== Object.prototype && proto !== null) return false;
  return equalRecords(left, right, fnByPresence, visited);
}

/** Own-key equality where each value is compared with {@link deepEqual}. */
export function equalRecords(
  left: object,
  right: object,
  fnByPresence = false,
  seen?: Seen
): boolean {
  if (left === right) return true;

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  if (leftKeys.length !== Object.keys(rightRecord).length) return false;

  for (const key of leftKeys) {
    if (!hasOwn(rightRecord, key)) return false;
    const a = leftRecord[key];
    const b = rightRecord[key];
    if (Object.is(a, b)) continue;
    if (!deepEqual(a, b, fnByPresence, seen)) return false;
  }

  return true;
}
