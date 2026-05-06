(function () {
  const tokenKey = "sessionToken";

  async function api(path, method = "GET", body) {
    const res = await fetch(path, {
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

  function setStatus(message, ok = true) {
    const el = document.querySelector("[data-status]");
    if (el) {
      el.textContent = message;
      el.style.color = ok ? "#1f7a3a" : "#b42318";
    }
  }

  async function me() {
    const out = await api("/api/auth/me");
    return out.user || null;
  }

  async function requireUser() {
    const user = await me();
    if (!user) location.href = "register.html";
    return user;
  }

  async function loadCollection(path, target, render) {
    const el = document.querySelector(target);
    if (!el) return;
    try {
      const out = await api(path);
      const items = out.items || out.posts || out.listings || [];
      el.innerHTML = items.length ? items.map(render).join("") : `<div class="panel muted">No user content has been posted yet.</div>`;
    } catch (error) {
      el.innerHTML = `<div class="panel muted">${error.message}</div>`;
    }
  }

  function bindForm(selector, path, buildBody, after) {
    const form = document.querySelector(selector);
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Saving...");
      try {
        await requireUser();
        const body = buildBody(new FormData(form));
        await api(path, "POST", body);
        form.reset();
        setStatus("Saved successfully.");
        if (after) after();
      } catch (error) {
        setStatus(error.message, false);
      }
    });
  }

  window.platform = { api, me, requireUser, loadCollection, bindForm, setStatus };
})();
