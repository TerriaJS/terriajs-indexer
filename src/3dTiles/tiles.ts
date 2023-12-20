import { Axis, Matrix4 } from "cesium";

type Tileset = {
  root?: Tile;
  asset?: { gltfUpAxis?: number };
};

type Tile = {
  content?: { uri?: string; url?: string };
  transform?: number[];
  children?: Tile[];
};

export async function forEachTile(
  tileset: Tileset,
  iterFn: (value: { tile: Tile; computedTransform: Matrix4 }) => Promise<void>
): Promise<void> {
  const root = tileset.root;
  if (root === undefined) {
    return;
  }

  const iterTile = async (
    tile: Tile,
    parentTransform: Matrix4
  ): Promise<void> => {
    const computedTransform =
      tile.transform !== undefined
        ? Matrix4.multiply(
            parentTransform,
            Matrix4.unpack(tile.transform),
            new Matrix4()
          )
        : parentTransform;
    await iterFn({ tile, computedTransform });
    if (Array.isArray(tile.children)) {
      await Promise.all(
        tile.children.map((child) => iterTile(child, computedTransform))
      );
    }
  };

  return iterTile(root, Matrix4.IDENTITY.clone());
}

export function uri(tile: Tile) {
  // older formats use url
  return tile.content?.uri ?? tile.content?.url;
}

export function toZUpTransform(tileset: Tileset) {
  const upAxis = tileset.asset?.gltfUpAxis ?? Axis.Y;
  const transform =
    upAxis === Axis.Y
      ? (Axis as any).Y_UP_TO_Z_UP.clone()
      : upAxis === Axis.X
      ? (Axis as any).X_UP_TO_Z_UP.clone()
      : Matrix4.IDENTITY.clone();
  return transform;
}
