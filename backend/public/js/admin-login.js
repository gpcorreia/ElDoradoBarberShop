const form = document.querySelector("#admin-login-form");
const errorElement = document.querySelector("#login-error");

async function verifyExistingSession() {
  const response = await fetch("/api/admin/session", { headers: { Accept: "application/json" } });
  if (response.ok) window.location.replace("/admin");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  const data = Object.fromEntries(new FormData(form));
  button.disabled = true;
  errorElement.classList.add("hidden");
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.authenticated) throw new Error(result.message || "Não foi possível iniciar sessão.");
    window.location.replace("/admin");
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.classList.remove("hidden");
    button.disabled = false;
  }
});

verifyExistingSession().catch(() => {});
