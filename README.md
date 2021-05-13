*Note: Experimental tool. Expect the API to break as we make changes*

# terriajs-indexer

A tool for generating search index for TerriaJS datasets. 

Formats supported:
 * Cesium 3D Tiles
 * KML-glTFs


# Installation

```bash
yarn install
yarn build
```

# 3d Tiles

## Generating index for Cesium 3d Tiles

```bash
./bin/index-3d-tiles </path/to/tileset.json> </path/to/config.json> </path/to/output/directory>
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

- `indexes: Record<string, IndexConfig>`
  - Required
  - An object with the property name as the key and an [index
    configuration](#index-configuration) as its value. Only the properties
    specified in this object will be indexed. 
    
    To index the automatically computed feature heights, use a configuration like:
    ```json
     "indexes": {"height": {"type": "numeric"}}
    ```

### Index configuration

The configuration for an individual properties index.

- `type: string`
  - Required
  - The type of the index.
  

# KML-glTF files

## Generating index for KML-glTF files

The KML files should be formatted as given below:
```xml
<Placemark>
  <name>Independence Hall</name>
  <Model>
    <Link><href>123.gltf</href></Link>
    <Location>
      <longitude>152.78600626966184</longitude>
      <latitude>-27.54602173027532</latitude>
      <altitude>78.79797821225782</altitude>
    </Location>
  </Model>
  <ExtendedData>                       
    <Data name="Address">
      <value>500-36 CHESTNUT ST</value>
    </Data>
    <Data name="Parcel_ID">
      <value>313762</value>
    </Data>
    <Data name="Is_City_Owned">
      <value>True</value>
    </Data>
  </ExtendedData> 
</Placemark>
```

```bash
./bin/index-kml-gltf </path/to/kml-gltfs> </path/to/config.json> </path/to/output/directory>
```

The index configuration format is similar to configuration in the 3d-tiles example.
