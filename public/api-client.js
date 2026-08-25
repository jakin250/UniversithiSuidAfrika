window.apiClient = {
  async get(path) {
    const response = await fetch(path, { credentials: 'same-origin' });
    return this.handle(response);
  },
  async post(path, body) {
    return this.request(path, 'POST', body);
  },
  async patch(path, body) {
    return this.request(path, 'PATCH', body);
  },
  async delete(path) {
    return this.request(path, 'DELETE');
  },
  async request(path, method, body) {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return this.handle(response);
  },
  async handle(response) {
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => '');
    if (!response.ok) {
      const message = payload && typeof payload === 'object'
        ? (payload.error || payload.message || `Request failed: ${response.status}`)
        : `Request failed: ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }
};
