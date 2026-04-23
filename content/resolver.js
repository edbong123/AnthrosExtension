function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return isNaN(key) ? acc[key] : acc[parseInt(key)];
  }, obj);
}

function extractFields(data, fields) {
  const result = {};
  for (const [fieldName, path] of Object.entries(fields)) {
    result[fieldName] = resolvePath(data, path) ?? null;
  }
  return result;
}
