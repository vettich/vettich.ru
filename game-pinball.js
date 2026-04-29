function gamePinball(sizeStr) {
	// `this` is `CurrentCommand`

	const baseSize = parseInt(sizeStr) || 5;
	let size = baseSize;
	if (isNaN(size) || size < 3 || size > 10) {
		return this.applyAnswer('Invalid size. Use number between 3-10. Example: <button class="command">game pinball 4</button>');
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
	const maxLevelForSize = Math.min(10, size * 2); // Максимальный уровень для текущего размера поля
	let ballPath = []; // Для хранения траектории шарика

	// Создаем контейнер игры
	const container = document.createElement('div');
	container.id = gameId;
	container.className = 'pinball-container';

	// Создаем header для информации об уровне
	const header = document.createElement('div');
	header.className = 'pinball-header';
	header.innerHTML = `<div class="pinball-level">Level: ${currentLevel}/${maxLevelForSize}</div>`;

	// Создаем footer
	const footer = document.createElement('div');
	footer.className = 'pinball-footer';

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
		// Ограничиваем количество пинов в зависимости от уровня и размера поля
		const maxPins = Math.min(size * size - 1, Math.floor(size * 1.5) + currentLevel - 1);
		const totalPins = Math.max(1, maxPins);

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
		ballPath = []; // Сбрасываем траекторию

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
			const cellIndex = y * gridSize + x;
			const cell = cells[cellIndex];

			if (cell && cell.classList.contains('main-cell')) {
				// Записываем направление входа
				cell.dataset.ballDirIn = getDirectionName(dx, dy);
				// Обновляем направление выхода
				cell.dataset.ballDirOut = getDirectionName(dx, dy);
				ballPath.push(cellIndex);
			}

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

		// Добавляем направления к данным траектории
		// ballPath.forEach((index, i) => {
		// 	if (cells[index]) {
		// 		cells[index].dataset.ballDirIn = pathDirections[i];
		// 		cells[index].dataset.ballDirOut = pathDirections[i + 1] || pathDirections[i];
		// 	}
		// });

		// Если шарик не вышел за пределы (не должно происходить)
		correctExitPosition = -1;
	};

	const showBallPath = () => {
		// Очищаем предыдущую траекторию
		cells.forEach(cell => {
			cell.classList.remove('ball-path', 'ball-path-change');
			cell.innerHTML = '';
		});

		// Проходим по траектории и рисуем точки
		for (let i = 0; i < ballPath.length; i++) {
			const cellIndex = ballPath[i];
			const cell = cells[cellIndex];
			if (!cell || !cell.classList.contains('main-cell')) continue;

			// Создаем контейнер для точек
			const pointsContainer = document.createElement('div');
			pointsContainer.className = 'ball-points-container';

			// Первая точка (вход)
			const point1 = document.createElement('div');
			point1.className = 'ball-point ball-point-in';
			point1.dataset.direction = getDirection(cellIndex, ballPath[i + 1], size + 2);

			// Вторая точка (выход)
			const point2 = document.createElement('div');
			point2.className = 'ball-point ball-point-out';
			point2.dataset.direction = getDirection(cellIndex, ballPath[i + 1], size + 2);

			// Определяем направления
			const prevDir = i > 0 ? getDirection(ballPath[i - 1], cellIndex, size + 2) : null;
			const nextDir = i < ballPath.length - 1 ? getDirection(cellIndex, ballPath[i + 1], size + 2) : null;

			// Если направление изменилось (был отскок)
			if (prevDir && nextDir && prevDir !== nextDir) {
				cell.classList.add('ball-path-change');
				point2.classList.add('ball-point-bounce');
			}

			pointsContainer.append(point1, point2);
			cell.appendChild(pointsContainer);
			cell.style.animationDelay = `${i * 0.05}s`;
			cell.classList.add('ball-path');
		}
	};

	// Улучшенная функция определения направления
	const getDirection = (fromIndex, toIndex, gridSize) => {
		const fromRow = Math.floor(fromIndex / gridSize);
		const fromCol = fromIndex % gridSize;
		const toRow = Math.floor(toIndex / gridSize);
		const toCol = toIndex % gridSize;

		const dx = toCol - fromCol;
		const dy = toRow - fromRow;

		if (dx > 0 && dy === 0) return 'right';
		if (dx < 0 && dy === 0) return 'left';
		if (dy > 0 && dx === 0) return 'down';
		if (dy < 0 && dx === 0) return 'up';
		if (dx > 0 && dy > 0) return 'down-right';
		if (dx > 0 && dy < 0) return 'up-right';
		if (dx < 0 && dy > 0) return 'down-left';
		if (dx < 0 && dy < 0) return 'up-left';
		return null;
	};

	function getDirectionName(dx, dy) {
		if (dx > 0 && dy === 0) return 'right';
		if (dx < 0 && dy === 0) return 'left';
		if (dy > 0 && dx === 0) return 'down';
		if (dy < 0 && dx === 0) return 'up';
		if (dx > 0 && dy > 0) return 'down-right';
		if (dx > 0 && dy < 0) return 'up-right';
		if (dx < 0 && dy > 0) return 'down-left';
		if (dx < 0 && dy < 0) return 'up-left';
		return '';
	}

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

		// Показываем траекторию шарика
		showBallPath();

		// Подсвечиваем правильный ответ
		if (correctExitPosition !== -1) {
			cells[correctExitPosition].classList.add(success ? 'correct-exit' : 'correct-show');
		}

		const message = success ?
			`🎉 Correct! Level ${currentLevel} completed!` :
			`❌ Wrong! Try again.`;

		const result = document.createElement('div');
		result.className = 'pinball-result';

		// Создаем кнопки в зависимости от успеха
		const buttons = [];

		if (success) {
			if (currentLevel > 1) {
				buttons.push(`<button class="pinball-prev-level">Previous Level</button>`);
			}
			buttons.push(`<button class="pinball-next-level">Next Level</button>`);
			buttons.push(`<button class="pinball-same-level">Repeat Level</button>`);
		} else {
			if (currentLevel > 1) {
				buttons.push(`<button class="pinball-prev-level">Previous Level</button>`);
			}
			buttons.push(`<button class="pinball-same-level">Try Again</button>`);
		}

		buttons.push(`<button class="pinball-stop">Quit</button>`);

		result.innerHTML = `${message}
                <div class="pinball-result-buttons">
                    ${buttons.join('')}
                </div>`;

		// Обработчики для кнопок
		result.querySelector('.pinball-next-level')?.addEventListener('click', () => {
			if (currentLevel < maxLevelForSize) {
				currentLevel++;
			} else {
				// Увеличиваем размер поля и сбрасываем уровень
				size++;
				currentLevel = 1;
			}
			restartGame();
		});

		result.querySelector('.pinball-same-level')?.addEventListener('click', () => {
			restartGame();
		});

		result.querySelector('.pinball-prev-level')?.addEventListener('click', () => {
			if (currentLevel > 1) currentLevel--;
			updateLevelDisplay();
			restartGame();
		});

		result.querySelector('.pinball-stop')?.addEventListener('click', () => {
			stopBtn.onclick();
		});

		footer.innerHTML = '';
		footer.appendChild(result);
		success ? this.playAudio('gamePerfect') : this.playTone(220, 0.5);
	};

	// Обновляем отображение уровня
	const updateLevelDisplay = () => {
		const levelDisplay = header.querySelector('.pinball-level');
		if (levelDisplay) {
			levelDisplay.textContent = `Field: ${size}x${size} | Level: ${currentLevel}/${maxLevelForSize}`;
		}
	};

	// Перезапуск игры с текущими настройками
	const restartGame = () => {
		cells.forEach(c => {
			c.classList.remove('correct-exit', 'correct-show', 'pin-visible', 'active', 'ball-path', 'wrong-exit');
			c.dataset.pinType = null;
			c.style.animationDelay = '';
		});
		startBtn.onclick();
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
			c.classList.remove('pin-visible', 'correct-exit', 'correct-show', 'active', 'ball-path', 'ball-path-change', 'wrong-exit');
			c.dataset.pinType = null;
			c.removeAttribute('data-ball-dir-in');
			c.removeAttribute('data-ball-dir-out');
			c.style.animationDelay = '';

			// Удаляем все точки
			const pointsContainer = c.querySelector('.ball-points-container');
			if (pointsContainer) {
				pointsContainer.remove();
			}
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

		// Подсвечиваем выбранную ячейку
		if (!isCorrect) {
			cells[selectedIndex].classList.add('wrong-exit');
		}

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
	container.append(header, grid, footer);
	this.applyAnswer(container);
}
