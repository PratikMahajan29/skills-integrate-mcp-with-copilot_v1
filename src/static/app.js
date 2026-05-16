document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authContainer = document.getElementById("auth-container");
  const userInfoSection = document.getElementById("user-info");
  const logoutButton = document.getElementById("logout-btn");
  const userEmailElem = document.getElementById("user-email");
  const userBranchElem = document.getElementById("user-branch");
  const activitiesContainer = document.getElementById("activities-container");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");

  const authTokenKey = "mergington_auth_token";
  let authToken = localStorage.getItem(authTokenKey);
  let currentUser = null;

  function show(element, visible) {
    if (visible) {
      element.classList.remove("hidden");
    } else {
      element.classList.add("hidden");
    }
  }

  function setMessage(message, type = "info") {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    window.clearTimeout(messageDiv.dismissTimer);
    messageDiv.dismissTimer = window.setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function clearUserState() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem(authTokenKey);
    userEmailElem.textContent = "";
    userBranchElem.textContent = "";
    show(userInfoSection, false);
    show(activitiesContainer, false);
    show(signupContainer, false);
    show(authContainer, true);
  }

  function setUserState(user, token) {
    authToken = token;
    currentUser = user;
    localStorage.setItem(authTokenKey, token);
    userEmailElem.textContent = user.email;
    userBranchElem.textContent = user.branch;
    show(authContainer, false);
    show(userInfoSection, true);
    show(activitiesContainer, true);
    show(signupContainer, true);
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=\"\">-- Select an activity --</option>";

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function loadCurrentUser() {
    if (!authToken) {
      clearUserState();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        clearUserState();
        return;
      }

      const user = await response.json();
      setUserState(user, authToken);
    } catch (error) {
      console.error("Error loading current user:", error);
      clearUserState();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.detail || "Login failed", "error");
        return;
      }

      setUserState({ email: result.email, branch: result.branch }, result.token);
      setMessage(result.message, "success");
      await fetchActivities();
      event.target.reset();
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to login. Please try again.", "error");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();
    const branch = document.getElementById("register-branch").value;

    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, branch }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.detail || "Registration failed", "error");
        return;
      }

      setUserState({ email: result.email, branch: result.branch }, result.token);
      setMessage(result.message, "success");
      await fetchActivities();
      event.target.reset();
    } catch (error) {
      console.error("Registration error:", error);
      setMessage("Unable to register. Please try again.", "error");
    }
  }

  async function handleSignup(event) {
    event.preventDefault();

    if (!currentUser) {
      setMessage("Please log in before signing up for an activity.", "error");
      return;
    }

    const activity = activitySelect.value;
    if (!activity) {
      setMessage("Please choose an activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(
          currentUser.email
        )}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.detail || "Failed to sign up", "error");
        return;
      }

      setMessage(result.message, "success");
      await fetchActivities();
      signupForm.reset();
    } catch (error) {
      console.error("Signup error:", error);
      setMessage("Unable to sign up. Please try again.", "error");
    }
  }

  async function handleUnregister(event) {
    event.preventDefault();

    if (!currentUser) {
      setMessage("Please log in before unregistering.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(
          currentUser.email
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.detail || "Unable to unregister", "error");
        return;
      }

      setMessage(result.message, "success");
      await fetchActivities();
    } catch (error) {
      console.error("Unregister error:", error);
      setMessage("Unable to unregister. Please try again.", "error");
    }
  }

  async function handleLogout() {
    if (!authToken) {
      clearUserState();
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    clearUserState();
    setMessage("You have been logged out.", "info");
  }

  loginForm.addEventListener("submit", handleLogin);
  registerForm.addEventListener("submit", handleRegister);
  signupForm.addEventListener("submit", handleSignup);
  logoutButton.addEventListener("click", handleLogout);

  loadCurrentUser().then(() => fetchActivities());
});
