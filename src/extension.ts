import * as vscode from 'vscode';
import { DeferredPromise } from './deferredPromise';

const START_TOUR_COMMAND_ID = 'tour.startTour';

interface ITourAgentResult extends vscode.ChatAgentResult2 {
	tour: string;
}

export function activate(context: vscode.ExtensionContext) {

	// Prefix the lines with a number comment so that the LLM creates correct line numbers
	function prefixLinesWithLineNumber(input: string, start: number): string {
		const lines = input.split('\n');
		const prefixedLines = lines.map((line, index) => `/*${index + start}*/ ${line}`);
		return prefixedLines.join('\n');
	}

	function getRelativeFilePath(): string | undefined {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const document = activeEditor.document;
			return vscode.workspace.asRelativePath(document.uri);
		}
		return undefined;
	}

	const handler: vscode.ChatAgentHandler = async (request: vscode.ChatAgentRequest, context: vscode.ChatAgentContext, progress: vscode.Progress<vscode.ChatAgentProgress>, token: vscode.CancellationToken): Promise<ITourAgentResult> => {
		if (request.slashCommand?.name == 'explainEditor') {
			let tour = await explainEditor(request, token, progress);
			return { tour: tour };
		} else if (request.slashCommand?.name == 'explainSelection') {
			let tour = await explainSelection(request, token, progress);
			return { tour: tour };
		} else {
			let tour = await explainEditor(request, token, progress);
			return { tour: tour };
		}
	};

	const agent = vscode.chat.createChatAgent('codetour', handler);
	agent.iconPath = vscode.Uri.joinPath(context.extensionUri, 'codetour.png');
	agent.description = vscode.l10n.t('Answer questions with a code tour');
	agent.fullName = vscode.l10n.t('CodeTour');
	agent.slashCommandProvider = {
		provideSlashCommands(token) {
			return [
				{ name: 'explainEditor', description: 'Explain the code in the active editor with a code tour' },
				{ name: 'explainSelection', description: 'Explain the code in the selection with a code tour' },
			];
		}
	};

	agent.followupProvider = {
		provideFollowups(result: ITourAgentResult, token: vscode.CancellationToken) {
			if (result.tour.length > 0) {
				return [{
					commandId: START_TOUR_COMMAND_ID,
					args: [result.tour],
					message: 'Start the tour',
					title: vscode.l10n.t('Start the Tour')
				}];
			}
		}
	};

	async function explainEditor(request: vscode.ChatAgentRequest, token: vscode.CancellationToken, progress: vscode.Progress<vscode.ChatAgentProgress>): Promise<string> {
		if (!vscode.window.activeTextEditor) {
			vscode.window.showInformationMessage(`There is no active editor, open an editor and try again.`);
			return '' ;
		}
		const access = await vscode.chat.requestChatAccess('copilot');
		const filePath = getRelativeFilePath();
		const contents = vscode.window.activeTextEditor.document.getText();
		const lineNumberPrefixed = prefixLinesWithLineNumber(contents, 1);
		const messages = [
			{
				role: vscode.ChatMessageRole.System,
				content: `There is a VSCode extension called CodeTour it supports to create so called code tours in a JSON file.\n` +
					`When asked to explain the code you should respond with a code tour JSON file.\n` +
					`The JSON schema of the code tour file is "https://aka.ms/codetour-schema"\n` +
					`Only respond with the contents of the code tour file as JSON and nothing else.\n`
			},
			{
				role: vscode.ChatMessageRole.User,
				content: `Create tour for the following question:\n` +
					`${request.prompt}\n` +
					`Add a 'title' attribute to the tour that describes its purpose.\n` +
					`Add a 'file' attribute in each step use the following file path ${filePath} for its value.\n` +
					`Each line in the code starts with a comment that corresponds to the line number in the file.\n` +
					`When creating a step for the tour use the line number from the comment at the beginning of the line.\n` +
					`Provide a detailed description for each step. The description may include markdown to improve its readability.\n` +
					`This is the code that you should explain in a tour\n.` +
					`${lineNumberPrefixed}`
			},
		];

		const chatRequest = access.makeRequest(messages, {}, token);

		let tour = '';

		let deferredPromise: DeferredPromise<vscode.ChatAgentFileTree | vscode.ChatAgentContent> = new DeferredPromise();
		progress.report({
			placeholder: 'Creating the tour...',
			resolvedContent: deferredPromise.p
		});

		for await (const fragment of chatRequest.response) {
			tour += fragment;
		}

		deferredPromise.complete({ content: '' });
		console.log(tour);
		return tour;
	}

	async function explainSelection(request: vscode.ChatAgentRequest, token: vscode.CancellationToken, progress: vscode.Progress<vscode.ChatAgentProgress>): Promise<string> {
		// TODO fix code duplication
		if (!vscode.window.activeTextEditor) {
			vscode.window.showInformationMessage(`There is no active editor, open an editor and try again.`);
			return '' ;
		}
		const access = await vscode.chat.requestChatAccess('copilot');
		const filePath = getRelativeFilePath();
		const editor = vscode.window.activeTextEditor;
		const selection = editor.selection;
		const selectedLines = editor.document.getText(selection.with({ start: selection.start.with({ character: 0 }), end: selection.end.with({ character: editor.document.lineAt(selection.end.line).text.length }) }));
		const lineNumberPrefixed = prefixLinesWithLineNumber(selectedLines, selection.start.line + 1);
		const messages = [
			{
				role: vscode.ChatMessageRole.System,
				content: `There is a VSCode extension called CodeTour it supports to create so called code tours in a JSON file.\n` +
					`When asked to explain the code you should respond with a code tour JSON file.\n` +
					`The JSON schema of the code tour file is "https://aka.ms/codetour-schema"\n` +
					`Only respond with the contents of the code tour file as JSON and nothing else.\n`
			},
			{
				role: vscode.ChatMessageRole.User,
				content: `Create tour for the following question:\n` +
					`${request.prompt}\n` +
					`Add a 'title' attribute to the tour that describes its purpose.\n` +
					`Add a 'file' attribute in each step use the following the file path ${filePath} for its value.\n` +
					`Each line in the code starts with a comment that corresponds to the line number in the file.\n` +
					`When creating a step for the tour use the line number from the comment at the beginning of the line.\n` +
					`Provide a detailed description for each step. The description may include markdown to improve its readability.\n` +
					`This is the code that you should explain in a tour\n.` +
					`${lineNumberPrefixed}`
			},
		];

		const chatRequest = access.makeRequest(messages, {}, token);

		let tour = '';

		let deferredPromise: DeferredPromise<vscode.ChatAgentFileTree | vscode.ChatAgentContent> = new DeferredPromise();
		progress.report({
			placeholder: 'Creating the tour...',
			resolvedContent: deferredPromise.p
		});

		for await (const fragment of chatRequest.response) {
			tour += fragment;
		}

		deferredPromise.complete({ content: '' });
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

	context.subscriptions.push(
		agent,
		vscode.commands.registerCommand(START_TOUR_COMMAND_ID, async (arg) => {
			try {
				let tour = JSON.parse(arg);
				if (!validateTour(tour)) {
					vscode.window.showInformationMessage(`Could not start the tour, the tour is not valid. Please try again`);
					return;
				}
				startTour(tour);
			} catch (err) {
				vscode.window.showInformationMessage(`Could not start the tour, the tour is not valid.`);
			}
		}),
	);
}

export function deactivate() { }
