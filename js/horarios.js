/* ============================================================================
   horarios.js — módulo de horarios y promos de los parques
============================================================================ */

const PREDEFINED_PARKS_HORARIOS = [
  {
    name: 'Atlantis',
    icon: '🌊',
    color: '#0077BE',
    banner: 'img/parks/atlantis.jpg',
    homeUrl: 'https://www.atlantisaquarium-madrid.es',
    scheduleUrl: 'https://www.atlantisaquarium-madrid.es/precios-y-horarios/horarios-de-apertura'
  },
  {
    name: 'Aquopolis CAR',
    icon: '🏊',
    color: '#00BFFF',
    banner: 'img/parks/aquopolis-car.jpg',
    homeUrl: 'https://cartaya.aquopolis.es',
    scheduleUrl: 'https://cartaya.aquopolis.es/horarios-y-precios/horarios'
  },
  {
    name: 'Aquopolis CDA',
    icon: '🏊',
    color: '#00BFFF',
    banner: 'img/parks/aquopolis-cda.jpg',
    homeUrl: 'https://costa-dorada.aquopolis.es',
    scheduleUrl: 'https://costa-dorada.aquopolis.es/precios-y-horarios/horarios-de-apertura'
  },
  {
    name: 'Aquopolis CULL',
    icon: '🏊',
    color: '#00BFFF',
    banner: 'img/parks/aquopolis-cull.jpg',
    homeUrl: 'https://cullera.aquopolis.es',
    scheduleUrl: 'https://cullera.aquopolis.es/horarios-y-precios/horarios'
  },
  {
    name: 'Aquopolis TOR',
    icon: '🏊',
    color: '#00BFFF',
    banner: 'img/parks/aquopolis-tor.jpg',
    homeUrl: 'https://torrevieja.aquopolis.es',
    scheduleUrl: 'https://torrevieja.aquopolis.es/horarios-y-precios/horarios'
  },
  {
    name: 'Aquopolis VILL',
    icon: '🏊',
    color: '#00BFFF',
    banner: 'img/parks/aquopolis-vill.jpg',
    homeUrl: 'https://villanueva.aquopolis.es',
    scheduleUrl: 'https://villanueva.aquopolis.es/horarios-y-precios/horarios'
  },
  {
    name: 'Faunia',
    icon: '🦜',
    color: '#4CAF50',
    banner: 'img/parks/faunia.jpg',
    homeUrl: 'https://www.faunia.es',
    scheduleUrl: 'https://www.faunia.es/horarios-y-precios/horarios'
  },
  {
    name: 'PAM',
    icon: '🎪',
    color: '#FF5722',
    banner: 'img/parks/pam.jpg',
    homeUrl: 'https://www.parquedeatracciones.es',
    scheduleUrl: 'https://www.parquedeatracciones.es/horarios-y-precios/horarios'
  },
  {
    name: 'Selwo Aventura',
    icon: '🦁',
    color: '#795548',
    banner: 'img/parks/selwo-aventura.jpg',
    homeUrl: 'https://www.selwo.es',
    scheduleUrl: 'https://www.selwo.es/horarios-y-precios/horarios'
  },
  {
    name: 'Selwo Marina',
    icon: '🐬',
    color: '#2196F3',
    banner: 'img/parks/selwo-marina.jpg',
    homeUrl: 'https://www.selwomarina.es',
    scheduleUrl: 'https://www.selwomarina.es/horarios-y-precios/horarios'
  },
  {
    name: 'Teleférico Benalmádena',
    icon: '🚠',
    color: '#9C27B0',
    banner: 'img/parks/teleferico-benalmadena.jpg',
    homeUrl: 'https://www.telefericobenalmadena.com',
    scheduleUrl: 'https://www.telefericobenalmadena.com/horarios-y-precios/horarios'
  },
  {
    name: 'Warner',
    icon: '🎬',
    color: '#004F9F',
    banner: 'img/parks/warner.jpg',
    homeUrl: 'https://www.parquewarner.com',
    scheduleUrl: 'https://www.parquewarner.com/horarios-y-precios/horarios'
  },
  {
    name: 'Warner Beach',
    icon: '🏖️',
    color: '#FF9800',
    banner: 'img/parks/warner-beach.jpg',
    homeUrl: 'https://parquewarnerbeach.parquewarner.com',
    scheduleUrl: 'https://parquewarnerbeach.parquewarner.com/horarios-y-precios/horarios'
  },
  {
    name: 'ZOO',
    icon: '🐘',
    color: '#3E2723',
    banner: 'img/parks/zoo.jpg',
    homeUrl: 'https://www.zoomadrid.com',
    scheduleUrl: 'https://www.zoomadrid.com/horarios-y-precios/horarios'
  }
];

function initHorarios() {
  renderHorariosPage();
}

function renderHorariosPage() {
  renderParksCards();
}

function renderParksCards() {
  const container = document.getElementById('horarios-parks-container');
  if (!container) return;

  // Get active parks from STATE (parques that exist and are active)
  const activeParkNames = (STATE.parques || [])
    .filter(p => p.activo !== false)
    .map(p => p.nombre.toLowerCase().trim());

  const visibleParks = PREDEFINED_PARKS_HORARIOS.filter(park =>
    activeParkNames.includes(park.name.toLowerCase().trim())
  );

  if (!visibleParks.length) {
    container.innerHTML = `<div class="empty-state">No hay parques activos. Crea y activa parques en la sección "Parques / Bonos" para ver sus horarios.</div>`;
    return;
  }

  container.innerHTML = visibleParks.map(park => {
    const hasBanner = !!park.banner;
    return `
      <div class="park-card">
        <div class="park-card-header${hasBanner ? ' has-banner' : ''}" style="background: linear-gradient(135deg, ${park.color}, ${adjustColor(park.color, -30)});">
          ${hasBanner ? `<img class="park-card-banner-img" src="${escapeHtml(park.banner)}" alt="${escapeHtml(park.name)}" loading="lazy" onerror="this.remove(); this.closest('.park-card-header').classList.remove('has-banner');">` : ''}
          <span class="park-card-icon">${park.icon}</span>
          <h3 class="park-card-name">${escapeHtml(park.name)}</h3>
          ${hasBanner ? `<div class="park-card-overlay-name">${escapeHtml(park.name)}</div>` : ''}
        </div>
        <div class="park-card-actions">
          <a href="${escapeHtml(park.homeUrl)}" target="_blank" class="park-action-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            Página Principal
          </a>
          <a href="${escapeHtml(park.scheduleUrl)}" target="_blank" class="park-action-btn primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Horarios Oficiales
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}