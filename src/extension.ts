// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DollarRecognizer, Point } from './recognizer';

// =============================================================================
// PREDEFINED BLOCKS - Safe commands that users can use to build routines
// =============================================================================
interface Block {
	id: string;
	label: string;
	icon: string;
	command: string;
	category: 'files' | 'focus' | 'appearance' | 'terminal' | 'git';
}

const PREDEFINED_BLOCKS: Block[] = [
	// Files
	{ id: 'save', label: 'Guardar', icon: '', command: 'workbench.action.files.save', category: 'files' },
	{ id: 'saveAll', label: 'Guardar Todo', icon: '', command: 'workbench.action.files.saveAll', category: 'files' },
	{ id: 'format', label: 'Formatear', icon: '', command: 'editor.action.formatDocument', category: 'files' },
	{ id: 'closeEditor', label: 'Cerrar Editor', icon: '', command: 'workbench.action.closeActiveEditor', category: 'files' },
	{ id: 'closeAll', label: 'Cerrar Todo', icon: '', command: 'workbench.action.closeAllEditors', category: 'files' },

	// Focus
	{ id: 'zenMode', label: 'Modo Zen', icon: '', command: 'workbench.action.toggleZenMode', category: 'focus' },
	{ id: 'toggleSidebar', label: 'Toggle Sidebar', icon: '', command: 'workbench.action.toggleSidebarVisibility', category: 'focus' },
	{ id: 'togglePanel', label: 'Toggle Panel', icon: '', command: 'workbench.action.togglePanel', category: 'focus' },
	{ id: 'fullScreen', label: 'Pantalla Completa', icon: '', command: 'workbench.action.toggleFullScreen', category: 'focus' },
	{ id: 'toggleMinimap', label: 'Toggle Minimap', icon: '', command: 'editor.action.toggleMinimap', category: 'focus' },

	// Appearance
	{ id: 'changeTheme', label: 'Cambiar Tema', icon: '', command: 'workbench.action.selectTheme', category: 'appearance' },
	{ id: 'zoomIn', label: 'Aumentar Fuente', icon: '', command: 'editor.action.fontZoomIn', category: 'appearance' },
	{ id: 'zoomOut', label: 'Reducir Fuente', icon: '', command: 'editor.action.fontZoomOut', category: 'appearance' },
	{ id: 'zoomReset', label: 'Reset Fuente', icon: '', command: 'editor.action.fontZoomReset', category: 'appearance' },

	// Terminal
	{ id: 'newTerminal', label: 'Nueva Terminal', icon: '', command: 'workbench.action.terminal.new', category: 'terminal' },
	{ id: 'toggleTerminal', label: 'Toggle Terminal', icon: '', command: 'workbench.action.terminal.toggleTerminal', category: 'terminal' },
	{ id: 'clearTerminal', label: 'Limpiar Terminal', icon: '', command: 'workbench.action.terminal.clear', category: 'terminal' },

	// Git
	{ id: 'gitCommit', label: 'Git Commit', icon: '', command: 'git.commit', category: 'git' },
	{ id: 'gitPush', label: 'Git Push', icon: '', command: 'git.push', category: 'git' },
	{ id: 'gitPull', label: 'Git Pull', icon: '', command: 'git.pull', category: 'git' },
	{ id: 'gitStash', label: 'Git Stash', icon: '', command: 'git.stash', category: 'git' },
	{ id: 'gitStashPop', label: 'Git Stash Pop', icon: '', command: 'git.stashPop', category: 'git' },
];

// =============================================================================
// ROUTINE STRUCTURE - A routine is a gesture + sequence of commands
// =============================================================================
interface Routine {
	name: string;
	commands: string[];  // Array of command IDs to execute in sequence
	samples: { x: number; y: number }[][];  // Gesture samples for recognition
}

// Store for routines: RoutineName -> Routine
let routineStore: Record<string, Routine> = {};

// =============================================================================
// GLOBAL STATE
// =============================================================================

// Global state for drawing mode
let isDrawingMode = false;
let statusBarItem: vscode.StatusBarItem;

// Decoration type for drawing
let drawingDecorationType: vscode.TextEditorDecorationType;
// Array to store the selections that represent the current gesture
let currentGestureRanges: vscode.Selection[] = [];


