// This JavaScript file is the main script for the website. It handles the loading of channel data, user interactions, and dynamic updates to the UI.

// Main player and channel list script
document.addEventListener('DOMContentLoaded', function() {
    const channelListEl = document.getElementById('channel-list');
    const playerWrap = document.getElementById('player-wrap');
    const playerTitle = document.getElementById('player-title');
    const playerDesc = document.getElementById('player-desc');
    const nowPlaying = document.getElementById('now-playing');

    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const muteBtn = document.getElementById('mute-btn');

    let currentChannel = null;
    let isPlaying = false;
    let isMuted = false; // start unmuted by default (browsers may still block autoplay with sound)
    let currentIframe = null;

    function escapeHtml(text){
        return (text || '').toString().replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    }

    function extractYouTubeId(url){
        if(!url) return null;
        // Matches standard watch?v=ID, youtu.be/ID, or embed/ID
        const patterns = [/v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /embed\/([\w-]{11})/, /\/live\/([\w-]{11})/];
        for(const p of patterns){
            const m = url.match(p);
            if(m) return m[1];
        }
        // fallback: last 11 chars if looks like an id
        if(url.length >= 11) return url.slice(-11);
        return null;
    }

    function buildChannelCard(ch){
        const col = document.createElement('div');
        col.className = 'col-12 mb-3';
        const videoId = extractYouTubeId(ch.url || ch.video || ch.videoUrl);
        const thumb = ch.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        col.innerHTML = `
            <div class="card h-100">
                <div class="row no-gutters">
                    <div class="col-5">
                        <img src="${thumb}" class="card-img" alt="${escapeHtml(ch.title || ch.name)}">
                    </div>
                    <div class="col-7">
                        <div class="card-body p-2">
                            <h6 class="card-title mb-1">${escapeHtml(ch.title || ch.name)}</h6>
                            <p class="card-text small mb-2 text-truncate">${escapeHtml(ch.description || '')}</p>
                            <div class="d-flex">
                                <button class="btn btn-sm btn-primary mr-2 btn-play" data-url='${encodeURIComponent(ch.url)}'>Play</button>
                                <button class="btn btn-sm btn-outline-secondary btn-open" data-url='${encodeURIComponent(ch.url)}'>Open</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return col;
    }

    function setControlsEnabled(enabled){
        playBtn.disabled = !enabled;
        pauseBtn.disabled = !enabled;
        muteBtn.disabled = !enabled;
    }

    function buildEmbedUrl(videoId, mute){
        const muteParam = mute ? '&mute=1' : '';
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1${muteParam}`;
    }

    function loadChannelFromUrl(url){
        const vid = extractYouTubeId(url);
        if(!vid) return;
        currentChannel = { url, videoId: vid };
        isPlaying = true;
        // rebuild iframe
        playerWrap.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.className = 'embed-responsive-item';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.src = buildEmbedUrl(vid, isMuted);
        iframe.setAttribute('allowfullscreen', '');
        currentIframe = iframe;
        playerWrap.appendChild(iframe);
        // update UI
        playerTitle.textContent = (currentChannel && currentChannel.title) || 'Live Stream';
        playerDesc.textContent = '';
        nowPlaying.textContent = (currentChannel && currentChannel.url) || 'Playing';
        setControlsEnabled(true);
        updateMuteLabel();
    }

    function stopPlayback(){
        isPlaying = false;
        currentChannel = null;
        if(currentIframe) currentIframe.src = '';
        playerWrap.innerHTML = '<div id="player-placeholder" class="d-flex align-items-center justify-content-center h-100 text-light">Select a channel to play</div>';
        playerTitle.textContent = 'Select a channel';
        playerDesc.textContent = 'Click a channel on the right to start listening.';
        nowPlaying.textContent = 'Nothing playing';
        setControlsEnabled(false);
    }

    function toggleMute(){
        isMuted = !isMuted;
        if(!currentChannel) return;
        // recreate iframe with new mute param
        if(currentIframe && currentChannel.videoId){
            currentIframe.src = buildEmbedUrl(currentChannel.videoId, isMuted);
        }
        updateMuteLabel();
    }

    function updateMuteLabel(){
        muteBtn.textContent = isMuted ? 'Muted' : 'Unmuted';
    }

    // fetch channels.json and build list
    fetch('data/channels.json')
        .then(r => r.json())
        .then(data => {
            data.forEach(ch => {
                const card = buildChannelCard(ch);
                channelListEl.appendChild(card);
            });
            // attach handlers
            channelListEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-play');
                if(btn){
                    const url = decodeURIComponent(btn.getAttribute('data-url'));
                    loadChannelFromUrl(url);
                }
                const openBtn = e.target.closest('.btn-open');
                if(openBtn){
                    const url = decodeURIComponent(openBtn.getAttribute('data-url'));
                    // open in new tab for users who want YouTube page
                    window.open(url, '_blank');
                }
            });
        })
        .catch(err => {
            console.error('Failed to load channels.json', err);
            channelListEl.innerHTML = '<div class="col-12">Failed to load channels.</div>';
        });

    // control buttons
    playBtn.addEventListener('click', () => {
        if(!currentChannel) return;
        if(!isPlaying){
            loadChannelFromUrl(currentChannel.url);
        }
    });

    pauseBtn.addEventListener('click', () => {
        if(!isPlaying) return;
        stopPlayback();
    });

    muteBtn.addEventListener('click', () => {
        toggleMute();
    });

    // initialize
    setControlsEnabled(false);
});