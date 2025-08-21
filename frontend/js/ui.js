class UIManager {
    constructor() {
        this.currentPage = 'home';
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.initializeTheme();
        this.bindEvents();
        this.initializeNavigation();
    }

    bindEvents() {
        // Mobile navigation toggle
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');
        
        navToggle?.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
        });

        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Navigation links
        document.addEventListener('click', (e) => {
            if (e.target.matches('.nav-link')) {
                e.preventDefault();
                const page = e.target.dataset.page;
                if (page) {
                    this.showPage(page);
                }
                
                // Close mobile menu
                navMenu?.classList.remove('active');
                navToggle?.classList.remove('active');
            }
        });

        // Video card clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.video-card, .video-card *')) {
                const videoCard = e.target.closest('.video-card');
                if (videoCard) {
                    const videoId = videoCard.dataset.videoId;
                    if (videoId) {
                        videoManager.playVideo(videoId);
                    }
                }
            }
        });

        // Modal management
        const authModal = document.getElementById('auth-modal');
        const modalClose = document.getElementById('modal-close');
        
        modalClose?.addEventListener('click', () => {
            this.hideAuthModal();
        });
        
        authModal?.addEventListener('click', (e) => {
            if (e.target === authModal) {
                this.hideAuthModal();
            }
        });
    }

    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.currentTheme);
        this.initializeTheme();
    }

    initializeNavigation() {
        // Update navigation based on auth status
        this.updateNavigation();
        
        // Set initial active nav link
        this.setActiveNavLink('home');
    }

    updateNavigation() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const creatorOnlyElements = document.querySelectorAll('.creator-only');

        if (auth.isLoggedIn()) {
            authButtons?.classList.add('hidden');
            userMenu?.classList.remove('hidden');
            
            // Update user info
            const navUsername = document.getElementById('nav-username');
            const navUserType = document.getElementById('nav-user-type');
            
            if (navUsername) navUsername.textContent = auth.user.username;
            if (navUserType) navUserType.textContent = auth.user.userType;
            
            // Show creator-only elements
            if (auth.isCreator()) {
                creatorOnlyElements.forEach(el => el.classList.remove('hidden'));
            }
        } else {
            authButtons?.classList.remove('hidden');
            userMenu?.classList.add('hidden');
            creatorOnlyElements.forEach(el => el.classList.add('hidden'));
        }
    }

    setActiveNavLink(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });
    }

    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show target page
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            this.setActiveNavLink(pageId);
        }

        // Load page-specific data
        switch (pageId) {
            case 'home':
                this.loadHomePage();
                break;
            case 'dashboard':
                if (auth.isCreator()) {
                    this.loadDashboard();
                }
                break;
            case 'upload':
                if (!auth.isCreator()) {
                    this.showToast('Creator access required', 'error');
                    this.showPage('home');
                }
                break;
        }
    }

    async loadHomePage() {
        try {
            this.showLoading();
            const response = await api.getVideos(1, 12);
            this.displayVideos(response.videos);
            this.hideLoading();
        } catch (error) {
            console.error('Error loading videos:', error);
            this.showToast('Failed to load videos', 'error');
            this.hideLoading();
        }
    }

    displayVideos(videos) {
        const videoGrid = document.getElementById('video-grid');
        if (!videoGrid) return;

        videoGrid.innerHTML = '';

        videos.forEach(video => {
            const videoCard = document.createElement('div');
            videoCard.className = 'video-card';
            videoCard.dataset.videoId = video.id;
            
            videoCard.innerHTML = `
                <div class="video-thumbnail">
                    📹
                </div>
                <div class="video-card-content">
                    <h3 class="video-card-title">${this.escapeHtml(video.title)}</h3>
                    <div class="video-card-meta">
                        <span class="video-card-creator">${this.escapeHtml(video.creator_username || video.creator_name)}</span>
                        <span>${new Date(video.upload_date).toLocaleDateString()}</span>
                    </div>
                    <div class="video-card-stats">
                        <span>${video.view_count || 0} views</span>
                        <span>${video.like_count || 0} likes</span>
                    </div>
                </div>
            `;
            
            videoGrid.appendChild(videoCard);
        });
    }

    async loadDashboard() {
        if (!auth.isCreator()) return;

        try {
            this.showLoading();
            
            // Load profile and videos
            const [profileResponse, videosResponse] = await Promise.all([
                api.getProfile(),
                api.getMyVideos()
            ]);

            const profile = profileResponse.user;
            const videos = videosResponse.videos;

            // Update dashboard stats
            const totalVideos = document.getElementById('total-videos');
            const totalViews = document.getElementById('total-views');
            const totalFollowers = document.getElementById('total-followers');

            if (totalVideos) totalVideos.textContent = profile.video_count || 0;
            if (totalViews) totalViews.textContent = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
            if (totalFollowers) totalFollowers.textContent = profile.follower_count || 0;

            // Display videos list
            this.displayMyVideos(videos);
            
            this.hideLoading();
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showToast('Failed to load dashboard', 'error');
            this.hideLoading();
        }
    }

    displayMyVideos(videos) {
        const videosList = document.getElementById('my-videos-list');
        if (!videosList) return;

        videosList.innerHTML = '';

        videos.forEach(video => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-list-item';
            
            videoItem.innerHTML = `
                <div class="video-list-thumbnail">📹</div>
                <div class="video-list-content">
                    <h4 class="video-list-title">${this.escapeHtml(video.title)}</h4>
                    <div class="video-list-meta">
                        <span>${video.view_count || 0} views</span>
                        <span>${video.like_count || 0} likes</span>
                        <span>${video.privacy_setting}</span>
                        <span>${new Date(video.upload_date).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="video-list-actions">
                    <button class="btn btn-small btn-outline" onclick="videoManager.playVideo(${video.id})">View</button>
                    <button class="btn btn-small btn-outline" onclick="ui.deleteVideo(${video.id})">Delete</button>
                </div>
            `;
            
            videosList.appendChild(videoItem);
        });
    }

    showAuthModal(mode = 'login') {
        const modal = document.getElementById('auth-modal');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const modalTitle = document.getElementById('modal-title');
        const authSwitchText = document.getElementById('auth-switch-text');
        const authSwitchLink = document.getElementById('auth-switch-link');

        if (mode === 'login') {
            modalTitle.textContent = 'Login';
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            authSwitchText.textContent = "Don't have an account?";
            authSwitchLink.textContent = 'Register here';
            authSwitchLink.onclick = () => this.showAuthModal('register');
        } else {
            modalTitle.textContent = 'Register';
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authSwitchText.textContent = 'Already have an account?';
            authSwitchLink.textContent = 'Login here';
            authSwitchLink.onclick = () => this.showAuthModal('login');
        }

        modal.classList.remove('hidden');
    }

    hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.add('hidden');
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    async deleteVideo(videoId) {
        if (!confirm('Are you sure you want to delete this video?')) return;

        try {
            await api.deleteVideo(videoId);
            this.showToast('Video deleted successfully', 'success');
            this.loadDashboard(); // Refresh dashboard
        } catch (error) {
            console.error('Error deleting video:', error);
            this.showToast('Failed to delete video', 'error');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
