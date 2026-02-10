export const buildDemandeCode = (
  prefix: string,
  codeType: string,
  id: number | string,
) => {
  const safePrefix = String(prefix || 'DEM').toUpperCase();
  const safeType = String(codeType || 'UNK').toUpperCase();
  const idStr = String(id ?? '').trim();
  return `${safePrefix}-${safeType}-${idStr}`;
};
