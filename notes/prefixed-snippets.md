"Here is a potentially relevant code excerpt from `src/extension/prompts/node/panel/chatVariables.tsx`:
```tsx

/*1*/ /*---------------------------------------------------------------------------------------------
/*2*/  *  Copyright (c) Microsoft Corporation and GitHub. All rights reserved.
/*3*/  *--------------------------------------------------------------------------------------------*/
/*4*/ 
/*5*/ import type * as vscode from 'vscode';
/*6*/ import { ChatVariableLevel, Uri } from '../../../../vscodeTypes';
/*7*/ import { UserMessage } from '../base/promptBase';
/*8*/ import { CommonPromptElementProps, PromptElement, PromptPiece, PromptSizing } from '../base/promptElement';
/*9*/ import { FileVariable } from './fileVariable';
/*10*/ 
/*-1*/ export interface ChatVariablesProps extends CommonPromptElementProps {/*...*/}
/*-1*/ 
/*-1*/ export interface VariableData {/*...*/}
/*-1*/ 
/*-1*/ export interface ChatVariablesState {/*...*/}
/*-1*/ 
/*-1*/ export class ChatVariables extends PromptElement<ChatVariablesProps, ChatVariablesState> {/*...*/}
/*-1*/ 
```

Here is a potentially relevant code excerpt from `src/extension/prompts/node/panel/chatVariables.tsx`:
```tsx

/*32*/ class ChatVariables extends PromptElement<ChatVariablesProps, ChatVariablesState> {
/*33*/ \toverride async prepare(): Promise<ChatVariablesState> {
/*34*/ \t\tlet { query: message, chatVariables: variables } = this.props;
/*35*/ 
/*36*/ \t\tconst data: VariableData[] = [];
/*37*/ \t\tvariables.forEach((variable, i) => {
/*38*/ \t\t\t// Rewrite the message to use the variable header name
/*39*/ \t\t\tconst variableValue = variable.values.find(v => v.level === ChatVariableLevel.Full) ?? variable.values[0];
/*40*/ \t\t\tif (variableValue.kind === 'github.docset') {
/*41*/ \t\t\t\tmessage = message.slice(0, variable.range[0]) + variableValue.value + message.slice(variable.range[1]);
/*42*/ \t\t\t} else {
/*43*/ \t\t\t\tconst name = this.uniqueFileName(variable.name, variables.slice(i + 1));
/*44*/ \t\t\t\tdata.push({ variableName: name, variableValue: variableValue.value });
/*45*/ \t\t\t\tmessage = message.slice(0, variable.range[0]) + `[#${name}](#${name}-context)` + message.slice(variable.range[1]);
/*46*/ \t\t\t}
/*47*/ \t\t});
/*48*/ 
/*49*/ \t\tdata.reverse();
/*50*/ 
/*51*/ \t\treturn { data, rewrittenMessage: message };
/*52*/ \t}
/*-1*/ \t/*...*/
/*-1*/ }
/*-1*/ 
```

Here is a potentially relevant code excerpt from `src/extension/prompts/node/panel/chatVariables.tsx`:
```tsx
/*-1*/ class ChatVariables extends PromptElement<ChatVariablesProps, ChatVariablesState> {
/*-1*/ \toverride async prepare(): Promise<ChatVariablesState> {/*...*/}
/*-1*/ 
/*-1*/ \toverride render(state: ChatVariablesState, sizing: PromptSizing): PromptPiece<any, any> | undefined {/*...*/}
/*-1*/ 
/*-1*/ \tprivate uniqueFileName(name: string, variables: vscode.ChatResolvedVariable[]): string {/*...*/}
/*14*/ }
/*15*/ 

```

Here is a potentially relevant code excerpt from `src/extension/prompts/node/panel/chatVariables.tsx`:
```tsx

/*21*/ interface ChatVariablesState {
/*22*/ \t/**
/*23*/ \t * The variable names and values, in the order that they appeared in the user's query.
/*24*/ \t */
/*25*/ \tdata: VariableData[];
/*26*/ \t/**
/*27*/ \t * The user's query, rewritten to account for variable references.
/*28*/ \t */
/*29*/ \trewrittenMessage: string;
/*30*/ }
/*31*/ 

```

Here is a potentially relevant code excerpt from `src/extension/prompts/node/panel/chatVariables.tsx`:
```tsx

/*11*/ interface ChatVariablesProps extends CommonPromptElementProps {
/*12*/ \tquery: string;
/*13*/ \tchatVariables: vscode.ChatResolvedVariable[];
/*14*/ }
/*15*/ 

```

Here is a potentially relevant code excerpt from `src/extension/prompt/vscode-node/promptVariablesService.ts`:
```ts

