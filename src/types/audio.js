/**
 * @typedef SourceOptions
 * @property {Rotations} rotations 
 * @property {Volumes} volumes
 * @property {Timing} [timing]
 */

/**
 * @typedef Rotation
 * @property {number} yaw - Rotation around the vertical axis (in degrees)
 * @property {number} pitch - Rotation around the lateral axis (in degrees)
 * @property {number} roll - Rotation around the longitudinal axis (in degrees)
 */

/**
 * @typedef Rotations
 * @property {Rotation} starting
 * @property {Rotation} [ending]
 */

/**
 * @typedef Volumes
 * @property {number} starting
 * @property {number} [ending]
 */

/**
 * @typedef Timing
 * @property {number} starting
 * @property {number} [ending]
 */
