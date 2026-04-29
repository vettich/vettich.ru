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
		ballPath = [];

		const row = Math.floor(launchPosition.index / gridSize);
		const col = launchPosition.index % gridSize;

		switch (launchPosition.direction) {
			case 'down':  x = col;     y = row + 1; dx = 0;  dy = 1;  break;
			case 'up':    x = col;     y = row - 1; dx = 0;  dy = -1; break;
			case 'left':  x = col - 1; y = row;     dx = -1; dy = 0;  break;
			case 'right': x = col + 1; y = row;     dx = 1;  dy = 0;  break;
		}

		let steps = 0;
		const maxSteps = size * size * 2;

		while (steps < maxSteps) {
			// Сначала проверяем выход за границу
			if (x <= 0 || x >= gridSize - 1 || y <= 0 || y >= gridSize - 1) {
				let exitIndex;
				if (y <= 0) exitIndex = x;
				else if (y >= gridSize - 1) exitIndex = (gridSize - 1) * gridSize + x;
				else if (x <= 0) exitIndex = y * gridSize;
				else exitIndex = y * gridSize + (gridSize - 1);
				correctExitPosition = exitIndex;
				return;
			}

			const cellIndex = y * gridSize + x;
			const dirIn = getDirectionName(dx, dy);

			// Применяем отражение от пина (если есть)
			const pin = pins.find(p => p.index === cellIndex);
			if (pin) {
				if (pin.type === '/') {
					[dx, dy] = [-dy, -dx];
				} else {
					[dx, dy] = [dy, dx];
				}
			}

			const dirOut = getDirectionName(dx, dy);

			const cell = cells[cellIndex];
			if (cell && cell.classList.contains('main-cell')) {
				ballPath.push({ index: cellIndex, dirIn, dirOut });
			}

			x += dx;
			y += dy;
			steps++;
		}

		correctExitPosition = -1;
	};

	const showBallPath = () => {
		cells.forEach(cell => {
			cell.classList.remove('ball-path', 'ball-path-change');
			cell.querySelectorAll('svg.ball-path-svg').forEach(el => el.remove());
		});

		// Возвращает [x%, y%] точки входа/выхода для данного направления движения
		const dirToPoint = (dir, isEntry) => {
			const pts = {
				right: isEntry ? [5, 50]  : [95, 50],
				left:  isEntry ? [95, 50] : [5, 50],
				down:  isEntry ? [50, 5]  : [50, 95],
				up:    isEntry ? [50, 95] : [50, 5],
			};
			return pts[dir] || [50, 50];
		};

		for (let i = 0; i < ballPath.length; i++) {
			const { index: cellIndex, dirIn, dirOut } = ballPath[i];
			const cell = cells[cellIndex];
			if (!cell || !cell.classList.contains('main-cell')) continue;

			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 100 100');
			svg.setAttribute('class', 'ball-path-svg');
			svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:visible;';

			const [x1, y1] = dirToPoint(dirIn, true);
			const [x2, y2] = dirToPoint(dirOut, false);

			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', x1);
			line.setAttribute('y1', y1);
			line.setAttribute('x2', x2);
			line.setAttribute('y2', y2);
			line.setAttribute('stroke', '#6fc7ff');
			line.setAttribute('stroke-width', '10');
			line.setAttribute('stroke-linecap', 'round');
			line.style.filter = 'drop-shadow(0 0 3px rgba(110,199,255,0.9))';
			line.style.animation = `ball-path-appear 0.25s ${i * 0.04}s both`;

			// Точка отскока — другой цвет
			if (dirIn !== dirOut) {
				line.setAttribute('stroke', '#ffb347');
				line.style.filter = 'drop-shadow(0 0 3px rgba(255,179,71,0.9))';
				cell.classList.add('ball-path-change');
			}

			svg.appendChild(line);
			cell.appendChild(svg);
			cell.classList.add('ball-path');
		}
	};

	// Анимация движения шарика по траектории
	const animateBall = (callback) => {
		cells.forEach(c => { c.onclick = null; c.classList.remove('active'); });

		const ball = document.createElement('div');
		ball.className = 'pinball-ball';
		ball.style.opacity = '0';
		grid.appendChild(ball);

		const fullPath = [launchPosition.index, ...ballPath.map(p => p.index)];
		if (correctExitPosition !== -1) fullPath.push(correctExitPosition);

		if (fullPath.length === 0) {
			ball.remove();
			callback();
			return;
		}

		const getCellCenter = (index) => {
			const cell = cells[index];
			const cr = cell.getBoundingClientRect();
			const gr = grid.getBoundingClientRect();
			return { left: cr.left - gr.left + cr.width / 2, top: cr.top - gr.top + cr.height / 2 };
		};

		const stepDelay = Math.min(200, Math.max(80, 1500 / fullPath.length));

		// Начальная позиция без перехода
		const start = getCellCenter(fullPath[0]);
		ball.style.left = start.left + 'px';
		ball.style.top = start.top + 'px';

		let step = 0;

		const moveNext = () => {
			if (step === 0) ball.style.opacity = '1';
			step++;
			if (step >= fullPath.length) {
				setTimeout(() => {
					ball.style.transition = 'opacity 0.2s';
					ball.style.opacity = '0';
					setTimeout(() => { ball.remove(); callback(); }, 220);
				}, stepDelay);
				return;
			}
			ball.style.transition = `left ${stepDelay * 0.85}ms linear, top ${stepDelay * 0.85}ms linear`;
			const pos = getCellCenter(fullPath[step]);
			ball.style.left = pos.left + 'px';
			ball.style.top = pos.top + 'px';
			setTimeout(moveNext, stepDelay);
		};

		setTimeout(moveNext, 80);
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
			c.querySelectorAll('.ball-points-container, svg.ball-path-svg').forEach(el => el.remove());
		});
		const existingBall = grid.querySelector('.pinball-ball');
		if (existingBall) existingBall.remove();
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

		if (!isCorrect) {
			cells[selectedIndex].classList.add('wrong-exit');
			mistakes++;
			this.playTone(220, 0.3);
			if (navigator.vibrate) navigator.vibrate(200);
		} else {
			this.playTone(523, 0.1);
			if (navigator.vibrate) navigator.vibrate(50);
		}

		animateBall(() => {
			finishGame(isCorrect);
		});
	};

	// Собираем интерфейс
	grid.append(...cells);
	footer.append(startBtn);
	container.append(header, grid, footer);
	this.applyAnswer(container);
}
