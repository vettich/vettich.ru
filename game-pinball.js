function gamePinball(sizeStr) {
	// `this` is `CurrentCommand`

	const size = parseInt(sizeStr) || 5;
	if (isNaN(size) || size < 2 || size > 8) {
		return this.applyAnswer('Invalid size. Use number between 2-8. Example: <button class="command">game pinball 4</button>');
	}

	this.preloadAudios({
		gameStart: 'assets/sounds/game-start.mp3',
		gamePerfect: 'assets/sounds/game-perfect.mp3'
	});

	const gameId = `pinball-${Date.now()}`;
	let pins = [];
	let mistakes = 0;
	let isPreviewPhase = true;
	let countdownTimer;
	let launchPosition = null;
	let correctExitPosition = null;
	let currentLevel = 1;

	// Создаем контейнер игры
	const container = document.createElement('div');
	container.id = gameId;
	container.className = 'pinball-container';

	// Создаем footer
	const footer = document.createElement('div');

	// Создаем игровое поле с дополнительными ячейками по краям
	const grid = document.createElement('div');
	grid.className = 'pinball-grid';
	grid.style.gridTemplateColumns = `0.5fr repeat(${size}, 1fr) 0.5fr`;
	grid.style.gridTemplateRows = `0.5fr repeat(${size}, 1fr) 0.5fr`;

	// Создаем все ячейки (основные + граничные)
	const cells = [];
	const totalCells = (size + 2) * (size + 2);

	for (let i = 0; i < totalCells; i++) {
		const cell = document.createElement('div');
		cell.className = 'pinball-cell';
		cell.dataset.index = i;

		// Определяем тип ячейки (граничная или основная)
		const row = Math.floor(i / (size + 2));
		const col = i % (size + 2);

		if (row === 0 || row === size + 1 || col === 0 || col === size + 1) {
			cell.classList.add('border-cell');
			if (!(row === 0 && col === 0) &&
				!(row === 0 && col === size + 1) &&
				!(row === size + 1 && col === 0) &&
				!(row === size + 1 && col === size + 1)) {
				// Это не угловая ячейка - может быть активной
				cell.classList.add('exit-cell');
			}
		} else {
			cell.classList.add('main-cell');
		}

		cells.push(cell);
	}

	// Кнопка старта
	const startBtn = document.createElement('button');
	startBtn.className = 'pinball-start';
	startBtn.textContent = 'Start';
	startBtn.onclick = () => {
		this.enableFullscreenMode(container);
		isPreviewPhase = true;
		startGame();
		this.playAudio('gameStart');
	};

	// Кнопка остановки
	const stopBtn = document.createElement('button');
	stopBtn.className = 'pinball-stop';
	stopBtn.textContent = 'Stop';
	stopBtn.onclick = () => {
		this.disableFullscreenMode();
		finishGame(false);
	};

	// Генерация случайных пинов
	const generatePins = () => {
		pins = [];
		const totalPins = Math.floor(size * 1.5) + currentLevel - 1;

		while (pins.length < totalPins) {
			// Выбираем только основные ячейки
			const rnd = Math.floor(Math.random() * (size * size));
			const row = Math.floor(rnd / size) + 1;
			const col = (rnd % size) + 1;
			const index = row * (size + 2) + col;

			if (!pins.some(p => p.index === index)) {
				pins.push({
					index: index,
					type: Math.random() > 0.5 ? '\\' : '/'
				});
			}
		}
	};

	// Выбор случайной позиции запуска на границе
	const generateLaunchPosition = () => {
		const possiblePositions = [];

		// Верхняя граница (исключая углы)
		for (let col = 1; col <= size; col++) {
			possiblePositions.push({
				index: col,
				direction: 'down'
			});
		}

		// Правая граница (исключая углы)
		for (let row = 1; row <= size; row++) {
			possiblePositions.push({
				index: row * (size + 2) + size + 1,
				direction: 'left'
			});
		}

		// Нижняя граница (исключая углы)
		for (let col = 1; col <= size; col++) {
			possiblePositions.push({
				index: (size + 1) * (size + 2) + col,
				direction: 'up'
			});
		}

		// Левая граница (исключая углы)
		for (let row = 1; row <= size; row++) {
			possiblePositions.push({
				index: row * (size + 2),
				direction: 'right'
			});
		}

		// Выбираем случайную позицию
		launchPosition = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];

		// Вычисляем правильную позицию выхода
		simulateBallMovement();
	};

	// Симуляция движения шарика для определения правильного ответа
	const simulateBallMovement = () => {
		let x, y, dx, dy;
		const gridSize = size + 2;

		// Определяем начальную позицию и направление
		const row = Math.floor(launchPosition.index / gridSize);
		const col = launchPosition.index % gridSize;

		switch (launchPosition.direction) {
			case 'down':
				x = col;
				y = row + 1;
				dx = 0;
				dy = 1;
				break;
			case 'up':
				x = col;
				y = row - 1;
				dx = 0;
				dy = -1;
				break;
			case 'left':
				x = col - 1;
				y = row;
				dx = -1;
				dy = 0;
				break;
			case 'right':
				x = col + 1;
				y = row;
				dx = 1;
				dy = 0;
				break;
		}

		let steps = 0;
		const maxSteps = size * size * 2; // Предотвращаем бесконечный цикл

		while (steps < maxSteps) {
			// Проверяем, не вышли ли за границы основного поля
			if (x <= 0 || x >= gridSize - 1 || y <= 0 || y >= gridSize - 1) {
				// Находим индекс граничной ячейки
				let exitIndex;
				if (y <= 0) exitIndex = x; // Верхняя граница
				else if (y >= gridSize - 1) exitIndex = (gridSize - 1) * gridSize + x; // Нижняя граница
				else if (x <= 0) exitIndex = y * gridSize; // Левая граница
				else if (x >= gridSize - 1) exitIndex = y * gridSize + (gridSize - 1); // Правая граница

				correctExitPosition = exitIndex;
				return;
			}

			// Проверяем, есть ли пин в этой клетке
			const cellIndex = y * gridSize + x;
			const pin = pins.find(p => p.index === cellIndex);
			if (pin) {
				// Меняем направление в зависимости от типа пина
				if (pin.type === '/') {
					[dx, dy] = [-dy, -dx]; // Отражение от /
				} else {
					[dx, dy] = [dy, dx]; // Отражение от \
				}
			}

			x += dx;
			y += dy;
			steps++;
		}

		// Если шарик не вышел за пределы (не должно происходить)
		correctExitPosition = -1;
	};

	// Отображение позиции запуска
	const showLaunchPosition = () => {
		// Очищаем все стрелки
		cells.forEach(cell => {
			if (!cell.classList.contains('border-cell')) {
				return;
			}
			cell.innerHTML = '';
			cell.classList.remove('launch-cell');
		});

		// Добавляем стрелку запуска
		const cell = cells[launchPosition.index];
		cell.classList.add('launch-cell');

		const arrow = document.createElement('div');
		arrow.className = 'launch-arrow';
		arrow.innerHTML = getArrowSymbol(launchPosition.direction);
		cell.appendChild(arrow);
	};

	const getArrowSymbol = (direction) => {
		switch (direction) {
			case 'up': return '↑';
			case 'down': return '↓';
			case 'left': return '←';
			case 'right': return '→';
			default: return '↻';
		}
	};

	// Логика завершения игры
	const finishGame = (success) => {
		clearInterval(countdownTimer);

		// Показываем все пины
		showAllPins();

		// Подсвечиваем правильный ответ
		if (correctExitPosition !== -1) {
			cells[correctExitPosition].classList.add(success ? 'correct-exit' : 'correct-show');
		}

		const message = success ?
			`🎉 Correct! Level ${currentLevel} completed!` :
			`❌ Wrong! Try again.`;

		const result = document.createElement('div');
		result.className = 'pinball-result';
		result.innerHTML = `${message}
                <div class="pinball-result-buttons">
                    <button class="pinball-restart">${success ? 'Next Level' : 'Try Again'}</button>
                    <button class="pinball-stop">Quit</button>
                </div>`;

		result.querySelector('.pinball-restart').onclick = () => {
			if (success) currentLevel++;
			cells.forEach(c => {
				c.classList.remove('correct-exit', 'correct-show', 'pin-visible', 'active');
				c.dataset.pinType = null;
			});
			startBtn.onclick();
		};

		result.querySelector('.pinball-stop').onclick = () => {
			stopBtn.onclick();
		};

		footer.innerHTML = '';
		footer.appendChild(result);
		success ? this.playAudio('gamePerfect') : this.playTone(220, 0.5);
	};

	// Показать все пины
	const showAllPins = () => {
		pins.forEach(pin => {
			const cell = cells[pin.index];
			cell.classList.add('pin-visible');
			cell.dataset.pinType = pin.type;
		});
	};

	// Логика игры
	const startGame = () => {
		// Сбрасываем предыдущее состояние
		clearInterval(countdownTimer);
		cells.forEach(c => {
			c.classList.remove('pin-visible', 'correct-exit', 'correct-show', 'active');
			c.dataset.pinType = null;
		});
		if (launchPosition) {
			cells[launchPosition.index].classList.remove('launch-cell');
			cells[launchPosition.index].innerHTML = '';
		}

		// Удаляем предыдущий результат
		footer.innerHTML = '';
		footer.append(stopBtn);

		// Генерируем новую карту
		generatePins();
		generateLaunchPosition();

		// Показываем пины на несколько секунд
		showAllPins();

		// Обратный отсчет
		let seconds = 3;
		countdownTimer = setInterval(() => {
			seconds--;

			if (seconds === 0) {
				clearInterval(countdownTimer);
				isPreviewPhase = false;

				// Скрываем пины, оставляем только позицию запуска
				cells.forEach(c => {
					if (!c.classList.contains('launch-cell') && c.classList.contains('main-cell')) {
						c.classList.remove('pin-visible');
						c.dataset.pinType = null;
					}
				});

				// Показываем позицию запуска
				showLaunchPosition();

				// Активируем граничные ячейки для выбора
				cells.forEach(c => {
					if (c.classList.contains('exit-cell')) {
						c.classList.add('active');
						c.onclick = () => checkAnswer(c.dataset.index);
					} else {
						c.classList.remove('active');
						c.onclick = null;
					}
				});
			}
		}, 1000);
	};

	// Проверка ответа
	const checkAnswer = (selectedIndex) => {
		const isCorrect = parseInt(selectedIndex) === correctExitPosition;

		if (isCorrect) {
			finishGame(true);
			this.playTone(523, 0.1);
			if (navigator.vibrate) navigator.vibrate(50);
		} else {
			mistakes++;
			this.playTone(220, 0.3);
			if (navigator.vibrate) navigator.vibrate(200);
			finishGame(false);
		}
	};

	// Собираем интерфейс
	grid.append(...cells);
	footer.append(startBtn);
	container.append(grid, footer);
	this.applyAnswer(container);
}
