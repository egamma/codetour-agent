import * as vscode from 'vscode';

import * as workspaceTour from './workspaceTour';
import * as fileTour from './fileTour';

const CODETOUR_PARTICIPANT_NAME = 'codetour';
const START_TOUR_COMMAND_ID = 'tour.startTour';
const CREATE_TOUR_COMMAND_ID = 'codetour-participant.createTour';

interface ITourAgentResult extends vscode.ChatResult {
	tour: string;
}

export function activate(context: vscode.ExtensionContext) {

	const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<ITourAgentResult> => {
		let resolvedPrompt = request.prompt;
		let prefixedCodeExcerpts: undefined | string = undefined;
		let variableWarnings = [];

		for (let variable of request.variables) {
			switch (variable.name) {
				case 'codebase':
					prefixedCodeExcerpts = await workspaceTour.getCodeExcerpts(variable, request);
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
			let tour = await workspaceTour.createWorkspaceCodeTour(resolvedPrompt, prefixedCodeExcerpts, token, stream);
			return { tour: tour };
		} else {
			let tour = await fileTour.createSingleFileCodeTour(resolvedPrompt, token, stream);
			return { tour: tour };
		}
	};

	const codeTourParticipant = vscode.chat.createChatParticipant(CODETOUR_PARTICIPANT_NAME, handler);
	codeTourParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'codetour.png');

	function substituteVariable(value: string, start: number, end: number, variableValue: string): string {
		return value.substring(0, start) + variableValue + value.substring(end);
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

