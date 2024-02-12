import * as vscode from 'vscode';

const START_TOUR_COMMAND_ID = 'tour.startTour';

interface ITourAgentResult extends vscode.ChatAgentResult2 {
	tour: string;
}

const LANGUAGE_MODEL_ID = 'copilot-gpt-4';

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

	function getFullCode(): string {
		if (!vscode.window.activeTextEditor) {
			return '';
		}
		const editor = vscode.window.activeTextEditor;
		let code = editor.document.getText();
		return prefixLinesWithLineNumber(code, 1);
	}
	
	function getSelectionCode(): string {
		if (!vscode.window.activeTextEditor) {
			return '';
		}
		const editor = vscode.window.activeTextEditor;
		const selection = editor.selection;
		let code = editor.document.getText(selection.with({ start: selection.start.with({ character: 0 }), end: selection.end.with({ character: editor.document.lineAt(selection.end.line).text.length }) }));
		return prefixLinesWithLineNumber(code, selection.start.line + 1);
	}
	
	const handler: vscode.ChatAgentHandler = async (request: vscode.ChatAgentRequest, context: vscode.ChatAgentContext, stream: vscode.ChatAgentResponseStream, token: vscode.CancellationToken): Promise<ITourAgentResult> => {
		if (request.command == 'explainEditor') {
			let tour = await explainCode(request, token, stream, getFullCode);
			return { tour: tour };
		} else if (request.command == 'explainSelection') {
			let tour = await explainCode(request, token, stream, getSelectionCode);
			return { tour: tour };
		} else {
			let tour = await explainCode(request, token, stream, getFullCode);
			return { tour: tour };
		}
	};

	const agent = vscode.chat.createChatAgent('codetour', handler);
	agent.iconPath = vscode.Uri.joinPath(context.extensionUri, 'codetour.png');
	agent.description = vscode.l10n.t('Answer questions with a code tour');
	agent.fullName = vscode.l10n.t('CodeTour');
	agent.commandProvider = {
		provideCommands(token) {
			return [
				{ name: 'explainEditor', description: 'Explain the code in the active editor with a code tour' },
				{ name: 'explainSelection', description: 'Explain the code in the selection with a code tour' },
			];
		}
	};

	async function explainCode(request: vscode.ChatAgentRequest, token: vscode.CancellationToken, stream: vscode.ChatAgentResponseStream, getCode: () => string): Promise<string> {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showInformationMessage(`There is no active editor, open an editor and try again.`);
			return '' ;
		}
		const access = await vscode.chat.requestLanguageModelAccess(LANGUAGE_MODEL_ID);

		const filePath = getRelativeFilePath();
		let lineNumberPrefixed = getCode();

		const messages = [
			{
				role: vscode.ChatMessageRole.System,
				content: `There is a VSCode extension called CodeTour it supports to create so called code tours in a JSON file.\n` +
					`When asked to explain the code you should respond with a code tour JSON file.\n` +
					`The JSON schema of the code tour file is "https://aka.ms/codetour-schema"\n` +
					`Only respond with the contents of the code tour file as JSON and nothing else.\n` +
					`When creating the tour then follow these guidelines:\n` +
					`- Add a 'title' attribute to the tour that describes its purpose.\n` +
					`- Add a 'file' attribute in each step use the following file path ${filePath} for its value.\n` +
					`- Each line in the code starts with a comment that corresponds to the line number in the file.\n` +
					`When creating a step for the tour use the line number from the comment at the beginning of the line.\n` +
					- `Provide a detailed description for each step. The description may include markdown to improve its readability.\n` +
					- `Only create on Code Tourstep for each line of code that you want to explain.\n`	

			},
			{
				role: vscode.ChatMessageRole.User,
				content: `Create tour for the following question:\n` +
					`${request.prompt}\n` +
					`This is the code that you should explain in a tour\n.` +
					`${lineNumberPrefixed}`
			},
		];

		const chatRequest = access.makeChatRequest(messages, {}, token);

		let tour = '';

		stream.progress('Creating the Code Tour...');

		for await (const fragment of chatRequest.stream) {
			tour += fragment;
		}

		try {
			let parsedTour = JSON.parse(tour);
			if (validateTour(parsedTour)) {
				stream.markdown('Code Tour Created.');
			} else {
				throw new Error('Invalid Code Tour');
			}
		} catch (err) {
			stream.markdown('Apologies, but the created tour is not a valid Code Tour. Please retry...');
			tour = '';
		}
		console.log(tour);

		if (tour.length > 0) {
			stream.button({
				command: START_TOUR_COMMAND_ID,
				arguments: [tour],
				title: vscode.l10n.t('Start the Tour')
			});
		}

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

	context.subscriptions.push(
		agent,
		vscode.commands.registerCommand(START_TOUR_COMMAND_ID, async (arg) => {
			try {
				let tour = JSON.parse(arg);
				startTour(tour);
			} catch (err) {
				vscode.window.showInformationMessage(`Could not start the tour, the tour is not valid. Please retry...`);
			}
		}),
	);
}

export function deactivate() { }

