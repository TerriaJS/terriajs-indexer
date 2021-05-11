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

export function forEachTile(
  tileset: Tileset,
  iterFn: (value: { tile: Tile; computedTransform: Matrix4 }) => void
) {
  const root = tileset.root;
  if (root === undefined) {
    return;
  }

  const iterTile = (tile: Tile, parentTransform: Matrix4) => {
    const computedTransform =
      tile.transform !== undefined
        ? Matrix4.multiply(
            parentTransform,
            Matrix4.unpack(tile.transform),
            new Matrix4()
          )
        : parentTransform;
    iterFn({ tile, computedTransform });
    if (Array.isArray(tile.children)) {
      tile.children.forEach((child) => iterTile(child, computedTransform));
    }
  };

  iterTile(root, Matrix4.IDENTITY.clone());
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