/*13*/ class PromptVariablesServiceImpl implements IPromptVariablesService {
/*14*/ \tdeclare readonly _serviceBrand: undefined;
/*15*/ 
/*16*/ \tprivate _chatVariableService: IChatVariableService;
/*17*/ \tprivate _fsService: IFileSystemService;
/*18*/ 
/*19*/ \tconstructor(
/*20*/ \t\t@IChatVariableService chatVariableService: IChatVariableService,
/*21*/ \t\t@IFileSystemService fsService: IFileSystemService
/*22*/ \t) {
/*23*/ \t\tthis._chatVariableService = chatVariableService;
/*24*/ \t\tthis._fsService = fsService;
/*25*/ \t}
/*26*/ 
/*27*/ \tasync resolveVariablesInPrompt(message: string, variables: ChatResolvedVariable[]): Promise<{ message: string; parts: PromptContext[] }> {
/*28*/ \t\tconst contextParts: PromptContext[] = [];
/*29*/ 
/*30*/ \t\tfor (const variable of variables) {
/*31*/ \t\t\tlet variableValue = variable.values.find(v => v.level === ChatVariableLevel.Full) ?? variable.values[0];
/*32*/ \t\t\tif (variableValue.value instanceof Uri) {
/*33*/ \t\t\t\tconst fileContents = (await this._fsService.readFile(variableValue.value))
/*34*/ \t\t\t\t\t.toString()
/*35*/ \t\t\t\t\t.replace(/\\r/g, ''); // Normalize newlines
/*36*/ \t\t\t\tvariableValue = {
/*37*/ \t\t\t\t\t...variableValue,
/*38*/ \t\t\t\t\tvalue: createFencedCodeBlock('', fileContents)
/*39*/ \t\t\t\t};
/*40*/ \t\t\t}
/*41*/ 
/*42*/ \t\t\tif (variableValue.kind === 'github.docset') {
/*43*/ \t\t\t\tmessage = message.slice(0, variable.range[0]) + variableValue.value + message.slice(variable.range[1]);
/*44*/ \t\t\t} else {
/*45*/ \t\t\t\tconst existingVariable = this._chatVariableService.getVariable(variable.name);
/*46*/ \t\t\t\tcontextParts.push({
/*47*/ \t\t\t\t\tkind: existingVariable?.kind ?? PromptContextKind.Variable,
/*48*/ \t\t\t\t\tuserMessages: [getMarkdownHeaderForVariable(variable.name) + variableValue.value],
/*49*/ \t\t\t\t});
/*50*/ \t\t\t\tmessage = message.slice(0, variable.range[0]) + `[#${variable.name}](#${variable.name}-context)` + message.slice(variable.range[1]);
/*51*/ \t\t\t}
/*52*/ \t\t}
/*53*/ 
/*54*/ \t\treturn { parts: contextParts, message };
/*55*/ \t}
/*56*/ }
/*57*/ 

```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatParticipant.d.ts`:
```ts
/*-1*/ /*...*/
/*-1*/ \t/**
/*-1*/ \t * A resolved variable value is a name-value pair as well as the range in the prompt where a variable was used.
/*-1*/ \t */
/*-1*/ interface ChatResolvedVariable {/*...*/}
/*-1*/ 
/*-1*/ \texport interface ChatRequest {/*...*/}
/*-1*/ 
/*-1*/ \t/**
/*-1*/ \t * The ChatResponseStream is how a participant is able to return content to the chat view. It provides several methods for streaming different types of content
/*-1*/ \t * which will be rendered in an appropriate way in the chat view. A participant can use the helper method for the type of content it wants to return, or it
/*-1*/ \t * can instantiate a {@link ChatResponsePart} and use the generic {@link ChatResponseStream.push} method to return it.
/*-1*/ \t */
/*-1*/ interface ChatResponseStream {/*...*/}
/*-1*/ 
/*-1*/ \texport class ChatResponseMarkdownPart {/*...*/}
/*-1*/ 
/*-1*/ \texport interface ChatResponseFileTree {/*...*/}
/*-1*/ 
/*-1*/ \texport class ChatResponseFileTreePart {/*...*/}
/*-1*/ 
/*-1*/ \texport class ChatResponseAnchorPart {/*...*/}
/*-1*/ 
/*-1*/ \texport class ChatResponseProgressPart {/*...*/}
/*-1*/ 
/*-1*/ \texport class ChatResponseReferencePart {/*...*/}
/*-1*/ 
/*-1*/ \texport class ChatResponseCommandButtonPart {/*...*/}
/*-1*/ 
/*-1*/ \t/**
/*-1*/ \t * Represents the different chat response types.
/*-1*/ \t */
/*-1*/ \texport type ChatResponsePart = ChatResponseMarkdownPart | ChatResponseFileTreePart | ChatResponseAnchorPart
/*-1*/ \t\t| ChatResponseProgressPart | ChatResponseReferencePart | ChatResponseCommandButtonPart;
/*-1*/ 
/*-1*/ 
/*-1*/ \texport namespace chat {/*...*/}
/*1*/ 
/*2*/ \t/**
/*3*/ \t * The detail level of this chat variable value.
/*4*/ \t */
/*5*/ \texport enum ChatVariableLevel {
/*6*/ \t\tShort = 1,
/*7*/ \t\tMedium = 2,
/*8*/ \t\tFull = 3
/*9*/ \t}
/*10*/ 
/*-1*/ \texport interface ChatVariableValue {/*...*/}
/*-1*/ 
/*-1*/ 
/*-1*/ }
/*-1*/ 
```
"