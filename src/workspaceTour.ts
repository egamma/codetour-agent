import * as vscode from 'vscode';

import * as toursCommon from './toursCommon';
import path from 'path';

export async function getCodeExcerpts(variable: vscode.ChatResolvedVariable, request: vscode.ChatRequest): Promise<string | undefined> {
    if (variable.values.length > 0 && typeof variable.values[0].value === 'string') {
        return await addLineNumbersToCodeExcerpts(variable.values[0].value);
    }
    return undefined;
}

export async function createWorkspaceCodeTour(resolvedPrompt: string, relevantCodeExcerpts: string, token: vscode.CancellationToken, stream: vscode.ChatResponseStream): Promise<string> {
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

        // Remove the square brackets if the model has wrapped the JSON response in [] 
        if (tour.startsWith('[')) {
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
        command: toursCommon.START_TOUR_COMMAND_ID,
        arguments: [tour],
        title: vscode.l10n.t('Start the Tour')
    });
    return tour;
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0];
    }
    return undefined;
}

async function findExcerptStartLineNumber(workspaceFolder: vscode.WorkspaceFolder, fileName: string, excerptLines: string[]): Promise<number> {
    let fullPath = path.join(workspaceFolder.uri.fsPath, fileName);
    const document = await vscode.workspace.openTextDocument(fullPath);

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

function getLongestExcerptWithoutElision(lines: string[]): [number, number] {
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
    return [longestSequenceStart, longestSequenceEnd];
}

async function addLineNumberPrefixToCodeExcerpt(workspaceFolder: vscode.WorkspaceFolder, fileName: string, codeExcerpt: string) {
    // lines before the excerpt without elision are prefixed with -1
    // lines of the excerpt are prefixed incrementally starting from startLineNumber
    // lines after the execerpt without elision are prefixed with -1

    let beforePrefixed = '';
    let afterPrefixed = '';

    const excerptLines = codeExcerpt.split('\n');
    const [start, end] = getLongestExcerptWithoutElision(excerptLines);

    const excerptLinesWithoutElision = excerptLines.slice(start, end + 1);
    const excerptWithoutElision = excerptLinesWithoutElision.join('\n');

    const startingLineNumber = await findExcerptStartLineNumber(workspaceFolder, fileName, excerptLinesWithoutElision);

    if (0 !== start) {
        const before = excerptLines.slice(0, start).join('\n');
        beforePrefixed = toursCommon.prefixLinesWithLineNumber(before, -1);
    }

    const bodyPrefixed = toursCommon.prefixLinesWithLineNumber(excerptWithoutElision, startingLineNumber);

    if (end !== excerptLines.length - 1) {
        const after = excerptLines.slice(end + 1).join('\n');
        afterPrefixed = toursCommon.prefixLinesWithLineNumber(after, -1);
    }
    return `${beforePrefixed}\n${bodyPrefixed}\n${afterPrefixed}`;
}