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
