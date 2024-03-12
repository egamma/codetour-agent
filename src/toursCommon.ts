import * as vscode from 'vscode';

export const START_TOUR_COMMAND_ID = 'tour.startTour';

//export const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo';
export const LANGUAGE_MODEL_ID = 'copilot-gpt-4';

export const MAX_RETRIES = 3;

export function prefixLinesWithLineNumber(input: string, startLineNumber: number): string {
    const lines = input.split('\n');
    if (startLineNumber === -1) {
        const prefixedLines = lines.map((line, index) => `/*-1*/ ${line}`);
        return prefixedLines.join('\n');
    }
    const prefixedLines = lines.map((line, index) => `/*${index + startLineNumber}*/ ${line}`);
    return prefixedLines.join('\n');
}

export async function processResponse(response: vscode.LanguageModelChatResponse, token: vscode.CancellationToken): Promise<string> {
    let tour = '';
    for await (const fragment of response.stream) {
        tour += fragment;
    }
    console.log(tour);
    return tour;
}

export async function selectRange(editor: vscode.TextEditor): Promise<boolean> {
    const extensionId = 'GitHub.copilot-chat';
    const extension = vscode.extensions.getExtension(extensionId);

    if (!extension) {
        console.log(`Failed to get extension: ${extensionId}`);
        return false;
    }
    if (!extension.isActive) {
        await extension.activate();
    }

    const api = extension.exports.getAPI(1);
    if (!api) {
        console.log(`Failed to get API from extension: ${extensionId}`);
        return false;
    }
    const options = {
        reason: `Select a range for a refactoring suggestion`
    };
    let result = await api.selectScope(editor, options);
    if (!result) {
        return false;
    }
    return true;
}