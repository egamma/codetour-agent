# Prefix snippets with line numbers

Create a function that transforms a string of code snippets so that each snippet has a line number comment at the beginning of the line. The input string has the following structure:

- each code snippet starts with the string: Here is a potentially relevant code excerpt from FILE_NAME:
- the next line has a tripple markdown backtick with the language of the snippet. For example ```ts
- the next line has a comment with the relative file name. For example, // StringFormatter.test.ts
- then follows the actual code snippets that ends at the closing ``` and an empty line.

Each line in the snippet should be prefixed with a line number starts at line number that corresponds to the position of the snippet inside the given file

# Find the initial line number
Q: Given a snippet and a relative file name, find the line number in the file where the snippet occurs

Q: What is the initial line number of the snippet in the file?
I'm doing this inside a VS Code extension and would like to use the vscode.ws function to access the file contents
--
Q: The snippet has multiple lines and each line of the snippet should match
---
Don't have to close the document that I have opened with openTextDocument?
---
No, you don't need to manually close a document that you've opened with vscode.workspace.openTextDocument. Visual Studio Code manages open documents for you. When you call openTextDocument, it doesn't actually open the document in the editor, it just loads the document into memory so you can work with it programmatically. When you're done with the document, it will be automatically garbage collected if there are no more references to it. If you want to open the document in the editor, you would use vscode.window.showTextDocument.