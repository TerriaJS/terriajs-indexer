*Notice: Experimental tool. Expect the API to break as we make changes*

# terriajs-indexer

This is a tool for generating static index for searching datasets from TerriaJS. We currently support generating index for Cesium 3D tiles.

# Installation

```
yarn install
```

# 3d Tiles

## Generating index for Cesium 3d Tiles

```
ts-node --skip-ignore src/3dTiles/index.ts </path/to/tileset.json> </path/to/config.json> </path/to/output/directory>
```

Script parameters:
  1) Path to `tileset.json` file.
  2) An index configuration file (See [sample configuration](samples/3dtiles-config.json)).
  3) An output directory to write the index

This generates an index in the given output directory. Check the `indexRoot.json` to see how the index is structured.

## Dumping 3d tiles properites as CSV

You can also dump all the tileset properties as a CSV file. This might be useful for debugging.

```
$ ts-node --skip-ignore src/3dTiles/dumpCsv.ts </path/to/tileset.json> </path/to/output.csv>
```

Script parameters:
  1) Path to `tileset.json`
  2) Output csv file