// Reference to the panel to communicate with it
let currentPanel: vscode.WebviewPanel | undefined = undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-pen" is now active!');

	// Load routines from global state on activation
	routineStore = context.globalState.get('codePen.routines', {});
	console.log('Loaded routines from globalState:', routineStore);

	// Create an output channel to show the coordinates to the user
	const outputChannel = vscode.window.createOutputChannel("Code Pen Debug");
	// outputChannel.show(true); // Show it automatically

	// Initialize the decoration type
	drawingDecorationType = vscode.window.createTextEditorDecorationType({
		textDecoration: 'underline solid yellow',
		overviewRulerColor: 'yellow', // Also show a mark in the scrollbar
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	});

	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'code-pen.toggleDrawing';
	context.subscriptions.push(statusBarItem);
	updateStatusBar();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposableHello = vscode.commands.registerCommand('code-pen.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from code-pen!');
	});

	const disposableToggle = vscode.commands.registerCommand('code-pen.toggleDrawing', () => {
		isDrawingMode = !isDrawingMode;
		updateStatusBar();
		if (isDrawingMode) {
			vscode.window.showInformationMessage('Drawing Mode ON - Select text to draw!');
			outputChannel.show(true);
			outputChannel.appendLine("=== START DRAWING SESSION ===");
			// Clear any previous decorations if mode is re-entered
			currentGestureRanges = [];
			vscode.window.activeTextEditor?.setDecorations(drawingDecorationType, []);
		} else {
			vscode.window.showInformationMessage('Drawing Mode OFF');
			outputChannel.appendLine("=== END DRAWING SESSION ===");
			// Clear all decorations when drawing mode is off
			vscode.window.activeTextEditor?.setDecorations(drawingDecorationType, []);
			currentGestureRanges = []; // Reset points
		}
	});

	const disposableCanvas = vscode.commands.registerCommand('code-pen.openCanvas', () => {
		// If panel already exists, show it
		if (currentPanel) {
			currentPanel.reveal(vscode.ViewColumn.Beside);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'codePenCanvas',
			'Code Pen Canvas',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);
		
		currentPanel = panel;

		panel.webview.html = getWebviewContent(PREDEFINED_BLOCKS, routineStore);

		// Cleanup when panel is closed
		panel.onDidDispose(
			() => {
				currentPanel = undefined;
			},
			null,
			context.subscriptions
		);

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'log':
						outputChannel.appendLine(message.text);
						return;

					case 'saveRoutine':
						// Save the routine with its commands and gesture samples
						const routine: Routine = {
							name: message.name,
							commands: message.commands,
							samples: message.samples
						};
						routineStore[message.name] = routine;
						// Persist to global state
						context.globalState.update('codePen.routines', routineStore);
						vscode.window.showInformationMessage(`Rutina guardada: "${message.name}" (${message.commands.length} comandos)`);
						outputChannel.appendLine(`SAVED ROUTINE "${message.name}". Commands: ${message.commands.join(' -> ')}`);
						// Send updated routines back to webview
						panel.webview.postMessage({
							command: 'routinesUpdated',
							routines: routineStore
						});
						return;

					case 'deleteRoutine':
						delete routineStore[message.name];
						context.globalState.update('codePen.routines', routineStore);
						vscode.window.showInformationMessage(`Rutina eliminada: "${message.name}"`);
						// Send updated routines back to webview
						panel.webview.postMessage({
							command: 'routinesUpdated',
							routines: routineStore
						});
						return;

					case 'stroke':
						outputChannel.appendLine(`Canvas Stroke: ${JSON.stringify(message.points)}`);
						return;
				}
			},
			undefined,
			context.subscriptions
		);
	});

	// Register the event listener for selection changes
	const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
		if (!isDrawingMode) {
			return;
		}

		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const activePosition = event.selections[0].active;
		const anchorPosition = event.selections[0].anchor;
		
		// Log the position
		outputChannel.appendLine(`Cursor at: Line ${activePosition.line}, Char ${activePosition.character} | Anchor at: Line ${anchorPosition.line}, Char ${anchorPosition.character}`);
		
		// If a selection is being made (i.e., not just a click)
		if (!activePosition.isEqual(anchorPosition)) {
			outputChannel.appendLine("--> Drawing/Selecting...");
			// Add the selection to our gesture points and update decorations
			const selection = new vscode.Selection(anchorPosition, activePosition);
			currentGestureRanges.push(selection);
			editor.setDecorations(drawingDecorationType, currentGestureRanges);
		} else {
			outputChannel.appendLine("--> Click / Stop - Processing Gesture...");
			
			// PROCESS GESTURE
			if (currentGestureRanges.length > 5) {
				// 1. Convert ranges to Points
				// We use the 'active' position (where the cursor is) as the point
				const candidatePoints: Point[] = currentGestureRanges.map(s => {
					return { x: s.active.character, y: s.active.line };
				});

				// 2. Prepare templates from routineStore
				const templates = Object.keys(routineStore).map(routineName => {
					return {
						name: routineName,
						points: routineStore[routineName].samples // This is Point[][] (array of samples)
					};
				});

				// 3. Recognize
				if (templates.length > 0) {
					const result = DollarRecognizer.recognize(candidatePoints, templates);
					outputChannel.appendLine(`RECOGNITION RESULT: ${result.name} (Score: ${result.score.toFixed(2)})`);

					if (result.score > 0.80) {
						const routine = routineStore[result.name];
						vscode.window.showInformationMessage(`Rutina detectada: "${result.name}"`);
						outputChannel.appendLine(`Executing routine: ${routine.commands.join(' -> ')}`);

						// Execute all commands in sequence
						(async () => {
							for (const cmd of routine.commands) {
								outputChannel.appendLine(`  -> Executing: ${cmd}`);
								try {
									await vscode.commands.executeCommand(cmd);
								} catch (err) {
									outputChannel.appendLine(`  -> Error executing ${cmd}: ${err}`);
								}
							}
							outputChannel.appendLine(`Routine "${result.name}" completed.`);
						})();
					} else {
						vscode.window.setStatusBarMessage(`Gesto no reconocido (Score: ${result.score.toFixed(2)})`, 3000);
					}
				} else {
					outputChannel.appendLine("No routines recorded yet.");
				}
			}

			// This means the user stopped selecting/dragging. We can consider this the end of a gesture.
			// For now, let's just clear the decorations and reset.
			// In a real implementation, you would process currentGestureRanges here.
			editor.setDecorations(drawingDecorationType, []);
			currentGestureRanges = []; // Reset for next gesture
		}
	});

	context.subscriptions.push(disposableHello);
	context.subscriptions.push(disposableToggle);
	context.subscriptions.push(disposableCanvas);
	context.subscriptions.push(selectionListener);
	context.subscriptions.push(drawingDecorationType); // Ensure decorations are disposed
}

