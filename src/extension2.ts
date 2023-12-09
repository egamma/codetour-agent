/*1*/ import * as vscode from 'vscode';
/*2*/ 
/*3*/ const MEOW_COMMAND_ID = 'cat.meow';
/*4*/ 
/*5*/ interface ICatChatAgentResult extends vscode.ChatAgentResult2 {
/*6*/ 	slashCommand: string;
/*7*/ }
/*8*/ 
/*9*/ export function activate(context: vscode.ExtensionContext) {
/*10*/ 
/*11*/     // Define a Cat chat agent handler. 
/*12*/     const handler: vscode.ChatAgentHandler = async (request: vscode.ChatAgentRequest, context: vscode.ChatAgentContext, progress: vscode.Progress<vscode.ChatAgentProgress>, token: vscode.CancellationToken): Promise<ICatChatAgentResult> => {
/*13*/         // To talk to an LLM in your slash command handler implementation, your
/*14*/         // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
/*15*/         // The GitHub Copilot Chat extension implements this provider.
/*16*/         if (request.slashCommand?.name == 'teach') {
/*17*/             const access = await vscode.chat.requestChatAccess('copilot');
/*18*/ 			const topics = ['linked list', 'recursion', 'stack', 'queue', 'pointers'];
/*19*/ 			const topic = topics[Math.floor(Math.random() * topics.length)];
/*20*/             const messages = [
/*21*/                 {
/*22*/                     role: vscode.ChatMessageRole.System,
/*23*/ 					content: 'You are a cat! Your job is to explain computer science concepts in the funny manner of a cat. Always start your response by stating what concept you are explaining.'
/*24*/                 },
/*25*/                 {
/*26*/                     role: vscode.ChatMessageRole.User,
/*27*/                     content: topic
/*28*/                 },
/*29*/             ];
/*30*/             const chatRequest = access.makeRequest(messages, {}, token);
/*31*/             for await (const fragment of chatRequest.response) {
/*32*/                 progress.report({ content: fragment });
/*33*/             }
/*34*/ 			return { slashCommand: 'teach' };
/*35*/         } else if (request.slashCommand?.name == 'play') {
/*36*/             const access = await vscode.chat.requestChatAccess('copilot');
/*37*/             const messages = [
/*38*/                 {
/*39*/                     role: vscode.ChatMessageRole.System,
/*40*/ 					content: 'You are a cat that wants to play! Reply in a helpful way for a coder, but with the hidden meaning that all you want to do is play.'
/*41*/                 },
/*42*/                 {
/*43*/                     role: vscode.ChatMessageRole.User,
/*44*/                     content: request.prompt
/*45*/                 }
/*46*/             ];
/*47*/             const chatRequest = access.makeRequest(messages, {}, token);
/*48*/             for await (const fragment of chatRequest.response) {
/*49*/                 progress.report({ content: fragment });
/*50*/             }
/*51*/ 			return { slashCommand: 'play' };
/*52*/         } else {
/*53*/ 			const access = await vscode.chat.requestChatAccess('copilot');
/*54*/ 			const messages = [
/*55*/ 				{
/*56*/ 					role: vscode.ChatMessageRole.System,
/*57*/ 					content: 'You are a cat! Reply in the voice of a cat, using cat analogies when appropriate.'
/*58*/ 				},
/*59*/ 				{
/*60*/ 					role: vscode.ChatMessageRole.User,
/*61*/ 					content: request.prompt
/*62*/ 				}
/*63*/ 			];
/*64*/ 			const chatRequest = access.makeRequest(messages, {}, token);
/*65*/ 			for await (const fragment of chatRequest.response) {
/*66*/ 				progress.report({ content: fragment });
/*67*/ 			}
/*68*/ 			
/*69*/ 			return { slashCommand: '' };
/*70*/ 		}
/*71*/     };
/*72*/     
/*73*/     // Agents appear as top-level options in the chat input
/*74*/     // when you type `@`, and can contribute sub-commands in the chat input
/*75*/     // that appear when you type `/`.
/*76*/     const agent = vscode.chat.createChatAgent('cat', handler);
/*77*/     agent.iconPath = vscode.Uri.joinPath(context.extensionUri, 'cat.jpeg');
/*78*/     agent.description = vscode.l10n.t('Meow! What can I help you with?');
/*79*/ 	agent.fullName = vscode.l10n.t('Cat');
/*80*/     agent.slashCommandProvider = {
/*81*/         provideSlashCommands(token) {
/*82*/             return [
/*83*/                 { name: 'teach', description: 'Pick at random a computer science concept then explain it in purfect way of a cat' },
/*84*/                 { name: 'play', description: 'Do whatever you want, you are a cat after all' }
/*85*/             ];
/*86*/         }
/*87*/     };
/*88*/ 
/*89*/     agent.followupProvider = {
/*90*/ 		provideFollowups(result: ICatChatAgentResult, token: vscode.CancellationToken) {
/*91*/             if (result.slashCommand === 'teach') {
/*92*/                 return [{
/*93*/                     commandId: MEOW_COMMAND_ID,
/*94*/                     message: '@cat thank you',
/*95*/                     title: vscode.l10n.t('Meow!')
/*96*/                 }];
/*97*/             } else if (result.slashCommand === 'play') {
/*98*/                 return [{
/*99*/                     message: '@cat let us play',
/*100*/                     title: vscode.l10n.t('Play with the cat')
/*101*/                 }];
/*102*/             }
/*103*/         }
/*104*/     };
/*105*/ 
/*106*/     context.subscriptions.push(
/*107*/         agent,
/*108*/         // Register the command handler for the /meow followup
/*109*/         vscode.commands.registerCommand(MEOW_COMMAND_ID, async () => {
/*110*/             vscode.window.showInformationMessage('Meow!');
/*111*/         }),
/*112*/     );
/*113*/ }
/*114*/ 
/*115*/ export function deactivate() { }
