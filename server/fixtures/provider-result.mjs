import { analysisSchema } from '../analysis.mjs';

// Synthetic provider mocks follow the actual strict transport schema.
export function providerResult(value) {
  return Object.fromEntries(Object.entries(analysisSchema.properties).map(([section, schema]) => [
    section, (value[section] ?? []).map(row => Object.fromEntries(Object.entries(schema.items.properties).map(([field, type]) => [
      field, row[field] ?? (Array.isArray(type.type) ? null : type.type === 'array' ? [] : ''),
    ]))),
  ]));
}