function updateStatusBar() {
	if (isDrawingMode) {
		statusBarItem.text = `$(pencil) Drawing ON`;
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	} else {
		statusBarItem.text = `$(circle-slash) Drawing OFF`;
		statusBarItem.backgroundColor = undefined;
	}
	statusBarItem.show();
}

function getWebviewContent(blocks: Block[], routines: Record<string, Routine>) {
	const blocksJson = JSON.stringify(blocks);
	const routinesJson = JSON.stringify(routines);

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Pen - Rutinas</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 16px;
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            min-height: 100vh;
        }
        h1 { margin: 0 0 16px 0; font-size: 1.4em; }
        h2 { margin: 0 0 12px 0; font-size: 1.1em; opacity: 0.9; }
        h3 { margin: 0 0 8px 0; font-size: 0.95em; opacity: 0.7; text-transform: uppercase; }

        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 13px;
            border-radius: 4px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.danger { background: #c53030; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }

        input[type="text"] {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 8px 12px;
            font-size: 13px;
            border-radius: 4px;
            width: 100%;
        }

        /* Views */
        .view { display: none; }
        .view.active { display: block; }

        /* Main View - Routine List */
        .routine-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .routine-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .routine-info { flex: 1; }
        .routine-name { font-weight: bold; margin-bottom: 4px; }
        .routine-commands { font-size: 12px; opacity: 0.7; }
        .routine-actions { display: flex; gap: 8px; }
        .routine-actions button { padding: 4px 8px; font-size: 12px; }

        .empty-state {
            text-align: center;
            padding: 40px;
            opacity: 0.6;
        }

        /* Create View */
        .create-container { display: flex; flex-direction: column; gap: 16px; }
        .step { display: none; }
        .step.active { display: block; }

        .blocks-section { display: flex; gap: 16px; margin-top: 8px; }
        .blocks-available { flex: 1; }
        .blocks-selected { flex: 1; }

        .category { margin-bottom: 16px; }
        .blocks-grid { display: flex; flex-wrap: wrap; gap: 6px; }

        .block {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            user-select: none;
            transition: transform 0.1s, box-shadow 0.1s;
        }
        .block:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .block .icon { font-size: 14px; }

        .selected-list {
            min-height: 100px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 2px dashed var(--vscode-panel-border);
            border-radius: 6px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .selected-list.empty::before {
            content: 'Haz clic en los bloques para agregarlos aqui';
            display: block;
            text-align: center;
            padding: 30px;
            opacity: 0.5;
            font-size: 12px;
        }

        .selected-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
            font-size: 12px;
        }
        .selected-item .order {
            background: rgba(255,255,255,0.2);
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: bold;
        }
        .selected-item .remove {
            margin-left: auto;
            cursor: pointer;
            opacity: 0.7;
        }
        .selected-item .remove:hover { opacity: 1; }

        /* Canvas View */
        .canvas-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }
        #drawingCanvas {
            border: 2px solid var(--vscode-panel-border);
            border-radius: 8px;
            cursor: crosshair;
            background: var(--vscode-editor-background);
        }
        .sample-indicators {
            display: flex;
            gap: 12px;
            font-size: 24px;
        }
        .sample-dot { opacity: 0.3; }
        .sample-dot.done { opacity: 1; }

        .nav-buttons { display: flex; gap: 8px; margin-top: 16px; }
    </style>
