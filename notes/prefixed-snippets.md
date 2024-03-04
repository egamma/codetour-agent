"Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatParticipant.d.ts`:
```ts
/*8*/ /**
/*9*/ \t * A resolved variable value is a name-value pair as well as the range in the prompt where a variable was used.
/*10*/ \t */
/*11*/ interface ChatResolvedVariable {
/*12*/ \t\t/**
/*13*/ \t\t * The name of the variable.
/*14*/ \t\t *
/*15*/ \t\t * *Note* that the name doesn't include the leading `#`-character,
/*16*/ \t\t * e.g `selection` for `#selection`.
/*17*/ \t\t */
/*18*/ \t\treadonly name: string;
/*19*/ 
/*20*/ \t\t/**
/*21*/ \t\t * The start and end index of the variable in the {@link ChatRequest.prompt prompt}.
/*22*/ \t\t *
/*23*/ \t\t * *Note* that the indices take the leading `#`-character into account which means they can
/*24*/ \t\t * used to modify the prompt as-is.
/*25*/ \t\t */
/*26*/ \t\treadonly range: [start: number, end: number];
/*27*/ 
/*28*/ \t\t// TODO@API decouple of resolve API, use `value: string | Uri | (maybe) unknown?`
/*29*/ \t\treadonly values: ChatVariableValue[];
/*30*/ \t}
/*31*/ 
```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatParticipant.d.ts`:
```ts
/*8*/ /**
/*9*/ \t * A chat participant can be invoked by the user in a chat session, using the `@` prefix. When it is invoked, it handles the chat request and is solely
/*10*/ \t * responsible for providing a response to the user. A ChatParticipant is created using {@link chat.createChatParticipant}.
/*11*/ \t */
/*12*/ interface ChatParticipant {
/*13*/ \t\t/**
/*14*/ \t\t * The short name by which this participant is referred to in the UI, e.g `workspace`.
/*15*/ \t\t */
/*16*/ \t\treadonly name: string;
/*17*/ 
/*18*/ \t\t/**
/*19*/ \t\t * Icon for the participant shown in UI.
/*20*/ \t\t */
/*21*/ \t\ticonPath?: Uri | {
/*22*/ \t\t\t/**
/*23*/ \t\t\t * The icon path for the light theme.
/*24*/ \t\t\t */
/*25*/ \t\t\tlight: Uri;
/*26*/ \t\t\t/**
/*27*/ \t\t\t * The icon path for the dark theme.
/*28*/ \t\t\t */
/*29*/ \t\t\tdark: Uri;
/*30*/ \t\t} | ThemeIcon;
/*31*/ 
/*32*/ \t\t/**
/*33*/ \t\t * The handler for requests to this participant.
/*34*/ \t\t */
/*35*/ \t\trequestHandler: ChatRequestHandler;
/*36*/ 
/*37*/ \t\t/**
/*38*/ \t\t * This provider will be called once after each request to retrieve suggested followup questions.
/*39*/ \t\t */
/*40*/ \t\tfollowupProvider?: ChatFollowupProvider;
/*41*/ 
/*42*/ \t\t/**
/*43*/ \t\t * When the user clicks this participant in `/help`, this text will be submitted to this participant.
/*44*/ \t\t */
/*45*/ \t\tsampleRequest?: string;
/*46*/ 
/*47*/ \t\t/**
/*48*/ \t\t * Whether invoking the participant puts the chat into a persistent mode, where the participant is automatically added to the chat input for the next message.
/*49*/ \t\t */
/*50*/ \t\tisSticky?: boolean;
/*51*/ 
/*52*/ \t\t/**
/*53*/ \t\t * An event that fires whenever feedback for a result is received, e.g. when a user up- or down-votes
/*54*/ \t\t * a result.
/*55*/ \t\t *
/*56*/ \t\t * The passed {@link ChatResultFeedback.result result} is guaranteed to be the same instance that was
/*57*/ \t\t * previously returned from this chat participant.
/*58*/ \t\t */
/*59*/ \t\tonDidReceiveFeedback: Event<ChatResultFeedback>;
/*60*/ 
/*61*/ \t\t/**
/*62*/ \t\t * Dispose this participant and free resources
/*63*/ \t\t */
/*64*/ \t\tdispose(): void;
/*65*/ \t}
/*66*/ 
```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatVariableResolver.d.ts`:
```ts
/*1*/ /*---------------------------------------------------------------------------------------------
/*2*/  *  Copyright (c) Microsoft Corporation. All rights reserved.
/*3*/  *  Licensed under the MIT License. See License.txt in the project root for license information.
/*4*/  *--------------------------------------------------------------------------------------------*/
/*5*/ 
/*6*/ declare module 'vscode' {
/*7*/ 
```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatVariableResolver.d.ts`:
```ts
/*43*/ interface ChatVariableResolver {
/*44*/ \t\t/**
/*45*/ \t\t * A callback to resolve the value of a chat variable.
/*46*/ \t\t * @param name The name of the variable.
/*47*/ \t\t * @param context Contextual information about this chat request.
/*48*/ \t\t * @param token A cancellation token.
/*49*/ \t\t */
/*50*/ \t\tresolve(name: string, context: ChatVariableContext, token: CancellationToken): ProviderResult<ChatVariableValue[]>;
/*51*/ \t}
/*52*/ 
```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatVariableResolver.d.ts`:
```ts
/*36*/ interface ChatVariableContext {
/*37*/ \t\t/**
/*38*/ \t\t * The message entered by the user, which includes this variable.
/*39*/ \t\t */
/*40*/ \t\tprompt: string;
/*41*/ \t}
/*42*/ 
```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatVariableResolver.d.ts`:
```ts
/*19*/ interface ChatVariableValue {
/*20*/ \t\t/**
/*21*/ \t\t * The detail level of this chat variable value. If possible, variable resolvers should try to offer shorter values that will consume fewer tokens in an LLM prompt.
/*22*/ \t\t */
/*23*/ \t\tlevel: ChatVariableLevel;
/*24*/ 
/*25*/ \t\t/**
/*26*/ \t\t * The variable's value, which can be included in an LLM prompt as-is, or the chat participant may decide to read the value and do something else with it.
/*27*/ \t\t */
/*28*/ \t\tvalue: string | Uri;
/*29*/ 
/*30*/ \t\t/**
/*31*/ \t\t * A description of this value, which could be provided to the LLM as a hint.
/*32*/ \t\t */
/*33*/ \t\tdescription?: string;
/*34*/ \t}
/*35*/ 
```

Here is a potentially relevant code excerpt from `src/extension/vscode.proposed.chatVariableResolver.d.ts`:
```ts
/*8*/ namespace chat {
/*9*/ \t\t/**
/*10*/ \t\t * Register a variable which can be used in a chat request to any participant.
/*11*/ \t\t * @param name The name of the variable, to be used in the chat input as `#name`.
/*12*/ \t\t * @param description A description of the variable for the chat input suggest widget.
/*13*/ \t\t * @param resolver Will be called to provide the chat variable's value when it is used.
/*14*/ \t\t */
/*15*/ \t\texport function registerChatVariableResolver(name: string, description: string, resolver: ChatVariableResolver): Disposable;
/*16*/ \t}
/*17*/ 
```
"