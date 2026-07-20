// js/transition.js
// Handles tab page loading transitions and cookie consent policies.

document.addEventListener("DOMContentLoaded", () => {
  // 1. Page transition loader fade-out on initial load
  const loader = document.getElementById("page-transition-loader");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("fade-out");
    }, 450); // fast loader fade out
  }

  // 2. Intercept tab clicks for a smooth transition animation
  const navLinks = document.querySelectorAll('a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    const target = link.getAttribute('target');
    
    // Check if it's a relative link to another page on the site
    if (href && 
        !href.startsWith('http') && 
        !href.startsWith('mailto') && 
        !href.startsWith('tel') && 
        !href.startsWith('#') && 
        !href.startsWith('javascript:') &&
        !link.hasAttribute('onclick') &&
        target !== '_blank' &&
        !link.classList.contains('no-transition')) {
      
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (loader) {
          loader.classList.remove("fade-out");
        }
        setTimeout(() => {
          window.location.href = href;
        }, 550); // redirect after transition animation runs
      });
    }
  });

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
