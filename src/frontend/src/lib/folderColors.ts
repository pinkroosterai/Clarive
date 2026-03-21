export const FOLDER_COLORS = [
  { key: 'red', label: 'Red', tw: 'bg-red-500' },
  { key: 'orange', label: 'Orange', tw: 'bg-orange-500' },
  { key: 'yellow', label: 'Yellow', tw: 'bg-yellow-500' },
  { key: 'green', label: 'Green', tw: 'bg-green-500' },
  { key: 'teal', label: 'Teal', tw: 'bg-teal-500' },
  { key: 'blue', label: 'Blue', tw: 'bg-blue-500' },
  { key: 'purple', label: 'Purple', tw: 'bg-purple-500' },
  { key: 'pink', label: 'Pink', tw: 'bg-pink-500' },
  { key: 'gray', label: 'Gray', tw: 'bg-gray-500' },
] as const;

export type FolderColorKey = (typeof FOLDER_COLORS)[number]['key'];

/** Get the Tailwind class for a folder color key. */
export function getFolderColorClass(color: string | null): string | undefined {
  if (!color) return undefined;
  return FOLDER_COLORS.find((c) => c.key === color)?.tw;
}
