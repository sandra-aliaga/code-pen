(function() {
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const feedback = document.getElementById('feedback');
    const gestureCountEl = document.getElementById('gestureCount');
    const recognizedCountEl = document.getElementById('recognizedCount');

    let isDrawing = false;
    let points = [];
    let gestureCount = 0;
    let recognizedCount = 0;
    let isProcessing = false;
    let processingTimeout = null;
    const MAX_POINTS = 500;
    const PROCESSING_TIMEOUT_MS = 5000;

    // Resize canvas to fill container
    function resizeCanvas() {
        const wrapper = canvas.parentElement;
        const rect = wrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = getStrokeColor();
    }

    function getStrokeColor() {
        return getComputedStyle(document.documentElement)
            .getPropertyValue('--vscode-editorCursor-foreground').trim() || '#007acc';
    }

    // Initial resize and listen for window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events for trackpad/touch
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        draw({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function startDrawing(e) {
        isDrawing = true;
        points = [];
        canvas.classList.add('drawing');
        feedback.classList.remove('visible');
        ctx.strokeStyle = getStrokeColor();
        draw(e);
    }

    function draw(e) {
        if (!isDrawing) return;
        if (points.length >= MAX_POINTS) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        points.push({ x, y });
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        canvas.classList.remove('drawing');
        ctx.beginPath();

        if (points.length > 5) {
            if (isProcessing) {
                showFeedback('Procesando...', 'failure');
                points = [];
                setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 300);
                return;
            }

            isProcessing = true;
            gestureCount++;
            gestureCountEl.textContent = gestureCount;

            if (processingTimeout) clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                if (isProcessing) {
                    isProcessing = false;
                    showFeedback('Timeout - reintenta', 'failure');
                    setTimeout(() => showFeedback('', 'failure'), 2000);
                }
            }, PROCESSING_TIMEOUT_MS);

            vscode.postMessage({
                command: 'recognizeGesture',
                points: points
            });
        } else {
            showFeedback('Gesto muy corto', 'failure');
        }

        setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 300);

        points = [];
    }

    function showFeedback(text, type) {
        feedback.textContent = text;
        feedback.className = 'feedback visible ' + type;
    }

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'recognitionResult') {
            isProcessing = false;
            if (processingTimeout) {
                clearTimeout(processingTimeout);
                processingTimeout = null;
            }
            const score = Math.round(message.score * 100);
            if (message.recognized) {
                recognizedCount++;
                recognizedCountEl.textContent = recognizedCount;
                showFeedback('[OK] ' + message.routineName + ' (' + score + '%)', 'success');
                setTimeout(() => feedback.classList.remove('visible'), 2000);
            } else {
                const text = message.routineName
                    ? '[X] No reconocido (mejor: ' + message.routineName + ' ' + score + '%)'
                    : '[X] No reconocido';
                showFeedback(text, 'failure');
                setTimeout(() => feedback.classList.remove('visible'), 3000);
            }
        }
    });
})();
