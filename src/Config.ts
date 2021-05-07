import { assertObject, assertString, isJsonString } from "./Json";
import { IndexType, indexTypes } from "./Index";

export type IndexesConfig = {
  idProperty: string;
  positionProperties?: PositionProperties;
  indexes: Record<string, IndexConfig>;
};

export type IndexConfig = {
  type: IndexType;
};

export type PositionProperties = {
  latitude: string;
  longitude: string;
  height?: string;
};

export type FeaturePosition = {
  latitude: number; // in degrees
  longitude: number; // in degrees
  height: number; // feature height in metres
};

export function parseIndexesConfig(json: any): IndexesConfig {
  assertObject(json, "IndexesConfig");
  assertString(json.idProperty, "idProperty");

  let positionProperties: PositionProperties | undefined;
  try {
    positionProperties = parsePositionProperties(json.positionProperties);
  } catch (e) {
    // ignore
  }

  const indexes = parseIndexes(json.indexes);
  return {
    idProperty: json.idProperty,
    positionProperties,
    indexes,
  };
}

function parsePositionProperties(json: any): PositionProperties {
  assertObject(json, "IndexesConfig.positionProperties");
  assertString(json.latitude, "laitude");
  assertString(json.longitude, "longitude");
  return {
    latitude: json.latitude,
    longitude: json.longitude,
    height: isJsonString(json.height) ? json.height : undefined,
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
