export default class SpatialAudioManager {

	constructor(audioCtx, videoElement) {
		this.audioCtx = audioCtx;
		this.videoElement = videoElement;

		this.sources = [];
		this.masterGain = audioCtx.createGain();
		this.masterGain.connect(audioCtx.destination);

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
		audioFilePath,
		position = { x: 0, y: 0, z: 0 },
		volume = 1.0
	) {
		try {
			const audioElement = document.createElement("audio");
			audioElement.loop = true;
			audioElement.src = audioFilePath;
			audioElement.preload = "auto";

			console.log("[SAM] Audio element created for:", audioFilePath);

			const audioSource = this.audioCtx.createMediaElementSource(audioElement);
			
			// Create panner node for 3D positioning
			// Old version used Omnitone but htis seems to work better
			const pannerNode = this.audioCtx.createPanner();
			pannerNode.panningModel = "HRTF";
			pannerNode.coneInnerAngle = 360; // Full 360 degree sound
			pannerNode.coneOuterAngle = 360;

			if (pannerNode.positionX) {
				// New Web Audio API
				pannerNode.positionX.value = position.x;
				pannerNode.positionY.value = position.y;
				pannerNode.positionZ.value = position.z;
			} else if (pannerNode.setPosition) {
				// Legacy API
				pannerNode.setPosition(position.x, position.y, position.z);
			}

			// Gain node for volume control
			const gainNode = this.audioCtx.createGain();
			gainNode.gain.value = volume;

			// Audio chain: source -> panner -> gain -> master
			audioSource.connect(pannerNode);
			pannerNode.connect(gainNode);
			gainNode.connect(this.masterGain);

			// Video synchronization events
			this.videoElement.addEventListener("play", () => {
				audioElement.currentTime = this.videoElement.currentTime;
				audioElement.play().catch(e => console.error("[SAM] Error playing audio:", e));
			});

			this.videoElement.addEventListener("pause", () => {
				audioElement.pause();
			});

			this.videoElement.addEventListener("seeked", () => {
				audioElement.currentTime = this.videoElement.currentTime;
			});

			this.videoElement.addEventListener("timeupdate", () => {
				const timeDiff = Math.abs(this.videoElement.currentTime - audioElement.currentTime);
				if (timeDiff > 0.1) {
					audioElement.currentTime = this.videoElement.currentTime;
				}
			});

			const sourceObj = {
				audioElement,
				audioSource,
				pannerNode,
				gainNode,
				position,
				id: this.sources.length,
				name: audioFilePath.split("/").pop()
			};

			this.sources.push(sourceObj);
			console.log(`[SAM] Added spatial source: ${sourceObj.name} at position:`, position);
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

	playAll() {
		console.log("[SAM] Playing all sources");
		this.sources.forEach(source => {
			source.audioElement.currentTime = this.videoElement.currentTime;
			source.audioElement.play().catch(e => console.error("[SAM] Error playing source:", e));
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
