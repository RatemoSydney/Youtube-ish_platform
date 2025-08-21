class VideoManager {
    constructor() {
        this.currentVideoId = null;
        this.currentVideo = null;
        this.bindEvents();
    }

    bindEvents() {
        // Video player events
        const videoPlayer = document.getElementById('video-player');
        if (videoPlayer) {
            videoPlayer.addEventListener('loadedmetadata', () => {
                console.log('Video metadata loaded');
            });
            
            videoPlayer.addEventListener('error', (e) => {
                console.error('Video playback error:', e);
                ui.showToast('Video playback failed', 'error');
            });
        }

        // Like button
        document.addEventListener('click', (e) => {
            if (e.target.matches('#like-btn, #like-btn *')) {
                e.preventDefault();
                this.toggleLike();
            }
        });

        // Follow button
        document.addEventListener('click', (e) => {
            if (e.target.matches('#follow-btn, #follow-btn *')) {
                e.preventDefault();
                this.toggleFollow();
            }
        });
    }

    async playVideo(videoId) {
        try {
            ui.showLoading();
            const response = await api.getVideo(videoId);
            const { video } = response;
            
            this.currentVideo = video;
            this.currentVideoId = videoId;
            
            // Update video player
            const videoPlayer = document.getElementById('video-player');
            const videoSrc = `/uploads/videos/${video.filename}`;
            videoPlayer.src = videoSrc;
            
            // Update video info
            document.getElementById('video-title').textContent = video.title;
            document.getElementById('video-views').textContent = `${video.view_count || 0} views`;
            document.getElementById('video-date').textContent = new Date(video.upload_date).toLocaleDateString();
            document.getElementById('video-description').textContent = video.description || 'No description available';
            
            // Update creator info
            document.getElementById('creator-name').textContent = video.creator_name || video.creator_username;
            document.getElementById('creator-followers').textContent = `${video.creator_followers || 0} followers`;
            
            // Update like button
            const likeBtn = document.getElementById('like-btn');
            const likeCount = document.getElementById('like-count');
            likeCount.textContent = video.like_count || 0;
            
            if (video.user_liked) {
                likeBtn.classList.add('active');
            } else {
                likeBtn.classList.remove('active');
            }
            
            // Update follow button
            const followBtn = document.getElementById('follow-btn');
            if (auth.isLoggedIn() && auth.user.id !== video.creator_id) {
                followBtn.classList.remove('hidden');
                followBtn.textContent = video.user_following ? 'Unfollow' : 'Follow';
            } else {
                followBtn.classList.add('hidden');
            }
            
            ui.hideLoading();
            ui.showPage('video-page');
            
        } catch (error) {
            console.error('Error playing video:', error);
            ui.showToast('Failed to load video', 'error');
            ui.hideLoading();
        }
    }

    async toggleLike() {
        if (!auth.isLoggedIn()) {
            ui.showAuthModal('login');
            return;
        }

        if (!this.currentVideoId) return;

        try {
            const response = await api.toggleLike(this.currentVideoId);
            
            const likeBtn = document.getElementById('like-btn');
            const likeCount = document.getElementById('like-count');
            
            likeCount.textContent = response.likeCount;
            
            if (response.liked) {
                likeBtn.classList.add('active');
                ui.showToast('Video liked!', 'success');
            } else {
                likeBtn.classList.remove('active');
                ui.showToast('Like removed', 'success');
            }
            
        } catch (error) {
            console.error('Error toggling like:', error);
            ui.showToast('Failed to update like', 'error');
        }
    }

    async toggleFollow() {
        if (!auth.isLoggedIn() || !this.currentVideo) return;

        try {
            const response = await api.toggleFollow(this.currentVideo.creator_id);
            
            const followBtn = document.getElementById('follow-btn');
            const followerCount = document.getElementById('creator-followers');
            
            followBtn.textContent = response.following ? 'Unfollow' : 'Follow';
            followerCount.textContent = `${response.followerCount} followers`;
            
            const message = response.following ? 'Now following creator!' : 'Unfollowed creator';
            ui.showToast(message, 'success');
            
        } catch (error) {
            console.error('Error toggling follow:', error);
            ui.showToast('Failed to update follow status', 'error');
        }
    }
}
