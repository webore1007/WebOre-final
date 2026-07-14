(function initLogin() {
  const form = document.getElementById("login-form");
  if (!form) return;
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Logging in…";
    try {
      const res = await api("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: form.email.value, password: form.password.value }),
      });
      setToken(res.token);
      window.location.href = res.user.role === "admin" ? "admin.html" : "dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message || "Login failed.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  });
})();

(function initSignup() {
  const form = document.getElementById("signup-form");
  if (!form) return;
  const errorEl = document.getElementById("signup-error");
  const btn = document.getElementById("signup-submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Creating account…";
    try {
      const res = await api("/auth/signup", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          name: form.name.value,
          email: form.email.value,
          password: form.password.value,
          company: form.company.value,
          phone: form.phone.value,
        }),
      });
      setToken(res.token);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message || "Sign up failed.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Create account";
    }
  });
})();

/* ---------- Social login ---------- */

async function handleOauthSuccess(res) {
  setToken(res.token);
  window.location.href = res.user.role === "admin" ? "admin.html" : "dashboard.html";
}

function showSocialError(message) {
  const errorEl = document.getElementById("login-error") || document.getElementById("signup-error");
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function currentGoogleClientId() {
  return window.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID || "";
}
function currentFacebookAppId() {
  return window.FACEBOOK_APP_ID || FACEBOOK_APP_ID || "";
}

function initGoogleButton() {
  const holder = document.getElementById("google-signin-btn");
  if (!holder) return;
  const clientId = currentGoogleClientId();

  if (!clientId) {
    holder.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-social";
    btn.textContent = "Continue with Google";
    btn.addEventListener("click", () =>
      showSocialError("Google sign-in isn't set up yet — add a Google Client ID in Admin → Settings.")
    );
    holder.appendChild(btn);
    return;
  }

  holder.innerHTML = "";
  const render = () => {
    if (!window.google || !window.google.accounts) return setTimeout(render, 200);
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const res = await api("/auth/google", {
            method: "POST",
            auth: false,
            body: JSON.stringify({ credential: response.credential }),
          });
          handleOauthSuccess(res);
        } catch (err) {
          showSocialError(err.message || "Google sign-in failed.");
        }
      },
    });
    google.accounts.id.renderButton(holder, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      width: 320,
    });
  };
  render();
}

function initFacebookButton() {
  const btn = document.getElementById("facebook-signin-btn");
  if (!btn) return;
  const appId = currentFacebookAppId();

  // Replace the button node each time so we don't stack duplicate listeners
  // if this runs again after settings load.
  const freshBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(freshBtn, btn);

  if (!appId) {
    freshBtn.addEventListener("click", () =>
      showSocialError("Facebook sign-in isn't set up yet — add a Facebook App ID in Admin → Settings.")
    );
    return;
  }

  if (!window.fbAsyncInit) {
    window.fbAsyncInit = function () {
      FB.init({ appId: currentFacebookAppId(), cookie: true, xfbml: false, version: "v19.0" });
    };
    (function loadFbSdk(d, s, id) {
      if (d.getElementById(id)) return;
      const js = d.createElement(s);
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      d.body.appendChild(js);
    })(document, "script", "facebook-jssdk");
  } else if (window.FB) {
    FB.init({ appId, cookie: true, xfbml: false, version: "v19.0" });
  }

  freshBtn.addEventListener("click", () => {
    if (!window.FB) return showSocialError("Facebook is still loading — try again in a moment.");
    FB.login(
      async (response) => {
        if (!response.authResponse) return; // user cancelled
        try {
          const res = await api("/auth/facebook", {
            method: "POST",
            auth: false,
            body: JSON.stringify({ accessToken: response.authResponse.accessToken }),
          });
          handleOauthSuccess(res);
        } catch (err) {
          showSocialError(err.message || "Facebook sign-in failed.");
        }
      },
      { scope: "public_profile,email" }
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initGoogleButton();
  initFacebookButton();
});

// If Admin → Settings supplied client IDs after this ran (loadPublicSettings()
// in main.js resolves asynchronously), re-render the buttons with real ones.
document.addEventListener("webore:settings-loaded", () => {
  initGoogleButton();
  initFacebookButton();
});

/** Redirect helper used on dashboard.html / admin.html */
async function requireRole(role) {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return null;
  }
  const user = await loadCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  if (role && user.role !== role) {
    window.location.href = user.role === "admin" ? "admin.html" : "dashboard.html";
    return null;
  }
  return user;
}
