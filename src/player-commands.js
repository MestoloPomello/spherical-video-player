export function initializePlayerCommands() {
	const videoPlayerBar = document.querySelector(".video-player");

	let mouseY = 0;
	let hideTimeout = null;

	function showBar() {
		videoPlayerBar.classList.add("visible");
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => {
			videoPlayerBar.classList.remove("visible");
		}, 3000);
	}

	// Show the bar when the mouse is near the bottom border
	window.addEventListener("mousemove", (e) => {
		mouseY = e.clientY;
		const windowHeight = window.innerHeight;
		if (mouseY > windowHeight - 80) {
			showBar();
		}
	});

	const video = document.getElementById("video360");
	const playBtn = document.getElementById("playBtn");
	const pauseBtn = document.getElementById("pauseBtn");
	const stopBtn = document.getElementById("stopBtn");
	const volumeSlider = document.getElementById("volumeSlider");
	const progressBar = document.getElementById("progressBar");
	const progressFilled = document.getElementById("progressFilled");
	const fullscreenBtn = document.getElementById("fullscreenBtn");

	// Play
	playBtn.addEventListener("click", () => {
		video.play();
	});

	// Pause
	pauseBtn.addEventListener("click", () => {
		video.pause();
	});

	// Stop (pause + rewind)
	stopBtn.addEventListener("click", () => {
		video.pause();
		video.currentTime = 0;
	});

	// Volume
	volumeSlider.addEventListener("input", (e) => {
		video.volume = e.target.value;
	});

	// Progress bar - TODO - test
	video.addEventListener("timeupdate", () => {
		const percent = (video.currentTime / video.duration) * 100;
		progressFilled.style.width = `${percent}%`;
	});

	// Progress bar selection
	progressBar.addEventListener("click", (e) => {
		const rect = progressBar.getBoundingClientRect();
		const pos = (e.clientX - rect.left) / rect.width;
		video.currentTime = pos * video.duration;
	});

	// Fullscreen
	fullscreenBtn.addEventListener("click", () => {
		const scene = document.querySelector("a-scene");
		if (!document.fullscreenElement) {
			scene.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	});
}
