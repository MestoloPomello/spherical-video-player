export default class SpatialAudioManager {

	constructor(audioCtx, videoElement) {
		this.audioCtx = audioCtx;
		this.videoElement = videoElement;

		this.sources = [];
		this.masterGain = audioCtx.createGain();
		this.masterGain.connect(audioCtx.destination);

		this.pause = true;

		this.setupAudioListener();

		console.log("[SAM] SpatialAudioManager initialized");
	}

	setupAudioListener() {
		const listener = this.audioCtx.listener;

		// Set listener position at origin
		if (listener.positionX) {
			// Compatibility - New Web Audio API
			listener.positionX.value = 0;
			listener.positionY.value = 0;
			listener.positionZ.value = 0;
			listener.forwardX.value = 0;
			listener.forwardY.value = 0;
			listener.forwardZ.value = -1;
			listener.upX.value = 0;
			listener.upY.value = 1;
			listener.upZ.value = 0;
		} else if (listener.setPosition) {
			// Compatibility - Legacy API
			listener.setPosition(0, 0, 0);
			listener.setOrientation(0, 0, -1, 0, 1, 0);
		}
	}

	async addSpatialSource(
		/** @type {string} */ audioFilePath,
		/** @type {SourceOptions} */ options
	) {
		const { positions, volumes, timing } = options;
		try {
			const audioElement = document.createElement("audio");
			audioElement.loop = false;
			audioElement.src = audioFilePath;
			audioElement.preload = "auto";

			const audioSource = this.audioCtx.createMediaElementSource(audioElement);

			// Panner
			const pannerNode = this.audioCtx.createPanner();
			pannerNode.panningModel = "HRTF";
			pannerNode.coneInnerAngle = 360;
			pannerNode.coneOuterAngle = 360;

			// Gain
			const gainNode = this.audioCtx.createGain();
			gainNode.gain.value = 0;

			// Chain
			audioSource.connect(pannerNode);
			pannerNode.connect(gainNode);
			gainNode.connect(this.masterGain);

			// No timing = whole video
			const effectiveTiming = timing ?? {
				starting: 0,
				ending: this.videoElement.duration || Number.MAX_SAFE_INTEGER
			};

			const sourceObj = {
				audioElement,
				audioSource,
				pannerNode,
				gainNode,
				positions,
				volumes,
				timing: effectiveTiming,
				id: this.sources.length,
				name: audioFilePath.split("/").pop()
			};
			this.sources.push(sourceObj);

			const isStatic =
				positions.starting.x === positions.ending.x &&
				positions.starting.y === positions.ending.y &&
				positions.starting.z === positions.ending.z &&
				volumes.starting === volumes.ending;

			const update = () => {
				const { currentTime } = this.videoElement;
				if (this.isSourceInTimeRange(sourceObj.id)) {

					if (!this.pause && audioElement.paused) {
						audioElement.currentTime = Math.max(0, currentTime - effectiveTiming.starting);
						audioElement.play().catch(() => {});
					}

					let pos, vol;

					if (isStatic) {
						pos = positions.starting;
						vol = volumes.starting;
					} else {
						const progress =
							(currentTime - effectiveTiming.starting) /
							(effectiveTiming.ending - effectiveTiming.starting);

						pos = {
							x: positions.starting.x + (positions.ending.x - positions.starting.x) * progress,
							y: positions.starting.y + (positions.ending.y - positions.starting.y) * progress,
							z: positions.starting.z + (positions.ending.z - positions.starting.z) * progress
						};

						vol =
							volumes.starting +
							(volumes.ending - volumes.starting) * progress;
					}

					if (pannerNode.positionX) {
						pannerNode.positionX.value = pos.x;
						pannerNode.positionY.value = pos.y;
						pannerNode.positionZ.value = pos.z;
					} else {
						pannerNode.setPosition(pos.x, pos.y, pos.z);
					}

					gainNode.gain.value = vol;
				} else {
					if (!audioElement.paused) {
						audioElement.pause();
					}
				}

				requestAnimationFrame(update);
			};
			requestAnimationFrame(update);

			console.log(`[SAM] Added ${isStatic ? "static" : "moving"} spatial source: ${sourceObj.name}`);
			return sourceObj;

		} catch (error) {
			console.error(`[SAM] Error adding spatial source ${audioFilePath}:`, error);
			return null;
		}
	}

	updateListenerOrientation(yaw, pitch, roll) {
		const listener = this.audioCtx.listener;

		// Calculate forward and up vectors from Euler angles
		const forward = [
			Math.sin(yaw) * Math.cos(pitch),
			Math.sin(pitch),
			-Math.cos(yaw) * Math.cos(pitch)
		];

		const up = [
			Math.sin(yaw) * Math.cos(pitch + Math.PI/2),
			Math.sin(pitch + Math.PI/2),
			-Math.cos(yaw) * Math.cos(pitch + Math.PI/2)
		];

		if (listener.forwardX) {
			// Compatibility - New Web Audio API
			listener.forwardX.value = forward[0];
			listener.forwardY.value = forward[1];
			listener.forwardZ.value = forward[2];
			listener.upX.value = up[0];
			listener.upY.value = up[1];
			listener.upZ.value = up[2];
		} else if (listener.setOrientation) {
			// Compatibility - Legacy API
			listener.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
		}
	}

	// Move a source to a new position
	setSourcePosition(sourceId, position) {
		if (this.sources[sourceId] && this.sources[sourceId].pannerNode) {
			const panner = this.sources[sourceId].pannerNode;

			if (panner.positionX) {
				panner.positionX.value = position.x;
				panner.positionY.value = position.y;
				panner.positionZ.value = position.z;
			} else if (panner.setPosition) {
				panner.setPosition(position.x, position.y, position.z);
			}

			this.sources[sourceId].position = position;
		}
	}

	// Helper function to convert polar coordinates to cartesian
	polarToCartesian(distance, azimuth, elevation = 0) {
		return {
			x: distance * Math.cos(elevation) * Math.sin(azimuth),
			y: distance * Math.sin(elevation),
			z: -distance * Math.cos(elevation) * Math.cos(azimuth)
		};
	}

	isSourceInTimeRange(id) {
		const { currentTime } = this.videoElement;
		if (
			currentTime >= this.sources[id].timing.starting &&
			currentTime <= this.sources[id].timing.ending
		) {
			return true;
		} else {
			return false;
		}
	}

	playAll() {
		console.log("[SAM] Playing all sources");
		this.sources.forEach(source => {
			source.audioElement.currentTime = this.videoElement.currentTime;
			if (this.isSourceInTimeRange(source.id)) {
				source.audioElement.play().catch(e => console.error("[SAM] Error playing source:", e));
			}
		});
	}

	pauseAll() {
		this.sources.forEach(source => {
			source.audioElement.pause();
		});
	}

	stopAll() {
		this.sources.forEach(source => {
			source.audioElement.pause();
			source.audioElement.currentTime = 0;
		});
	}

	seekAll(time) {
		this.sources.forEach(source => {
			source.audioElement.currentTime = time;
		});
	}

	checkSynchronization() {
		this.sources.forEach((source, index) => {
			const timeDiff = Math.abs(this.videoElement.currentTime - source.audioElement.currentTime);
			if (timeDiff > 0.15) {
				source.audioElement.currentTime = this.videoElement.currentTime;
			}
		});
	}

	setSourceVolume(sourceId, volume) {
		if (this.sources[sourceId]) {
			this.sources[sourceId].gainNode.gain.value = volume;
		}
	}

	setMasterVolume(volume) {
		this.masterGain.gain.value = volume;
	}

	getSourcesInfo() {
		return this.sources.map(source => ({
			id: source.id,
			name: source.name,
			position: source.position,
			currentTime: source.audioElement.currentTime,
			volume: source.gainNode.gain.value
		}));
	}
}
