import { ICONS } from "../resources/icons/_svg";

/**
 *	Initializes the player commands interactions.
 */
export default function() {
	const videoPlayerBar = document.querySelector(".video-player");

	let mouseY = 0;
	let hideTimeout = null;
	let savedVolume = 0.5;

	const videoElement = document.getElementById("video360");
	const playBtn = document.getElementById("playBtn");
	const stopBtn = document.getElementById("stopBtn");
	const volumeSlider = document.getElementById("volumeSlider");
	const progressBar = document.getElementById("progressBar");
	const progressFilled = document.getElementById("progressFilled");
	const fullscreenBtn = document.getElementById("fullscreenBtn");
	const volumeIcon = document.getElementById("volumeIcon");

	// MUTE VIDEO AUDIO - Keep only Ambisonics audio
	videoElement.volume = 0;
	videoElement.muted = true;

	// Set icons
	playBtn.innerHTML = ICONS.play;
	stopBtn.innerHTML = ICONS.stop;
	volumeIcon.innerHTML = ICONS.volume_low;
	fullscreenBtn.innerHTML = ICONS.expand;


	// Event listeners

	const playerContainer = document.getElementById("player-container");
	playerContainer.tabIndex = 0; // Makes the playerContainer focusable for the keyboard cmds
	playerContainer.addEventListener("keydown", (event) => {
		// For all of the possible keyboard interactions
		switch (event.key) {
			case " ":
				event.preventDefault(); // Prevent page scroll
				handlePlayPause();
				break;
			case "m":
				handleMute();
				break;
				// TODO - check for other possible keybinds
		}
	});

	window.addEventListener("mousemove", (event) => {
		// Show the bar when the mouse is near the bottom border
		mouseY = event.clientY;
		const windowHeight = window.innerHeight;
		if (mouseY > windowHeight - 80) {
			showBar();
		}
	});

	playBtn.addEventListener("click", () => {
		handlePlayPause();
	});

	stopBtn.addEventListener("click", () => {
		// Stop = pause + rewind
		videoElement.pause();
		videoElement.currentTime = 0;

		// Stop all spatial sources
		if (window.spatialManager) {
			window.spatialManager.stopAll();
		}

		playBtn.innerHTML = ICONS.play;
	});

	// Initialize Ambisonics volume control (not video volume)
	volumeSlider.value = savedVolume;
	if (window.spatialManager) {
		window.spatialManager.setMasterVolume(savedVolume);
	}

	volumeSlider.addEventListener("input", (event) => {
		handleVolume(event.target.value);
	});

	volumeIcon.addEventListener("click", () => {
		handleMute();
	});

	// Progress bar
	videoElement.addEventListener("timeupdate", () => {
		const percent = (videoElement.currentTime / videoElement.duration) * 100;
		progressFilled.style.width = `${percent}%`;
	});

	// Progress bar selection
	progressBar.addEventListener("click", (event) => {
		const rect = progressBar.getBoundingClientRect();
		const pos = (event.clientX - rect.left) / rect.width;
		videoElement.currentTime = pos * videoElement.duration;

		// Sync all spatial sources
		if (window.spatialManager) {
			window.spatialManager.seekAll(pos * videoElement.duration);
		}
	});

	// Fullscreen
	fullscreenBtn.addEventListener("click", () => {
		if (!document.fullscreenElement) {
			playerContainer.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	});

	playerContainer.addEventListener("fullscreenchange", () => {
		// This event sets the icons accordingly to the current fullscreen state
		if (!document.fullscreenElement) {
			fullscreenBtn.innerHTML = ICONS.expand;
			playerContainer.focus();
		} else {
			fullscreenBtn.innerHTML = ICONS.compress;
		}
	});

	// Focus the container on load for keyboard controls
	window.addEventListener("load", () => {
		playerContainer.focus();
	});


	// Local functions and handlers

	function showBar() {
		videoPlayerBar.classList.add("visible");
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => {
			videoPlayerBar.classList.remove("visible");
		}, 3000);
	}

	function handlePlayPause() {
		if (videoElement.paused) {
			// Resume AudioContext if needed
			if (window.audioCtx && window.audioCtx.state === "suspended") {
				window.audioCtx.resume();
			}

			playBtn.innerHTML = ICONS.pause;
			videoElement.play();

			// Play all spatial sources
			if (window.spatialManager) {
				window.spatialManager.playAll();
			}
		} else {
			playBtn.innerHTML = ICONS.play;
			videoElement.pause();

			// Pause all spatial sources
			if (window.spatialManager) {
				window.spatialManager.pauseAll();
			}
		}
	}

	function handleVolume(value) {
		// Set volume only for spatial sources
		if (window.spatialManager) {
			window.spatialManager.setMasterVolume(value);
		}

		// Update volume icon
		if (value == 0) {
			volumeIcon.innerHTML = ICONS.volume_off;
		} else if (value <= 0.5) {
			volumeIcon.innerHTML = ICONS.volume_low;
		} else {
			volumeIcon.innerHTML = ICONS.volume_high;
		}
	}

	function handleMute() {
		// Click on icon saves the old volume and mutes the audio.
		// A second click restores the old volume value.
		// If the user takes the volume to 0 and presses the button, it
		// gets defaulted to 0.5.
		let newValue;

		// Get current Ambisonics volume instead of video volume
		const currentVolume = window.spatialManager ? 
			window.spatialManager.masterGain.gain.value : 0;

		if (currentVolume != 0) {
			savedVolume = currentVolume;
			newValue = 0;
		} else if (savedVolume != 0) {
			newValue = savedVolume;
		} else {
			newValue = 0.5;
		}
		handleVolume(newValue);
		volumeSlider.value = newValue;
	}
}
