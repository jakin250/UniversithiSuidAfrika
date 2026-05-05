(function () {
  const API = "";
  const tokenKey = "sessionToken";

  async function api(path, method = "GET", body) {
    const res = await fetch(API + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-session-token": localStorage.getItem(tokenKey) || "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function getMe() {
    const out = await api("/api/auth/me", "GET");
    return out.user || null;
  }

  async function ensureLogin() {
    const me = await getMe();
    if (me) return me;

    const email = prompt("Enter your student email (e.g. name@unisa.ac.za)");
    if (!email) return null;

    const password = prompt("Enter your password (min 8 characters)");
    if (!password) return null;

    try {
      const out = await api("/api/auth/login", "POST", { email, password });
      localStorage.setItem(tokenKey, out.token);
      return out.user;
    } catch (error) {
      const wantsRegister = confirm("Account not found or login failed. Do you want to create an account?");
      if (!wantsRegister) throw error;

      const out = await api("/api/auth/register", "POST", { email, password });
      localStorage.setItem(tokenKey, out.token);
      return out.user;
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey);
  }

  window.sharedCampus = { api, getMe, ensureLogin, logout };
})();
