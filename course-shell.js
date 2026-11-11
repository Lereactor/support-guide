(() => {
  const STORAGE_KEY = 'support-guide-progress-v1';
  const file = location.pathname.split('/').pop() || 'index.html';
  const initialHash = decodeURIComponent(location.hash.slice(1));
  const courses = {
    'kubernetes_support_course_full_marked.html': { title: 'Kubernetes для поддержки', total: 15, next: 'java_kubernetes_support_threads_memory_gc_hikari_course.html', nextTitle: 'Следующий: Java' },
    'java_kubernetes_support_threads_memory_gc_hikari_course.html': { title: 'Java в Kubernetes', total: 15, next: 'postgresql.html', nextTitle: 'Следующий: PostgreSQL' },
    'postgresql.html': { title: 'PostgreSQL для поддержки', total: 12, next: 'prometheus_grafana_metrics_support_course_v12.html', nextTitle: 'Следующий: Метрики' },
    'prometheus_grafana_metrics_support_course_v12.html': { title: 'Prometheus и Grafana', total: 24, next: 'integration_systems_course.html', nextTitle: 'Следующий: Интеграции' },
    'integration_systems_course.html': { title: 'Интеграции систем', total: 15, next: 'soft_skills.pdf', nextTitle: 'Далее: Soft skills' },
    'knowledge_navigator_mobile.html': { title: 'Навигатор дополнительных ресурсов' }
  };
  const course = courses[file];
  if (!course) return;

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function visitedSections() {
    const saved = readProgress()[file];
    return new Set(Array.isArray(saved?.visited) ? saved.visited : []);
  }

  function recordVisit(id) {
    if (!course.total || !document.getElementById(id)) return;
    const progress = readProgress();
    const visited = visitedSections();
    visited.add(id);
    progress[file] = { visited: [...visited], last: id, updatedAt: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      return;
    }
    updateProgress();
  }

  function updateProgress() {
    if (!course.total) return;
    const count = Math.min(visitedSections().size, course.total);
    const percent = Math.round(count / course.total * 100);
    const label = document.querySelector('.portal-progress-label');
    const bar = document.querySelector('.portal-progress-track span');
    if (label) label.textContent = `${count}/${course.total} · ${percent}%`;
    if (bar) bar.style.width = `${percent}%`;
  }

  function buildNavigation() {
    const bar = document.createElement('nav');
    bar.className = 'portal-bar';
    bar.setAttribute('aria-label', 'Навигация по базе знаний');

    const home = document.createElement('a');
    home.className = 'portal-home';
    home.href = 'index.html';
    const homeLabel = document.createElement('span');
    homeLabel.className = 'portal-home-label';
    homeLabel.textContent = 'Все курсы';
    home.append(homeLabel);

    const current = document.createElement('span');
    current.className = 'portal-current';
    current.textContent = course.title;
    bar.append(home, current);

    if (course.total) {
      const progress = document.createElement('div');
      progress.className = 'portal-progress';
      progress.title = 'Количество открытых разделов курса';
      const label = document.createElement('span');
      label.className = 'portal-progress-label';
      const track = document.createElement('span');
      track.className = 'portal-progress-track';
      track.setAttribute('aria-hidden', 'true');
      track.append(document.createElement('span'));
      progress.append(label, track);
      bar.append(progress);
    }

    if (course.next) {
      const next = document.createElement('a');
      next.className = 'portal-next';
      next.href = course.next;
      next.textContent = course.nextTitle;
      if (course.next.endsWith('.pdf')) {
        next.target = '_blank';
        next.rel = 'noopener';
      }
      bar.append(next);
    }
    document.body.prepend(bar);
    updateProgress();
  }

  function setupMobileMenus() {
    document.querySelectorAll('.mobile-toggle').forEach((button, index) => {
      const aside = document.querySelector('.layout > aside');
      if (aside) {
        if (!aside.id) aside.id = `course-menu-${index}`;
        button.setAttribute('aria-controls', aside.id);
      }
      button.setAttribute('aria-expanded', 'false');
      button.removeAttribute('onclick');
      button.addEventListener('click', () => {
        const open = document.body.classList.toggle('menu-open');
        button.setAttribute('aria-expanded', String(open));
      });
    });
  }

  const originalShow = window.show;
  if (typeof originalShow === 'function') {
    window.show = function(id) {
      const result = originalShow.call(this, id);
      const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      document.querySelectorAll('.mobile-toggle').forEach(button => button.setAttribute('aria-expanded', 'false'));
      if (document.getElementById(safeId)) {
        recordVisit(safeId);
        try {
          history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(safeId)}`);
        } catch {
          location.hash = safeId;
        }
      }
      return result;
    };
  }

  window.addEventListener('DOMContentLoaded', () => {
    buildNavigation();
    setupMobileMenus();
    if (initialHash && document.getElementById(initialHash)) {
      if (typeof window.show === 'function') {
        window.show(initialHash);
        window.setTimeout(() => window.scrollTo(0, 0), 0);
      }
    } else {
      const active = document.querySelector('.page.active');
      if (active) recordVisit(active.id);
    }
  });

  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && document.getElementById(id) && typeof window.show === 'function') {
      window.show(id);
      window.setTimeout(() => window.scrollTo(0, 0), 0);
    }
  });
})();
