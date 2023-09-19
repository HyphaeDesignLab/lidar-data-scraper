require('tokml');

// kml is a string of KML data, geojsonObject is a JavaScript object of
// GeoJSON data
var kml = tokml(geojsonObject);

// grab name and description properties from each object and write them in
// KML
var kmlNameDescription = tokml(geojsonObject, {
    name: 'name',
    description: 'description'
});

// name and describe the KML document as a whole
var kmlDocumentName = tokml(geojsonObject, {
    documentName: 'My List Of Markers',
    documentDescription: "One of the many places you are not I am"
});