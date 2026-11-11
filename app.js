(() => {
  const STORAGE_KEY = 'support-guide-progress-v1';
  const searchInput = document.getElementById('global-search');
  const resultsContainer = document.getElementById('search-results');
  const searchStatus = document.getElementById('search-status');
  const clearButton = document.getElementById('clear-search');
  let searchIndex = [];
  let indexPromise;

  function readProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function updateCourseProgress() {
    const progress = readProgress();
    document.querySelectorAll('[data-course]').forEach(card => {
      const course = card.dataset.course;
      const total = Number(card.dataset.total);
      const visited = Array.isArray(progress[course]?.visited) ? new Set(progress[course].visited) : new Set();
      const count = Math.min(visited.size, total);
      const percent = total ? Math.round(count / total * 100) : 0;
      const label = card.querySelector('[data-progress-label]');
      const percentLabel = card.querySelector('[data-progress-percent]');
      const bar = card.querySelector('[data-progress-bar]');
      const openLabel = card.querySelector('[data-open-label]');
      const link = card.querySelector('.course-link');
      if (label) label.textContent = count ? `Просмотрено: ${count} из ${total}` : 'Не начат';
      if (percentLabel) percentLabel.textContent = `${percent}%`;
      if (bar) bar.style.width = `${percent}%`;
      if (openLabel) openLabel.textContent = count ? 'Продолжить' : 'Открыть курс';
      if (count && progress[course]?.last && link) link.href = `${course}#${encodeURIComponent(progress[course].last)}`;
    });
  }

  document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      let visible = 0;
      document.querySelectorAll('.course-card[data-category]').forEach(card => {
        const show = filter === 'all' || card.dataset.category.split(' ').includes(filter);
        card.hidden = !show;
        if (show) visible += 1;
      });
      document.getElementById('filter-empty').hidden = visible > 0;
    });
  });

  function focusSearch() {
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => searchInput.focus(), 250);
  }

  document.querySelectorAll('[data-focus-search]').forEach(button => button.addEventListener('click', focusSearch));
  document.querySelectorAll('[data-query]').forEach(button => {
    button.addEventListener('click', () => {
      searchInput.value = button.dataset.query;
      runSearch();
      searchInput.focus();
    });
  });

  document.addEventListener('keydown', event => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (event.key === '/' && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      focusSearch();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      clearSearch();
      searchInput.blur();
    }
  });

  function normalize(value) {
    return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('search-index.json')
        .then(response => {
          if (!response.ok) throw new Error(`Search index: ${response.status}`);
          return response.json();
        })
        .then(data => {
          searchIndex = data.map(item => ({ ...item, normalized: normalize(`${item.course} ${item.title} ${item.text}`) }));
          return searchIndex;
        });
    }
    return indexPromise;
  }

  function appendHighlighted(parent, text, query) {
    const normalizedText = normalize(text);
    const start = normalizedText.indexOf(query);
    if (start < 0) {
      parent.textContent = text;
      return;
    }
    parent.append(document.createTextNode(text.slice(0, start)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, start + query.length);
    parent.append(mark, document.createTextNode(text.slice(start + query.length)));
  }

  function snippetFor(item, query) {
    const text = item.text.replace(/\s+/g, ' ').trim();
    const position = normalize(text).indexOf(query);
    if (position < 0) return text.slice(0, 190);
    const start = Math.max(0, position - 70);
    const end = Math.min(text.length, position + query.length + 120);
    return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
  }

  function renderResults(matches, query) {
    resultsContainer.replaceChildren();
    matches.slice(0, 12).forEach(item => {
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = `${item.file}#${encodeURIComponent(item.id)}`;

      const course = document.createElement('span');
      course.className = 'result-course';
      course.textContent = item.shortTitle;

      const body = document.createElement('span');
      body.className = 'result-body';
      const title = document.createElement('strong');
      appendHighlighted(title, item.title, query);
      const snippet = document.createElement('span');
      appendHighlighted(snippet, snippetFor(item, query), query);
      body.append(title, snippet);

      const arrow = document.createElement('span');
      arrow.className = 'result-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      link.append(course, body, arrow);
      resultsContainer.append(link);
    });
  }

  async function runSearch() {
    const query = normalize(searchInput.value);
    clearButton.hidden = !searchInput.value;
    if (!query) {
      resultsContainer.replaceChildren();
      searchStatus.textContent = '';
      return;
    }
    if (query.length < 2) {
      resultsContainer.replaceChildren();
      searchStatus.textContent = 'Введите хотя бы два символа.';
      return;
    }
    searchStatus.textContent = 'Ищем по всем курсам…';
    try {
      await loadIndex();
      if (query !== normalize(searchInput.value)) return;
      const terms = query.split(' ').filter(Boolean);
      const matches = searchIndex
        .filter(item => terms.every(term => item.normalized.includes(term)))
        .map(item => {
          const title = normalize(item.title);
          let score = title.includes(query) ? 10 : 0;
          if (title.startsWith(query)) score += 5;
          if (normalize(item.course).includes(query)) score += 3;
          if (item.id === 'home') score -= 2;
          return { ...item, score };
        })
        .sort((a, b) => b.score - a.score || a.course.localeCompare(b.course, 'ru'));
      searchStatus.textContent = matches.length
        ? `Найдено разделов: ${matches.length}${matches.length > 12 ? '. Показаны первые 12.' : ''}`
        : 'Ничего не найдено. Попробуйте более короткий запрос или другое написание термина.';
      renderResults(matches, query);
    } catch (error) {
      console.error(error);
      searchStatus.textContent = 'Поиск временно недоступен. Откройте нужный курс ниже — внутри каждого курса есть собственный поиск.';
      resultsContainer.replaceChildren();
    }
  }

  let searchTimer;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 180);
  });
  searchInput.addEventListener('search', runSearch);
  clearButton.addEventListener('click', clearSearch);

  function clearSearch() {
    searchInput.value = '';
    resultsContainer.replaceChildren();
    searchStatus.textContent = '';
    clearButton.hidden = true;
    searchInput.focus();
  }

  updateCourseProgress();
})();
