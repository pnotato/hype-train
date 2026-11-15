// World constants for the 3D town. One world unit ≈ one jellybean's height.

/** Side length of the square floor, in world units. */
export const floorSize = 200;

/** Where the camera starts, looking at the origin. */
export const cameraStart: [number, number, number] = [0, 60, 80];

/** Zoom limits: distance from the camera to the point it orbits. */
export const minZoomDistance = 10;
export const maxZoomDistance = 180;

/** Steepest tilt from straight down; keeps the camera above the floor. */
export const maxPolarAngle = Math.PI / 2.3;

export const skyColour = "#cfe3f0";
export const floorColour = "#a8c69f";

/** WASD speed, as a fraction of the zoom distance per second. */
export const panSpeed = 0.8;
