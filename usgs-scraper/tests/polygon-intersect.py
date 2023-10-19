from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.ops import unary_union
from geopandas import GeoSeries, GeoDataFrame
import time

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

def test_1000s_polygon_unions_unary_and_simplify_topojs():
    if len(sys.argv) < 2:
        print('need a polygon JSON file as first arg')
        return

    file = open(sys.argv[1])
    obj = json.load(file)
    file.close()

    total_start_time = time.time()

    arr = []
    for feature in obj['features']:
        arr.append(Polygon(feature['geometry']['coordinates'][0]))

    union = unary_union(arr)

    # https://mattijn.github.io/topojson/api/topojson.core.topology.html
    # https://mattijn.github.io/topojson/example/output-types.html
    #import topojson as tp
    # simplify_with='simplification',
    # simplify_algorithm = dp:  Douglas-Peucker or vw : Visvalingam-Whyatt
    #  simplify_algorithm='vw',
    # prevent_oversimplify=True
    # presimplify=True
    #union_topo = tp.Topology(union, prequantize=1e4, topoquantize=True)
    #union_simple = union_topo.toposimplify(.03)
    #union_simple.to_geojson()

    file_out = open(sys.argv[1]+'.union.simple.json', 'w')

    file_out.write(json.dumps({'type': 'FeatureCollection', 'features': [{ 'geometry': mapping(union)}]}))
    file_out.close()

    print ( time.time() - total_start_time )

def test_1000s_polygon_unions():
    if len(sys.argv) < 2:
        print('need a polygon JSON file as first arg')
        return

    file = open(sys.argv[1])
    obj = json.load(file)
    file.close()

    total_start_time = time.time()

    union_batches = test_1000s_polygon_unions__helper(obj['features'], 100, True, True) # first batch size is 100
    while len(union_batches) > 1:
        union_batches = test_1000s_polygon_unions__helper(union_batches, 10, False, True) # next batch size is 10

    print ( time.time() - total_start_time )

    file_out = open(sys.argv[1]+'.union.json', 'w')
    file_out.write(json.dumps({'type': 'FeatureCollection', 'features': [{ 'geometry': mapping(union_batches[0]) }]}))
    file_out.close()


def test_1000s_polygon_unions__helper(polygons, batch_size, is_polygon_a_feature_object=False, use_unary=False):
    # print('batches of %s (length of array: %s)' % (batch_size, len(polygons)))
    union_batches = []
    union = None
    union_arr = []
    start_time = time.time()
    i = 0
    last_i = len(polygons) - 1
    for polygon in polygons:
        if i % batch_size == 0 and union or i == last_i:
            if use_unary:
                union = unary_union(union_arr)
                union_arr = []
            union_batches.append(union)
            union = None
            end_time = time.time()
            # print(i, end_time - start_time )
            start_time = end_time
        i = i + 1

        # the polygon can be a Shapley POLYGON object or a GeoJSON feature object
        polygon_safe = polygon if not is_polygon_a_feature_object else Polygon(polygon['geometry']['coordinates'][0])

        if use_unary:
            union_arr.append(polygon_safe)
        else:
            if union is None:
                union = polygon_safe
            else:
                #union = unary_union([union, polygon_safe])
                union = union.union(polygon_safe)

    end_time = time.time()
    # print(i, end_time - start_time )
    # print('result array length  %s ' % (len(union_batches)))
    return union_batches

import json
import sys

# Test 4
# intersection_file = open('test-intersections.json')
# intersection_obj = json.load(intersection_file)
# multipolygon_coordinates = intersection_obj.get('features')[1].get('geometry').get('coordinates')
# test_polygon_coordinates = intersection_obj.get('features')[0].get('geometry').get('coordinates')

#print(multipolygon_coordinates)
#print(test_polygon_coordinates)

# Test 2
# is_intersects_shapely(multipolygon_coordinates, test_polygon_coordinates)
# is_intersects_geopandas(multipolygon_coordinates, test_polygon_coordinates)
# union_shapely(multipolygon_coordinates, test_polygon_coordinates)

# Test 3
#test_union_shapely()

# Test 4: Test many polygon unions
# test_1000s_polygon_unions()
test_1000s_polygon_unions_unary_and_simplify_topojs()


