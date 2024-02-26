import * as vscode from 'vscode';

import * as scopePicker from './scopePicker';

const START_TOUR_COMMAND_ID = 'tour.startTour';
const CREATE_TOUR_COMMAND_ID = 'codetour-participant.createTour';

interface ITourAgentResult extends vscode.ChatResult {
	tour: string;
}

const LANGUAGE_MODEL_ID = 'copilot-gpt-4';
const MAX_RETRIES = 3;

export function activate(context: vscode.ExtensionContext) {

	function getRelativeFilePath(): string | undefined {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const document = activeEditor.document;
			return vscode.workspace.asRelativePath(document.uri);
		}
		return undefined;
	}

	function prefixLinesWithLineNumber(input: string, start: number): string {
		const lines = input.split('\n');
		const prefixedLines = lines.map((line, index) => `/*${index + start}*/ ${line}`);
		return prefixedLines.join('\n');
	}

	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<ITourAgentResult> => {
		let tour = await explainWithCodeTour(request, token, stream);
		return { tour: tour };
	};

	const codeTourParticipant = vscode.chat.createChatParticipant('codetour', handler);
	codeTourParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'codetour.png');
	codeTourParticipant.description = vscode.l10n.t('Answer questions with a code tour');

	async function explainWithCodeTour(request: vscode.ChatRequest, token: vscode.CancellationToken, stream: vscode.ChatResponseStream): Promise<string> {
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

		const access = await vscode.lm.requestLanguageModelAccess(LANGUAGE_MODEL_ID);

		const filePath = getRelativeFilePath();
		const selection = editor.selection;
		let selectedText = editor.document.getText(selection.with({ start: selection.start.with({ character: 0 }), end: selection.end.with({ character: editor.document.lineAt(selection.end.line).text.length }) }));
		const lineNumberPrefixed = prefixLinesWithLineNumber(selectedText, selection.start.line + 1);

		const messages = [
			new vscode.LanguageModelSystemMessage(
				`There is a VSCode extension called CodeTour it supports to create so called code tours in a JSON file.\n` +
				`When asked to explain the code you should respond with a code tour JSON file.\n` +
				`The JSON schema of the code tour file is "https://aka.ms/codetour-schema"\n` +
				`Only respond with the contents of the code tour file as JSON and nothing else.\n` +
				`Do not wrap the JSON response in triple backticks.\n` +
				`When creating the tour then follow these guidelines:\n` +
				`- Add a 'title' attribute to the tour that describes its purpose.\n` +
				`- Add a 'file' attribute in each step use the following file path ${filePath} for its value.\n` +
				`- Each line in the code starts with a comment that corresponds to the line number in the file.\n` +
				`When creating a step for the tour use the line number from the comment at the beginning of the line.\n` +
				- `Provide a detailed description for each step. The description may include markdown to improve its readability.\n` +
				- `Only create on Code Tourstep for each line of code that you want to explain.\n`

			),
			new vscode.LanguageModelUserMessage(
				`Create tour for the following question:\n` +
				`${request.prompt}\n` +
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
			tour = await createTour(access, messages, token);
			try {
				let parsedTour = JSON.parse(tour);
				if (validateTour(parsedTour)) {
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

	async function createTour(access: vscode.LanguageModelAccess, messages: vscode.LanguageModelMessage[], token: vscode.CancellationToken): Promise<string> {
		const chatRequest = access.makeChatRequest(messages, {}, token);

		let tour = '';
		for await (const fragment of chatRequest.stream) {
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

	function validateTour(tour: any): boolean {
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

