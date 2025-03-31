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

	applyAnswer(text) {
		const savedB = document.createElement('div');
		savedB.className = 'b';
		savedB.innerText = this.customInput ?? this.input.value;
		chat.appendChild(savedB);

		const a = document.createElement('div')
		a.className = 'a'
		a.innerHTML = text
		chat.appendChild(a);

		if (!this.customInput) {
			this.input.value = '';
		}
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

		const [name, args] = cmdF.split(' ', 2);

		// Выполняем команду, или выводим сообщение об отсутствии команды
		this.customInput = customCommand;
		const cmd = commands[name.toLowerCase()];
		cmd ? await cmd.bind(this)((args ?? '').trim()) : this.applyAnswer('Command not found. Enter the <button class="command">help</button> to see available commands.');
		this.customInput = '';
		this.toLastAnswer();
	}
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
	clear() {
		this.clear();
	},
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
