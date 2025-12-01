// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DollarRecognizer, Point } from './recognizer';

// Global state for drawing mode
let isDrawingMode = false;
let statusBarItem: vscode.StatusBarItem;

// Decoration type for drawing
let drawingDecorationType: vscode.TextEditorDecorationType;
// Array to store the selections that represent the current gesture
let currentGestureRanges: vscode.Selection[] = [];

// Store for recorded gestures: CommandID -> Array of Strokes (Points[])
let gestureStore: Record<string, {x:number, y:number}[][]> = {};

// Reference to the panel to communicate with it
let currentPanel: vscode.WebviewPanel | undefined = undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-pen" is now active!');

	// Load gestures from global state on activation
	gestureStore = context.globalState.get('codePen.gestures', {});
	console.log('Loaded gestures from globalState:', gestureStore);

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

		panel.webview.html = getWebviewContent();

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
										case 'requestCommandPick':
											// Show the QuickPick to select a command
											const allCommands = await vscode.commands.getCommands(true);
											
											// Build a map of metadata from extensions
											const commandMetadata = new Map<string, { title: string, keybinding?: string }>();
											
											for (const ext of vscode.extensions.all) {
												const contributes = ext.packageJSON?.contributes;
												if (!contributes) continue;
					
												// Map Titles
												if (contributes.commands) {
													for (const cmd of contributes.commands) {
														commandMetadata.set(cmd.command, { title: cmd.title });
													}
												}
												
												// Map Keybindings (append to existing metadata if present)
												if (contributes.keybindings) {
													for (const kb of contributes.keybindings) {
														const existing = commandMetadata.get(kb.command);
														if (existing) {
															existing.keybinding = kb.key;
														} else {
															// If we have a keybinding but no command title definition (rare but possible)
															commandMetadata.set(kb.command, { title: kb.command, keybinding: kb.key });
														}
													}
												}
											}
					
											// Create QuickPickItems
											const items: vscode.QuickPickItem[] = allCommands.map(cmdId => {
												const meta = commandMetadata.get(cmdId);
												if (meta) {
													return {
														label: meta.title,
														description: cmdId,
														detail: meta.keybinding ? `Keybinding: ${meta.keybinding}` : undefined,
														// Store ID in a hidden way or just use description later
														picked: false 
													};
												} else {
													// Fallback for built-in commands or those without metadata
													return {
														label: cmdId,
														description: "Built-in / No metadata",
													};
												}
											});
					
											// Sort alphabetically
											items.sort((a, b) => a.label.localeCompare(b.label));
					
											const selectedItem = await vscode.window.showQuickPick(items, {
												placeHolder: 'Select a command to associate with the gesture',
												matchOnDescription: true,
												matchOnDetail: true
											});
											
											if (selectedItem) {
												// Use description (which contains the ID for enhanced items) or label (for simple items)
												// Wait, for enhanced items label is Title. We need the ID.
												// Let's recover the ID.
												const commandId = selectedItem.description === "Built-in / No metadata" ? selectedItem.label : selectedItem.description;
					
												if (commandId) {
													panel.webview.postMessage({ 
														command: 'startRecording', 
														targetCommand: commandId 
													});
												}
											}
											return;					case 'saveGesture':
						// Store the gesture in memory
						gestureStore[message.targetCommand] = message.samples;
						// Persist to global state
						context.globalState.update('codePen.gestures', gestureStore);
						vscode.window.showInformationMessage(`Gesture saved for: ${message.targetCommand} (${message.samples.length} samples)`);
						outputChannel.appendLine(`SAVED GESTURE for ${message.targetCommand}. Samples: ${message.samples.length}`);
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

				// 2. Prepare templates from store
				const templates = Object.keys(gestureStore).map(commandName => {
					return {
						name: commandName,
						points: gestureStore[commandName] // This is Point[][] (array of samples)
					};
				});

				// 3. Recognize
				if (templates.length > 0) {
					const result = DollarRecognizer.recognize(candidatePoints, templates);
					outputChannel.appendLine(`RECOGNITION RESULT: ${result.name} (Score: ${result.score.toFixed(2)})`);

					if (result.score > 0.80) {
						vscode.window.showInformationMessage(`Gesture Detected: ${result.name}`);
						// Execute the command
						vscode.commands.executeCommand(result.name);
					} else {
						vscode.window.setStatusBarMessage(`Gesture not recognized (Score: ${result.score.toFixed(2)})`, 3000);
					}
				} else {
					outputChannel.appendLine("No gestures recorded yet.");
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

function getWebviewContent() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Pen Canvas</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            overflow: hidden; 
            background-color: var(--vscode-editor-background); 
			font-family: var(--vscode-font-family);
        }
		.controls {
			position: absolute;
			top: 10px;
			left: 10px;
			display: flex;
			gap: 10px;
			align-items: center;
			z-index: 10;
		}
		button {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 6px 12px;
			cursor: pointer;
			font-size: 13px;
		}
		button:hover {
			background: var(--vscode-button-hoverBackground);
		}
        canvas { 
            display: block; 
            cursor: crosshair; 
        }
        #status { 
			color: var(--vscode-editor-foreground); 
			opacity: 0.8;
			font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="controls">
		<button id="btnRecord">Record New Gesture</button>
		<span id="status">Free Drawing Mode</span>
	</div>
    <canvas id="drawingCanvas"></canvas>
    <script>
        const vscode = acquireVsCodeApi();
        const canvas = document.getElementById('drawingCanvas');
        const ctx = canvas.getContext('2d');
        const statusSpan = document.getElementById('status');
		const btnRecord = document.getElementById('btnRecord');
        
        let painting = false;
        let points = [];

		// Recording State
		let isRecording = false;
		let targetCommand = "";
		let recordedSamples = [];
		const REQUIRED_SAMPLES = 3;

        // Helper to get CSS variable value
        function getThemeColor(variableName) {
            return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
        }

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            // Use editor cursor color or fallback to yellow
            ctx.strokeStyle = getThemeColor('--vscode-editorCursor-foreground') || '#FFD700';
            ctx.lineWidth = 5;
        }
        window.addEventListener('resize', resize);
        resize();

		// Button Logic
		btnRecord.addEventListener('click', () => {
			vscode.postMessage({ command: 'requestCommandPick' });
		});

		// Handle messages from Extension
		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.command) {
				case 'startRecording':
					isRecording = true;
					targetCommand = message.targetCommand;
					recordedSamples = []; // Reset samples
					statusSpan.innerText = "Recording for: " + targetCommand + " (Draw 1/" + REQUIRED_SAMPLES + ")";
					statusSpan.style.color = "#FFD700"; // Highlight
					break;
			}
		});

        function startPosition(e) {
            painting = true;
            points = []; // Start new stroke
            ctx.strokeStyle = getThemeColor('--vscode-editorCursor-foreground') || '#FFD700';
            draw(e);
        }

        function finishedPosition() {
			if (!painting) return;
            painting = false;
            ctx.beginPath();
			
			// Logic: Handle stroke
            if (points.length > 5) { // Ignore tiny accidental clicks
				if (isRecording) {
					recordedSamples.push(points);
					const count = recordedSamples.length;
					
					if (count < REQUIRED_SAMPLES) {
						statusSpan.innerText = "Recording for: " + targetCommand + " (Draw " + (count + 1) + "/" + REQUIRED_SAMPLES + ")";
					} else {
						// Finished!
						vscode.postMessage({
							command: 'saveGesture',
							targetCommand: targetCommand,
							samples: recordedSamples
						});
						
						// Reset UI
						isRecording = false;
						statusSpan.innerText = "Gesture Saved! Back to Free Drawing.";
						statusSpan.style.color = "";
						setTimeout(() => { statusSpan.innerText = "Free Drawing Mode"; }, 3000);
					}

				} else {
					// Normal Free Drawing
                	vscode.postMessage({ command: 'stroke', points: points });
				}
            }

            points = [];
            // Clear the canvas after stroke is finished
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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

        canvas.addEventListener('mousedown', startPosition);
        canvas.addEventListener('mouseup', finishedPosition);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', finishedPosition);

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