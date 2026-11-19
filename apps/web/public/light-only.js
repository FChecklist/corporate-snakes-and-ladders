/* The older app pages (sign-in, payment, report, Help Desk, referral) are drawn in light colours only: this keeps the page light even when the visitor chose Dark on another page. Load right after theme-init.js. */
document.documentElement.setAttribute("data-mode", "light");
