import { IndexType, indexTypes } from "./Index";
import { assertObject, assertString } from "./Json";

export type IndexesConfig = {
  idProperty: string;
  indexes: Record<string, IndexConfig>;
};

export type IndexConfig = {
  type: IndexType;
};

export function parseIndexesConfig(json: any): IndexesConfig {
  assertObject(json, "IndexesConfig");
  assertString(json.idProperty, "idProperty");

  const indexes = parseIndexes(json.indexes);
  return {
    idProperty: json.idProperty,
    indexes,
  };
}

function parseIndexes(json: any): Record<string, IndexConfig> {
  assertObject(json, "IndexesConfig.indexes");
  return Object.entries(json).reduce((indexes, [property, indexConfigJson]) => {
    indexes[property] = parseIndexConfig(indexConfigJson);
    return indexes;
  }, {} as Record<string, IndexConfig>);
}

function parseIndexConfig(json: any): IndexConfig {
  assertObject(json, "IndexConfig");
  return {
    type: parseIndexType(json.type),
  };
}

function parseIndexType(json: any): IndexType {
  assertString(json, "IndexType");
  if (indexTypes.includes(json)) return json as IndexType;
  throw new Error(
    `Expected index type to be ${indexTypes.join("|")}, got ${json}`
  );
}
