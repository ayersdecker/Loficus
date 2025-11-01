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
    let ytPlayer = null;
    let ytApiReady = false;

    // Called by the YouTube IFrame API when it's ready
    window.onYouTubeIframeAPIReady = function() {
        ytApiReady = true;
    };

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
        const safeTitle = escapeHtml(ch.title || ch.name || '');
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
                                <button class="btn btn-sm btn-primary mr-2 btn-play" data-url='${encodeURIComponent(ch.url)}' data-title='${encodeURIComponent(safeTitle)}'>Play</button>
                                <button class="btn btn-sm btn-outline-secondary btn-open" data-url='${encodeURIComponent(ch.url)}'>Open</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return col;
    }

    // Try to fetch the real video title via YouTube oEmbed and update the card UI
    function fetchAndSetTitle(card, url){
        if(!url) return;
        const oembed = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json';
        fetch(oembed)
            .then(r => {
                if(!r.ok) throw new Error('oembed failed');
                return r.json();
            })
            .then(data => {
                if(!data || !data.title) return;
                const title = data.title;
                const titleEl = card.querySelector('.card-title');
                if(titleEl) titleEl.textContent = title;
                const playBtn = card.querySelector('.btn-play');
                if(playBtn) playBtn.setAttribute('data-title', encodeURIComponent(title));
            })
            .catch(() => {
                // ignore failures silently; keep existing title
            });
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

    function showEmbedError(message, videoUrl){
        // Display a friendly error UI and an Open on YouTube button
        playerWrap.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'd-flex flex-column align-items-center justify-content-center h-100 text-center p-3';
        const msg = document.createElement('div');
        msg.textContent = message;
        msg.style.marginBottom = '12px';
        const btnRow = document.createElement('div');
        btnRow.className = 'btn-group';
        const open = document.createElement('button');
        open.className = 'btn btn-sm btn-primary';
        open.textContent = 'Open on YouTube';
        open.addEventListener('click', () => window.open(videoUrl, '_blank'));
        const retry = document.createElement('button');
        retry.className = 'btn btn-sm btn-outline-secondary';
        retry.textContent = 'Try embed again';
        retry.addEventListener('click', () => {
            // fallback to a simple iframe attempt
            loadChannelEmbedFallback(videoUrl);
        });
        btnRow.appendChild(open);
        btnRow.appendChild(retry);
        wrap.appendChild(msg);
        wrap.appendChild(btnRow);
        playerWrap.appendChild(wrap);
        setControlsEnabled(false);
    }

    function createYTPlayer(videoId, videoUrl){
        // destroy existing
        if(ytPlayer && typeof ytPlayer.destroy === 'function'){
            try{ ytPlayer.destroy(); }catch(e){}
            ytPlayer = null;
        }
        playerWrap.innerHTML = '<div id="yt-player" style="width:100%;height:100%;"></div>';
        try{
            ytPlayer = new YT.Player('yt-player', {
                videoId: videoId,
                playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
                events: {
                    onReady: function(event){
                        if(isMuted) event.target.mute(); else event.target.unMute();
                        // attempt play (may be blocked if browser prevents autoplay with sound)
                        try{ event.target.playVideo(); }catch(e){}
                        setControlsEnabled(true);
                        updateMuteLabel();
                    },
                    onError: function(e){
                        // YouTube error codes: 2,5,100,101,150... treat 101/150/153 as embedding disabled
                        const code = (e && e.data) ? e.data : null;
                        if(code === 101 || code === 150 || code === 153){
                            showEmbedError('This video cannot be played embedded (owner restricted playback).', videoUrl);
                        } else {
                            showEmbedError('Video player error (code ' + code + ').', videoUrl);
                        }
                    }
                }
            });
        }catch(err){
            // if something goes wrong, fallback to iframe
            loadChannelEmbedFallback(videoUrl);
        }
    }

    function loadChannelEmbedFallback(url){
        const vid = extractYouTubeId(url);
        if(!vid) return;
        // clean up any YT player
        if(ytPlayer && typeof ytPlayer.destroy === 'function'){
            try{ ytPlayer.destroy(); }catch(e){}
            ytPlayer = null;
        }
        playerWrap.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.className = 'embed-responsive-item';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.src = buildEmbedUrl(vid, isMuted);
        iframe.setAttribute('allowfullscreen', '');
        currentIframe = iframe;
        playerWrap.appendChild(iframe);
        setControlsEnabled(true);
        updateMuteLabel();
    }

    function loadChannelFromUrl(url, title){
        const vid = extractYouTubeId(url);
        if(!vid) return;
        currentChannel = { url, videoId: vid, title: title || (currentChannel && currentChannel.title) || '' };
        isPlaying = true;
        // prefer YT IFrame API for error handling
        if(ytApiReady && window.YT && typeof YT.Player === 'function'){
            createYTPlayer(vid, url);
            // update UI
            playerTitle.textContent = (currentChannel && currentChannel.title) || 'Live Stream';
            playerDesc.textContent = '';
            nowPlaying.textContent = (currentChannel && currentChannel.url) || 'Playing';
            return;
        }
        // fallback to simple iframe embed
        loadChannelEmbedFallback(url);
        playerTitle.textContent = (currentChannel && currentChannel.title) || 'Live Stream';
        playerDesc.textContent = '';
        nowPlaying.textContent = (currentChannel && currentChannel.url) || 'Playing';
    }

    function stopPlayback(){
        isPlaying = false;
        currentChannel = null;
        if(currentIframe) currentIframe.src = '';
        if(ytPlayer && typeof ytPlayer.destroy === 'function'){
            try{ ytPlayer.destroy(); }catch(e){}
            ytPlayer = null;
        }
        playerWrap.innerHTML = '<div id="player-placeholder" class="d-flex align-items-center justify-content-center h-100 text-light">Select a channel to play</div>';
        playerTitle.textContent = 'Select a channel';
        playerDesc.textContent = 'Click a channel on the right to start listening.';
        nowPlaying.textContent = 'Nothing playing';
        setControlsEnabled(false);
    }

    function toggleMute(){
        isMuted = !isMuted;
        if(!currentChannel) return;
        // If using YT player, use API to mute/unmute
        if(ytPlayer && typeof ytPlayer.getPlayerState === 'function'){
            try{
                if(isMuted) ytPlayer.mute(); else ytPlayer.unMute();
            }catch(e){
                // fallback to iframe reload
                if(currentIframe && currentChannel.videoId){
                    currentIframe.src = buildEmbedUrl(currentChannel.videoId, isMuted);
                }
            }
        } else {
            // recreate iframe with new mute param
            if(currentIframe && currentChannel.videoId){
                currentIframe.src = buildEmbedUrl(currentChannel.videoId, isMuted);
            }
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
                // fetch and update title to match the actual YouTube video title when possible
                fetchAndSetTitle(card, ch.url);
            });
            // attach handlers
            channelListEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-play');
                if(btn){
                    const url = decodeURIComponent(btn.getAttribute('data-url'));
                    const title = decodeURIComponent(btn.getAttribute('data-title') || '');
                    loadChannelFromUrl(url, title);
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
        if(ytPlayer && typeof ytPlayer.playVideo === 'function'){
            try{ ytPlayer.playVideo(); isPlaying = true; setControlsEnabled(true); }catch(e){}
            return;
        }
        if(!isPlaying){
            loadChannelFromUrl(currentChannel.url);
        }
    });

    pauseBtn.addEventListener('click', () => {
        if(!isPlaying) return;
        if(ytPlayer && typeof ytPlayer.pauseVideo === 'function'){
            try{ ytPlayer.pauseVideo(); isPlaying = false; }catch(e){}
            return;
        }
        stopPlayback();
    });

    muteBtn.addEventListener('click', () => {
        toggleMute();
    });

    // initialize
    setControlsEnabled(false);
});