*Note: Experimental tool. Expect the API to break as we make changes*

# terriajs-indexer

A tool for generating search index for TerriaJS datasets. 

It can currently index Cesium 3D tiles.

# Installation

```
yarn install
```

# 3d Tiles

## Generating index for Cesium 3d Tiles

```
ts-node src/3dTiles/indexer.ts </path/to/tileset.json> </path/to/config.json> </path/to/output/directory>
```

Script parameters:
  1) Path to `tileset.json` file.
  2) An index configuration file (See [sample configuration](samples/3dtiles-config.json)).
  3) An output directory to write the index

This generates an index in the given output directory. Check the `indexRoot.json` to see how the index is structured.


### Indexer Configuration options

- `idProperty: string`
  - Required
  - Name of the property to be used as the ID for indexing

- `positionProperties: PositionProperties`
  - Optional
  - We need to index the position of each feature so that we can zoom close to
    it when the user selects it from the search results. `positionProperties`
    allow specifying the name of the properites to be used as the latitude,
    longitude or height of the feature. 
    
    - `latitude: string`
      - Required
      - Name of the property to be used as latitude of the feature
    - `longitude: string`
      - Required
      - Name of the property to be used as longitude of the feature
    - `height: string`
      - Optional
      - Name of the property to be used as height of the feature

    If not provided, we autocompute the latitude, longitude & height of the feature from its vertices

- `indexes: Record<string, IndexConfig>`
  - Required
  - An object with the property name as the key and an [index
    configuration](#index-configuration) as its value. Only the properties
    specified in this object will be indexed.

### Index configuration

The configuration for an individual properties index.

- `type: string`
  - Required
  - The type of the index.
  

