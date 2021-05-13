// Various utility functions for working with GLTFs
// See: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md

import { Cartesian3, Cartographic, Matrix4, Rectangle } from "cesium";

const sizeOfUint32 = 4;
const jsonChunkType = 0x4e4f534a;
const binaryChunkType = 0x004e4942;

export type Gltf = { json: any; buffers: Buffer[] };

// Add more types here as required from https://github.com/CesiumGS/cesium/blob/master/Source/Core/ComponentDatatype.js#L12
enum ComponentType {
  UNSIGNED_BYTE = 5121,
  SHORT = 5123,
  FLOAT = 5126,
}

export function isValidComponentType(value: number): value is ComponentType {
  return value in ComponentType;
}

export function asComponentType(value: number) {
  if (isValidComponentType(value)) return value;
  throw new Error(`Unhandled component type: ${value}`);
}

export function parseGlb(glb: Buffer): Gltf | undefined {
  if (glb.slice(0, 4).toString() !== "glTF") {
    return;
  }
  const version = glb.readUInt32LE(4);
  if (version === 2) {
    return parseGlbVersion2(glb);
  }
  throw new Error(`Unhandled gltf version: ${version}`);
}

function parseGlbVersion2(glb: Buffer): Gltf {
  const length = readHeader(glb, 0, 12)[2];
  let byteOffset = 12;
  let json: any;
  let binaryBuffer: Buffer = Buffer.from([]);
  while (byteOffset < length) {
    const [chunkLength, chunkType] = readHeader(glb, byteOffset, 2);
    byteOffset += 8;
    const chunkBuffer = glb.subarray(byteOffset, byteOffset + chunkLength);
    byteOffset += chunkLength;
    if (chunkType === jsonChunkType) {
      json = JSON.parse(chunkBuffer.toString("utf-8"));
    } else if (chunkType === binaryChunkType) {
      binaryBuffer = chunkBuffer;
    }
  }
  return { json, buffers: [binaryBuffer] };
}

function readHeader(glb: Buffer, byteOffset: number, count: number): number[] {
  const header = [];
  for (let i = 0; i < count; i++) {
    header.push(glb.readUInt32LE(byteOffset + i * sizeOfUint32));
  }
  return header;
}

/**
 * Get the nth value in the buffer described by an accessor with accessorId
 */
export function getBufferForValueAt(gltf: Gltf, accessorId: number, n: number) {
  const accessor = gltf.json.accessors[accessorId];
  const bufferView = gltf.json.bufferViews[accessor.bufferView];
  const bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId].slice(
    bufferView.byteOffset,
    bufferView.byteOffset + bufferView.byteLength
  );
  const valueSize =
    sizeOfComponentType(accessor.componentType) *
    numberOfComponentsForType(accessor.type);

  // if no byteStride specified, the buffer is tightly packed
  const byteStride = bufferView.byteStride ?? valueSize;
  const pos = accessor.byteOffset + n * byteStride;
  const valueBuffer = buffer.slice(pos, pos + valueSize);
  return valueBuffer;
}

export function readValueAt(
  gltf: Gltf,
  accessorId: number,
  n: number
): number[] {
  const buffer = getBufferForValueAt(gltf, accessorId, n);
  const accessor = gltf.json.accessors[accessorId];
  const numberOfComponents = numberOfComponentsForType(accessor.type);
  const valueComponents = [];
  const componentType = asComponentType(accessor.componentType);
  for (let i = 0; i < numberOfComponents; i++) {
    valueComponents[i] = readComponent(buffer, componentType, i);
  }
  return valueComponents;
}

function readComponent(
  valueBuffer: Buffer,
  componentType: ComponentType,
  n: number
): number {
  switch (componentType) {
    case ComponentType.UNSIGNED_BYTE:
      return valueBuffer.readUInt8(n * sizeOfComponentType(componentType));
    case ComponentType.SHORT:
      return valueBuffer.readUInt16LE(n * sizeOfComponentType(componentType));
    case ComponentType.FLOAT:
      return valueBuffer.readFloatLE(n * sizeOfComponentType(componentType));
  }
}

