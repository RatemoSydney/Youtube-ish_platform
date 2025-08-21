class VideoStreamingApp {
    constructor() {
        this.videoManager = null;
        this.ui = null;
        this.uploadManager = null;
    }

    async init() {
        try {
            // Initialize core managers
            this.ui = new UIManager();
            this.videoManager = new VideoManager();

            // Make globally available
            window.ui = this.ui;
            window.videoManager = this.videoManager;

            // Initialize upload functionality
            this.initializeUpload();

            // Initialize auth forms
            this.initializeAuthForms();

            // Initialize search
            this.initializeSearch();

            // Load initial content
            await this.loadInitialContent();

            console.log('VideoStreaming App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.ui?.showToast('Application failed to initialize', 'error');
        }
    }

    initializeUpload() {
        const uploadForm = document.getElementById('upload-form');
        const fileUploadArea = document.getElementById('file-upload-area');
        const videoFileInput = document.getElementById('video-file');

        // File upload area click
        fileUploadArea?.addEventListener('click', () => {
            videoFileInput?.click();
        });

        // Drag and drop functionality
        fileUploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea?.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                videoFileInput.files = files;
                this.handleFileSelection(files[0]);
            }
        });

        // File input change
        videoFileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });

        // Form submission
        uploadForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVideoUpload();
        });
    }

    handleFileSelection(file) {
        const fileUploadArea = document.getElementById('file-upload-area');
        const uploadText = fileUploadArea?.querySelector('.upload-text');

        // Validate file type
        if (!config.allowedVideoTypes.includes(file.type)) {
            this.ui.showToast('Invalid file type. Please select a video file.', 'error');
            return;
        }

        // Validate file size
        if (file.size > config.maxFileSize) {
            this.ui.showToast('File too large. Maximum size is 100MB.', 'error');
            return;
        }

        // Update UI to show selected file
        if (uploadText) {
            uploadText.textContent = `Selected: ${file.name}`;
        }
    }

    async handleVideoUpload() {
        if (!auth.isCreator()) {
            this.ui.showToast('Creator access required', 'error');
            return;
        }

        const form = document.getElementById('upload-form');
        const formData = new FormData();

        // Get form values
        const videoFile = document.getElementById('video-file').files[0];
        const title = document.getElementById('video-title-input').value.trim();
        const description = document.getElementById('video-description-input').value.trim();
        const privacy = document.getElementById('video-privacy').value;
        const tags = document.getElementById('video-tags').value.trim();

        // Validation
        if (!videoFile) {
            this.ui.showToast('Please select a video file', 'error');
            return;
        }

        if (!title) {
            this.ui.showToast('Please enter a video title', 'error');
            return;
        }

        // Build form data
        formData.append('video', videoFile);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('privacy', privacy);
        formData.append('tags', tags);

        try {
            // Show upload progress
            const progressContainer = document.getElementById('upload-progress');
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            const submitBtn = document.getElementById('upload-submit');

            progressContainer?.classList.remove('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';

            // Simulate progress (since we can't get real progress with fetch)
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `Uploading... ${Math.round(progress)}%`;
            }, 200);

            // Upload video
            const response = await api.uploadVideo(formData);

            // Complete progress
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            progressText.textContent = 'Upload complete!';

            this.ui.showToast('Video uploaded successfully!', 'success');

            // Reset form
            form.reset();
            document.querySelector('.upload-text').textContent = 'Click to select video file or drag and drop';
            progressContainer?.classList.add('hidden');

            // Navigate to dashboard
            setTimeout(() => {
                this.ui.showPage('dashboard');
            }, 2000);

        } catch (error) {
            console.error('Upload error:', error);
            this.ui.showToast(error.message || 'Upload failed', 'error');
        } finally {
            const submitBtn = document.getElementById('upload-submit');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Video';
        }
    }

    initializeAuthForms() {
        // Login form
        const loginForm = document.getElementById('login-form');
        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Register form
        const registerForm = document.getElementById('register-form');
        registerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });

        // Auth buttons
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const logoutBtn = document.getElementById('logout-btn');

        loginBtn?.addEventListener('click', () => {
            this.ui.showAuthModal('login');
        });

        registerBtn?.addEventListener('click', () => {
            this.ui.showAuthModal('register');
        });

        logoutBtn?.addEventListener('click', () => {
            this.handleLogout();
        });
    }

    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            this.ui.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const result = await auth.login(username, password);
            if (result.success) {
                this.ui.showToast(`Welcome back, ${result.user.username}!`, 'success');
                this.ui.hideAuthModal();
                this.ui.updateNavigation();
                
                // Redirect creators to dashboard, others to home
                if (result.user.userType === 'creator') {
                    this.ui.showPage('dashboard');
                } else {
                    this.ui.showPage('home');
                }
                
                // Clear form
                document.getElementById('login-form').reset();
            } else {
                this.ui.showToast(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.ui.showToast('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const userType = document.getElementById('reg-user-type').value;

        // Validation
        if (!username || !email || !password || !userType) {
            this.ui.showToast('Please fill in all fields', 'error');
            return;
        }

        // Username validation
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.ui.showToast('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }

        if (username.length < 3 || username.length > 50) {
            this.ui.showToast('Username must be 3-50 characters long', 'error');
            return;
        }

        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.ui.showToast('Please enter a valid email address', 'error');
            return;
        }

        // Password validation
        if (password.length < 6) {
            this.ui.showToast('Password must be at least 6 characters long', 'error');
            return;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            this.ui.showToast('Password must contain uppercase, lowercase, and number', 'error');
            return;
        }

        try {
            const result = await auth.register({
                username,
                email,
                password,
                userType
            });

            if (result.success) {
                this.ui.showToast(`Welcome to VideoStream, ${result.user.username}!`, 'success');
                this.ui.hideAuthModal();
                this.ui.updateNavigation();
                
                // Redirect based on user type
                if (result.user.userType === 'creator') {
                    this.ui.showPage('upload');
                    this.ui.showToast('You can now start uploading videos!', 'info');
                } else {
                    this.ui.showPage('home');
                }
                
                // Clear form
                document.getElementById('register-form').reset();
            } else {
                this.ui.showToast(result.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.ui.showToast('Registration failed. Please try again.', 'error');
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            auth.logout();
            this.ui.updateNavigation();
            this.ui.showPage('home');
            this.ui.showToast('Logged out successfully', 'success');
        }
    }

    initializeSearch() {
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        let searchTimeout;

        // Search functionality
        const performSearch = async () => {
            const query = searchInput?.value.trim();
            if (query) {
                await this.searchVideos(query);
            } else {
                await this.ui.loadHomePage(); // Reset to all videos
            }
        };

        searchBtn?.addEventListener('click', performSearch);

        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // Real-time search with debouncing
        searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = searchInput.value.trim();
                if (query.length > 2) {
                    this.searchVideos(query);
                } else if (query.length === 0) {
                    this.ui.loadHomePage();
                }
            }, 500);
        });
    }

    async searchVideos(query) {
        try {
            this.ui.showLoading();
            const response = await api.getVideos(1, 12, query);
            this.ui.displayVideos(response.videos);
            
            if (response.videos.length === 0) {
                this.ui.showToast('No videos found for your search', 'info');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.ui.showToast('Search failed', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    async loadInitialContent() {
        // Update navigation based on auth status
        this.ui.updateNavigation();
        
        // Load home page content
        await this.ui.loadHomePage();
        
        // Set up periodic token validation
        this.setupTokenValidation();
    }

    setupTokenValidation() {
        // Check token validity every 5 minutes
        setInterval(() => {
            if (auth.isLoggedIn()) {
                // Simple token validation - try to get profile
                api.getProfile().catch(() => {
                    // If token is invalid, logout user
                    console.warn('Token validation failed, logging out user');
                    this.handleLogout();
                    this.ui.showToast('Session expired, please login again', 'warning');
                });
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const app = new VideoStreamingApp();
    await app.init();
});

// Export for potential external use
window.VideoStreamingApp = VideoStreamingApp;
