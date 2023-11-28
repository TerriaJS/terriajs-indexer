import { Matrix4 } from "cesium";
type Tileset = {
    root?: Tile;
    asset?: {
        gltfUpAxis?: number;
    };
};
type Tile = {
    content?: {
        uri?: string;
        url?: string;
    };
    transform?: number[];
    children?: Tile[];
};
export declare function forEachTile(tileset: Tileset, iterFn: (value: {
    tile: Tile;
    computedTransform: Matrix4;
}) => Promise<void>): Promise<void>;
export declare function uri(tile: Tile): string | undefined;
export declare function toZUpTransform(tileset: Tileset): any;
export {};
