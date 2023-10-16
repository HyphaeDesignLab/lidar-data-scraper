from shapely.geometry import Polygon, MultiPolygon, mapping
from geopandas import GeoSeries, GeoDataFrame

# https://shapely.readthedocs.io/en/stable/reference/shapely.intersection.html
def is_intersects_shapely(multipolygon_coordinates, polygon_coorinates):
    polygon = Polygon(polygon_coorinates[0])
    #print(polygon)

    is_intersects = False
    for polygon_i_coordinates in multipolygon_coordinates:
        polygon_i = Polygon(polygon_i_coordinates[0])
        is_intersects = is_intersects or polygon_i.intersects(polygon)

    print (is_intersects)

# https://geopandas.org/en/stable/docs/reference/api/geopandas.GeoDataFrame.html
def is_intersects_geopandas(multipolygon_coordinates, polygon_coorinates):

    polygon = GeoSeries([
        Polygon(polygon_coorinates[0])
    ])

    is_intersects = False
    for polygon_i_coordinates in multipolygon_coordinates:
        polygon_i = Polygon(polygon_i_coordinates[0])
        intersection_result = polygon.intersection( polygon_i )
        intersection_i = GeoDataFrame(intersection_result, columns=['geometry'])
        # print ( intersection_i.is_empty.values[0] )
        # print ( intersection_i.values[0] )
        is_intersects = is_intersects or not intersection_i.is_empty.values[0]

    print(is_intersects)

def union_shapely(multipolygon_coordinates, polygon_coorinates):

    polygon = Polygon(polygon_coorinates)
    print(multipolygon_coordinates)
    multipolygon = MultiPolygon(multipolygon_coordinates)

    #print(polygon)
    print(polygon, multipolygon)

def test_union_shapely():
    multipolygon = MultiPolygon(
    [
      [
        [[-122.4, 37.9],
         [-122.3, 37.9],
         [-122.3, 37.7],
         [-122.4, 37.7],
         [-122.4, 37.9]],
        [[
             [-122.45, 37.85],
             [-122.42, 37.85],
             [-122.42, 37.83],
             [-122.45, 37.83],
             [-122.45, 37.85],
        ]]
      ]
    ])


    polygon1 = Polygon(
        [
            [-122.4, 37.9],
            [-122.4, 37.7],
            [-122.3, 37.7],
            [-122.3, 37.9],
            [-122.4, 37.9]
         ]
    )
    polygon2 = Polygon(
        [
            [-122.44, 37.95],
            [-122.44, 37.85],
            [-122.38, 37.85],
            [-122.38, 37.95],
            [-122.44, 37.95]
         ]
    )
    polygon3 = Polygon(
            [
                [-122.6, 37.6],
                [-122.6, 37.5],
                [-122.5, 37.5],
                [-122.5, 37.6],
                [-122.6, 37.6]
             ],
             holes=[]
        )

    union_overlapped = polygon1.union(polygon2)
    union_disjointed = polygon1.union(polygon2)
    union_disjointed = union_disjointed.union(polygon3)

    polygons_separate_file = open('union-test-polygons.json', 'w')
    polygons_separate = { "type": "FeatureCollection", "features": [
        {'properties': {'type':'red'}, 'geometry': mapping(polygon1)},
        {'properties': {'type':'blue'}, 'geometry': mapping(polygon2)},
        {'properties': {'type':'green'}, 'geometry': mapping(polygon3)}
    ]}
    polygons_separate_file.write(json.dumps(polygons_separate))

    union_result_file = open('union-test-result.json', 'w')
    union_result = { "type": "FeatureCollection", "features": [
        {'properties':{'type':'red'}, 'geometry':mapping(union_overlapped)},
        {'properties':{'type':'blue'}, 'geometry':mapping(union_disjointed)}
    ]}
    union_result_file.write(json.dumps(union_result))


import json
intersection_file = open('test-intersections.json')
intersection_obj = json.load(intersection_file)
multipolygon_coordinates = intersection_obj.get('features')[1].get('geometry').get('coordinates')
test_polygon_coordinates = intersection_obj.get('features')[0].get('geometry').get('coordinates')

#print(multipolygon_coordinates)
#print(test_polygon_coordinates)

# is_intersects_shapely(multipolygon_coordinates, test_polygon_coordinates)
# is_intersects_geopandas(multipolygon_coordinates, test_polygon_coordinates)
# union_shapely(multipolygon_coordinates, test_polygon_coordinates)

test_union_shapely()

