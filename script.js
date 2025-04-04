class CurrentCommand {
	constructor(commands, commandHelps) {
		this.commands = commands
		this.commandHelps = commandHelps;
		this.commandsSortedList = Object.keys(commands).sort();

		this.input = document.getElementById('command_input');
		this.customInput = '';
		this.orig = '';
		this.origInitialized = false;
		this.origCursor = 0;
		this.chat = document.getElementById('chat');

		this.reset();
		this.input.focus();
		this.initHandlers();

		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
	}

	initHandlers() {
		this.input.addEventListener('keydown', event => this.keydownHandler(event))
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	keydownHandler(event) {
		if (event.key.length == 1) {
			this.resetOrig();
			return;
		}

		switch (event.key) {
			case "Enter":
				this.run();
				break;
			case "Tab":
				this.showNextCommand(event);
				break;
			case "Backspace":
				this.resetOrig();
				break;
			case "Delete":
				this.resetOrig();
				break;
		}
	}

	reset() {
		this.input.value = '';
	}

	resetOrig() {
		this.orig = '';
		this.origInitialized = false;
		this.origCursor = 0;
	}

	toLastAnswer() {
		const lastB = [...this.chat.querySelectorAll('.b')].at(-1);
		if (lastB)
			window.scrollTo({ top: lastB.offsetTop - 14 });
	}

	clear() {
		this.chat.innerHTML = '';
		this.reset();
	}

	applyAnswer(text, updateId = null) {
		if (updateId) {
			const element = document.getElementById(updateId);
			if (element) {
				element.outerHTML = text;
				return;
			}
		}

		const savedB = document.createElement('div');
		savedB.className = 'b';
		savedB.innerText = this.customInput ?? this.input.value;
		this.chat.appendChild(savedB);

		const a = document.createElement('div')
		a.className = 'a'
		if (text instanceof HTMLElement) {
			a.appendChild(text)
		} else {
			a.innerHTML = text
		}
		this.chat.appendChild(a);

		if (!this.customInput) this.input.value = '';
	}

	/**
	 * Показать следующую доступную команду, у которой совпадает начало
	 *
	 * @param {KeyboardEvent} event
	 */
	showNextCommand(event) {
		if (event.ctrlKey || event.metaKey || event.altKey) {
			return;
		}

		event.preventDefault();

		const command = this.input.value;
		const cursor = this.input.selectionStart;

		if (command.length && cursor != command.length) {
			return;
		}

		if (!this.orig.length && !this.origInitialized) {
			this.orig = command;
			this.origCursor = this.cursor;
			if (!this.orig.length) {
				this.origInitialized = true;
			}
		}

		const toFind = this.orig.trim();
		const filtered = toFind.length ? this.commandsSortedList.filter(cmd => cmd.startsWith(toFind)) : this.commandsSortedList;
		if (!filtered.length) {
			return;
		}

		const current = command.trim();
		let idx = filtered.findIndex(cmd => cmd == current)
		if (idx >= 0) {
			if (event.shiftKey) {
				idx--;
				if (idx < 0) {
					idx = -1;
				}
			} else {
				idx++;
				if (idx >= filtered.length) {
					idx = -1;
				}
			}
		} else {
			idx = event.shiftKey ? filtered.length - 1 : 0;
		}

		if (idx == -1) {
			this.input.value = this.orig;
		} else {
			this.input.value = filtered[idx]
		}

		this.toLastAnswer()
	}

	/**
	 * Выполнить текущую команду
	 *
	 * @param {string} customCommand
	 */
	async run(customCommand) {
		const cmdF = customCommand ?? this.input.value;
		// const cmdF = this.command.trim();
		if (!cmdF.length) {
			// Если команда пустая, то ничего не делаем
			this.reset();
			this.toLastAnswer();
			return;
		}

		const [name, args] = splitByFirstSpace(cmdF);

		// Выполняем команду, или выводим сообщение об отсутствии команды
		this.customInput = customCommand;
		const cmd = commands[name.toLowerCase()];
		cmd ? await cmd.bind(this)((args ?? '').trim()) : this.applyAnswer('Command not found. Enter the <button class="command">help</button> to see available commands.');
		this.customInput = '';
		this.toLastAnswer();
	}


	playTone(frequency = 440, duration = 0.3) {
		const audioContext = this.audioContext;
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

		gainNode.gain.setValueAtTime(0.9, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.start();
		oscillator.stop(audioContext.currentTime + duration);
	}
}

function splitByFirstSpace(str) {
	const firstSpaceIndex = str.indexOf(' '); // Находим индекс первого пробела
	if (firstSpaceIndex === -1) {
		// Если пробела нет, возвращаем оригинальную строку в массиве
		return [str];
	}
	const firstPart = str.slice(0, firstSpaceIndex); // Часть до пробела
	const secondPart = str.slice(firstSpaceIndex + 1); // Часть после пробела
	return [firstPart, secondPart]; // Возвращаем массив с двумя частями
}

// Список доступных команд
const commands = {
	help() {
		const renderHelp = (cmd) => `<span><button class="command">${cmd}</button> - ${commandsHelps[cmd]}</span>`;
		this.applyAnswer('<div class="text-rows">' + Object.keys(commandsHelps).map(renderHelp).join('') + '</div>')
	},
	ls() {
		this.applyAnswer(commandsSortedList.map(cmd => `<button class="command">${cmd}</button>`).join('<br>'))
	},
	contacts() {
		const link = (link, icon, text) => `<a class="contact" href="${link}" target="_blank"><i class="${icon}"></i> ${text}</a>`
		this.applyAnswer([
			'<div class="contact-rows">',
			'<div class="contact-cols">',
			link('https://github.com/vettich', 'fab fa-github', 'Github'),
			link('https://t.me/vettich', 'fab fa-telegram-plane', 'Telegram'),
			'</div>',
			'<div class="contact-cols">',
			link('https://youtube.com/vettich', 'fab fa-youtube', 'YouTube'),
			link('mailto:vetti.ch@mail.ru', 'fas fa-at', 'vetti.ch@mail.ru'),
			'</div>',
			'</div>',
		].join(''))
	},
	async projects(name) {
		const projects = {
			ParrotPoster: 'social media auto-publishing service',
		};
		const details = {
			parrotposter: 'project-parrotposter.html',
		}
		if (name) {
			if (details[name.toLowerCase()]) {
				const resp = await fetch(details[name.toLowerCase()]);
				this.applyAnswer(await resp.text());
			} else {
				this.applyAnswer('Project not found')
			}
			return;
		}
		const r = (p) => `<button class="command" data-cmd="projects ${p}">${p}</button> - ${projects[p]}`;
		this.applyAnswer(Object.keys(projects).map(r).join('<br>'))
	},
	feedback() {
		this.applyAnswer([
			'<form class="feedback" onsubmit="sendFeedback(event)">',
			'<label>',
			'Enter your email:<br>',
			'<input name="email">',
			'</label>',
			'<label>',
			'Enter your message:<br>',
			'<textarea name="msg" rows="4"></textarea>',
			'</label>',
			'<button>Submit</button>',
			'</label>',
			'<div class="error hide"></div>',
			'</form>',
		].join(''))
	},
	about() {
		this.applyAnswer([
			'<div class="about text">',
			`<p>I'm a simple guy who wants to live, learn about life and be a creator of it.</p>`,
			`<p>Programming is the part of my life that closes the need to create. It's a great thing to have an idea and turn it into the reality I live in.</p>`,
			'</div>',
		].join(''))
	},
	async breath(args) {
		if (!args) return this.applyAnswer(`
			Usage: breath [duration] [inhale-hold-exhale-hold]
			<br>
			Example: <button class="command">breath 10m 4-8-8-8</button>
			<br>
			Example: <button class="command">breath 2m 2-2-2-2</button>
		`);

		// Парсинг и валидация
		let [durationStr, patternStr] = args.split(' ');
		const [inhale, holdIn, exhale, holdOut] = patternStr.split('-').map(Number);
		if (!durationStr || !patternStr || patternStr.split('-').length !== 4) {
			return this.applyAnswer('Invalid format. Example: <button class="command">breath 1m30s 4-0-10-10</button>');
		}

		// Разбиваем время на фазы
		const phases = [
			{ name: 'Inhale', duration: inhale },
			{ name: 'Hold', duration: holdIn },
			{ name: 'Exhale', duration: exhale },
			{ name: 'Hold', duration: holdOut }
		];
		const icons = {
			'Inhale': '<span class="inhale">Inhale</span>',
			'Exhale': '<span class="exhale">Exhale</span>',
		};

		// Логика таймера
		const timerId = `breath-${Date.now()}`;
		let elementsCache = {}; // Храним ссылки на элементы
		let isStopped = false;
		let prevPhase;

		const createUI = () => {
			const container = document.createElement('div');
			container.id = timerId;
			container.className = 'breath-container';
			container.innerHTML = `
				<div class="cycle-count"></div>
				<div class="phase-main">
					<span class="phase-name"></span>
					<span class="counter"></span>
				</div>
				<div class="phase-next"></div>
				<button class="stop-button">█ Stop</button>
			`;

			// Сохраняем ссылки на элементы
			elementsCache = {
				cycleCount: container.querySelector('.cycle-count'),
				phaseName: container.querySelector('.phase-name'),
				counter: container.querySelector('.counter'),
				nextPhase: container.querySelector('.phase-next'),
				stopButton: container.querySelector('.stop-button')
			};

			elementsCache.stopButton.onclick = () => isStopped = true;

			// Первоначальное добавление в DOM
			this.applyAnswer(container);
		};


		const updateUI = (phase, nextPhase, timeLeft, currentCycle, totalCycles) => {
			// Создаем элементы при первом вызове
			if (!document.getElementById(timerId)) {
				createUI();
				console.log(elementsCache)
			}

			// Обновляем только необходимые свойства
			elementsCache.cycleCount.textContent = `${currentCycle}/${totalCycles}`;
			elementsCache.phaseName.innerHTML = icons[phase] || phase;
			elementsCache.counter.textContent = `${timeLeft}s`;
			elementsCache.nextPhase.textContent = nextPhase ? `Next: ${nextPhase}` : '';

			// Проигрываем звук
			const phaseChanged = prevPhase !== phase;
			if (phaseChanged) {
				if (phase === 'Inhale') this.playTone(530);
				if (phase === 'Exhale') this.playTone(480);
				if (phase === 'Hold') this.playTone(660);
				prevPhase = phase;
			}
		};

		const updateCompletedUI = (duration, currentCycle, totalCycles) => {
			const content = `
				<div id="${timerId}" class="breath-container">
					<div class="cycle-count">${currentCycle}/${totalCycles}</div>
					<div class="phase-main">Completed in ${duration}</div>
				</div>
			`;
			this.applyAnswer(content, timerId);
		};

		try {
			const totalSeconds = parseDuration(durationStr);
			const cycleDuration = inhale + holdIn + exhale + holdOut;
			const totalCycles = Math.ceil(totalSeconds / cycleDuration);
			const startAt = new Date();

			let cycle = 1;
			for (; cycle <= totalCycles && !isStopped; cycle++) {
				for (let i = 0; i < phases.length && !isStopped; i++) {
					const currentPhase = phases[i];
					const nextPhase = phases[i + 1]?.name || phases[0]?.name;

					for (let t = currentPhase.duration; t > 0; t--) {
						if (isStopped) break;
						updateUI(currentPhase.name, nextPhase, t, cycle, totalCycles);
						await new Promise(r => setTimeout(r, 1000));
					}
				}
			}

			const endAt = new Date();
			const duration = formatDuration(endAt - startAt);
			updateCompletedUI(duration, cycle, totalCycles);
		} catch (e) {
			this.applyAnswer(`Error: ${e.message}`);
		}
	},
	clear() {
		this.clear();
	},
}

function formatDuration(duration) {
	duration = duration / 1000;
	const hours = Math.floor(duration / 3600);
	const minutes = Math.floor((duration % 3600) / 60);
	const seconds = Math.floor(duration % 60);
	return [[hours, 'h'], [minutes, 'm'], [seconds, 's']]
		.filter(([value]) => value)
		.map(([value, unit]) => `${value}${unit}`)
		.join(' ');
}

function parseDuration(duration) {
	const regex = /(\d+)([hms])/g; // Регулярное выражение для поиска чисел и единиц
	let totalSeconds = 0;
	let match;

	while ((match = regex.exec(duration)) !== null) {
		const value = parseInt(match[1], 10); // Числовое значение
		const unit = match[2]; // Единица измерения

		switch (unit) {
			case 'h':
				totalSeconds += value * 3600; // 1 час = 3600 секунд
				break;
			case 'm':
				totalSeconds += value * 60; // 1 минута = 60 секунд
				break;
			case 's':
				totalSeconds += value; // 1 секунда
				break;
		}
	}

	return totalSeconds; // Возвращаем общее количество секунд
}

const commandsSortedList = Object.keys(commands).sort()

const commandsHelps = {
	contacts: 'Shows my contacts',
	projects: 'Shows my projects',
	about: 'A little bit about me',
	// feedback: 'Write me a message',
	clear: 'Clear the screen from commands',
}

function sendFeedback(event) {
	event.preventDefault();

	const fd = new FormData(event.target);
	const data = Object.fromEntries(fd);

	if (!data.email.trim() || !data.msg.trim()) {
		const err = event.target.querySelector('.error');
		err.classList.remove('hide');
		err.innerText = 'Enter email and message';
		return;
	}

	fetch('feedback.php', {
		method: 'POST',
		body: fd,
	})

	event.target.innerHTML = 'Your message has been successfully sent.<br>Thank you for your feedback!'
	event.target.classList.add('success')
}

const cmd = new CurrentCommand(commands, commandsHelps);

// Если была передана команда в query параметрах, запускаем ее
const queryParams = new URLSearchParams(location.search);
if (queryParams.has('cmd')) {
	cmd.run(queryParams.get('cmd'));
}

document.addEventListener('keydown', function (event) {
	// если что-то вводится в какое-то поле ввода, то не обрабатывать это событие
	if (isInput(event.target)) {
		return;
	}

	// нажата буква/цифра/символ
	if (event.key.length == 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
		cmd.input.focus();
		return;
	}

	// обрабатываем специальные клавиши
	switch (event.key) {
		case "Enter":
			cmd.run();
			break;
		case "Tab":
			cmd.showNextCommand(event);
			break;
	}

	cmd.toLastAnswer()
})

document.addEventListener('click', function (event) {
	if (event.target.classList.contains('command')) {
		cmd.run(event.target.dataset.cmd ?? event.target.innerText);
		cmd.toLastAnswer();
	} else {
		if (event.pointerType == 'touch' && !isInput(event.target)) {
			cmd.input.focus();
		}
	}
})

/**
 * @param {HTMLElement} elem
 */
function isInput(elem) {
	return elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA'
}
