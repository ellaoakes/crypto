// Mobile nav toggle
const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Waitlist form -> mailto (no backend yet; swap for a real form
// service such as Formspree or Netlify Forms once one is wired up)
const waitlistForm = document.getElementById("waitlist-form");
const waitlistSuccess = document.getElementById("waitlist-success");

if (waitlistForm) {
  waitlistForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = waitlistForm.name.value.trim();
    const email = waitlistForm.email.value.trim();
    const role = waitlistForm.role.value;

    if (!name || !email) {
      return;
    }

    const subject = encodeURIComponent("Kitty waitlist signup");
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nUsually the: ${role}`
    );

    window.location.href = `mailto:hello@kitty.trip?subject=${subject}&body=${body}`;

    waitlistForm.hidden = true;
    waitlistSuccess.hidden = false;
  });
}
