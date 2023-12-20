// Various utility functions for working with GLTFs
// See: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md

import { GltfUtilities } from "3d-tiles-tools";
import { Accessor, Document, Node, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { Cartesian3, Cartographic, Matrix4, Rectangle } from "cesium";
import draco3d from "draco3dgltf";

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

export async function parseGlb(glb: Buffer): Promise<Document> {
  const io = new NodeIO();
  io.registerExtensions(ALL_EXTENSIONS) // pass through extensions we do not handle explicitly
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
  // Replaces CESIUM_RTC by inserting new nodes that wrap existing nodes inside
  // a transform
  const modernGlb = await GltfUtilities.replaceCesiumRtcExtension(glb);
  const document = await io.readBinary(new Uint8Array(modernGlb));
  return document;
}

export async function parseGltf(gltfJson: any): Promise<Document> {
  const io = new NodeIO();
  io.registerExtensions(ALL_EXTENSIONS) // pass through extensions we do not handle explicitly
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });
  const document = await io.readJSON(gltfJson);
  return document;
}

export function readValueAt(accessor: Accessor, n: number): number[] {
  const elements = accessor.getElementSize();
  const start = n * elements;
  const valueComponents = Array.from(
    accessor.getArray()?.slice(start, start + elements) ?? []
  );
  return valueComponents;
}

/**
 * Compute position for each feature from the vertex data
 *
 * @returns An array of Cartographic positions one for each feature. The array
 * can be indexed by the batchId for the feature.
 */
export function computeFeaturePositionsFromGltfVertices(
  gltf: Document,
  tileTransform: Matrix4,
  toZUpTransform: Matrix4
): Cartographic[] | undefined {
  const root = gltf.getRoot();
  const nodes = root.listNodes();
  const batchIdPositions: Cartographic[][] = [];

  nodes.forEach((node) => {
    const mesh = node.getMesh();
    if (mesh === null) {
      return;
    }
    const nodeMatrix = getCompoundMatrix(node);
    const primitives = mesh.listPrimitives();

    // worldMatrix = tileTransform * toZUpTransform * nodeMatrix
    const worldMatrix = Matrix4.IDENTITY.clone();
    Matrix4.multiplyTransformation(worldMatrix, tileTransform, worldMatrix);
    Matrix4.multiplyTransformation(worldMatrix, toZUpTransform, worldMatrix);
    Matrix4.multiplyTransformation(worldMatrix, nodeMatrix, worldMatrix);

    primitives.forEach((primitive) => {
      const attributes = primitive.listAttributes();
      const accessors = Object.fromEntries(
        primitive
          .listSemantics()
          .map((semantic, i) => [semantic, attributes[i]])
      );

      if (accessors.POSITION === undefined) {
        return;
      }

      const count = accessors.POSITION.getCount();
      for (let i = 0; i < count; i++) {
        // If the gltf vertices are tagged with BATCHID, store the positions at
        // the respective BATCHID. Otherwise store everything under a single
        // BATCHID=0
        const [batchId] =
          accessors._BATCHID !== undefined
            ? readValueAt(accessors._BATCHID, i)
            : [0];
        const [x, y, z] = readValueAt(accessors.POSITION, i);
        const localPosition = new Cartesian3(x, y, z);
        const worldPosition = Matrix4.multiplyByPoint(
          worldMatrix,
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

/**
 * Get the compound matrix for the given node.
 * This is the cumulative product of the matrices of the current node and all its parents.
 */
function getCompoundMatrix(node: Node): Matrix4 {
  const parentNode = node.getParentNode();
  const matrix = parentNode
    ? getCompoundMatrix(parentNode)
    : Matrix4.IDENTITY.clone();
  Matrix4.multiply(matrix, Matrix4.fromArray(node.getMatrix()), matrix);
  return matrix;
}
