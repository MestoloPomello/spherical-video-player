import "aframe";
import initPlayerCommands from "./initPlayerCommands.js";
import AmbisonicsSourceManager from "./AmbisonicsSourceManager.js";

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
		const ambisonicsManager = new AmbisonicsSourceManager(audioCtx, videoElement);
		window.spatialManager = ambisonicsManager; // Nome compatibile con i controlli

		// Set initial volume for Ambisonics
		ambisonicsManager.setMasterVolume(0.5);

		// Sound sources
		await ambisonicsManager.addAmbisonicsSource(
			"./resources/audio/ducks.wav",
			0.5,  // volume 50%
			{ yaw: Math.PI/2, pitch: 0, roll: 0 }  // 90° a destra
		);

		// Update all listener orientations based on camera rotation
		AFRAME.registerComponent("ambisonics-listener-sync", {
			tick: function () {
				const rotation = cameraElement.getAttribute("rotation");

				// Convert A-Frame rotation to radiants
				const yaw = -rotation.y * Math.PI / 180;   // Horizontal rotation
				const pitch = -rotation.x * Math.PI / 180; // Vertical rotation  
				const roll = -rotation.z * Math.PI / 180;  // Roll rotation

				ambisonicsManager.updateGlobalOrientation(yaw, pitch, roll);
			}
		});

		cameraElement.setAttribute("ambisonics-listener-sync", "");

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
		console.error("[Main] Error initializing Ambisonics Source Manager:", error);
	}
});
