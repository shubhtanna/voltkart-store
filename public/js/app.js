// Submit filter checkboxes immediately for quicker browsing.
document.querySelectorAll('.filters input').forEach(function (el) {
  el.addEventListener('change', function () { el.form.submit(); });
});

// Collapse filters on small screens.
if (window.innerWidth < 1000) document.querySelectorAll('.fbox').forEach(function (d) { d.open = false; });
