export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function platesMatch(a: string, b: string) {
  const left = normalizePlate(a);
  const right = normalizePlate(b);
  return Boolean(left && right && left === right);
}

export function imageHashSimilarity(a?: string, b?: string) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let same = 0;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] === b[index]) same += 1;
  }

  return Math.round((same / a.length) * 100);
}
