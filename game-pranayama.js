/**
 * Pranayama — embedded via iframe (games/pranayama/).
 * this = CurrentCommand
 */
function gamePranayama() {
	const gameId = `pranayama-${Date.now()}`;
	const container = document.createElement('div');
	container.id = gameId;
	container.className = 'pranayama-game-host';

	const intro = document.createElement('p');
	intro.className = 'pranayama-game-intro';
	intro.textContent =
		'Breath cycle timer. Start opens fullscreen; Stop here exits fullscreen and returns to the command line.';

	const iframeWrap = document.createElement('div');
	iframeWrap.className = 'pranayama-iframe-wrap';

	const iframe = document.createElement('iframe');
	iframe.className = 'pranayama-iframe';
	iframe.title = 'Pranayama';
	iframe.setAttribute('allowfullscreen', 'true');

	const actions = document.createElement('div');
	actions.className = 'pranayama-game-actions';

	const startBtn = document.createElement('button');
	startBtn.type = 'button';
	startBtn.className = 'pranayama-game-btn pranayama-game-start';
	startBtn.textContent = 'Start';

	const stopBtn = document.createElement('button');
	stopBtn.type = 'button';
	stopBtn.className = 'pranayama-game-btn pranayama-game-stop';
	stopBtn.textContent = 'Stop';

	const IFRAME_SRC = 'games/pranayama/index.html';

	startBtn.onclick = () => {
		if (!iframe.src) {
			iframe.src = IFRAME_SRC;
		}
		this.enableFullscreenMode(container);
	};

	stopBtn.onclick = () => {
		this.disableFullscreenMode();
	};

	iframeWrap.appendChild(iframe);
	actions.append(startBtn, stopBtn);
	container.append(intro, iframeWrap, actions);
	this.applyAnswer(container);
}
