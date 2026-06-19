export const rows = [
  { id: 1, name: "Mochi", breed: "Shiba Inu", age: 3, status: "active", amount: 120 },
  { id: 2, name: "Pepper", breed: "Border Collie", age: 5, status: "review", amount: 220 },
  { id: 3, name: "Nori", breed: "Akita", age: 2, status: "active", amount: 180 },
  { id: 4, name: "Bean", breed: "Corgi", age: 4, status: "inactive", amount: 90 },
  { id: 5, name: "Pip", breed: "Terrier", age: 1, status: "active", amount: 140 },
  { id: 6, name: "Kona", breed: "Husky", age: 6, status: "review", amount: 300 },
];

export const columns = [
  { key: "id", label: "ID", width: 72 },
  { key: "name", label: "Name", editable: true },
  { key: "breed", label: "Breed" },
  {
    key: "status",
    label: "Status",
    filterType: "select",
    filterOptions: ["active", "review", "inactive"],
  },
  { key: "age", label: "Age", type: "number" },
  { key: "amount", label: "Amount", type: "money" },
];
