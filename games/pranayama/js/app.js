/**
 * Pranayama — static build (vanilla JS).
 * Sound paths: relative to data-asset-base on #pranayama-root or the page.
 */
(function () {
	'use strict';

	const ALL_STEPS = ['in', 'hold1', 'out', 'hold2'];

	/** @typedef {'in'|'hold1'|'out'|'hold2'} Step */

	/** @type {Record<Step, string>} */
	const LABELS = {
		in: 'Inhale',
		hold1: 'Hold',
		out: 'Exhale',
		hold2: 'Hold'
	};

	/** @type {Record<Step, string>} */
	const LABELS_FULL = {
		in: 'Inhale',
		hold1: 'Hold after inhale',
		out: 'Exhale',
		hold2: 'Hold after exhale'
	};

	const LS_KEY = 'pranayama-settings';

	const root = document.getElementById('pranayama-root');
	if (!root) return;

	/** @type {Record<Step, number>} */
	let values = { in: 6, hold1: 0, out: 6, hold2: 0 };
	let hue = 162;
	let soundEnabled = true;
	let cyclesLimit = 0;

	let playing = false;
	/** @type {Step|null} */
	let step = null;
	let currentCounter = 0;
	let cyclesCompleted = 0;
	/** @type {ReturnType<typeof setInterval>|null} */
	let intervalId = null;
	let settingsLoaded = false;

	const $ = (sel, el = root) => el.querySelector(sel);

	function assetUrl(relPath) {
		const base = (root.dataset.assetBase || '').trim();
		if (!base) return relPath;
		return base.replace(/\/?$/, '/') + relPath.replace(/^\//, '');
	}

	function getActiveSteps() {
		return ALL_STEPS.filter((s) => values[s] > 0);
	}

	function totalCycleSeconds() {
		return getActiveSteps().reduce((sum, s) => sum + values[s], 0);
	}

	function applyHueCss() {
		const h = hue;
		root.style.setProperty('--bg', `hsl(${h}, 48%, 74%)`);
		root.style.setProperty('--bg-dark', `hsl(${h}, 43%, 61%)`);
		root.style.setProperty('--surface', `hsl(${h}, 38%, 67%)`);
		root.style.setProperty('--accent', `hsl(${h}, 42%, 40%)`);
		root.style.setProperty('--accent-light', `hsl(${h}, 42%, 52%)`);
		root.style.setProperty('--text', `hsl(${h}, 55%, 16%)`);
		root.style.setProperty('--text-muted', `hsl(${h}, 32%, 30%)`);
		root.style.setProperty('--white-alpha', 'rgba(255,255,255,0.25)');
		const dot = $('#hue-dot');
		if (dot) dot.style.background = `hsl(${h}, 60%, 55%)`;
	}

	function saveSettings() {
		if (!settingsLoaded) return;
		try {
			localStorage.setItem(
				LS_KEY,
				JSON.stringify({ values, hue, soundEnabled, cyclesLimit })
			);
		} catch {
			// ignore
		}
	}

	function loadSettings() {
		try {
			const raw = localStorage.getItem(LS_KEY);
			if (!raw) return;
			const s = JSON.parse(raw);
			if (s.values && typeof s.values === 'object') {
				values = { ...values, ...s.values };
			}
			if (typeof s.hue === 'number') hue = s.hue;
			if (typeof s.soundEnabled === 'boolean') soundEnabled = s.soundEnabled;
			if (typeof s.cyclesLimit === 'number') cyclesLimit = s.cyclesLimit;
		} catch {
			// ignore
		}
	}

	/**
	 * @param {'phase'|'end'} type
	 */
	function playSound(type) {
		if (!soundEnabled) return;
		const name = type === 'end' ? 'sounds/done.mp3' : 'sounds/tick.wav';
		const audio = new Audio(assetUrl(name));
		audio.volume = 0.7;
		audio.play().catch(() => { });
	}

	function formatDuration(secs) {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		if (m === 0) return `${s} sec`;
		if (s === 0) return `${m} min`;
		return `${m} min ${s} sec`;
	}

	function circleScale() {
		if (!playing || !step) return 0.62;
		const elapsed = values[step] - currentCounter;
		const p = values[step] > 1 ? elapsed / (values[step] - 1) : 1;
		if (step === 'in') return 0.62 + 0.38 * p;
		if (step === 'hold1') return 1.0;
		if (step === 'out') return 1.0 - 0.38 * p;
		return 0.62;
	}

	function isHolding() {
		return playing && (step === 'hold1' || step === 'hold2');
	}

	function syncPhaseCards() {
		root.querySelectorAll('.phase-card').forEach((card) => {
			const raw = card.getAttribute('data-step');
			if (!raw || !ALL_STEPS.includes(/** @type {Step} */(raw))) return;
			const s = /** @type {Step} */ (raw);
			const v = values[s];
			card.classList.toggle('zero', v === 0);
			const valEl = card.querySelector('.phase-value');
			const subEl = card.querySelector('.phase-sub');
			const dec = card.querySelector('.phase-dec');
			if (valEl) valEl.textContent = String(v);
			if (subEl) subEl.textContent = v > 0 ? `${v} sec` : 'off';
			if (dec) dec.disabled = v === 0;
		});
	}

	function syncStats() {
		const active = getActiveSteps();
		const statsRow = $('#stats-row');
		const statsSep = $('#stats-sep');
		const statsTotal = $('#stats-total');
		const statsCycle = $('#stats-cycle');
		if (!statsRow || !statsSep || !statsTotal || !statsCycle) return;

		if (active.length === 0) {
			statsRow.hidden = true;
			return;
		}
		statsRow.hidden = false;
		const t = totalCycleSeconds();
		statsCycle.textContent = `1 cycle: ${t} sec`;
		if (cyclesLimit > 0) {
			statsSep.hidden = false;
			statsTotal.hidden = false;
			statsTotal.textContent = `Total: ${formatDuration(cyclesLimit * t)}`;
		} else {
			statsSep.hidden = true;
			statsTotal.hidden = true;
		}
	}

	function syncSettingsUi() {
		const hueSlider = /** @type {HTMLInputElement|null} */ ($('#hue-slider'));
		if (hueSlider) hueSlider.value = String(hue);
		const cyclesDisplay = $('#cycles-display');
		if (cyclesDisplay) cyclesDisplay.textContent = cyclesLimit === 0 ? '∞' : String(cyclesLimit);
		const soundToggle = $('#sound-toggle');
		if (soundToggle) {
			soundToggle.textContent = soundEnabled ? 'On' : 'Off';
			soundToggle.classList.toggle('on', soundEnabled);
		}
		applyHueCss();
	}

	function syncStartButton() {
		const btn = $('#btn-start');
		if (btn) btn.disabled = getActiveSteps().length === 0;
	}

	function renderSetup() {
		syncPhaseCards();
		syncStats();
		syncSettingsUi();
		syncStartButton();
		saveSettings();
	}

	function buildActiveStepsDom() {
		const container = $('#active-steps');
		if (!container) return;
		container.innerHTML = '';
		for (const s of getActiveSteps()) {
			const div = document.createElement('div');
			div.className = 'step-item';
			div.dataset.step = s;
			div.innerHTML = `
				<div class="step-dot"></div>
				<div class="step-name">${LABELS_FULL[s]}</div>
				<div class="step-val">${values[s]}</div>
			`;
			container.appendChild(div);
		}
	}

	function renderCyclePips() {
		const row = $('#cycles-row');
		const pips = $('#cycle-pips');
		const label = $('#cycles-label');
		if (!row || !pips || !label) return;
		if (cyclesLimit <= 0) {
			row.hidden = true;
			pips.innerHTML = '';
			return;
		}
		row.hidden = false;
		pips.innerHTML = '';
		for (let i = 0; i < cyclesLimit; i++) {
			const pip = document.createElement('div');
			pip.className = 'cycle-pip' + (i < cyclesCompleted ? ' done' : '');
			pips.appendChild(pip);
		}
		label.textContent = `${cyclesCompleted}/${cyclesLimit}`;
	}

	function updatePlayingUi() {
		const active = getActiveSteps();
		const breathCircle = $('#breath-circle');
		const breathLabel = $('#breath-label');
		const breathCounter = $('#breath-counter');
		if (breathCircle) {
			breathCircle.style.transform = `scale(${circleScale()})`;
			breathCircle.classList.toggle('holding', isHolding());
		}
		if (breathLabel && step) breathLabel.textContent = LABELS[step];
		if (breathCounter) breathCounter.textContent = String(currentCounter);

		active.forEach((s) => {
			const item = root.querySelector(`.step-item[data-step="${s}"]`);
			if (!item) return;
			item.classList.toggle('current', step === s);
			const valEl = item.querySelector('.step-val');
			if (valEl) valEl.textContent = String(s === step ? currentCounter : values[s]);
		});

		root.querySelectorAll('.cycle-pip').forEach((pip, i) => {
			pip.classList.toggle('done', i < cyclesCompleted);
		});
		const cyclesLabel = $('#cycles-label');
		if (cyclesLabel && cyclesLimit > 0) {
			cyclesLabel.textContent = `${cyclesCompleted}/${cyclesLimit}`;
		}
	}

	function showSetup() {
		$('#screen-setup')?.classList.add('is-active');
		$('#screen-playing')?.classList.remove('is-active');
	}

	function showPlaying() {
		$('#screen-playing')?.classList.add('is-active');
		$('#screen-setup')?.classList.remove('is-active');
	}

	function start() {
		const active = getActiveSteps();
		if (active.length === 0) return;
		playing = true;
		step = active[0];
		currentCounter = values[step];
		cyclesCompleted = 0;
		playSound('phase');
		buildActiveStepsDom();
		renderCyclePips();
		updatePlayingUi();
		showPlaying();
		if (intervalId != null) clearInterval(intervalId);
		intervalId = setInterval(tick, 1000);
	}

	function stop() {
		playing = false;
		step = null;
		currentCounter = 0;
		cyclesCompleted = 0;
		if (intervalId != null) {
			clearInterval(intervalId);
			intervalId = null;
		}
		showSetup();
		renderSetup();
	}

	function tick() {
		currentCounter--;
		if (currentCounter <= 0) {
			const active = getActiveSteps();
			const curIdx = active.indexOf(/** @type {Step} */(step));
			const nextIdx = (curIdx + 1) % active.length;
			const isEndOfCycle = nextIdx === 0;

			if (isEndOfCycle) {
				cyclesCompleted++;
				if (cyclesLimit > 0 && cyclesCompleted >= cyclesLimit) {
					playSound('end');
					stop();
					return;
				}
			}

			step = active[nextIdx];
			currentCounter = values[step];
			playSound('phase');
		}
		updatePlayingUi();
	}

	// --- Phase controls ---
	root.querySelectorAll('.phase-card').forEach((card) => {
		const raw = card.getAttribute('data-step');
		if (!raw || !ALL_STEPS.includes(/** @type {Step} */(raw))) return;
		const s = /** @type {Step} */ (raw);
		card.querySelector('.phase-inc')?.addEventListener('click', () => {
			if (playing) return;
			values[s]++;
			renderSetup();
		});
		card.querySelector('.phase-dec')?.addEventListener('click', () => {
			if (playing || values[s] <= 0) return;
			values[s]--;
			renderSetup();
		});
	});

	$('#hue-slider')?.addEventListener('input', (e) => {
		hue = Number(/** @type {HTMLInputElement} */(e.target).value);
		applyHueCss();
		saveSettings();
	});

	$('.cycles-dec')?.addEventListener('click', () => {
		cyclesLimit = Math.max(0, cyclesLimit - 1);
		renderSetup();
	});
	$('.cycles-inc')?.addEventListener('click', () => {
		cyclesLimit++;
		renderSetup();
	});

	$('#sound-toggle')?.addEventListener('click', () => {
		soundEnabled = !soundEnabled;
		renderSetup();
	});

	$('#btn-start')?.addEventListener('click', start);
	$('#btn-stop')?.addEventListener('click', stop);

	window.addEventListener('beforeunload', () => {
		if (intervalId != null) clearInterval(intervalId);
	});

	loadSettings();
	settingsLoaded = true;
	renderSetup();
})();
