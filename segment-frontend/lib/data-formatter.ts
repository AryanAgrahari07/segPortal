/**
 * Format cell values for display in the data table
 */
export function formatValueForDisplay(value: any, type: string): string {
  if (value === null || value === undefined) {
    return "null";
  }

  // Normalize the type to uppercase
  const normalizedType = type.toUpperCase();

  switch (normalizedType) {
    case "BOOLEAN":
      return String(value);
    case "DATE":
      try {
        // For DATE type, only show the date portion without time
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch (e) {
        return String(value);
      }
    case "TIMESTAMP":
    case "DATETIME":
      try {
        return new Date(value).toLocaleString();
      } catch (e) {
        return String(value);
      }
    case "DECIMAL":
    case "FLOAT":
    case "DOUBLE":
    case "NUMBER":
      return typeof value === "number" ? value.toFixed(2) : String(value);
    case "INTEGER":
    case "BIGINT":
      return typeof value === "number" ? value.toString() : String(value);
    default:
      return String(value);
  }
} 