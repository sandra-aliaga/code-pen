// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Global state for drawing mode
let isDrawingMode = false;
let statusBarItem: vscode.StatusBarItem;

// Decoration type for drawing
let drawingDecorationType: vscode.TextEditorDecorationType;
// Array to store the ranges that represent the current gesture
let currentGestureRanges: vscode.Range[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "code-pen" is now active!');

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
			// Add the range to our gesture points and update decorations
			const range = new vscode.Range(anchorPosition, activePosition);
			currentGestureRanges.push(range);
			editor.setDecorations(drawingDecorationType, currentGestureRanges);
		} else {
			outputChannel.appendLine("--> Click / Stop - Processing Gesture...");
			// This means the user stopped selecting/dragging. We can consider this the end of a gesture.
			// For now, let's just clear the decorations and reset.
			// In a real implementation, you would process currentGestureRanges here.
			editor.setDecorations(drawingDecorationType, []);
			currentGestureRanges = []; // Reset for next gesture
		}
	});

	context.subscriptions.push(disposableHello);
	context.subscriptions.push(disposableToggle);
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

// This method is called when your extension is deactivated
export function deactivate() {
	if (drawingDecorationType) {
		drawingDecorationType.dispose();
	}
}
