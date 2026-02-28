const FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
const STREETS = ["Maple St", "Oak Ave", "Washington Blvd", "Lakeview Dr", "Parkway Ln"];
const CITIES = ["Springfield", "Riverside", "Georgetown", "Franklin", "Clinton"];

export function generateSynthetic(type: string): string {
  const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
  
  switch (type) {
    case 'credit_card':
      return `4111 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
    case 'ssn':
      return `9${Math.floor(10 + Math.random() * 89)}-${Math.floor(10 + Math.random() * 89)}-${Math.floor(1000 + Math.random() * 8999)}`;
    case 'phone':
      return `(555) ${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`;
    case 'email':
      return `${rand(FIRST_NAMES).toLowerCase()}.${rand(LAST_NAMES).toLowerCase()}@example.com`;
    case 'address':
      return `${Math.floor(100 + Math.random() * 8999)} ${rand(STREETS)}, ${rand(CITIES)}, ST ${Math.floor(10000 + Math.random() * 89999)}`;
    case 'name':
      return `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
    default:
      return "[REDACTED]";
  }
}
