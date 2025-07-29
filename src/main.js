import 'aframe';
import * as Omnitone from 'omnitone';

window.addEventListener('load', async () => {
	const videoElement = document.getElementById('video360');
	const cameraElement = document.getElementById('camera');

	const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

	// Omnitone initialization
	const foaRenderer = Omnitone.createFOARenderer(audioCtx);
	await foaRenderer.initialize();

	// Set the video as audios source - TODO: probably change this
	const srcNode = audioCtx.createMediaElementSource(videoElement);
	srcNode.connect(foaRenderer.input);
	foaRenderer.output.connect(audioCtx.destination);

	document.body.addEventListener('click', () => {
		audioCtx.resume();
		videoElement.play();
	}, { once: true });

	// Update the listener orientation after each frame
	AFRAME.registerComponent('listener-orientation-sync', {
		tick: function () {
			const rotation = cameraElement.getAttribute('rotation');
			const yaw = -rotation.y * Math.PI / 180;
			const pitch = -rotation.x * Math.PI / 180;
			const roll = -rotation.z * Math.PI / 180;
			foaRenderer.setListenerOrientation(yaw, pitch, roll);
		}
	});

	cameraElement.setAttribute('listener-orientation-sync', '');
});

