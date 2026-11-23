export function mountNavigation() {
  let navigationFrame = false;
  function updateNavigation() {
    const links = [...document.querySelectorAll('.sidebar .nav')];
    let active = links[0];
    for (const link of links) {
      const section = document.getElementById(link.hash.slice(1));
      if (section && section.getBoundingClientRect().top <= 160) active = link;
    }
    for (const link of links) {
      link.classList.toggle('active', link === active);
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener(
    'scroll',
    () => {
      if (navigationFrame) return;
      navigationFrame = true;
      requestAnimationFrame(() => {
        updateNavigation();
        navigationFrame = false;
      });
    },
    { passive: true },
  );

  updateNavigation();
}
