import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  ComponentDatatype,
  Matrix2,
  Matrix3,
  Matrix4,
} from "cesium";
import { assertNumber, assertObject, assertString } from "../Json";

type BinaryProperty = {
  byteOffset: number;
  componentType: number;
  type: BinaryPropertyType;
};

type BinaryPropertyType =
  | "SCALAR"
  | "VEC2"
  | "VEC3"
  | "VEC4"
  | "MAT2"
  | "MAT3"
  | "MAT4";

const ComponentsPerAttribute: Record<BinaryPropertyType, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

const ClassTypes = {
  SCALAR: undefined,
  VEC2: Cartesian2,
  VEC3: Cartesian3,
  VEC4: Cartesian4,
  MAT2: Matrix2,
  MAT3: Matrix3,
  MAT4: Matrix4,
};

const binaryPropertyTypes: string[] = Object.keys(ComponentsPerAttribute);

export function parseBinaryProperty(json: any): BinaryProperty {
  assertObject(json, "Object");
  assertNumber(json.byteOffset, "byteOffset");
  const type = parseBinaryPropertyType(json.type);
  const componentType = parseComponentType(json.componentType);
  return {
    byteOffset: json.byteOffset,
    type,
    componentType,
  };
}

function parseBinaryPropertyType(json: any): BinaryPropertyType {
  assertString(json, "type");
  if (binaryPropertyTypes.includes(json)) return json as BinaryPropertyType;
  throw new Error(
    `Expected type to be ${binaryPropertyTypes.join("|")}, got ${json}`
  );
}

function parseComponentType(json: any): number {
  if (typeof json === "string")
    return (ComponentDatatype as any).fromName(json) as number;
  assertNumber(json, "componentType");
  return json;
}

export function readPropertyValuesFromBinaryBatchTable(
  binaryProperty: BinaryProperty,
  binaryBody: Uint8Array,
  length: number
) {
  const componentsPerAttribute = ComponentsPerAttribute[binaryProperty.type];
  const typedArray = (ComponentDatatype as any).createArrayBufferView(
    binaryProperty.componentType,
    binaryBody.buffer,
    binaryBody.byteOffset + binaryProperty.byteOffset,
    componentsPerAttribute * length
  );
  const classType = ClassTypes[binaryProperty.type];
  const values: any[] = [];
  for (let i = 0; i < length; i++) {
    if (classType === undefined) values.push(typedArray[i]);
    else values.push(classType.unpack(typedArray, i * componentsPerAttribute));
  }
  return values;
}
