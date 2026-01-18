import Omnitone from "../node_modules/omnitone/build/omnitone.min.esm.js";

export default class SpatialAudioManager {
    constructor(audioCtx, videoElement) {
        this.audioCtx = audioCtx;
        this.videoElement = videoElement;

        this.sources = [];
        this.masterGain = audioCtx.createGain();
        this.masterGain.connect(audioCtx.destination);

        this.pause = true;

        // Initialize Omnitone FOA renderer
        this.foaRenderer = Omnitone.createFOARenderer(audioCtx, {
            renderingMode: "ambisonic"
        });

        this.foaRenderer.output.connect(this.masterGain);

        console.log("[SAM] SpatialAudioManager initialized with Omnitone");
    }

    /**
     * Initialize the Spatial Audio Manager and Omnitone FOA renderer
     */
    async initialize() {
        await this.foaRenderer.initialize();
        console.log("[SAM] Omnitone FOA Renderer initialized");
    }

    /**
     * 
     * @param {string} audioFilePath 
     * @param {object} options 
     * @returns 
     */
    async addAmbisonicsSource(audioFilePath, options) {
        const {
            rotations,
            volumes,
            timing
        } = options;

        try {
            const audioElement = document.createElement("audio");
            audioElement.loop = false;
            audioElement.src = audioFilePath;
            audioElement.preload = "auto";
            audioElement.crossOrigin = "anonymous";

            const audioSource = this.audioCtx.createMediaElementSource(audioElement);

            const sourceRenderer = Omnitone.createFOARenderer(this.audioCtx, {
                renderingMode: "ambisonic"
            });
            await sourceRenderer.initialize();

            const gainNode = this.audioCtx.createGain();
            gainNode.gain.value = 0;

            audioSource.connect(sourceRenderer.input);
            sourceRenderer.output.connect(gainNode);
            gainNode.connect(this.masterGain);

            const effectiveTiming = timing ?? {
                starting: 0,
                ending: this.videoElement.duration || Number.MAX_SAFE_INTEGER
            };

            // Check if this is a dynamic source by checking if it has an ending rotation or volume
            const isDynamic = (rotations && rotations.ending) || (volumes && volumes.ending);

            const volume = volumes ? volumes.starting : 1;
            const volumeEnd = volumes ? volumes.ending : null;

            const rotation = rotations ? rotations.starting : { yaw: 0, pitch: 0, roll: 0 };
            const rotationEnd = rotations ? rotations.ending : null;    

            const sourceObj = {
                audioElement,
                audioSource,
                sourceRenderer,
                gainNode,
                volumes,
                // volumeEnd: volumeEnd ?? volume,
                rotations,
                // rotationEnd: rotationEnd ?? rotation,
                timing: effectiveTiming,
                id: this.sources.length,
                name: audioFilePath.split("/").pop(),
                type: "ambisonics",
                isDynamic
            };

            this.sources.push(sourceObj);

            const update = () => {
                const { currentTime } = this.videoElement;

                if (this.isSourceInTimeRange(sourceObj.id)) {
                    if (!this.pause && audioElement.paused) {
                        audioElement.currentTime = Math.max(0, currentTime - effectiveTiming.starting);
                        audioElement.play().catch(() => { });
                    }

                    // Calculate interpolation progress
                    if (isDynamic) {
                        const progress =
                            (currentTime - effectiveTiming.starting) /
                            (effectiveTiming.ending - effectiveTiming.starting);

                        // Interpolate volume
                        const currentVolume =
                            sourceObj.volumes.starting +
                            (sourceObj.volumes.ending - sourceObj.volumes.starting) * progress;
                        gainNode.gain.value = currentVolume;

                        // Interpolate rotation (will be applied in updateListenerOrientation)
                        sourceObj.currentRotation = {
                            yaw: sourceObj.rotations.starting.yaw +
                                (sourceObj.rotations.ending.yaw - sourceObj.rotations.starting.yaw) * progress,
                            pitch: sourceObj.rotations.starting.pitch +
                                (sourceObj.rotations.ending.pitch - sourceObj.rotations.starting.pitch) * progress,
                            roll: sourceObj.rotations.starting.roll +
                                (sourceObj.rotations.ending.roll - sourceObj.rotations.starting.roll) * progress
                        };
                    } else {
                        gainNode.gain.value = volume;
                        sourceObj.currentRotation = sourceObj.rotations.starting;
                    }
                } else {
                    if (!audioElement.paused) {
                        audioElement.pause();
                    }
                }

                requestAnimationFrame(update);
            };
            requestAnimationFrame(update);

            console.log(`[SAM] Added ${isDynamic ? "dynamic" : "static"} Ambisonics FOA source: ${sourceObj.name}`);
            return sourceObj;
        } catch (error) {
            console.error(`[SAM] Error adding Ambisonics source ${audioFilePath}:`, error);
            return null;
        }
    }

    updateListenerOrientation(yaw, pitch, roll) {
        // Update all Ambisonics sources with camera orientation
        this.sources.forEach(source => {
            if (source.type === "ambisonics" && source.sourceRenderer) {
                // Use currentRotation if dynamic, otherwise use static rotation
                const srcRot = source.currentRotation || source.rotations.starting;

                const totalYaw = yaw + (srcRot.yaw || 0) * Math.PI / 180;
                const totalPitch = pitch + (srcRot.pitch || 0) * Math.PI / 180;
                const totalRoll = roll + (srcRot.roll || 0) * Math.PI / 180;

                const rotationMatrix = this.eulerToRotationMatrix(totalYaw, totalPitch, totalRoll);
                source.sourceRenderer.setRotationMatrix4(rotationMatrix);
            }
        });
    }

    eulerToRotationMatrix(yaw, pitch, roll) {
        // Calculate rotation matrix from Euler angles (ZXY order)
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const cr = Math.cos(roll);
        const sr = Math.sin(roll);

        // Column-major 4x4 rotation matrix
        return [
            cy * cr - sy * sp * sr, cy * sr + sy * sp * cr, -sy * cp, 0,
            -cp * sr, cp * cr, sp, 0,
            sy * cr + cy * sp * sr, sy * sr - cy * sp * cr, cy * cp, 0,
            0, 0, 0, 1
        ];
    }

    isSourceInTimeRange(id) {
        const { currentTime } = this.videoElement;
        return currentTime >= this.sources[id].timing.starting &&
            currentTime <= this.sources[id].timing.ending;
    }

    playAll() {
        console.log("[SAM] Playing all sources");
        this.sources.forEach(source => {
            source.audioElement.currentTime = this.videoElement.currentTime;
            if (this.isSourceInTimeRange(source.id)) {
                source.audioElement.play().catch(e =>
                    console.error("[SAM] Error playing source:", e)
                );
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
        this.sources.forEach(source => {
            const timeDiff = Math.abs(
                this.videoElement.currentTime - source.audioElement.currentTime
            );
            if (timeDiff > 0.15) {
                source.audioElement.currentTime = this.videoElement.currentTime;
            }
        });
    }

    setSourceVolume(sourceId, volume) {
        if (this.sources[sourceId]) {
            this.sources[sourceId].gainNode.gain.value = volume;
            this.sources[sourceId].volume = volume;
        }
    }

    setMasterVolume(volume) {
        this.masterGain.gain.value = volume;
    }

    getSourcesInfo() {
        return this.sources.map(source => ({
            id: source.id,
            name: source.name,
            type: source.type,
            currentTime: source.audioElement.currentTime,
            volume: source.gainNode.gain.value
        }));
    }
}