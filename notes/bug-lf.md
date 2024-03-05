{
  level: 3,
  kind: undefined,
  value: "Active selection:


From the file: promptVariablesService.ts
```typescript
export class PromptVariablesServiceImpl implements IPromptVariablesService {

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
```

",
  description: "",
}