import "aframe";
import initPlayerCommands from "./initPlayerCommands.js";
import SpatialAudioManager from "./SpatialAudioManager.js";

window.addEventListener("load", async () => {
    initPlayerCommands();

    let syncTimer;

    const videoElement = document.getElementById("video360");
    const cameraElement = document.getElementById("camera");

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    window.audioCtx = audioCtx;

    try {
        const spatialManager = new SpatialAudioManager(audioCtx, videoElement);
        window.spatialManager = spatialManager;

        await spatialManager.initialize();

        spatialManager.setMasterVolume(0.5);

        // Ducks near the river
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/ducks.wav",
            {
                volumes: {
                    starting: 2
                },
                rotations: {
                    starting: { yaw: 90, pitch: 0, roll: 0 }
                }
            }
        );

        // Noise from the street
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/noise.wav",
            {
                volumes: {
                    starting: 1
                },
                rotations: {
                    starting: { yaw: -90, pitch: 0, roll: 0 }
                }
            }
        );

        // River water, multiple instances
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/water.wav",
            {
                volumes: {
                    starting: 2
                },
                rotations: {
                    starting: { yaw: 60, pitch: 0, roll: 0 }
                }
            }
        );

        await spatialManager.addAmbisonicsSource(
            "./resources/audio/water.wav",
            {
                volumes: {
                    starting: 1.7
                },
                rotations: {
                    starting: { yaw: 65, pitch: 0, roll: 0 }
                }
            }
        );

        await spatialManager.addAmbisonicsSource(
            "./resources/audio/water.wav",
            {
                volumes: {
                    starting: 1.7
                },
                rotations: {
                    starting: { yaw: 55, pitch: 0, roll: 0 }
                }
            }
        );

        // Steps with dynamic movement - single file with interpolation

        // Approaching: from front-far to right-near (12-17s)
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/steps.wav",
            {
                volumes: {
                    starting: 1,
                    ending: 30 
                },
                rotations: {
                    starting: { yaw: 0, pitch: 0, roll: 0 }, // Start: front
                    ending: { yaw: -90, pitch: 0, roll: 0 }  // End: back
                },
                timing: {
                    starting: 12,
                    ending: 17
                }
            }
        );

        // Walking away: from right-near to back-far (16.2-23.5s)
        await spatialManager.addAmbisonicsSource(
            "./resources/audio/steps.wav",
            {
                volumes: {
                    starting: 30,
                    ending: 1
                },
                rotations: {
                    starting: { yaw: -90, pitch: 0, roll: 0 }, // Start: right side
                    ending: { yaw: 180, pitch: 0, roll: 0 }    // End: behind
                },
                timing: {
                    starting: 16.8,
                    ending: 23.5
                }
            }
        );

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