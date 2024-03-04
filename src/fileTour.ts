import * as vscode from 'vscode';

import * as toursCommon from './toursCommon';
import * as scopePicker from './scopePicker';

export async function createSingleFileCodeTour(resolvedPrompt: string, token: vscode.CancellationToken, stream: vscode.ChatResponseStream): Promise<string> {
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
    const lineNumberPrefixed = toursCommon.prefixLinesWithLineNumber(selectedText, selection.start.line + 1);

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
        if (retries++ >= toursCommon.MAX_RETRIES || token.isCancellationRequested) {
            break;
        }
        stream.progress('Creating a Code Tour...');
        const response = await vscode.lm.sendChatRequest(toursCommon.LANGUAGE_MODEL_ID, messages, {}, token);
        tour = await toursCommon.processResponse(response, token);

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
        command: toursCommon.START_TOUR_COMMAND_ID,
        arguments: [tour],
        title: vscode.l10n.t('Start the Tour')
    });
    return tour;
}

function getRelativeFilePath(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const document = activeEditor.document;
        return vscode.workspace.asRelativePath(document.uri);
    }
    return undefined;
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

