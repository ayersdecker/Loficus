// This file manages the audio player functionality, allowing users to play, pause, and switch between different Lofi channels.

let currentChannel = null;
const audioPlayer = document.getElementById('audio-player');
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');
const channelTitle = document.getElementById('channel-title');

function loadChannel(channel) {
    if (currentChannel) {
        audioPlayer.pause();
    }
    currentChannel = channel;
    audioPlayer.src = currentChannel.url;
    channelTitle.textContent = currentChannel.title;
}

function playChannel() {
    if (currentChannel) {
        audioPlayer.play();
    }
}

function pauseChannel() {
    audioPlayer.pause();
}

playButton.addEventListener('click', playChannel);
pauseButton.addEventListener('click', pauseChannel);

// Export functions for use in main.js if needed
export { loadChannel, playChannel, pauseChannel };