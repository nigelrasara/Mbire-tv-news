// js/transition.js
// Handles tab page loading transitions and cookie consent policies.

document.addEventListener("DOMContentLoaded", () => {
  // Page transition animations completely removed for instant response.


  // 3. Dynamic Cookie Consent Banner Injection
  if (!localStorage.getItem("cookieConsentAccepted")) {
    const banner = document.createElement("div");
    banner.id = "cookie-consent-banner";
    banner.className = "cookie-consent-banner";
    banner.innerHTML = `
      <div class="cookie-content">
        <p>🍪 We use cookies to enhance your experience, serve personalized ads, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. Read our <a href="cookie.html">Cookie Policy</a>.</p>
        <div class="cookie-buttons">
          <button id="accept-cookies-btn" class="btn btn-primary btn-sm">Accept All</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    // Accept Button Handler
    const acceptBtn = document.getElementById("accept-cookies-btn");
    if (acceptBtn) {
      acceptBtn.addEventListener("click", () => {
        localStorage.setItem("cookieConsentAccepted", "true");
        banner.classList.add("cookie-hidden");
        setTimeout(() => banner.remove(), 400);
      });
    }
  }
});
