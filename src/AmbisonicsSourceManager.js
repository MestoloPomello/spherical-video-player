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
		
		console.log("[ASM] AmbisonicsSourceManager initialized");
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
			audioElement.preload = "auto";

			console.log("[ASM] Audio element created for:", audioFilePath);

			// FOA decoder for this single source - try without custom config first
			const foaRenderer = Omnitone.createFOARenderer(this.audioCtx);
			
			await foaRenderer.initialize();
			console.log("[ASM] FOA Renderer initialized");

			// Gain node creation for the source's volume control
			const gainNode = this.audioCtx.createGain();
			gainNode.gain.value = volume;

			// Connection: audio -> renderer -> gain -> master
			const audioSource = this.audioCtx.createMediaElementSource(audioElement);
			audioSource.connect(foaRenderer.input);
			foaRenderer.output.connect(gainNode);
			gainNode.connect(this.masterGain);

			console.log("[ASM] Audio graph connected");

			// Video synchronization events
			this.videoElement.addEventListener("play", () => {
				console.log("[ASM] Video playing, syncing audio");
				audioElement.currentTime = this.videoElement.currentTime;
				audioElement.play().catch(e => console.error("[ASM] Error playing audio:", e));
			});

			this.videoElement.addEventListener("pause", () => {
				console.log("[ASM] Video paused, pausing audio");
				audioElement.pause();
			});

			this.videoElement.addEventListener("seeked", () => {
				console.log("[ASM] Video seeked, syncing audio to:", this.videoElement.currentTime);
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

	updateGlobalOrientation(yaw, pitch, roll) {
		// Store current orientation
		this.currentOrientation = { yaw, pitch, roll };
		
		console.log(`[ASM] Updating orientation - Yaw: ${yaw.toFixed(3)}, Pitch: ${pitch.toFixed(3)}, Roll: ${roll.toFixed(3)}`);

		// Update each FOA renderer with the new orientation
		this.sources.forEach((source, index) => {
			if (source.foaRenderer && source.foaRenderer.setRotationMatrix4) {
				try {
					// Apply rotation offset if any
					const finalYaw = yaw + source.rotationOffset.yaw;
					const finalPitch = pitch + source.rotationOffset.pitch;
					const finalRoll = roll + source.rotationOffset.roll;
					
					// Create rotation matrix from Euler angles (Omnitone expects radians)
					const rotMatrix = this.createRotationMatrix4(finalYaw, finalPitch, finalRoll);
					source.foaRenderer.setRotationMatrix4(rotMatrix);
					
				} catch (error) {
					console.error(`[ASM] Error updating orientation for source ${index}:`, error);
				}
			}
		});
	}

	// Create 4x4 rotation matrix from Euler angles (in radians)
	createRotationMatrix4(yaw, pitch, roll) {
		// Calculate trigonometric values
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);
		const cp = Math.cos(pitch);
		const sp = Math.sin(pitch);
		const cr = Math.cos(roll);
		const sr = Math.sin(roll);

		// Create 4x4 rotation matrix (column-major order for WebGL)
		return [
			cy * cp,                    sy * cp,                    -sp,        0,
			cy * sp * sr - sy * cr,     sy * sp * sr + cy * cr,     cp * sr,    0,
			cy * sp * cr + sy * sr,     sy * sp * cr - cy * sr,     cp * cr,    0,
			0,                          0,                          0,          1
		];
	}

	// Create 3x3 rotation matrix from Euler angles (in degrees) - fallback
	createRotationMatrix3(yaw, pitch, roll) {
		const yawRad = yaw * Math.PI / 180;
		const pitchRad = pitch * Math.PI / 180;
		const rollRad = roll * Math.PI / 180;

		const cy = Math.cos(yawRad);
		const sy = Math.sin(yawRad);
		const cp = Math.cos(pitchRad);
		const sp = Math.sin(pitchRad);
		const cr = Math.cos(rollRad);
		const sr = Math.sin(rollRad);

		return [
			cy * cp,                    sy * cp,                    -sp,
			cy * sp * sr - sy * cr,     sy * sp * sr + cy * cr,     cp * sr,
			cy * sp * cr + sy * sr,     sy * sp * cr - cy * sr,     cp * cr
		];
	}

	playAll() {
		console.log("[ASM] Playing all sources");
		this.sources.forEach(source => {
			source.audioElement.currentTime = this.videoElement.currentTime;
			source.audioElement.play().catch(e => console.error("[ASM] Error playing source:", e));
		});
	}

	pauseAll() {
		console.log("[ASM] Pausing all sources");
		this.sources.forEach(source => {
			source.audioElement.pause();
		});
	}

	stopAll() {
		console.log("[ASM] Stopping all sources");
		this.sources.forEach(source => {
			source.audioElement.pause();
			source.audioElement.currentTime = 0;
		});
	}

	seekAll(time) {
		console.log("[ASM] Seeking all sources to:", time);
		this.sources.forEach(source => {
			source.audioElement.currentTime = time;
		});
	}

	checkSynchronization() {
		this.sources.forEach((source, index) => {
			const timeDiff = Math.abs(this.videoElement.currentTime - source.audioElement.currentTime);
			if (timeDiff > 0.15) {
				console.log(`[ASM] Resyncing source ${index}, diff: ${timeDiff.toFixed(3)}s`);
				source.audioElement.currentTime = this.videoElement.currentTime;
			}
		});
	}

	setSourceVolume(sourceId, volume) {
		if (this.sources[sourceId]) {
			this.sources[sourceId].gainNode.gain.value = volume;
			console.log(`[ASM] Set source ${sourceId} volume to ${volume}`);
		}
	}

	setMasterVolume(volume) {
		this.masterGain.gain.value = volume;
		console.log(`[ASM] Set master volume to ${volume}`);
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
