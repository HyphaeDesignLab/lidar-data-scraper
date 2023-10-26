from shapely.geometry import Polygon, MultiPolygon, mapping
import sys


def test_polygon_union(polygons):
    polygon1 = Polygon(
        [
            [-122.6, 37.6],
            [-122.6, 37.5],
            [-122.5, 37.5],
            [-122.5, 37.6],
            [-122.6, 37.6]
         ],
         holes=[]
    )
    polygon2 = Polygon(
        [
            [-122.44, 37.95],
            [-122.44, 37.85],
            [-122.38, 37.85],
            [-122.38, 37.95],
            [-122.44, 37.95]
         ],
         holes=[]
    )

    union = polygon1.union(polygon2)
    union_geojson_obj = { "type": "FeatureCollection", "features": [
        {'properties': {'type':'poly'}, 'geometry': mapping(polygon1)},
        {'properties': {'type':'poly'}, 'geometry': mapping(polygon2)},
        {'properties': {'type':'union'}, 'geometry': mapping(union)}
    ]}

if __name__ == '__main__':
    test_polygon_union()
