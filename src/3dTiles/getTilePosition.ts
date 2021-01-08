import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
} from "cesium";

export type TilePosition = {
  latitude: number;
  longitude: number;
  radius: number;
};

export default function getTilePosition(
  tile: any,
  transform: Matrix4
): TilePosition {
  const tileBoundingVolume = tile.boundingVolume;
  if (Array.isArray(tileBoundingVolume?.box)) {
    const boundingSphere = createBox(tileBoundingVolume.box, transform);
    const carto: Cartographic = (Cartographic as any).fromCartesian(
      boundingSphere.center
    );
    return {
      latitude: CesiumMath.toDegrees(carto.latitude),
      longitude: CesiumMath.toDegrees(carto.longitude),
      radius: boundingSphere.radius,
    };
  }
  throw new Error("Not impelmented");
  // TODO: implement
  // if (tile.region)
  //   return createRegion(tile.region, transform, this._initialTransform, result);
  // if (tile.sphere) return createSphere(tile.sphere, transform);
}

function createBox(box: number[], transform: Matrix4): BoundingSphere {
  let center = Cartesian3.fromElements(box[0], box[1], box[2]);
  let halfAxes = Matrix3.fromArray(box, 3);

  // Find the transformed center and halfAxes
  center = Matrix4.multiplyByPoint(transform, center, center);
  // @ts-ignore
  const rotationScale = Matrix4.getMatrix3(transform, new Matrix3());
  halfAxes = Matrix3.multiply(rotationScale, halfAxes, halfAxes);

  // @ts-ignore
  const boundingSphere = BoundingSphere.fromOrientedBoundingBox({
    center,
    halfAxes,
  });

  return boundingSphere;
}
