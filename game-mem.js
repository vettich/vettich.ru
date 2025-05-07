function gameMem(sizeStr) {
	// `this` is `CurrentCommand`

	const size = parseInt(sizeStr) || 4;
	if (isNaN(size) || size < 2 || size > 10) {
		return this.applyAnswer('Invalid size. Use number between 2-10. Example: <button class="command">mempic 6</button>');
	}

	this.preloadAudios({
		gameStart: 'assets/sounds/game-start.mp3',
		gamePerfect: 'assets/sounds/game-perfect.mp3'
	});

	const gameId = `mempic-${Date.now()}`;
	let correctCells = [];
	let mistakes = 0;
	let isPreviewPhase = true;
	let countdownTimer;
	let totalCorrectCells = Math.floor(size * 1.5);

	// Создаем контейнер игры
	const container = document.createElement('div');
	container.id = gameId;
	container.className = 'mempic-container';

	// Создаем footer
	const footer = document.createElement('div');

	// Создаем игровое поле
	const grid = document.createElement('div');
	grid.className = 'mempic-grid';
	grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

	// Создаем ячейки
	const cells = Array.from({ length: size * size }, (_, i) => {
		const cell = document.createElement('div');
		cell.className = 'mempic-cell';
		cell.dataset.index = i;
		cell.setAttribute('role', 'button');
		cell.setAttribute('aria-label', `Cell ${i}`);
		return cell;
	});

	// Панель прогресса
	const progressBar = document.createElement('div');
	progressBar.className = 'mempic-progress';
	progressBar.innerHTML = `<span class="progress-count">0 / ${totalCorrectCells}</span>
                                <div class="progress-track"><div class="progress-fill"></div></div>`;

	// Таймер
	const timer = document.createElement('div');
	timer.className = 'mempic-timer hidden';

	// Кнопка старта
	const startBtn = document.createElement('button');
	startBtn.className = 'mempic-start';
	startBtn.textContent = 'Start';
	startBtn.onclick = () => {
		this.enableFullscreenMode(container);
		isPreviewPhase = true;
		startGame();
		this.playAudio('gameStart');
	};

	// Кнопка остановки
	const stopBtn = document.createElement('button');
	stopBtn.className = 'mempic-stop';
	stopBtn.textContent = 'Стоп';
	stopBtn.onclick = () => {
		this.disableFullscreenMode();
		finishGame();
	};

	// Логика обновления прогресса
	const updateProgress = () => {
		const found = totalCorrectCells - correctCells.length;
		const accuracy = mistakes > 0 ? ` (Errors: ${mistakes})` : '';
		progressBar.querySelector('.progress-count').textContent =
			`${found} / ${totalCorrectCells}${accuracy}`;

		// Анимация заполнения
		const fillPercent = (found / totalCorrectCells) * 100;
		progressBar.querySelector('.progress-fill').style.width = `${fillPercent}%`;

		// Цвет в зависимости от прогресса
		if (fillPercent > 80) {
			progressBar.querySelector('.progress-fill').style.backgroundColor = '#4CAF50';
		} else if (fillPercent > 50) {
			progressBar.querySelector('.progress-fill').style.backgroundColor = '#FFC107';
		} else {
			progressBar.querySelector('.progress-fill').style.backgroundColor = '#EE4540';
		}
	};

	// Логика таймера
	const updateTimer = (seconds) => {
		timer.textContent = seconds > 0 ? `${seconds}s` : 'Go!';
		if (seconds === 0) {
			setTimeout(() => {
				timer.textContent = ''
				timer.classList.add('hidden');
			}, 1000);
		} else if (timer.classList.contains('hidden')) {
			timer.classList.remove('hidden');
		}
	};

	// Логика завершения игры
	const finishGame = () => {
		const success = mistakes === 0 && correctCells.length === 0;

		clearInterval(countdownTimer);
		cells.forEach(c => c.classList.remove('active'));

		// Показываем пропущенные ячейки с анимацией
		correctCells.forEach(index => {
			const cell = cells[index];
			cell.classList.add('missed', 'has-dot');
			setTimeout(() => {
				cell.classList.add('missed-animate');
			}, 100);
		});

		const resultMistakes = mistakes ?? mistakes + correctCells.length;
		const message = success ? '🎉 Perfect! No mistakes!' : `❌ ${resultMistakes} mistakes.`
		const restartText = success ? 'Play Again' : 'Try Again';

		const result = document.createElement('div');
		result.className = 'mempic-result';
		result.innerHTML = `${message}
						<div class="mempic-result-buttons">
							<button class="mempic-restart">${restartText}</button>
							<button class="mempic-stop">Quit</button>
						</div>`;

		result.querySelector('.mempic-restart').onclick = () => {
			cells.forEach(c => {
				c.classList.remove('correct', 'wrong');
			});
			startBtn.onclick();
		};

		result.querySelector('.mempic-stop').onclick = () => {
			stopBtn.onclick();
		};

		footer.innerHTML = '';
		footer.append(result);
		success ? this.playAudio('gamePerfect') : this.playTone(440, 0.5);
	}

	// Логика игры
	const startGame = () => {
		// Сбрасываем предыдущее состояние
		clearInterval(countdownTimer);
		cells.forEach(c => {
			c.classList.remove('correct', 'wrong', 'has-dot', 'active');
		});
		footer.innerHTML = '';
		footer.style.opacity = '0';
		footer.append(progressBar, stopBtn);

		// Выбираем случайные ячейки
		correctCells = [];
		mistakes = 0;
		while (correctCells.length < totalCorrectCells) {
			const rnd = Math.floor(Math.random() * cells.length);
			if (!correctCells.includes(rnd)) correctCells.push(rnd);
		}

		// Показываем кружки и таймер
		updateTimer(3)
		cells.forEach((cell, i) => {
			cell.classList.toggle('has-dot', correctCells.includes(i));
		});

		// Обратный отсчет
		// Через 3 секунды скрываем и включаем ввод
		let seconds = 3;
		countdownTimer = setInterval(() => {
			seconds--;
			updateTimer(seconds);

			if (seconds === 0) {
				clearInterval(countdownTimer);
				cells.forEach(cell => cell.classList.remove('has-dot'));
				isPreviewPhase = false;
				cells.forEach(cell => cell.classList.add('active'));
				footer.style.opacity = '1';
				updateProgress();
			}
		}, 1000);
	};

	// Обработчик кликов
	const handleClick = (e) => {
		if (isPreviewPhase) return;

		const cell = e.target.closest('.mempic-cell');
		if (!cell || cell.classList.contains('correct') || !cell.classList.contains('active')) {
			return;
		}

		const index = parseInt(cell.dataset.index);
		const isCorrect = correctCells.includes(index);

		if (isCorrect) {
			cell.classList.add('correct');
			correctCells = correctCells.filter(i => i !== index);
			this.playTone(523, 0.1); // Звук правильного ответа
			if (navigator.vibrate) navigator.vibrate(50);
		} else {
			cell.classList.add('wrong');
			mistakes++;
			this.playTone(220, 0.3); // Звук ошибки
			if (navigator.vibrate) navigator.vibrate(200);
		}

		// Завершаем игру при 3 ошибках или если достигнуто количество верных ячеек
		if (mistakes >= 3 || (correctCells.length - mistakes) <= 0) {
			finishGame();
			return;
		}

		updateProgress();

		// Проверка завершения
		if (correctCells.length === 0) {
			finishGame();
		}
	};

	// Собираем интерфейс
	grid.append(...cells);
	footer.append(startBtn);
	container.append(timer, grid, footer);
	container.addEventListener('click', handleClick);
	this.applyAnswer(container);
}
