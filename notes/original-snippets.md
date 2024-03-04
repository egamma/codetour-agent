"Here is a potentially relevant code excerpt from `src/extension/inlineChat/vscode-node/inlineChatCodeActions.ts`:
```ts
class RefactorsProvider implements vscode.CodeActionProvider {
\tconstructor(accessor: ServicesAccessor) {
\t\tthis.logger = accessor.get(ILogService).getLogger('RefactorsProvider');
\t\tthis.telemetryService = accessor.get(ITelemetryService);
\t\tthis.parserService = accessor.get(IParserService);
\t}
\t/*...*/
}
```

Here is a potentially relevant code excerpt from `src/extension/prompts/node/panel/chatVariables.tsx`:
```tsx
interface VariableData {
\tvariableName: string;
\tvariableValue: string | vscode.Uri;
}
```

Here is a potentially relevant code excerpt from `src/extension/inlineChat/vscode-node/inlineChatCodeActions.ts`:
```ts
class RefactorsProvider implements vscode.CodeActionProvider {
\tstatic readonly providedCodeActionKinds = [vscode.CodeActionKind.RefactorRewrite];

\tprivate readonly logger: Logger;
\tprivate readonly telemetryService: ITelemetryService;
\tprivate readonly parserService: IParserService;

\tconstructor(accessor: ServicesAccessor) {/*...*/}

\tasync provideCodeActions(
\t\tdoc: vscode.TextDocument,
\t\trange: vscode.Range,
\t\t_ctx: vscode.CodeActionContext
\t): Promise<vscode.CodeAction[] | undefined> {/*...*/}

\t/**
\t * Provides code action `Generate using Copilot` or `Modify using Copilot`.
\t * - `Generate using Copilot` is shown when the selection is empty and the line of the selection contains only white-space characters or tabs.
\t * - `Modify using Copilot` is shown when the selection is not empty and the selection does not contain only white-space characters or tabs.
\t */
\tprovideGenerateUsingCopilotCodeAction(doc: vscode.TextDocument, range: vscode.Range): vscode.CodeAction | undefined {/*...*/}

\t/**
\t * Provides code action `Document using Copilot: '${documentableNode.identifier}'` if:
\t * - the document languageId is supported by tree-sitter parsers we have
\t * - the range is on an identifier AND the identifier is a child of a documentable node
\t *
\t * The code action invokes the inline chat, expanding the inline chat's \"wholeRange\" (blue region)
\t * to the whole documentable node.
\t */
\tasync provideDocumentUsingCopilotCodeAction(doc: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction | undefined> {/*...*/}

\tasync provideTestUsingCopilotCodeAction(doc: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction | undefined> {/*...*/}
}
```

Here is a potentially relevant code excerpt from `src/extension/prompt/vscode-node/promptVariablesService.ts`:
```ts
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { ChatResolvedVariable, ChatVariableLevel, Uri } from 'vscode';
import { IFileSystemService } from '../../../platform/filesystem/common/fileSystemService';
import { createFencedCodeBlock } from \"../../../util/node/markdown\";
import { IChatVariableService } from '../../context/node/chatVariables';
import { PromptContextKind } from \"../common/promptContextKind\";
import { PromptContext } from '../node/conversation';
import { IPromptVariablesService } from '../node/promptVariablesService';

export class PromptVariablesServiceImpl implements IPromptVariablesService {/*...*/}

export function getMarkdownHeaderForVariable(varName: string): string {/*...*/}
```

Here is a potentially relevant code excerpt from `src/extension/inlineChat/vscode-node/inlineChatCodeActions.ts`:
```ts
class RefactorsProvider implements vscode.CodeActionProvider {
\t/*...*/
\tasync provideCodeActions(
\t\tdoc: vscode.TextDocument,
\t\trange: vscode.Range,
\t\t_ctx: vscode.CodeActionContext
\t): Promise<vscode.CodeAction[] | undefined> {
\t\tconst copilotCodeActionsEnabled = vscode.workspace
\t\t\t.getConfiguration('github.copilot.editor')
\t\t\t.get('enableCodeActions');
\t\tif (!copilotCodeActionsEnabled) {
\t\t\treturn;
\t\t}
\t\tconst generateUsingCopilotCodeAction = this.provideGenerateUsingCopilotCodeAction(doc, range);
\t\tconst documentUsingCopilotCodeAction = await this.provideDocumentUsingCopilotCodeAction(doc, range);
\t\tconst testUsingCopilotCodeAction = await this.provideTestUsingCopilotCodeAction(doc, range);
\t\treturn arrays.coalesce([documentUsingCopilotCodeAction, generateUsingCopilotCodeAction, testUsingCopilotCodeAction]);
\t}
\t/*...*/
}
```

Here is a potentially relevant code excerpt from `src/extension/inlineChat/vscode-node/inlineChatCodeActions.ts`:
```ts
class QuickFixesProvider implements vscode.CodeActionProvider {
\t/*...*/
\tasync provideCodeActions(_doc: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext) {
\t\t/*...*/
\t\texplainAction.command = {
\t\t\ttitle: explainAction.title,
\t\t\tcommand: 'github.copilot.interactiveEditor.explain',
\t\t\targuments: [query],
\t\t};
\t\tcodeActions.push(fixAction, explainAction);
\t\treturn codeActions;
\t}
}
```

Here is a potentially relevant code excerpt from `src/extension/prompt/vscode-node/promptVariablesService.ts`:
```ts
class PromptVariablesServiceImpl implements IPromptVariablesService {
\tdeclare readonly _serviceBrand: undefined;

\tprivate _chatVariableService: IChatVariableService;
\tprivate _fsService: IFileSystemService;

\tconstructor(
\t\t@IChatVariableService chatVariableService: IChatVariableService,
\t\t@IFileSystemService fsService: IFileSystemService
\t) {
\t\tthis._chatVariableService = chatVariableService;
\t\tthis._fsService = fsService;
\t}

\tasync resolveVariablesInPrompt(message: string, variables: ChatResolvedVariable[]): Promise<{ message: string; parts: PromptContext[] }> {
\t\tconst contextParts: PromptContext[] = [];

\t\tfor (const variable of variables) {
\t\t\tlet variableValue = variable.values.find(v => v.level === ChatVariableLevel.Full) ?? variable.values[0];
\t\t\tif (variableValue.value instanceof Uri) {
\t\t\t\tconst fileContents = (await this._fsService.readFile(variableValue.value))
\t\t\t\t\t.toString()
\t\t\t\t\t.replace(/\\r/g, ''); // Normalize newlines
\t\t\t\tvariableValue = {
\t\t\t\t\t...variableValue,
\t\t\t\t\tvalue: createFencedCodeBlock('', fileContents)
\t\t\t\t};
\t\t\t}

\t\t\tif (variableValue.kind === 'github.docset') {
\t\t\t\tmessage = message.slice(0, variable.range[0]) + variableValue.value + message.slice(variable.range[1]);
\t\t\t} else {
\t\t\t\tconst existingVariable = this._chatVariableService.getVariable(variable.name);
\t\t\t\tcontextParts.push({
\t\t\t\t\tkind: existingVariable?.kind ?? PromptContextKind.Variable,
\t\t\t\t\tuserMessages: [getMarkdownHeaderForVariable(variable.name) + variableValue.value],
\t\t\t\t});
\t\t\t\tmessage = message.slice(0, variable.range[0]) + `[#${variable.name}](#${variable.name}-context)` + message.slice(variable.range[1]);
\t\t\t}
\t\t}

\t\treturn { parts: contextParts, message };
\t}
}
```"