import * as vscode from 'vscode';

import * as scopePicker from './scopePicker';
import path from 'path';

const CODETOUR_PARTICIPANT_NAME = 'codetour';
const START_TOUR_COMMAND_ID = 'tour.startTour';
const CREATE_TOUR_COMMAND_ID = 'codetour-participant.createTour';

interface ITourAgentResult extends vscode.ChatResult {
	tour: string;
}

const LANGUAGE_MODEL_ID = 'copilot-gpt-4';
const MAX_RETRIES = 3;

export function activate(context: vscode.ExtensionContext) {

	function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			return vscode.workspace.workspaceFolders[0];
		}
		return undefined;
	}

	async function findExcerptStartLineNumber(workspaceFolder: vscode.WorkspaceFolder, fileName: string, codeExcerpt: string): Promise<number> {
		let fullPath = path.join(workspaceFolder.uri.fsPath, fileName);
		const document = await vscode.workspace.openTextDocument(fullPath);
		const excerptLines = codeExcerpt.split('\n');

		for (let i = 0; i < document.lineCount; i++) {
			// excerpts do not always start at the first character, therefore only check whether the first
			// line of the excerpt is a suffix of the current line
			if (document.lineAt(i).text.endsWith(excerptLines[0])) {
				let found = true;
				for (let j = 1; j < excerptLines.length; j++) {
					if (i + j >= document.lineCount || document.lineAt(i + j).text !== excerptLines[j]) {
						// the excerpts sometimes do not preserve empty lines, therefore
						// try to insert an empty line into the excerpt and check again
						if (document.lineAt(i + j).text === '') {
							excerptLines.splice(j, 0, '');
							if (i + j >= document.lineCount || document.lineAt(i + j).text !== excerptLines[j]) {
								found = false;
								break;
							}
						}
					}
				}
				if (found) {
					return i + 1;
				}
			}
		}
		return -1;
	}

	async function addLineNumbersToCodeExcerpts(input: string): Promise<string> {
		let isInExcerpt = false;
		let result = '';
		let fileName = '';
		let codeExcerpt = '';

		let workspaceFolder = getWorkspaceFolder();
		if (!workspaceFolder) {
			return '';
		}

		const lines = input.split('\n');
		for (let line of lines) {
			if (line.startsWith('Here is a potentially relevant code excerpt from')) {
				fileName = line.split('`')[1];
				codeExcerpt = '';
				result += line + '\n';
			} else if (line.startsWith('```')) {
				if (isInExcerpt) {
					result += await addLineNumberPrefixToCodeExcerpt(workspaceFolder, fileName, codeExcerpt) + '\n';
				}
				isInExcerpt = !isInExcerpt;
				result += line + '\n';
			} else if (isInExcerpt) {
				codeExcerpt += line + '\n';
			} else {
				result += line + '\n';
			}
		}
		return result;
	}

	function getLongestExcerptWithoutElision(codeExcerpt: string): string {
		const lines = codeExcerpt.split('\n');
		let longestSequenceStart = 0;
		let longestSequenceEnd = 0;
		let currentSequenceStart = 0;
		let currentSequenceEnd = 0;

		for (let i = 0; i < lines.length; i++) {
			if (!lines[i].includes('/*...*/')) {
				currentSequenceEnd = i;
				// If the current sequence is longer than the longest sequence found so far, update the longest sequence
				if (currentSequenceEnd - currentSequenceStart > longestSequenceEnd - longestSequenceStart) {
					longestSequenceStart = currentSequenceStart;
					longestSequenceEnd = currentSequenceEnd;
				}
			} else {
				// The line contains an elision, so start a new sequence
				currentSequenceStart = i + 1;
				currentSequenceEnd = i + 1;
			}
		}
		// Extract the longest sequence of real content lines and join them into a single string
		const longestSequence = lines.slice(longestSequenceStart, longestSequenceEnd + 1).join('\n');
		return longestSequence;
	}

	async function addLineNumberPrefixToCodeExcerpt(workspaceFolder: vscode.WorkspaceFolder, fileName: string, codeExcerpt: string) {
		const excerptWithoutElision = getLongestExcerptWithoutElision(codeExcerpt);
		const startingLineNumber = await findExcerptStartLineNumber(workspaceFolder, fileName, excerptWithoutElision);
		let numberedExcerpt = prefixLinesWithLineNumber(excerptWithoutElision, startingLineNumber);
		return numberedExcerpt;
	}

	function getRelativeFilePath(): string | undefined {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const document = activeEditor.document;
			return vscode.workspace.asRelativePath(document.uri);
		}
		return undefined;
	}

	function substituteVariable(value: string, start: number, end: number, variableValue: string): string {
		return value.substring(0, start) + variableValue + value.substring(end);
	}

	function prefixLinesWithLineNumber(input: string, startLineNumber: number): string {
		const lines = input.split('\n');
		if (startLineNumber === -1) {
			const prefixedLines = lines.map((line, index) => `/*-1*/ ${line}`);
			return prefixedLines.join('\n');
		}
		const prefixedLines = lines.map((line, index) => `/*${index + startLineNumber}*/ ${line}`);
		return prefixedLines.join('\n');
	}

	async function getCodeExcerpts(variable: vscode.ChatResolvedVariable, request: vscode.ChatRequest): Promise<string | undefined> {
		if (variable.values.length > 0 && typeof variable.values[0].value === 'string') {
			return await addLineNumbersToCodeExcerpts(variable.values[0].value);
		}
		return undefined;
	}

	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<ITourAgentResult> => {
		let resolvedPrompt = request.prompt;
		let prefixedCodeExcerpts: undefined | string = undefined;
		let variableWarnings = [];

		for (let variable of request.variables) {
			switch (variable.name) {
				case 'codebase':
					prefixedCodeExcerpts = await getCodeExcerpts(variable, request);
					break;
				default:
					variableWarnings.push(`The variable '${variable.name}' is not supported and will be ignored.`);
			}
			resolvedPrompt = substituteVariable(request.prompt, variable.range[0], variable.range[1], '');
		}

		for (let warning of variableWarnings) {
			stream.markdown(`${warning}`);
		}

		if (prefixedCodeExcerpts) {
			let tour = await createWorkspaceCodeTour(resolvedPrompt, prefixedCodeExcerpts, token, stream);
			return { tour: tour };
		} else {
			let tour = await createSingleFileCodeTour(resolvedPrompt, token, stream);
			return { tour: tour };
		}
	};

	const codeTourParticipant = vscode.chat.createChatParticipant(CODETOUR_PARTICIPANT_NAME, handler);
	codeTourParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'codetour.png');

	async function createSingleFileCodeTour(resolvedPrompt: string, token: vscode.CancellationToken, stream: vscode.ChatResponseStream): Promise<string> {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage(`There is no active editor, open an editor and try again.`);
			return '';
		}

		if (editor.selection.isEmpty) {
			if (!await scopePicker.selectRange(editor, editor.selection)) {
				return '';
			};
		}

		const filePath = getRelativeFilePath();
		const selection = editor.selection;
		let selectedText = editor.document.getText(selection.with({ start: selection.start.with({ character: 0 }), end: selection.end.with({ character: editor.document.lineAt(selection.end.line).text.length }) }));
		const lineNumberPrefixed = prefixLinesWithLineNumber(selectedText, selection.start.line + 1);

		if (resolvedPrompt.trim() === '') {
			resolvedPrompt = `Explain how the code works with a CodeTour`;
		}
		const messages = [
			new vscode.LanguageModelChatSystemMessage(
				`There is a VSCode extension called CodeTour it supports to create so called code tours in a JSON file.\n` +
				`When asked to explain the code you should respond with a code tour JSON file.\n` +
				`The JSON schema of the code tour file is "https://aka.ms/codetour-schema"\n` +
				`Only respond with the contents of the code tour file as JSON and nothing else.\n` +
				`Do not wrap the JSON response in triple backticks.\n` +
				`When creating the tour then follow these guidelines:\n` +
				`- Add a 'title' attribute to the tour that describes its purpose.\n` +
				`- Add a 'file' attribute in each step use the following file path ${filePath} for its value.\n` +
				`- Each line in the code starts with a comment that corresponds to the line number in the file.\n` +
				`- Do not create a step for a line that has -1 as the line number.\n` +
				`When creating a step for the tour use the line number from the comment at the beginning of the line.\n` +
				- `Provide a detailed description for each step. The description may include markdown to improve its readability.\n` +
				- `Only create on Code Tourstep for each line of code that you want to explain.\n`

			),
			new vscode.LanguageModelChatUserMessage(
				`${resolvedPrompt}\n` +
				`This is the code that you should explain in a tour\n.` +
				`${lineNumberPrefixed}`
			),
		];

		let retries = 0;
		let tour = '';
		for (; ;) {
			if (retries++ >= MAX_RETRIES || token.isCancellationRequested) {
				break;
			}
			stream.progress('Creating a Code Tour...');
			const response = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, token);
			tour = await processResponse(response, token);

			// Remove the triple backticks lines if the model has wrapped the JSON response in ```
			if (tour.startsWith('```json')) {
				const lines = tour.split('\n');
				tour = lines.slice(1, -1).join('\n');
			}

			try {
				let parsedTour = JSON.parse(tour);
				if (validateSingleFileTour(parsedTour)) {
					stream.markdown('Code Tour Created.');
					break;
				} else {
					throw new Error('Invalid Code Tour');
				}
			} catch (err) {
				stream.markdown('The created tour is not valid, retrying...');
				tour = '';
			}
		}
		if (tour.length <= 0) {
			stream.markdown(`Failed to create a Code Tour after multiple attempts, giving up.`);
			return '';
		}
		stream.button({
			command: START_TOUR_COMMAND_ID,
			arguments: [tour],
			title: vscode.l10n.t('Start the Tour')
		});
		return tour;
	}

	async function createWorkspaceCodeTour(resolvedPrompt: string, relevantCodeExcerpts: string, token: vscode.CancellationToken, stream: vscode.ChatResponseStream): Promise<string> {
		const messages = [
			new vscode.LanguageModelChatSystemMessage(
				`There is a VSCode extension called CodeTour it supports to create so called code tours in a JSON file.\n` +
				`When asked to explain the code you should respond with a code tour JSON file.\n` +
				`The JSON schema of the code tour file is "https://aka.ms/codetour-schema"\n` +
				`Only respond with the contents of the code tour file as JSON and nothing else.\n` +
				`Do not wrap the JSON response in triple backticks.\n` +
				`When creating the tour then follow these guidelines:\n` +
				`- Add a 'title' attribute to the tour that describes its purpose.\n` +
				`- Add a 'file' attribute in each step use the file path that is given at the beginning of each code excerpt.\n` +
				`- Each line in the code starts with a comment that corresponds to the line number in the file.\n` +
				`- Do not create a step for a line that has -1 as the line number.\n` +
				`When creating a step for the tour use the line number from the comment at the beginning of the line.\n` +
				- `Provide a detailed description for each step. The description may include markdown to improve its readability.\n` +
				- `Only create on CodeTour step for each line of code that is not obvious and benefits from explanation.\n`
			),
			new vscode.LanguageModelChatUserMessage(
				`Create a CodeTour answering the following question about the workspace:\n` +
				`${resolvedPrompt}\n` +
				`These are the potentially relevant code excerpts from different files to answer the question\n.` +
				`${relevantCodeExcerpts}`
			),
		];

		
		let retries = 0;
		let tour = '';
		for (; ;) {
			if (retries++ >= MAX_RETRIES || token.isCancellationRequested) {
				break;
			}
			stream.progress('Creating a Code Tour...');
			const response = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, token);
			tour = await processResponse(response, token);

			// Remove the triple backticks lines if the model has wrapped the JSON response in ```
			if (tour.startsWith('```json')) {
				const lines = tour.split('\n');
				tour = lines.slice(1, -1).join('\n');
			}

			try {
				JSON.parse(tour);
				stream.markdown('Code Tour Created.');
				break;
			} catch (err) {
				stream.markdown('The created tour is not valid, retrying...');
				tour = '';
			}
		}
		if (tour.length <= 0) {
			stream.markdown(`Failed to create a Code Tour after multiple attempts, giving up.`);
			return '';
		}
		stream.button({
			command: START_TOUR_COMMAND_ID,
			arguments: [tour],
			title: vscode.l10n.t('Start the Tour')
		});
		return tour;
	}

	async function processResponse(response: vscode.LanguageModelChatResponse, token: vscode.CancellationToken): Promise<string> {
		let tour = '';
		for await (const fragment of response.stream) {
			tour += fragment;
		}
		console.log(tour);
		return tour;
	}

	async function startTour(tour: any) {
		const extensionId = 'vsls-contrib.codetour';
		const extension = vscode.extensions.getExtension(extensionId);

		if (!extension) {
			console.log(`Failed to get extension: ${extensionId}`);
			return;
		}
		if (!extension.isActive) {
			await extension.activate();
		}

		const api = extension.exports;
		api.startTour(tour);
	}

	function validateSingleFileTour(tour: any): boolean {
		if (!tour || !tour.title || !tour.steps || !Array.isArray(tour.steps)) {
			return false;
		}

		let previousLine = 0;
		const lineSet = new Set<number>();

		for (const step of tour.steps) {
			if (!step || !step.file || !step.line || !step.description) {
				return false;
			}

			const line = parseInt(step.line);
			if (isNaN(line) || line <= previousLine || lineSet.has(line)) {
				return false;
			}

			previousLine = line;
			lineSet.add(line);
		}

		return true;
	}

	async function startTourCommand(arg: any) {
		try {
			let tour = JSON.parse(arg);
			startTour(tour);
		} catch (err) {
			vscode.window.showInformationMessage(`Could not start the tour, the tour is not valid. Please retry...`);
		}
	}

	async function createTourCommand() {
		vscode.interactive.sendInteractiveRequestToProvider('copilot', { message: '@codetour' });
	}

	context.subscriptions.push(
		codeTourParticipant,
		vscode.commands.registerCommand(START_TOUR_COMMAND_ID, startTourCommand),
		vscode.commands.registerCommand(CREATE_TOUR_COMMAND_ID, createTourCommand)
	);
}

export function deactivate() { }

