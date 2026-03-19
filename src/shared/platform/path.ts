export function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? "";
}

export function getFileStem(filePath: string) {
  const fileName = getFileName(filePath);
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}
