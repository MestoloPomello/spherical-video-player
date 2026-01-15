import Omnitone from '../node_modules/omnitone/build/omnitone.min.esm.js';

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
            renderingMode: 'ambisonic' // or 'bypass' for debugging
        });

        this.foaRenderer.output.connect(this.masterGain);

        console.log("[SAM] SpatialAudioManager initialized with Omnitone");
    }

    async initialize() {
        // Initialize Omnitone renderer (loads HRIR files)
        await this.foaRenderer.initialize();
        console.log("[SAM] Omnitone FOA Renderer initialized");
    }

    async addAmbisonicsSource(audioFilePath, options) {
        const { timing, volume = 1 } = options;

        try {
            const audioElement = document.createElement("audio");
            audioElement.loop = false;
            audioElement.src = audioFilePath;
            audioElement.preload = "auto";
            audioElement.crossOrigin = "anonymous";

            // Create media element source
            const audioSource = this.audioCtx.createMediaElementSource(audioElement);

            // Create gain node for this source
            const gainNode = this.audioCtx.createGain();
            gainNode.gain.value = 0;

            // Connect: source -> gain -> FOA renderer
            audioSource.connect(gainNode);
            gainNode.connect(this.foaRenderer.input);

            // No timing = whole video
            const effectiveTiming = timing ?? {
                starting: 0,
                ending: this.videoElement.duration || Number.MAX_SAFE_INTEGER
            };

            const sourceObj = {
                audioElement,
                audioSource,
                gainNode,
                volume,
                timing: effectiveTiming,
                id: this.sources.length,
                name: audioFilePath.split("/").pop(),
                type: 'ambisonics'
            };

            this.sources.push(sourceObj);

            // Update loop for this source
            const update = () => {
                const { currentTime } = this.videoElement;

                if (this.isSourceInTimeRange(sourceObj.id)) {
                    if (!this.pause && audioElement.paused) {
                        audioElement.currentTime = Math.max(0, currentTime - effectiveTiming.starting);
                        audioElement.play().catch(() => { });
                    }

                    // Set volume
                    gainNode.gain.value = volume;
                } else {
                    if (!audioElement.paused) {
                        audioElement.pause();
                    }
                }

                requestAnimationFrame(update);
            };
            requestAnimationFrame(update);

            console.log(`[SAM] Added Ambisonics FOA source: ${sourceObj.name}`);
            return sourceObj;

        } catch (error) {
            console.error(`[SAM] Error adding Ambisonics source ${audioFilePath}:`, error);
            return null;
        }
    }

    updateListenerOrientation(yaw, pitch, roll) {
        // Convert Euler angles to rotation matrix
        // Omnitone uses setRotationMatrix4() with a 16-element array (column-major 4x4 matrix)
        const rotationMatrix = this.eulerToRotationMatrix(yaw, pitch, roll);
        this.foaRenderer.setRotationMatrix4(rotationMatrix);
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