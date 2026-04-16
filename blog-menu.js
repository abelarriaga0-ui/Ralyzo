const BLOG_POSTS = [
  {
    href: "/blog/como-comprimir-imagen.html",
    title: "Cómo comprimir una imagen"
  },
  {
    href: "/blog/jpg-vs-png.html",
    title: "JPG vs PNG"
  },
  {
    href: "/blog/optimizar-imagenes-web.html",
    title: "Optimizar imágenes para web"
  },
  {
    href: "/blog/formatos-imagen.html",
    title: "Formatos de imagen"
  },
  {
    href: "/blog/reducir-peso-imagen.html",
    title: "Reducir peso de una imagen"
  },
  {
    href: "/blog/convertir-imagen.html",
    title: "Convertir imágenes"
  },
  {
    href: "/blog/redimensionar-imagen-sin-perder-calidad.html",
    title: "Redimensionar imagen sin perder calidad"
  },
  {
    href: "/blog/que-formato-imagen-usar.html",
    title: "Qué formato de imagen usar"
  },
  {
    href: "/blog/errores-optimizar-imagenes.html",
    title: "Errores al optimizar imágenes"
  },
  {
  href: "/blog/errores-al-subir-imagenes-web.html",
  title: "Errores al subir imágenes a una web"
  }
];

function createBlogDropdownHTML() {
  const links = BLOG_POSTS.map(post => {
    return `<a href="${post.href}">${post.title}</a>`;
  }).join("");

  return `
    <button class="dropdown-toggle" aria-label="Abrir menú del blog" type="button">
      Blog
      <span>▾</span>
    </button>

    <div class="dropdown-menu" role="menu">
      <a href="/blog/index.html">Ver todos los artículos</a>
      ${links}
    </div>
  `;
}

function renderBlogMenus() {
  const containers = document.querySelectorAll(".js-blog-dropdown");

  containers.forEach(container => {
    container.classList.add("dropdown");
    container.innerHTML = createBlogDropdownHTML();
  });
}

document.addEventListener("DOMContentLoaded", renderBlogMenus);
