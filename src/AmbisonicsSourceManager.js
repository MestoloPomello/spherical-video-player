import Omnitone from "../node_modules/omnitone/build/omnitone.min.esm.js";

export default class AmbisonicsSourceManager {
	constructor(audioCtx, videoElement) {
		this.audioCtx = audioCtx;
		this.videoElement = videoElement;
		this.sources = [];
		this.masterGain = audioCtx.createGain();
		this.masterGain.connect(audioCtx.destination);

		// Global camera orientation listener
		this.currentOrientation = { yaw: 0, pitch: 0, roll: 0 };
	}

	async addAmbisonicsSource(
		audioFilePath,
		volume = 1.0,
		rotationOffset = { yaw: 0, pitch: 0, roll: 0 }
	) {
		try {
			const audioElement = document.createElement("audio");
			audioElement.crossOrigin = "anonymous";
			audioElement.loop = true;
			audioElement.src = audioFilePath;

			// FOA decoder for this single source
			const foaRenderer = Omnitone.createFOARenderer(this.audioCtx);
			await foaRenderer.initialize();

			// Gain node creation for the source's volume control
			const gainNode = this.audioCtx.createGain();
			gainNode.gain.value = volume;

			// Connection: audio -> renderer -> gain -> master
			const audioSource = this.audioCtx.createMediaElementSource(audioElement);
			audioSource.connect(foaRenderer.input);
			foaRenderer.output.connect(gainNode);
			gainNode.connect(this.masterGain);

			this.videoElement.addEventListener("play", () => {
				// Video sync on start
				audioElement.currentTime = this.videoElement.currentTime;
				audioElement.play();
			});

			this.videoElement.addEventListener("pause", () => {
				audioElement.pause();
			});

			this.videoElement.addEventListener("seeked", () => {
				audioElement.currentTime = this.videoElement.currentTime;
			});

			this.videoElement.addEventListener("timeupdate", () => {
				// Keep sync during the video execution
				const timeDiff = Math.abs(this.videoElement.currentTime - audioElement.currentTime);
				if (timeDiff > 0.1) {
					audioElement.currentTime = this.videoElement.currentTime;
				}
			});

			const sourceObj = {
				audioElement,
				foaRenderer,
				gainNode,
				audioSource,
				rotationOffset,
				id: this.sources.length,
				name: audioFilePath.split("/").pop()
			};

			this.sources.push(sourceObj);
			console.log(`[ASM] Added Ambisonics source: ${sourceObj.name} with rotation offset:`, rotationOffset);
			return sourceObj;

		} catch (error) {
			console.error(`[ASM] Error adding Ambisonics source ${audioFilePath}:`, error);
			return null;
		}
	}

	// TODO - docs for all functions
	createRotationMatrix(yaw, pitch, roll) {
		const cosY = Math.cos(yaw);
		const sinY = Math.sin(yaw);

		return {
			w: 1,		// W component doesn't rotate
			x: cosY,
			y: sinY,
			z: 1
		};
	}

	updateGlobalOrientation(yaw, pitch, roll) {
		this.currentOrientation = { yaw, pitch, roll };

		const listener = this.audioCtx.listener;

		if (listener.forwardX) {
			// Compatibility - New Web Audio API
			const forward = [
				Math.sin(yaw) * Math.cos(pitch),
				Math.sin(pitch),
				-Math.cos(yaw) * Math.cos(pitch)
			];
			const up = [0, 1, 0];

			listener.forwardX.value = forward[0];
			listener.forwardY.value = forward[1];
			listener.forwardZ.value = forward[2];
			listener.upX.value = up[0];
			listener.upY.value = up[1];
			listener.upZ.value = up[2];
		} else if (listener.setOrientation) {
			// Compatibility - Legacy API
			listener.setOrientation(
				Math.sin(yaw) * Math.cos(pitch),
				Math.sin(pitch),
				-Math.cos(yaw) * Math.cos(pitch),
				0, 1, 0
			);
		}
	}

	playAll() {
		this.sources.forEach(source => {
			source.audioElement.currentTime = this.videoElement.currentTime;
			source.audioElement.play();
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
		this.sources.forEach(source => {
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
		// For debug
		return this.sources.map(source => ({
			id: source.id,
			name: source.name,
			currentTime: source.audioElement.currentTime,
			volume: source.gainNode.gain.value,
			rotationOffset: source.rotationOffset
		}));
	}
}
