import * as vscode from 'vscode';

const START_TOUR_COMMAND_ID = 'tour.startTour';

interface ITourAgentResult extends vscode.ChatAgentResult2 {
	tour: string;
}

//#region copied from the vs code utilities
export type ValueCallback<T = unknown> = (value: T | Promise<T>) => void;

const enum DeferredOutcome {
	Resolved,
	Rejected
}

const canceledName = 'Canceled';

export class CancellationError extends Error {
	constructor() {
		super(canceledName);
		this.name = this.message;
	}
}
/**
 * Copied from the vs code utilities.
 */
export class DeferredPromise<T> {

	private completeCallback!: ValueCallback<T>;
	private errorCallback!: (err: unknown) => void;
	private outcome?: { outcome: DeferredOutcome.Rejected; value: any } | { outcome: DeferredOutcome.Resolved; value: T };

	public get isRejected() {
		return this.outcome?.outcome === DeferredOutcome.Rejected;
	}

	public get isResolved() {
		return this.outcome?.outcome === DeferredOutcome.Resolved;
	}

	public get isSettled() {
		return !!this.outcome;
	}

	public get value() {
		return this.outcome?.outcome === DeferredOutcome.Resolved ? this.outcome?.value : undefined;
	}

	public readonly p: Promise<T>;

	constructor() {
		this.p = new Promise<T>((c, e) => {
			this.completeCallback = c;
			this.errorCallback = e;
		});
	}

	public complete(value: T) {
		return new Promise<void>(resolve => {
			this.completeCallback(value);
			this.outcome = { outcome: DeferredOutcome.Resolved, value };
			resolve();
		});
	}

	public error(err: unknown) {
		return new Promise<void>(resolve => {
			this.errorCallback(err);
			this.outcome = { outcome: DeferredOutcome.Rejected, value: err };
			resolve();
		});
	}

	public cancel() {
		return this.error(new CancellationError());
	}
}

//#endregion

export function activate(context: vscode.ExtensionContext) {

	// Prefix the lines with a number comment so that the LLM creates correct line numbers
	function prefixLinesWithLineNumber(input: string): string {
		const lines = input.split('\n');
		const prefixedLines = lines.map((line, index) => `/*${index + 1}*/ ${line}`);
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
		if (request.slashCommand?.name == 'createForOpenEditor') {
			const access = await vscode.chat.requestChatAccess('copilot');
			if (!vscode.window.activeTextEditor) {
				vscode.window.showInformationMessage(`There is no active editor, open an editor and try again.`);
				return { tour: '' };
			}
			const filePath = getRelativeFilePath();
			const contents = vscode.window.activeTextEditor.document.getText();
			const lineNumberPrefixed = prefixLinesWithLineNumber(contents);
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
						`The code has a comment at the beginning of each line that corresponds to the line number of the file.\n` + 
						`When creating a step for the tour use the line number in the comment.\n` +
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

			deferredPromise.complete({ content: 'Tour created.' });
			console.log(tour);
			return { tour: tour };
		} else {
			vscode.window.showInformationMessage('No slash command provided');
			return { tour: '' };
		}
	};

	const agent = vscode.chat.createChatAgent('codetour', handler);
	agent.iconPath = vscode.Uri.joinPath(context.extensionUri, 'codetour.png');
	agent.description = vscode.l10n.t('Explain with a code tour');
	agent.fullName = vscode.l10n.t('CodeTour');
	agent.slashCommandProvider = {
		provideSlashCommands(token) {
			return [
				{ name: 'createForOpenEditor', description: 'Create a CodeTour for the currently opened editor' }
			];
		}
	};

	agent.followupProvider = {
		provideFollowups(result: ITourAgentResult, token: vscode.CancellationToken) {
			if (result.tour.length > 0) {
				return [{
					commandId: START_TOUR_COMMAND_ID,
					args: [result.tour],
					message: 'Start the new tour',
					title: vscode.l10n.t('Start the Tour')
				}];
			}
		}
	};

	context.subscriptions.push(
		agent,
		vscode.commands.registerCommand(START_TOUR_COMMAND_ID, async (arg) => {
			vscode.window.showInformationMessage(`Start tour ${arg}`);
		}),
	);
}

export function deactivate() { }