export function getCartesian3FromVertex(vertex: Buffer): Cartesian3 {
  const x = vertex.readFloatLE(0);
  const y = vertex.readFloatLE(4);
  const z = vertex.readFloatLE(8);
  const position = new Cartesian3(x, y, z);
  return position;
}

export function setVertexFromCartesian3(
  vertex: Buffer,
  position: Cartesian3
): void {
  vertex.writeFloatLE(position.x, 0);
  vertex.writeFloatLE(position.y, 4);
  vertex.writeFloatLE(position.z, 8);
}

export function sizeOfComponentType(componentType: ComponentType): number {
  switch (componentType as ComponentType) {
    case ComponentType.UNSIGNED_BYTE:
      return Uint8Array.BYTES_PER_ELEMENT;
    case ComponentType.SHORT:
      return Int16Array.BYTES_PER_ELEMENT;
    case ComponentType.FLOAT:
      return Float32Array.BYTES_PER_ELEMENT;
  }
}

export function numberOfComponentsForType(accessorType: string) {
  switch (accessorType) {
    case "VEC3":
      return 3;
    case "SCALAR":
      return 1;
    default:
      throw new Error(`Unhandled accessor type: ${accessorType}`);
  }
}

/**
 * Compute position for each feature from the vertex data
 *
 * @returns An array of Cartographic positions one for each feature. The array
 * can be indexed by the batchId for the feature.
 */
export function computeFeaturePositionsFromGltfVertices(
  gltf: Gltf,
  tileTransform: Matrix4,
  rtcTransform: Matrix4,
  toZUpTransform: Matrix4
): Cartographic[] | undefined {
  const nodes = gltf?.json.nodes;
  const meshes = gltf?.json.meshes;
  const accessors = gltf?.json.accessors;
  const bufferViews = gltf?.json.bufferViews;

  if (
    !Array.isArray(nodes) ||
    !Array.isArray(meshes) ||
    !Array.isArray(accessors) ||
    !Array.isArray(bufferViews)
  ) {
    return;
  }

  const batchIdPositions: Cartographic[][] = [];

  nodes.forEach((node) => {
    const mesh = meshes[node.mesh];
    const primitives = mesh.primitives;
    const nodeMatrix = Array.isArray(node.matrix)
      ? Matrix4.fromColumnMajorArray(node.matrix)
      : Matrix4.IDENTITY.clone();

    const modelMatrix = Matrix4.IDENTITY.clone();
    Matrix4.multiplyTransformation(modelMatrix, tileTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, rtcTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, toZUpTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, nodeMatrix, modelMatrix);

    primitives.forEach((primitive: any) => {
      const attributes = primitive.attributes;
      const _BATCHID = attributes._BATCHID;
      const POSITION = attributes.POSITION;
      if (POSITION === undefined) {
        return;
      }

      const count = accessors[POSITION].count;
      for (let i = 0; i < count; i++) {
        // If the gltf vertices are tagged with BATCHID, store the positions at
        // the respective BATCHID. Otherwise store everything under a single
        // BATCHID=0
        const [batchId] =
          _BATCHID !== undefined ? readValueAt(gltf, _BATCHID, i) : [0];
        const [x, y, z] = readValueAt(gltf, POSITION, i);
        const localPosition = new Cartesian3(x, y, z);
        const worldPosition = Matrix4.multiplyByPoint(
          modelMatrix,
          localPosition,
          new Cartesian3()
        );
        const cartographic = Cartographic.fromCartesian(worldPosition);
        batchIdPositions[batchId] = batchIdPositions[batchId] ?? [];
        if (cartographic !== undefined) {
          batchIdPositions[batchId].push(cartographic);
        }
      }
    });
  });

  const featurePositions = batchIdPositions.map((positions) => {
    // From all the positions for the feature
    // 1. compute a center point
    // 2. compute the feature height
    const heights = positions.map((carto) => carto.height);
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);
    const featureHeight = maxHeight - minHeight;
    const rectangle = Rectangle.fromCartographicArray(positions);
    const position = Rectangle.center(rectangle);
    position.height = featureHeight;
    return position;
  });

  return featurePositions;
}
