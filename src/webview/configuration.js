(function() {
    const vscode = acquireVsCodeApi();
    const BLOCKS = window.BLOCKS_DATA;
    let routines = window.ROUTINES_DATA;
    const ALL_COMMANDS = window.COMMANDS_DATA;
    let selectedCommands = [];
    let recordedSamples = [];
    const REQUIRED_SAMPLES = 3;
    let editingRoutineName = null;
    let pendingValidation = null;
    let validationRequestId = 0;

    // Sanitize HTML to prevent XSS
    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const mainView = document.getElementById('mainView');
    const createView = document.getElementById('createView');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const routineList = document.getElementById('routineList');
    const blocksContainer = document.getElementById('blocksContainer');
    const selectedBlocksEl = document.getElementById('selectedBlocks');
    const routineNameInput = document.getElementById('routineName');
    const routineDelayInput = document.getElementById('routineDelay');
    const btnNextStep = document.getElementById('btnNextStep');
    const btnTestRoutine = document.getElementById('btnTestRoutine');
    const btnSaveRoutine = document.getElementById('btnSaveRoutine');
    const gestureRoutineName = document.getElementById('gestureRoutineName');
    const step1Hint = document.getElementById('step1Hint');
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    const validationMessage = document.getElementById('validationMessage');
    let painting = false;
    let points = [];

    function getThemeColor(varName, fallback) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
    }

    renderBlocks();
    renderRoutineList();
    setupCanvas();

    document.getElementById('btnNewRoutine').addEventListener('click', () => {
        showView('create');
        resetCreateForm();
    });

    document.getElementById('btnCancelCreate').addEventListener('click', () => showView('main'));
    document.getElementById('btnBackStep').addEventListener('click', () => showStep(1));

    btnNextStep.addEventListener('click', () => {
        showStep(2);
        gestureRoutineName.textContent = routineNameInput.value;
        recordedSamples = [];
        updateSampleDots();
    });

    btnSaveRoutine.addEventListener('click', () => {
        vscode.postMessage({
            command: 'saveRoutine',
            name: routineNameInput.value,
            commands: selectedCommands.map(b => ({
                command: b.command,
                type: b.type || 'vscode-command',
                label: b.label
            })),
            samples: recordedSamples,
            delay: parseInt(routineDelayInput.value) || 0
        });
        showView('main');
    });

    btnTestRoutine.addEventListener('click', () => {
        vscode.postMessage({
            command: 'testRoutine',
            commands: selectedCommands.map(b => ({
                command: b.command,
                type: b.type || 'vscode-command',
                label: b.label
            })),
            delay: parseInt(routineDelayInput.value) || 0
        });
    });

    routineNameInput.addEventListener('input', validateStep1);

    // Custom command input with search
    const customCommandInput = document.getElementById('customCommandInput');
    const btnAddCustomCommand = document.getElementById('btnAddCustomCommand');
    const commandDropdown = document.getElementById('commandDropdown');
    const commandCount = document.getElementById('commandCount');
    let selectedDropdownIndex = -1;

    function addCustomCommand(cmd) {
        const command = cmd || customCommandInput.value.trim();
        if (command) {
            selectedCommands.push({
                id: 'custom-' + Date.now(),
                label: command,
                command: command,
                type: 'vscode-command'
            });
            renderSelectedBlocks();
            validateStep1();
            customCommandInput.value = '';
            hideDropdown();
        }
    }

    // Terminal command input
    const terminalCommandInput = document.getElementById('terminalCommandInput');
    const btnAddTerminalCommand = document.getElementById('btnAddTerminalCommand');

    function addTerminalCommand() {
        const command = terminalCommandInput.value.trim();
        if (command) {
            selectedCommands.push({
                id: 'term-' + Date.now(),
                label: command,
                command: command,
                type: 'terminal-command'
            });
            renderSelectedBlocks();
            validateStep1();
            terminalCommandInput.value = '';
        }
    }

    btnAddTerminalCommand.addEventListener('click', addTerminalCommand);
    terminalCommandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTerminalCommand();
        }
    });

    // Delay input
    const delayInput = document.getElementById('delayInput');
    const btnAddDelay = document.getElementById('btnAddDelay');

    function addDelay() {
        const delayMs = parseInt(delayInput.value) || 0;
        if (delayMs > 0) {
            const label = delayMs >= 1000 ? (delayMs / 1000) + 's' : delayMs + 'ms';
            selectedCommands.push({
                id: 'delay-' + Date.now(),
                label: 'Delay ' + label,
                command: String(delayMs),
                type: 'delay'
            });
            renderSelectedBlocks();
            validateStep1();
            delayInput.value = '';
        }
    }

    btnAddDelay.addEventListener('click', addDelay);
    delayInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDelay();
        }
    });

    function searchCommands(query) {
        if (!query || query.length < 2) {
            hideDropdown();
            commandCount.textContent = '';
            return;
        }

        const lowerQuery = query.toLowerCase();
        const matches = ALL_COMMANDS.filter(cmd =>
            cmd.toLowerCase().includes(lowerQuery)
        ).slice(0, 50);

        commandCount.textContent = matches.length + ' comandos encontrados';

        if (matches.length === 0) {
            hideDropdown();
            return;
        }

        commandDropdown.innerHTML = matches.map((cmd, i) => {
            const idx = cmd.toLowerCase().indexOf(lowerQuery);
            const before = escapeHtml(cmd.slice(0, idx));
            const match = escapeHtml(cmd.slice(idx, idx + query.length));
            const after = escapeHtml(cmd.slice(idx + query.length));
            return '<div class="command-option" data-cmd="' + escapeHtml(cmd) + '" data-index="' + i + '">' +
                before + '<span class="match">' + match + '</span>' + after +
                '</div>';
        }).join('');

        commandDropdown.classList.add('visible');
        selectedDropdownIndex = -1;

        commandDropdown.querySelectorAll('.command-option').forEach(el => {
            el.addEventListener('click', () => {
                addCustomCommand(el.dataset.cmd);
            });
        });
    }

    function hideDropdown() {
        commandDropdown.classList.remove('visible');
        selectedDropdownIndex = -1;
    }

    function navigateDropdown(direction) {
        const options = commandDropdown.querySelectorAll('.command-option');
        if (options.length === 0) return;

        if (selectedDropdownIndex >= 0 && options[selectedDropdownIndex]) {
            options[selectedDropdownIndex].style.background = '';
        }

        selectedDropdownIndex += direction;
        if (selectedDropdownIndex < 0) selectedDropdownIndex = options.length - 1;
        if (selectedDropdownIndex >= options.length) selectedDropdownIndex = 0;

        options[selectedDropdownIndex].style.background = 'var(--vscode-list-activeSelectionBackground)';
        options[selectedDropdownIndex].scrollIntoView({ block: 'nearest' });
    }

    btnAddCustomCommand.addEventListener('click', () => addCustomCommand());

    customCommandInput.addEventListener('input', (e) => {
        searchCommands(e.target.value);
    });

    customCommandInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateDropdown(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateDropdown(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const options = commandDropdown.querySelectorAll('.command-option');
            if (selectedDropdownIndex >= 0 && options[selectedDropdownIndex]) {
                addCustomCommand(options[selectedDropdownIndex].dataset.cmd);
            } else if (customCommandInput.value.trim()) {
                addCustomCommand();
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });

    customCommandInput.addEventListener('blur', () => {
        setTimeout(hideDropdown, 200);
    });

    customCommandInput.addEventListener('focus', () => {
        if (customCommandInput.value.length >= 2) {
            searchCommands(customCommandInput.value);
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'routinesUpdated') {
            routines = message.routines;
            renderRoutineList();
        } else if (message.command === 'gestureValidation') {
            handleGestureValidation(message);
        }
    });

    function handleGestureValidation(message) {
        if (!message.isValid) {
            showValidationMessage('error', message.message);
            setTimeout(() => hideValidationMessage(), 3000);
            pendingValidation = null;
            return;
        }

        if (pendingValidation) {
            recordedSamples.push(pendingValidation);
            pendingValidation = null;
            updateSampleDots();

            const current = recordedSamples.length;
            showValidationMessage('success', 'Gesto ' + current + '/3');

            if (current >= REQUIRED_SAMPLES) {
                btnSaveRoutine.disabled = false;
                showValidationMessage('success', 'COMPLETO! Guarda ahora');
            } else {
                setTimeout(() => hideValidationMessage(), 1500);
            }
        }
    }

    function showValidationMessage(type, text) {
        validationMessage.className = 'validation-message visible ' + type;
        validationMessage.textContent = text;
    }

    function hideValidationMessage() {
        validationMessage.classList.remove('visible');
    }

    function showView(view) {
        mainView.classList.toggle('active', view === 'main');
        createView.classList.toggle('active', view === 'create');
    }

    function showStep(step) {
        step1.classList.toggle('active', step === 1);
        step2.classList.toggle('active', step === 2);
    }

    function resetCreateForm() {
        routineNameInput.value = '';
        routineDelayInput.value = '0';
        selectedCommands = [];
        recordedSamples = [];
        editingRoutineName = null;
        btnSaveRoutine.disabled = true;
        renderSelectedBlocks();
        validateStep1();
        showStep(1);
    }

    function renderBlocks() {
        const categories = {
            files: { name: 'Archivos', blocks: [] },
            focus: { name: 'Concentracion', blocks: [] },
            appearance: { name: 'Apariencia', blocks: [] },
            terminal: { name: 'Terminal', blocks: [] },
            git: { name: 'Git', blocks: [] },
            utils: { name: 'Utilidades', blocks: [] }
        };

        BLOCKS.forEach(block => {
            if (categories[block.category]) {
                categories[block.category].blocks.push(block);
            }
        });

        blocksContainer.innerHTML = Object.entries(categories)
            .filter(([key, cat]) => cat.blocks.length > 0)
            .map(([key, cat]) =>
                '<div class="category"><h3>' + escapeHtml(cat.name) + '</h3><div class="blocks-grid">' +
                cat.blocks.map(b => {
                    const typeClass = b.type === 'terminal-command' ? ' terminal-type' :
                                     b.type === 'delay' ? ' delay-type' : '';
                    return '<div class="block' + typeClass + '" data-id="' + escapeHtml(b.id) + '"><span>' + escapeHtml(b.label) + '</span></div>';
                }).join('') +
                '</div></div>'
            ).join('');

        blocksContainer.querySelectorAll('.block').forEach(el => {
            el.addEventListener('click', () => {
                const block = BLOCKS.find(b => b.id === el.dataset.id);
                if (block) {
                    selectedCommands.push({
                        id: block.id,
                        label: block.label,
                        command: block.command,
                        type: block.type || 'vscode-command'
                    });
                    renderSelectedBlocks();
                    validateStep1();
                }
            });
        });
    }

    function renderSelectedBlocks() {
        if (selectedCommands.length === 0) {
            selectedBlocksEl.innerHTML = '';
            selectedBlocksEl.classList.add('empty');
        } else {
            selectedBlocksEl.classList.remove('empty');
            selectedBlocksEl.innerHTML = selectedCommands.map((block, i) => {
                const type = block.type || 'vscode-command';
                const typeClass = type === 'terminal-command' ? ' terminal-type' :
                                 type === 'delay' ? ' delay-type' : '';
                const typeLabel = type === 'terminal-command' ? '[T] ' :
                                 type === 'delay' ? '[D] ' : '';
                return '<div class="selected-item' + typeClass + '">' +
                    '<span class="order">' + (i + 1) + '</span>' +
                    '<span class="block-label">' + typeLabel + escapeHtml(block.label) + '</span>' +
                    '<span class="block-actions">' +
                    '<span class="move-btn" data-dir="up" data-index="' + i + '"' + (i === 0 ? ' style="visibility:hidden"' : '') + '>&#8593;</span>' +
                    '<span class="move-btn" data-dir="down" data-index="' + i + '"' + (i === selectedCommands.length - 1 ? ' style="visibility:hidden"' : '') + '>&#8595;</span>' +
                    '<span class="remove" data-index="' + i + '">&#10005;</span>' +
                    '</span></div>';
            }).join('');

            selectedBlocksEl.querySelectorAll('.move-btn').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.dataset.index);
                    const dir = el.dataset.dir;
                    if (dir === 'up' && idx > 0) {
                        [selectedCommands[idx], selectedCommands[idx - 1]] = [selectedCommands[idx - 1], selectedCommands[idx]];
                    } else if (dir === 'down' && idx < selectedCommands.length - 1) {
                        [selectedCommands[idx], selectedCommands[idx + 1]] = [selectedCommands[idx + 1], selectedCommands[idx]];
                    }
                    renderSelectedBlocks();
                });
            });

            selectedBlocksEl.querySelectorAll('.remove').forEach(el => {
                el.addEventListener('click', () => {
                    selectedCommands.splice(parseInt(el.dataset.index), 1);
                    renderSelectedBlocks();
                    validateStep1();
                });
            });
        }
    }

    function validateStep1() {
        const name = routineNameInput.value.trim();
        const hasName = name.length > 0;
        const hasCommands = selectedCommands.length > 0;
        const isDuplicate = hasName && routines[name] && name !== editingRoutineName;

        btnNextStep.disabled = !(hasName && hasCommands && !isDuplicate);
        btnTestRoutine.disabled = !hasCommands;

        if (!hasName && !hasCommands) {
            step1Hint.textContent = 'Ingresa un nombre y selecciona al menos un bloque';
        } else if (!hasName) {
            step1Hint.textContent = 'Ingresa un nombre para la rutina';
        } else if (isDuplicate) {
            step1Hint.textContent = 'Ya existe una rutina con ese nombre';
        } else if (!hasCommands) {
            step1Hint.textContent = 'Selecciona al menos un bloque';
        } else {
            step1Hint.textContent = 'Listo para continuar';
        }
    }

    function renderRoutineList() {
        const names = Object.keys(routines);
        if (names.length === 0) {
            routineList.innerHTML = '<div class="empty-state">No hay rutinas creadas.<br>Crea tu primera rutina!</div>';
        } else {
            routineList.innerHTML = names.map((name, idx) => {
                const r = routines[name];
                const isEnabled = r.enabled !== false;
                const cmdLabels = r.commands.map(cmd => {
                    if (typeof cmd === 'string') {
                        const block = BLOCKS.find(b => b.command === cmd);
                        return block ? block.label : cmd;
                    }
                    return cmd.label || cmd.command;
                }).join(' -> ');

                return '<div class="routine-card' + (isEnabled ? '' : ' disabled') + '">' +
                    '<canvas class="routine-preview" id="preview-' + idx + '" width="60" height="60"></canvas>' +
                    '<div class="routine-info">' +
                    '<div class="routine-name">' + escapeHtml(r.name) + (isEnabled ? '' : ' (desactivada)') + '</div>' +
                    '<div class="routine-commands">' + escapeHtml(cmdLabels) + '</div>' +
                    '</div>' +
                    '<div class="routine-actions">' +
                    '<button class="secondary" data-toggle="' + escapeHtml(name) + '">' + (isEnabled ? 'Desactivar' : 'Activar') + '</button>' +
                    '<button class="secondary" data-edit="' + escapeHtml(name) + '">Editar</button>' +
                    '<button class="danger" data-delete="' + escapeHtml(name) + '">Eliminar</button>' +
                    '</div></div>';
            }).join('');

            names.forEach((name, idx) => {
                const r = routines[name];
                if (r.samples && r.samples.length > 0) {
                    drawGesturePreview('preview-' + idx, r.samples[0]);
                }
            });

            routineList.querySelectorAll('[data-toggle]').forEach(el => {
                el.addEventListener('click', () => {
                    vscode.postMessage({ command: 'toggleRoutine', name: el.dataset.toggle });
                });
            });

            routineList.querySelectorAll('[data-edit]').forEach(el => {
                el.addEventListener('click', () => editRoutine(el.dataset.edit));
            });

            routineList.querySelectorAll('[data-delete]').forEach(el => {
                el.addEventListener('click', () => {
                    vscode.postMessage({ command: 'deleteRoutine', name: el.dataset.delete });
                });
            });
        }
    }

    function editRoutine(name) {
        const r = routines[name];
        if (!r) return;

        editingRoutineName = name;
        routineNameInput.value = r.name;
        routineDelayInput.value = r.delay || 0;

        selectedCommands = r.commands.map(cmd => {
            if (typeof cmd === 'string') {
                const block = BLOCKS.find(b => b.command === cmd);
                return block ? {
                    id: block.id,
                    label: block.label,
                    command: block.command,
                    type: block.type || 'vscode-command'
                } : {
                    id: cmd,
                    label: cmd,
                    command: cmd,
                    type: 'vscode-command'
                };
            }
            return {
                id: cmd.command,
                label: cmd.label || cmd.command,
                command: cmd.command,
                type: cmd.type || 'vscode-command'
            };
        });

        recordedSamples = r.samples ? r.samples.slice() : [];
        renderSelectedBlocks();
        validateStep1();
        updateSampleDots();
        btnSaveRoutine.disabled = recordedSamples.length < REQUIRED_SAMPLES;
        showView('create');
        showStep(1);
    }

    function drawGesturePreview(canvasId, points) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !points || points.length < 2) return;

        const ctx = canvas.getContext('2d');
        const padding = 8;
        const size = 60 - padding * 2;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const scale = Math.min(size / width, size / height);
        const offsetX = padding + (size - width * scale) / 2;
        const offsetY = padding + (size - height * scale) / 2;

        ctx.strokeStyle = getThemeColor('--vscode-editorCursor-foreground', '#888');
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        points.forEach((p, i) => {
            const x = (p.x - minX) * scale + offsetX;
            const y = (p.y - minY) * scale + offsetY;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    function setupCanvas() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = getThemeColor('--vscode-editorCursor-foreground', '#888');
        ctx.lineWidth = 4;

        canvas.addEventListener('mousedown', startPosition);
        canvas.addEventListener('mouseup', finishedPosition);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', finishedPosition);
    }

    function startPosition(e) {
        painting = true;
        points = [];
        hideValidationMessage();
        draw(e);
    }

    function finishedPosition() {
        if (!painting) return;
        painting = false;
        ctx.beginPath();

        if (points.length > 5) {
            pendingValidation = points.slice();
            validationRequestId++;

            const currentRequestId = validationRequestId;

            vscode.postMessage({
                command: 'validateGesture',
                points: pendingValidation,
                requestId: currentRequestId,
                excludeRoutineName: editingRoutineName
            });

            showValidationMessage('success', 'Validando...');

            setTimeout(() => {
                if (pendingValidation) {
                    showValidationMessage('error', 'Error - reintenta');
                    pendingValidation = null;
                    setTimeout(() => hideValidationMessage(), 2000);
                }
            }, 3000);
        } else {
            showValidationMessage('error', 'Muy corto');
            setTimeout(() => hideValidationMessage(), 2000);
        }

        points = [];
        setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 500);
    }

    function draw(e) {
        if (!painting) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        points.push({x, y});
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function updateSampleDots() {
        for (let i = 1; i <= 3; i++) {
            const dot = document.getElementById('dot' + i);
            if (recordedSamples.length >= i) {
                dot.classList.add('done');
            } else {
                dot.classList.remove('done');
            }
        }
    }
})();
