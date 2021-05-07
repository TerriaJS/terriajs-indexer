import { Cartesian3, Matrix4 } from "cesium";

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
  const [_magic, _version, length] = readHeader(glb, 0, 12);
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

export function forEachVertexInMesh(
  mesh: any,
  gltf: Gltf,
  iterFn: (vertex: Buffer) => void
) {
  const primitives = mesh.primitives;
  const accessors = gltf.json.accessors;
  const bufferViews = gltf.json.bufferViews;
  if (
    !Array.isArray(primitives) ||
    !Array.isArray(accessors) ||
    !Array.isArray(bufferViews)
  ) {
    return;
  }

  primitives.forEach((primitive) => {
    const accessor = accessors[primitive.attributes.POSITION];
    const bufferView = bufferViews[accessor.bufferView];
    const buffer = gltf.buffers[bufferView.buffer];
    const view = buffer.slice(
      bufferView.byteOffset,
      bufferView.byteOffset + bufferView.byteLength
    );
    const byteStride = bufferView.byteStride ?? 3 * sizeOfUint32;
    for (let i = 0; i < accessor.count; i++) {
      const pos = accessor.byteOffset + i * byteStride;
      const vertex = view.slice(pos, pos + 12);
      iterFn(vertex);
    }
  });
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
