import assert from 'node:assert/strict';
import Point from '@arcgis/core/geometry/Point.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import * as webMercatorUtils from '@arcgis/core/geometry/support/webMercatorUtils.js';
import proj4 from 'proj4';

const NORD_SAHARA_TOWGS84 = {
  dx: -267.407,
  dy: -47.068,
  dz: 446.357,
  rx: -0.179423,
  ry: 5.577661,
  rz: -1.277620,
  ds: 1.204866,
};

const buildUtmProj = (zone) =>
  `+proj=utm +zone=${zone} +a=6378249.145 +b=6356514.869 +units=m ` +
  `+k=0.9996 +x_0=500000 +y_0=0 ` +
  `+towgs84=${NORD_SAHARA_TOWGS84.dx},${NORD_SAHARA_TOWGS84.dy},${NORD_SAHARA_TOWGS84.dz},` +
  `${NORD_SAHARA_TOWGS84.rx},${NORD_SAHARA_TOWGS84.ry},${NORD_SAHARA_TOWGS84.rz},${NORD_SAHARA_TOWGS84.ds} ` +
  '+no_defs';

const distanceMeters = ([lon1, lat1], [lon2, lat2]) => {
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6378137 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const samples = [
  { zone: 29, coordinate: [-7.2, 29.5] },
  { zone: 30, coordinate: [-3.1, 32.2] },
  { zone: 31, coordinate: [2.8, 34.3] },
  { zone: 32, coordinate: [8.4, 27.7] },
];

let maxWebMercatorError = 0;
let maxUtmRoundTripError = 0;

for (const { zone, coordinate } of samples) {
  const geographicPoint = new Point({
    longitude: coordinate[0],
    latitude: coordinate[1],
    spatialReference: { wkid: 4326 },
  });
  const webMercatorPoint = webMercatorUtils.geographicToWebMercator(geographicPoint);
  const restoredPoint = webMercatorUtils.webMercatorToGeographic(webMercatorPoint);
  const restoredCoordinate = [restoredPoint.longitude, restoredPoint.latitude];
  const webMercatorError = distanceMeters(coordinate, restoredCoordinate);
  maxWebMercatorError = Math.max(maxWebMercatorError, webMercatorError);

  const utm = proj4('EPSG:4326', buildUtmProj(zone), coordinate);
  const restoredFromUtm = proj4(buildUtmProj(zone), 'EPSG:4326', utm);
  const utmError = distanceMeters(coordinate, restoredFromUtm);
  maxUtmRoundTripError = Math.max(maxUtmRoundTripError, utmError);

  assert.ok(webMercatorError < 0.001, `Web Mercator error too large in zone ${zone}: ${webMercatorError} m`);
  assert.ok(utmError < 0.01, `UTM round-trip error too large in zone ${zone}: ${utmError} m`);
}

const polygonCoordinates = samples.map(({ coordinate }) => coordinate);
const webMercatorRing = polygonCoordinates.map((coordinate) => {
  const point = webMercatorUtils.geographicToWebMercator(
    new Point({ longitude: coordinate[0], latitude: coordinate[1], spatialReference: { wkid: 4326 } }),
  );
  return [point.x, point.y];
});
const webMercatorPolygon = new Polygon({
  rings: [[...webMercatorRing, webMercatorRing[0]]],
  spatialReference: { wkid: 3857 },
});
const restoredPolygon = webMercatorUtils.webMercatorToGeographic(webMercatorPolygon);
const restoredRing = restoredPolygon.rings[0].slice(0, -1);
restoredRing.forEach((coordinate, index) => {
  const error = distanceMeters(polygonCoordinates[index], coordinate);
  assert.ok(error < 0.001, `Sketch polygon vertex ${index + 1} shifted by ${error} m`);
});

console.log(JSON.stringify({
  samples: samples.length,
  maxWebMercatorErrorMeters: maxWebMercatorError,
  maxUtmRoundTripErrorMeters: maxUtmRoundTripError,
  sketchPolygonVerticesVerified: restoredRing.length,
}, null, 2));
