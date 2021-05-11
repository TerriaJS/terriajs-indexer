import { Matrix4 } from "cesium";
declare type Tileset = {
    root?: Tile;
    asset?: {
        gltfUpAxis?: number;
    };
};
declare type Tile = {
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
}) => void): void;
export declare function uri(tile: Tile): string | undefined;
export declare function toZUpTransform(tileset: Tileset): any;
export {};
