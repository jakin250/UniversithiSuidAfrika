window.apiClient = {
  async get(path) {
    const response = await fetch(path, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  },
  async post(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }
};
