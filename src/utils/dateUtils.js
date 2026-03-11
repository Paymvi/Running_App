// Fix for YYYY-MM-DD timezone shift bug
export function parseLocalYMD(input) {
  if (!input) return null;

  if (input instanceof Date) return input;

  // Remove time if present
  const clean = String(input).split("T")[0];

  // Case 1: YYYY-MM-DD
  if (clean.includes("-")) {
    const [y, m, d] = clean.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  // Case 2: M/D/YYYY or MM/DD/YYYY
  if (clean.includes("/")) {
    const [m, d, y] = clean.split("/").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  return null;
}
