// Runs in <head> before first paint: mark JS available and apply the saved theme (avoids a flash).
document.documentElement.classList.add('js');
try {
  var savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.setAttribute('data-theme', savedTheme);
} catch (e) {}
