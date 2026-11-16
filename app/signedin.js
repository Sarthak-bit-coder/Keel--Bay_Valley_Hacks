// Shows "My account" instead of "Log in / Sign up" in the header when someone is using My pay in this browser.
try { if (window.localStorage.getItem("keel-mypay-mode")) document.documentElement.classList.add("signed-in"); } catch (e) { /* storage blocked */ }
