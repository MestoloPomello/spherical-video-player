import "aframe";
import initPlayerCommands from "./initPlayerCommands.js";
import SpatialAudioManager from "./SpatialAudioManager.js";

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

		// Ducks sounds
		const ducksPos = { x: -8, y: 0, z: 3 };
		await spatialManager.addSpatialSource(
			"./resources/audio/ducks.wav",
			{
				positions: {
					starting: ducksPos,
					ending: ducksPos
				},
				volumes: {
					starting: 2,
					ending: 2
				}
			}
		);

		// Water - multiple panner nodes for simulating the river
		const waterPos1 = { x: -3, y: 0, z: 0 };
		await spatialManager.addSpatialSource(
			"./resources/audio/water.wav",
			{
				positions: {
					starting: waterPos1,
					ending: waterPos1
				},
				volumes: {
					starting: 2,
					ending: 2
				}
			}
		);

		const waterPos2 = { x: -3, y: 0, z: 4 };
		await spatialManager.addSpatialSource(
			"./resources/audio/water.wav",
			{
				positions: {
					starting: waterPos2,
					ending: waterPos2
				},
				volumes: {
					starting: 1.7,
					ending: 1.7 
				}
			}
		);

		const waterPos3 = { x: -3, y: 0, z: -4 };
		await spatialManager.addSpatialSource(
			"./resources/audio/water.wav",
			{
				positions: {
					starting: waterPos3,
					ending: waterPos3
				},
				volumes: {
					starting: 1.7,
					ending: 1.7 
				}
			}
		);

		// Steps following the man - 2 sources:
		// 1. while the man approaches
		// 2. while the man goes away
		await spatialManager.addSpatialSource(
			"./resources/audio/steps.wav",
			{
				positions: {
					starting: { x: 0, y: 0, z: -10 },  // far, forward 
					ending:   { x: 2, y: 0, z: -2 }    // near, right
				},
				volumes: {
					starting: 20,
					ending: 70
				},
				timing: {
					starting: 12,
					ending: 18
				}
			}
		);

		await spatialManager.addSpatialSource(
			"./resources/audio/steps.wav",
			{
				positions: {
					starting: { x: 2, y: 0, z: -2 },	// near, right
					ending:   { x: 0, y: 0, z: 5 }		// far, back 
				},
				volumes: {
					starting: 70,
					ending: 10
				},
				timing: {
					starting: 17.2,
					ending: 23.5
				}
			}
		);

		// TODO - time counter for progress bar
		// TODO - steps sound for everyone
		// TODO - check for other sounds (i.e. birds)

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
