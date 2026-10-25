import { grey } from '@mui/material/colors';
import createPalette from '@mui/material/styles/createPalette';
import { loadImage, prepareIcon } from './mapUtil';

import directionSvg from '../../resources/images/direction.svg';
import backgroundSvg from '../../resources/images/background.svg';
import animalSvg from '../../resources/images/icon/animal.svg';
import bicycleSvg from '../../resources/images/icon/bicycle.svg';
import boatSvg from '../../resources/images/icon/boat.svg';
import busSvg from '../../resources/images/icon/bus.svg';
import carSvg from '../../resources/images/icon/car.svg';
import craneSvg from '../../resources/images/icon/crane.svg';
import defaultSvg from '../../resources/images/icon/default.svg';
import helicopterSvg from '../../resources/images/icon/helicopter.svg';
import motorcycleSvg from '../../resources/images/icon/motorcycle.svg';
import offroadSvg from '../../resources/images/icon/offroad.svg';
import personSvg from '../../resources/images/icon/person.svg';
import pickupSvg from '../../resources/images/icon/pickup.svg';
import planeSvg from '../../resources/images/icon/plane.svg';
import scooterSvg from '../../resources/images/icon/scooter.svg';
import shipSvg from '../../resources/images/icon/ship.svg';
import tractorSvg from '../../resources/images/icon/tractor.svg';
import trainSvg from '../../resources/images/icon/train.svg';
import tramSvg from '../../resources/images/icon/tram.svg';
import trolleybusSvg from '../../resources/images/icon/trolleybus.svg';
import truckSvg from '../../resources/images/icon/truck.svg';
import vanSvg from '../../resources/images/icon/van.svg';

export const mapIcons = {
  animal: animalSvg,
  bicycle: bicycleSvg,
  boat: boatSvg,
  bus: busSvg,
  car: carSvg,
  crane: craneSvg,
  default: defaultSvg,
  helicopter: helicopterSvg,
  motorcycle: motorcycleSvg,
  offroad: offroadSvg,
  person: personSvg,
  pickup: pickupSvg,
  plane: planeSvg,
  scooter: scooterSvg,
  ship: shipSvg,
  tractor: tractorSvg,
  train: trainSvg,
  tram: tramSvg,
  trolleybus: trolleybusSvg,
  truck: truckSvg,
  van: vanSvg,
};

export const mapIconKey = (category) => (mapIcons.hasOwnProperty(category) ? category : 'default');

export const mapImages = {};

const mapPalette = createPalette({
  neutral: { main: grey[500] },
});

const createRouteArrowImage = () => {
  const size = 28;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.beginPath();
  ctx.moveTo(14, 4);
  ctx.lineTo(23, 21);
  ctx.lineTo(14, 16);
  ctx.lineTo(5, 21);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const createPushpinArrowImage = (bgColor = '#10b981') => {
  const size = 32;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Outer border / halo
  ctx.beginPath();
  ctx.arc(16, 16, 13, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  // Colored circle body
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, 2 * Math.PI);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // White directional arrow pointing UP (0° North)
  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(22, 21);
  ctx.lineTo(16, 17);
  ctx.lineTo(10, 21);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const createPushpinStopImage = () => {
  const size = 32;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Outer border
  ctx.beginPath();
  ctx.arc(16, 16, 13, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  // Red circle body
  ctx.beginPath();
  ctx.arc(16, 16, 11, 0, 2 * Math.PI);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // White stop square
  ctx.beginPath();
  ctx.rect(11, 11, 10, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#7f1d1d';
  ctx.stroke();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const createRouteBadgeImage = (type) => {
  const isStart = type === 'start';
  const size = 36;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Outer border
  ctx.beginPath();
  ctx.arc(18, 18, 15, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  // Colored circle body
  ctx.beginPath();
  ctx.arc(18, 18, 13, 0, 2 * Math.PI);
  ctx.fillStyle = isStart ? '#10b981' : '#ef4444';
  ctx.fill();

  // Text: A (Inicio) o B (Fin)
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(isStart ? 'A' : 'B', 18, 18.5);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

export default async () => {
  const background = await loadImage(backgroundSvg);
  mapImages.background = await prepareIcon(background);
  mapImages.direction = await prepareIcon(await loadImage(directionSvg));

  // OpenGTS and Route directional icons
  mapImages['route-arrow'] = createRouteArrowImage();
  mapImages['pushpin-arrow-green'] = createPushpinArrowImage('#10b981');
  mapImages['pushpin-arrow-yellow'] = createPushpinArrowImage('#f59e0b');
  mapImages['pushpin-arrow-blue'] = createPushpinArrowImage('#3b82f6');
  mapImages['pushpin-stop-red'] = createPushpinStopImage();
  mapImages['route-start'] = createRouteBadgeImage('start');
  mapImages['route-end'] = createRouteBadgeImage('end');

  await Promise.all(Object.keys(mapIcons).map(async (category) => {
    const results = [];
    ['info', 'success', 'error', 'neutral'].forEach((color) => {
      results.push(loadImage(mapIcons[category]).then((icon) => {
        mapImages[`${category}-${color}`] = prepareIcon(background, icon, mapPalette[color].main);
      }));
    });
    await Promise.all(results);
  }));
};
