export function normalizePlate(plate: string) {
  return plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function platesMatch(left?: string, right?: string) {
  if (!left || !right) {
    return false;
  }

  return normalizePlate(left) === normalizePlate(right);
}

export function imageHashSimilarity(left?: string, right?: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const minLength = Math.min(left.length, right.length);
  let matches = 0;
  for (let index = 0; index < minLength; index += 1) {
    if (left[index] === right[index]) {
      matches += 1;
    }
  }

  return matches / Math.max(left.length, right.length);
}
