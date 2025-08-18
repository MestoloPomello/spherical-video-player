import "aframe";
import initPlayerCommands from "./initPlayerCommands.js";
import SpatialAudioManager from "./SpatialAudioManager.js";

// TODO - creation of a drive folder with the video and audio sources to be downloaded
// in a single package

window.addEventListener("load", async () => {
	initPlayerCommands();

	let syncTimer;

	const videoElement = document.getElementById("video360");
	const cameraElement = document.getElementById("camera");

	// Initialize AudioContext
	const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	window.audioCtx = audioCtx;

	try {
		const spatialManager = new SpatialAudioManager(audioCtx, videoElement);
		window.spatialManager = spatialManager; // Nome compatibile con i controlli

		// Set initial volume for spatial audio
		spatialManager.setMasterVolume(0.5);

		// Add spatial sound sources with precise positioning
		await spatialManager.addSpatialSource(
			"./resources/audio/ducks.wav",
			{ x: -8, y: 0, z: 3 }, // 8 units left, 3 units back 
			0.9
		);

		// Example: add another source in a different position
		// await spatialManager.addSpatialSource(
		//     "./resources/audio/birds.wav",
		//     { x: -5, y: 2, z: 5 }, // left, slightly up, behind
		//     0.6
		// );

		// Update listener orientation based on camera rotation
		AFRAME.registerComponent("spatial-listener-sync", {
			tick: function () {
				const rotation = cameraElement.getAttribute("rotation");

				// Convert A-Frame rotation to radians
				const yaw = -rotation.y * Math.PI / 180;   // Horizontal rotation
				const pitch = -rotation.x * Math.PI / 180; // Vertical rotation  
				const roll = -rotation.z * Math.PI / 180;  // Roll rotation

				spatialManager.updateListenerOrientation(yaw, pitch, roll);
			}
		});

		cameraElement.setAttribute("spatial-listener-sync", "");

		videoElement.addEventListener("play", startSyncTimer);
		videoElement.addEventListener("pause", stopSyncTimer);
		videoElement.addEventListener("ended", stopSyncTimer);

		// Cleanup when the page is closed
		window.addEventListener("beforeunload", stopSyncTimer);

		// Local functions

		function startSyncTimer() {
			syncTimer = setInterval(() => {
				if (window.spatialManager && !videoElement.paused) {
					window.spatialManager.checkSynchronization();
				}
			}, 500);
		}

		function stopSyncTimer() {
			if (syncTimer) {
				clearInterval(syncTimer);
				syncTimer = null;
			}
		}
	} catch (error) {
		console.error("[Main] Error initializing Spatial Audio Manager:", error);
	}
});
