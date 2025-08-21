class APIClient {
  constructor() {
    this.baseURL = config.apiUrl;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (auth.isLoggedIn()) {
      defaultOptions.headers.Authorization = `Bearer ${auth.token}`;
    }

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, finalOptions);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Video endpoints
  async getVideos(page = 1, limit = 12, search = '') {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    
    return this.makeRequest(`/videos?${params}`);
  }

  async getVideo(id) {
    return this.makeRequest(`/videos/${id}`);
  }

  async uploadVideo(formData) {
    return this.makeRequest('/videos', {
      method: 'POST',
      headers: {}, // Let browser set multipart headers
      body: formData
    });
  }

  async getMyVideos() {
    return this.makeRequest('/videos/my');
  }

  async deleteVideo(id) {
    return this.makeRequest(`/videos/${id}`, {
      method: 'DELETE'
    });
  }

  // Interaction endpoints
  async toggleLike(videoId) {
    return this.makeRequest(`/interactions/like/${videoId}`, {
      method: 'POST'
    });
  }

  async toggleFollow(userId) {
    return this.makeRequest(`/interactions/follow/${userId}`, {
      method: 'POST'
    });
  }

  async getProfile() {
    return this.makeRequest('/auth/profile');
  }
}

const api = new APIClient();
