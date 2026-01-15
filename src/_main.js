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
        window.spatialManager = spatialManager;

        // Initialize Omnitone (loads HRIR files)
        await spatialManager.initialize();

        // Set initial volume
        spatialManager.setMasterVolume(0.5);

        // Add Ambisonics FOA sources
        // Ogni file audio deve essere un file Ambisonics FOA a 4 canali (W, X, Y, Z)

        // Ducks - full duration
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/ducks.wav",
            {
                volume: 2
            }
        );

        // Noise - full duration
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/noise.wav",
            {
                volume: 1.5
            }
        );

        // Water ambience - full duration
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/water.wav",
            {
                volume: 2
            }
        );

        // Steps - man approaching (12-17s)
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/steps.wav",
            {
                volume: 3,
                timing: {
                    starting: 12,
                    ending: 17
                }
            }
        );

        // Steps - man walking away (16.2-23.5s)
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/steps.wav",
            {
                volume: 3,
                timing: {
                    starting: 16.2,
                    ending: 23.5
                }
            }
        );

        // Crowd/people talking
        // await spatialManager.addAmbisonicsSource(
        //   "./resources/audio/crowd_foa.wav",
        //   {
        //     volume: 2,
        //     timing: {
        //       starting: 0,
        //       ending: 75
        //     }
        //   }
        // );

        // Update listener orientation based on camera rotation
        AFRAME.registerComponent("spatial-listener-sync", {
            tick: function () {
                const rotation = cameraElement.getAttribute("rotation");

                // Convert A-Frame rotation to radians (Euler angles)
                const yaw = -rotation.y * Math.PI / 180;   // Horizontal
                const pitch = -rotation.x * Math.PI / 180; // Vertical  
                const roll = -rotation.z * Math.PI / 180;  // Roll

                spatialManager.updateListenerOrientation(yaw, pitch, roll);
            }
        });

        cameraElement.setAttribute("spatial-listener-sync", "");

        videoElement.addEventListener("play", startSyncTimer);
        videoElement.addEventListener("pause", stopSyncTimer);
        videoElement.addEventListener("ended", stopSyncTimer);

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