</head>
<body>
    <!-- MAIN VIEW: List of Routines -->
    <div id="mainView" class="view active">
        <h1>Code Pen - Rutinas</h1>
        <button id="btnNewRoutine">+ Nueva Rutina</button>
        <div id="routineList" class="routine-list"></div>
    </div>

    <!-- CREATE VIEW: Build a Routine -->
    <div id="createView" class="view">
        <h1>Crear Nueva Rutina</h1>

        <!-- Step 1: Name and Commands -->
        <div id="step1" class="step active">
            <div class="create-container">
                <div>
                    <h3>Nombre de la Rutina</h3>
                    <input type="text" id="routineName" placeholder="Ej: Modo Focus, Deploy Rapido...">
                </div>

                <div class="blocks-section">
                    <div class="blocks-available">
                        <h2>Bloques Disponibles</h2>
                        <div id="blocksContainer"></div>
                    </div>
                    <div class="blocks-selected">
                        <h2>Tu Rutina</h2>
                        <div id="selectedBlocks" class="selected-list empty"></div>
                    </div>
                </div>

                <div class="nav-buttons">
                    <button class="secondary" id="btnCancelCreate">Cancelar</button>
                    <button id="btnNextStep" disabled>Siguiente: Dibujar Gesto</button>
                </div>
            </div>
        </div>

        <!-- Step 2: Draw Gesture -->
        <div id="step2" class="step">
            <div class="canvas-container">
                <h2>Dibuja el gesto para: <span id="gestureRoutineName"></span></h2>
                <p style="opacity: 0.7; margin: 0;">Dibuja el mismo gesto 3 veces para registrarlo</p>

                <div class="sample-indicators">
                    <span class="sample-dot" id="dot1">○</span>
                    <span class="sample-dot" id="dot2">○</span>
                    <span class="sample-dot" id="dot3">○</span>
                </div>

                <canvas id="drawingCanvas" width="400" height="300"></canvas>

                <div class="nav-buttons">
                    <button class="secondary" id="btnBackStep">Atras</button>
                    <button id="btnSaveRoutine" disabled>Guardar Rutina</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Data from extension
        const BLOCKS = ${blocksJson};
        let routines = ${routinesJson};

        // State
        let selectedCommands = [];
        let recordedSamples = [];
        const REQUIRED_SAMPLES = 3;

        // DOM Elements
        const mainView = document.getElementById('mainView');
        const createView = document.getElementById('createView');
        const step1 = document.getElementById('step1');
        const step2 = document.getElementById('step2');
        const routineList = document.getElementById('routineList');
        const blocksContainer = document.getElementById('blocksContainer');
        const selectedBlocksEl = document.getElementById('selectedBlocks');
        const routineNameInput = document.getElementById('routineName');
        const btnNextStep = document.getElementById('btnNextStep');
        const btnSaveRoutine = document.getElementById('btnSaveRoutine');
        const gestureRoutineName = document.getElementById('gestureRoutineName');

        // Canvas
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        let painting = false;
        let points = [];

        // Initialize
        renderBlocks();
        renderRoutineList();
        setupCanvas();

        // Event Listeners
        document.getElementById('btnNewRoutine').addEventListener('click', () => {
            showView('create');
            resetCreateForm();
        });

        document.getElementById('btnCancelCreate').addEventListener('click', () => {
            showView('main');
        });

        document.getElementById('btnBackStep').addEventListener('click', () => {
            showStep(1);
        });

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
                commands: selectedCommands.map(b => b.command),
                samples: recordedSamples
            });
            showView('main');
        });

        routineNameInput.addEventListener('input', validateStep1);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'routinesUpdated') {
                routines = message.routines;
                renderRoutineList();
            }
        });

        // Functions
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
            selectedCommands = [];
            recordedSamples = [];
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
                git: { name: 'Git', blocks: [] }
            };

            BLOCKS.forEach(block => {
                categories[block.category].blocks.push(block);
            });

            blocksContainer.innerHTML = Object.entries(categories).map(([key, cat]) => {
                return '<div class="category">' +
                    '<h3>' + cat.name + '</h3>' +
                    '<div class="blocks-grid">' +
                    cat.blocks.map(b =>
                        '<div class="block" data-id="' + b.id + '">' +
                        '<span>' + b.label + '</span>' +
                        '</div>'
                    ).join('') +
                    '</div></div>';
            }).join('');

            // Add click handlers
            blocksContainer.querySelectorAll('.block').forEach(el => {
                el.addEventListener('click', () => {
                    const block = BLOCKS.find(b => b.id === el.dataset.id);
                    if (block) {
                        selectedCommands.push(block);
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
                selectedBlocksEl.innerHTML = selectedCommands.map((block, i) =>
                    '<div class="selected-item">' +
                    '<span class="order">' + (i + 1) + '</span>' +
                    '<span>' + block.label + '</span>' +
                    '<span class="remove" data-index="' + i + '">x</span>' +
                    '</div>'
                ).join('');

                // Add remove handlers
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
            const hasName = routineNameInput.value.trim().length > 0;
            const hasCommands = selectedCommands.length > 0;
            btnNextStep.disabled = !(hasName && hasCommands);
        }

        function renderRoutineList() {
            const names = Object.keys(routines);
            if (names.length === 0) {
                routineList.innerHTML = '<div class="empty-state">No hay rutinas creadas.<br>Crea tu primera rutina!</div>';
            } else {
                routineList.innerHTML = names.map(name => {
                    const r = routines[name];
                    const cmdLabels = r.commands.map(cmd => {
                        const block = BLOCKS.find(b => b.command === cmd);
                        return block ? block.label : cmd;
                    }).join(' -> ');

                    return '<div class="routine-card">' +
                        '<div class="routine-info">' +
                        '<div class="routine-name">' + r.name + '</div>' +
                        '<div class="routine-commands">' + cmdLabels + '</div>' +
                        '</div>' +
                        '<div class="routine-actions">' +
                        '<button class="danger" data-delete="' + name + '">Eliminar</button>' +
                        '</div>' +
                        '</div>';
                }).join('');

                // Add delete handlers
                routineList.querySelectorAll('[data-delete]').forEach(el => {
                    el.addEventListener('click', () => {
                        if (confirm('Eliminar rutina "' + el.dataset.delete + '"?')) {
                            vscode.postMessage({ command: 'deleteRoutine', name: el.dataset.delete });
                        }
                    });
                });
            }
        }

        // Canvas Setup
        function setupCanvas() {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;

            canvas.addEventListener('mousedown', startPosition);
            canvas.addEventListener('mouseup', finishedPosition);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseleave', finishedPosition);
        }

        function startPosition(e) {
            painting = true;
            points = [];
            draw(e);
        }

        function finishedPosition() {
            if (!painting) return;
            painting = false;
            ctx.beginPath();

            if (points.length > 5) {
                recordedSamples.push(points);
                updateSampleDots();

                if (recordedSamples.length >= REQUIRED_SAMPLES) {
                    btnSaveRoutine.disabled = false;
                }
            }

            points = [];
            setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 300);
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
                    dot.textContent = '●';
                    dot.classList.add('done');
                } else {
                    dot.textContent = '○';
                    dot.classList.remove('done');
                }
            }
        }
    </script>
</body>
</html>`;
}


// This method is called when your extension is deactivated
export function deactivate() {
	if (drawingDecorationType) {
		drawingDecorationType.dispose();
	}
}