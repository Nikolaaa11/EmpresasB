// Aplica el tema guardado antes de pintar la página (evita parpadeo).
try {
  const t = localStorage.getItem("tema");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) { /* sin almacenamiento: se usa el tema del sistema */ }
