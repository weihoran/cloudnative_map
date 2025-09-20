const state = {
      practices: null,
      qas: null,
      tools: null,
      layers: null,
      qasByIndex: new Map(),
      toolsByIndex: new Map(),
    };

    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const layersContainer = document.getElementById('layers');

    async function loadData() {
      try {
        const [practicesRes, qasRes, toolsRes, layersRes] = await Promise.all([
          fetch('practices.json'),
          fetch('practice_QAs.json'),
          fetch('tools.json'),
          fetch('layers.json')
        ]);

        const responses = [practicesRes, qasRes, toolsRes, layersRes];
        responses.forEach((res, idx) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch resource #${idx + 1}: ${res.status}`);
          }
        });

        const [practices, qas, tools, layers] = await Promise.all(responses.map(res => res.json()));

        state.practices = practices;
        state.qas = qas;
        state.tools = tools;
        state.layers = layers;

        buildIndices();
        renderStats();
        renderLayers();

        loadingEl.style.display = 'none';
      } catch (err) {
        console.error(err);
        loadingEl.style.display = 'none';
        errorEl.hidden = false;
        errorEl.innerHTML = `<strong>We hit a snag.</strong><br/>${err.message}`;
      }
    }

    function buildIndices() {
      // Map sub-practice index to QA details
      for (const practiceKey of Object.keys(state.qas)) {
        const practiceEntry = state.qas[practiceKey];
        if (!practiceEntry || !practiceEntry.qas) continue;
        for (const [subName, details] of Object.entries(practiceEntry.qas)) {
          if (!details || !details.index) continue;
          state.qasByIndex.set(details.index, {
            name: subName,
            qas: details.QAs || {}
          });
        }
      }

      // Map sub-practice index to tools list
      state.tools.forEach(entry => {
        if (!entry || !entry.index) return;
        state.toolsByIndex.set(entry.index, entry.tools || []);
      });
    }

    function renderStats() {
      const hpCount = Object.keys(state.practices).length;
      let subCount = 0;
      const qaNames = new Set();
      const toolNames = new Set();

      Object.values(state.practices).forEach(practice => {
        if (!practice.sub_practices) return;
        practice.sub_practices.forEach(sub => {
          subCount += 1;
          const qaEntry = state.qasByIndex.get(sub.index);
          if (qaEntry && qaEntry.qas) {
            Object.keys(qaEntry.qas).forEach(name => qaNames.add(name));
          }
          const tools = state.toolsByIndex.get(sub.index) || [];
          tools.forEach(tool => toolNames.add(tool.name));
        });
      });

      document.getElementById('hp-count').textContent = hpCount;
      document.getElementById('subpractice-count').textContent = subCount;
      document.getElementById('tool-count').textContent = toolNames.size;
      document.getElementById('qa-count').textContent = qaNames.size;
    }

    function renderLayers() {
      layersContainer.innerHTML = '';
      state.layers.forEach(layer => {
        const section = document.createElement('section');
        section.className = 'layers-section';
        const heading = document.createElement('h2');
        heading.textContent = layer.layer;
        section.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'hp-grid';

        layer.practices.forEach(practiceMeta => {
          const hpCard = document.createElement('div');
          hpCard.className = 'hp-card';
          hpCard.dataset.hpId = practiceMeta.id;
          hpCard.setAttribute('tabindex', '0');

          const cardButton = document.createElement('button');
          cardButton.className = 'hp-toggle';
          cardButton.type = 'button';

          const title = document.createElement('h3');
          title.className = 'hp-title';
          title.textContent = practiceMeta.name;

          const subCount = state.practices[practiceMeta.id]?.sub_practices?.length || 0;
          const meta = document.createElement('div');
          meta.className = 'hp-meta';
          meta.textContent = `${subCount} sub-practice${subCount !== 1 ? 's' : ''}`;

          cardButton.appendChild(title);
          cardButton.appendChild(meta);

          cardButton.addEventListener('click', event => {
            event.stopPropagation();
            toggleSubPractices(hpCard, practiceMeta.id);
          });

          hpCard.addEventListener('keypress', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleSubPractices(hpCard, practiceMeta.id);
            }
          });

          hpCard.appendChild(cardButton);
          grid.appendChild(hpCard);
        });

        section.appendChild(grid);
        layersContainer.appendChild(section);
      });
    }

    function toggleSubPractices(cardEl, hpId) {
      const existing = cardEl.querySelector('.subpractice-list');
      const allLists = layersContainer.querySelectorAll('.subpractice-list');
      if (existing) {
        existing.remove();
        cardEl.classList.remove('expanded');
        return;
      }

      allLists.forEach(list => list.remove());
      layersContainer.querySelectorAll('.hp-card.expanded').forEach(card => card.classList.remove('expanded'));

      const subList = document.createElement('div');
      subList.className = 'subpractice-list';

      const practice = state.practices[hpId];
      if (!practice || !practice.sub_practices) {
        const empty = document.createElement('p');
        empty.textContent = 'No sub-practices documented yet.';
        empty.className = 'sub-desc';
        subList.appendChild(empty);
      } else {
        practice.sub_practices.forEach(sub => {
          const subItem = document.createElement('div');
          subItem.className = 'sub-item';

          const button = document.createElement('button');
          button.type = 'button';
          button.addEventListener('click', event => {
            event.stopPropagation();
            openSubPracticeModal(sub, practice.name);
          });

          const headline = document.createElement('div');
          headline.className = 'sub-headline';

          const name = document.createElement('span');
          name.textContent = sub.name;

          headline.appendChild(name);

          const desc = document.createElement('p');
          desc.className = 'sub-desc';
          desc.textContent = sub.description || 'No description available yet.';

          button.appendChild(headline);
          button.appendChild(desc);
          subItem.appendChild(button);
          subList.appendChild(subItem);
        });
      }

      cardEl.appendChild(subList);
      cardEl.classList.add('expanded');
    }

    function openSubPracticeModal(sub, hpName) {
      const modal = document.getElementById('subpractice-modal');
      const titleEl = document.getElementById('modal-title');
      const descEl = document.getElementById('modal-description');
      const metaEl = document.getElementById('modal-meta');
      const qaSection = document.getElementById('modal-qas-section');
      const qaList = document.getElementById('modal-qas');
      const toolsSection = document.getElementById('modal-tools-section');
      const toolsList = document.getElementById('modal-tools');

      titleEl.textContent = sub.name;
      metaEl.textContent = hpName;
      descEl.textContent = sub.description || 'No description documented yet.';

      qaList.innerHTML = '';
      const qaData = state.qasByIndex.get(sub.index);
      const qas = qaData?.qas;
      if (qas && Object.keys(qas).length) {
        Object.entries(qas).forEach(([qaName, rationale]) => {
          const qaItem = document.createElement('div');
          qaItem.className = 'qa-item';

          const nameEl = document.createElement('div');
          nameEl.className = 'qa-name';
          nameEl.textContent = qaName;

          const rationaleEl = document.createElement('div');
          rationaleEl.className = 'qa-rationale';
          rationaleEl.textContent = rationale;

          qaItem.appendChild(nameEl);
          qaItem.appendChild(rationaleEl);
          qaList.appendChild(qaItem);
        });
        qaSection.style.display = '';
      } else {
        qaSection.style.display = 'none';
      }

      toolsList.innerHTML = '';
      const tools = state.toolsByIndex.get(sub.index) || [];
      if (tools.length) {
        tools.forEach(tool => {
          const item = document.createElement('div');
          item.className = 'tool-item';

          const link = document.createElement('a');
          link.href = tool.url || '#';
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = tool.name;

          const ref = document.createElement('div');
          ref.className = 'tool-ref';
          ref.textContent = tool.acm_reference || '';

          item.appendChild(link);
          if (tool.acm_reference) {
            item.appendChild(ref);
          }
          toolsList.appendChild(item);
        });
        toolsSection.style.display = '';
      } else {
        toolsSection.style.display = 'none';
      }

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      const modal = document.getElementById('subpractice-modal');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('subpractice-modal').addEventListener('click', event => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const modal = document.getElementById('subpractice-modal');
        if (modal.classList.contains('active')) {
          closeModal();
        }
      }
    });

    loadData();
