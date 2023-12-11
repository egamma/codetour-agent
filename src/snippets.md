src/vs/base/common/search.ts 1-23
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as strings from './strings';

export function buildReplaceStringWithCasePreserved(matches: string[] | null, pattern: string): string {
	if (matches && (matches[0] !== '')) {
		const containsHyphens = validateSpecificSpecialCharacter(matches, pattern, '-');
		const containsUnderscores = validateSpecificSpecialCharacter(matches, pattern, '_');
		if (containsHyphens && !containsUnderscores) {
			return buildReplaceStringForSpecificSpecialCharacter(matches, pattern, '-');
		} else if (!containsHyphens && containsUnderscores) {
			return buildReplaceStringForSpecificSpecialCharacter(matches, pattern, '_');
		}
		if (matches[0].toUpperCase() === matches[0]) {
			return pattern.toUpperCase();
		} else if (matches[0].toLowerCase() === matches[0]) {
			return pattern.toLowerCase();
		} else if (strings.containsUppercaseCharacter(matches[0][0]) && pattern.length > 0) {
			return pattern[0].toUpperCase() + pattern.substr(1);
		} else if (matches[0][0].toUpperCase() !== matches[0][0] && pattern.length > 0) {


src/vs/workbench/browser/parts/editor/editorAutoSave.ts 1-216
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { Disposable, DisposableStore, IDisposable, dispose, toDisposable } from 'vs/base/common/lifecycle';
import { IFilesConfigurationService, AutoSaveMode } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { SaveReason, IEditorIdentifier, GroupIdentifier, ISaveOptions, EditorInputCapabilities } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IWorkingCopyService } from 'vs/workbench/services/workingCopy/common/workingCopyService';
import { IWorkingCopy, WorkingCopyCapabilities } from 'vs/workbench/services/workingCopy/common/workingCopy';
import { ILogService } from 'vs/platform/log/common/log';

export class EditorAutoSave extends Disposable implements IWorkbenchContribution {

	// Auto save: after delay
	private readonly pendingAutoSavesAfterDelay = new Map<IWorkingCopy, IDisposable>();

	// Auto save: focus change & window change
	private lastActiveEditor: EditorInput | undefined = undefined;
	private lastActiveGroupId: GroupIdentifier | undefined = undefined;
	private lastActiveEditorControlDisposable = this._register(new DisposableStore());

	constructor(
		@IFilesConfigurationService private readonly filesConfigurationService: IFilesConfigurationService,
		@IHostService private readonly hostService: IHostService,
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@IWorkingCopyService private readonly workingCopyService: IWorkingCopyService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		// Fill in initial dirty working copies
		for (const dirtyWorkingCopy of this.workingCopyService.dirtyWorkingCopies) {
			this.onDidRegister(dirtyWorkingCopy);
		}

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.hostService.onDidChangeFocus(focused => this.onWindowFocusChange(focused)));
		this._register(this.hostService.onDidChangeActiveWindow(() => this.onActiveWindowChange()));
		this._register(this.editorService.onDidActiveEditorChange(() => this.onDidActiveEditorChange()));
		this._register(this.filesConfigurationService.onDidChangeAutoSaveConfiguration(() => this.onDidChangeAutoSaveConfiguration()));

		// Working Copy events
		this._register(this.workingCopyService.onDidRegister(workingCopy => this.onDidRegister(workingCopy)));
		this._register(this.workingCopyService.onDidUnregister(workingCopy => this.onDidUnregister(workingCopy)));
		this._register(this.workingCopyService.onDidChangeDirty(workingCopy => this.onDidChangeDirty(workingCopy)));
		this._register(this.workingCopyService.onDidChangeContent(workingCopy => this.onDidChangeContent(workingCopy)));
	}

	private onWindowFocusChange(focused: boolean): void {
		if (!focused) {
			this.maybeTriggerAutoSave(SaveReason.WINDOW_CHANGE);
		}
	}

	private onActiveWindowChange(): void {
		this.maybeTriggerAutoSave(SaveReason.WINDOW_CHANGE);
	}

	private onDidActiveEditorChange(): void {

		// Treat editor change like a focus change for our last active editor if any
		if (this.lastActiveEditor && typeof this.lastActiveGroupId === 'number') {
			this.maybeTriggerAutoSave(SaveReason.FOCUS_CHANGE, { groupId: this.lastActiveGroupId, editor: this.lastActiveEditor });
		}

		// Remember as last active
		const activeGroup = this.editorGroupService.activeGroup;
		const activeEditor = this.lastActiveEditor = activeGroup.activeEditor ?? undefined;
		this.lastActiveGroupId = activeGroup.id;

		// Dispose previous active control listeners
		this.lastActiveEditorControlDisposable.clear();

		// Listen to focus changes on control for auto save
		const activeEditorPane = this.editorService.activeEditorPane;
		if (activeEditor && activeEditorPane) {
			this.lastActiveEditorControlDisposable.add(activeEditorPane.onDidBlur(() => {
				this.maybeTriggerAutoSave(SaveReason.FOCUS_CHANGE, { groupId: activeGroup.id, editor: activeEditor });
			}));
		}
	}

	private maybeTriggerAutoSave(reason: SaveReason, editorIdentifier?: IEditorIdentifier): void {
		if (editorIdentifier) {
			if (
				!editorIdentifier.editor.isDirty() ||
				editorIdentifier.editor.isReadonly() ||
				editorIdentifier.editor.hasCapability(EditorInputCapabilities.Untitled)
			) {
				return; // no auto save for readonly or untitled editors
			}

			// Determine if we need to save all. In case of a window focus change we also save if
			// auto save mode is configured to be ON_FOCUS_CHANGE (editor focus change)
			const mode = this.filesConfigurationService.getAutoSaveMode(editorIdentifier.editor);
			if (
				(reason === SaveReason.WINDOW_CHANGE && (mode === AutoSaveMode.ON_FOCUS_CHANGE || mode === AutoSaveMode.ON_WINDOW_CHANGE)) ||
				(reason === SaveReason.FOCUS_CHANGE && mode === AutoSaveMode.ON_FOCUS_CHANGE)
			) {
				this.logService.trace(`[editor auto save] triggering auto save with reason ${reason}`);

				this.editorService.save(editorIdentifier, { reason });
			}
		} else {
			this.saveAllDirtyAutoSaveables({ reason });
		}
	}

	private onDidChangeAutoSaveConfiguration(): void {

		// Trigger a save-all when auto save is enabled
		let reason: SaveReason | undefined = undefined;
		switch (this.filesConfigurationService.getAutoSaveMode(undefined)) {
			case AutoSaveMode.ON_FOCUS_CHANGE:
				reason = SaveReason.FOCUS_CHANGE;
				break;
			case AutoSaveMode.ON_WINDOW_CHANGE:
				reason = SaveReason.WINDOW_CHANGE;
				break;
			case AutoSaveMode.AFTER_SHORT_DELAY:
			case AutoSaveMode.AFTER_LONG_DELAY:
				reason = SaveReason.AUTO;
				break;
		}

		if (reason) {
			this.saveAllDirtyAutoSaveables({ reason });
		}
	}

	private saveAllDirtyAutoSaveables(options?: ISaveOptions): void {
		for (const workingCopy of this.workingCopyService.dirtyWorkingCopies) {
			if (!(workingCopy.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.getAutoSaveMode(workingCopy.resource) !== AutoSaveMode.OFF) {
				workingCopy.save(options);
			}
		}
	}

	private onDidRegister(workingCopy: IWorkingCopy): void {
		if (workingCopy.isDirty()) {
			this.scheduleAutoSave(workingCopy);
		}
	}

	private onDidUnregister(workingCopy: IWorkingCopy): void {
		this.discardAutoSave(workingCopy);
	}

	private onDidChangeDirty(workingCopy: IWorkingCopy): void {
		if (workingCopy.isDirty()) {
			this.scheduleAutoSave(workingCopy);
		} else {
			this.discardAutoSave(workingCopy);
		}
	}

	private onDidChangeContent(workingCopy: IWorkingCopy): void {
		if (workingCopy.isDirty()) {
			// this listener will make sure that the auto save is
			// pushed out for as long as the user is still changing
			// the content of the working copy.
			this.scheduleAutoSave(workingCopy);
		}
	}

	private scheduleAutoSave(workingCopy: IWorkingCopy): void {
		if (workingCopy.capabilities & WorkingCopyCapabilities.Untitled) {
			return; // we never auto save untitled working copies
		}

		const autoSaveAfterDelay = this.filesConfigurationService.getAutoSaveConfiguration(workingCopy.resource).autoSaveDelay;
		if (typeof autoSaveAfterDelay !== 'number') {
			return; // auto save after delay must be enabled
		}

		// Clear any running auto save operation
		this.discardAutoSave(workingCopy);

		this.logService.trace(`[editor auto save] scheduling auto save after ${autoSaveAfterDelay}ms`, workingCopy.resource.toString(), workingCopy.typeId);

		// Schedule new auto save
		const handle = setTimeout(() => {

			// Clear disposable
			this.discardAutoSave(workingCopy);

			// Save if dirty
			if (workingCopy.isDirty() && this.filesConfigurationService.getAutoSaveMode(workingCopy.resource) !== AutoSaveMode.OFF) {
				this.logService.trace(`[editor auto save] running auto save`, workingCopy.resource.toString(), workingCopy.typeId);
				workingCopy.save({ reason: SaveReason.AUTO });
			}
		}, autoSaveAfterDelay);

		// Keep in map for disposal as needed
		this.pendingAutoSavesAfterDelay.set(workingCopy, toDisposable(() => {
			this.logService.trace(`[editor auto save] clearing pending auto save`, workingCopy.resource.toString(), workingCopy.typeId);

			clearTimeout(handle);
		}));
	}

	private discardAutoSave(workingCopy: IWorkingCopy): void {
		dispose(this.pendingAutoSavesAfterDelay.get(workingCopy));
		this.pendingAutoSavesAfterDelay.delete(workingCopy);
	}
}

src/vs/workbench/contrib/files/browser/files.contribution.ts 258-279
'default': 1000,
'minimum': 0,
'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSaveDelay' }, "Controls the delay in milliseconds after which an editor with unsaved changes is saved automatically. Only applies when `#files.autoSave#` is set to `{0}`.", AutoSaveConfiguration.AFTER_DELAY),
scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
},
'files.autoSaveWorkspaceFilesOnly': {
'type': 'boolean',
'default': false,
'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSaveWorkspaceFilesOnly' }, "When enabled, will limit [auto save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) of editors to files that are inside the opened workspace. Only applies when `#files.autoSave#` is enabled."),
scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
},
'files.autoSaveWhenNoErrors': {
'type': 'boolean',
'default': false,
'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSaveWhenNoErrors' }, "When enabled, will limit [auto save](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) of editors to files that have no errors reported in them. Only applies when `#files.autoSave#` is enabled."),
scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
},
'files.watcherExclude': {
'type': 'object',
'patternProperties': {
	'.*': { 'type': 'boolean' }
},

src/vs/workbench/contrib/notebook/browser/contrib/saveParticipants/saveParticipants.ts 309-501
class CodeActionOnSaveParticipant implements IStoredFileWorkingCopySaveParticipant {
	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
	}

	async participate(workingCopy: IStoredFileWorkingCopy<IStoredFileWorkingCopyModel>, context: { reason: SaveReason }, progress: IProgress<IProgressStep>, token: CancellationToken): Promise<void> {
		const nbDisposable = new DisposableStore();
		const isTrusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
		if (!isTrusted) {
			return;
		}

		if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
			return;
		}

		let saveTrigger = '';
		if (context.reason === SaveReason.AUTO) {
			// currently this won't happen, as vs/editor/contrib/codeAction/browser/codeAction.ts L#104 filters out codeactions on autosave. Just future-proofing
			// ? notebook CodeActions on autosave seems dangerous (perf-wise)
			// saveTrigger = 'always'; // TODO@Yoyokrazy, support during debt
			return undefined;
		} else if (context.reason === SaveReason.EXPLICIT) {
			saveTrigger = 'explicit';
		} else {
			// 	SaveReason.FOCUS_CHANGE, WINDOW_CHANGE need to be addressed when autosaves are enabled
			return undefined;
		}

		const notebookModel = workingCopy.model.notebookModel;

		const setting = this.configurationService.getValue<{ [kind: string]: string | boolean }>(NotebookSetting.codeActionsOnSave);
		if (!setting) {
			return undefined;
		}
		const settingItems: string[] = Array.isArray(setting)
			? setting
			: Object.keys(setting).filter(x => setting[x]);
		if (!settingItems.length) {
			return undefined;
		}

		const allCodeActions = this.createCodeActionsOnSave(settingItems);
		const excludedActions = allCodeActions
			.filter(x => setting[x.value] === 'never' || setting[x.value] === false);
		const includedActions = allCodeActions
			.filter(x => setting[x.value] === saveTrigger || setting[x.value] === true);

		const editorCodeActionsOnSave = includedActions.filter(x => !CodeActionKind.Notebook.contains(x));
		const notebookCodeActionsOnSave = includedActions.filter(x => CodeActionKind.Notebook.contains(x));
		if (!editorCodeActionsOnSave.length && !notebookCodeActionsOnSave.length) {
			return undefined;
		}

		// prioritize `source.fixAll` code actions
		if (!Array.isArray(setting)) {
			editorCodeActionsOnSave.sort((a, b) => {
				if (CodeActionKind.SourceFixAll.contains(a)) {
					if (CodeActionKind.SourceFixAll.contains(b)) {
						return 0;
					}
					return -1;
				}
				if (CodeActionKind.SourceFixAll.contains(b)) {
					return 1;
				}
				return 0;
			});
		}

		// run notebook code actions
		progress.report({ message: localize('notebookSaveParticipants.notebookCodeActions', "Running 'Notebook' code actions") });
		try {
			const cell = notebookModel.cells[0];
			const ref = await this.textModelService.createModelReference(cell.uri);
			nbDisposable.add(ref);

			const textEditorModel = ref.object.textEditorModel;

			await this.applyOnSaveActions(textEditorModel, notebookCodeActionsOnSave, excludedActions, progress, token);
		} catch {
			this.logService.error('Failed to apply notebook code action on save');
		} finally {
			progress.report({ increment: 100 });
			nbDisposable.dispose();
		}

		// run cell level code actions
		const disposable = new DisposableStore();
		progress.report({ message: localize('notebookSaveParticipants.cellCodeActions', "Running 'Cell' code actions") });
		try {
			await Promise.all(notebookModel.cells.map(async cell => {
				const ref = await this.textModelService.createModelReference(cell.uri);
				disposable.add(ref);

				const textEditorModel = ref.object.textEditorModel;

				await this.applyOnSaveActions(textEditorModel, editorCodeActionsOnSave, excludedActions, progress, token);
			}));
		} catch {
			this.logService.error('Failed to apply code action on save');
		} finally {
			progress.report({ increment: 100 });
			disposable.dispose();
		}
	}

	private createCodeActionsOnSave(settingItems: readonly string[]): CodeActionKind[] {
		const kinds = settingItems.map(x => new CodeActionKind(x));

		// Remove subsets
		return kinds.filter(kind => {
			return kinds.every(otherKind => otherKind.equals(kind) || !otherKind.contains(kind));
		});
	}

	private async applyOnSaveActions(model: ITextModel, codeActionsOnSave: readonly CodeActionKind[], excludes: readonly CodeActionKind[], progress: IProgress<IProgressStep>, token: CancellationToken): Promise<void> {

		const getActionProgress = new class implements IProgress<CodeActionProvider> {
			private _names = new Set<string>();
			private _report(): void {
				progress.report({
					message: localize(
						{ key: 'codeaction.get2', comment: ['[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}'] },
						"Getting code actions from '{0}' ([configure]({1})).",
						[...this._names].map(name => `'${name}'`).join(', '),
						'command:workbench.action.openSettings?%5B%22editor.codeActionsOnSave%22%5D'
					)
				});
			}
			report(provider: CodeActionProvider) {
				if (provider.displayName && !this._names.has(provider.displayName)) {
					this._names.add(provider.displayName);
					this._report();
				}
			}
		};

		for (const codeActionKind of codeActionsOnSave) {
			const actionsToRun = await this.getActionsToRun(model, codeActionKind, excludes, getActionProgress, token);
			if (token.isCancellationRequested) {
				actionsToRun.dispose();
				return;
			}

			try {
				for (const action of actionsToRun.validActions) {
					const codeActionEdits = action.action.edit?.edits;
					let breakFlag = false;
					if (!action.action.kind?.startsWith('notebook')) {
						for (const edit of codeActionEdits ?? []) {
							const workspaceTextEdit = edit as IWorkspaceTextEdit;
							if (workspaceTextEdit.resource && isEqual(workspaceTextEdit.resource, model.uri)) {
								continue;
							} else {
								// error -> applied to multiple resources
								breakFlag = true;
								break;
							}
						}
					}
					if (breakFlag) {
						this.logService.warn('Failed to apply code action on save, applied to multiple resources.');
						continue;
					}
					progress.report({ message: localize('codeAction.apply', "Applying code action '{0}'.", action.action.title) });
					await this.instantiationService.invokeFunction(applyCodeAction, action, ApplyCodeActionReason.OnSave, {}, token);
					if (token.isCancellationRequested) {
						return;
					}
				}
			} catch {
				// Failure to apply a code action should not block other on save actions
			} finally {
				actionsToRun.dispose();
			}
		}
	}

	private getActionsToRun(model: ITextModel, codeActionKind: CodeActionKind, excludes: readonly CodeActionKind[], progress: IProgress<CodeActionProvider>, token: CancellationToken) {
		return getCodeActions(this.languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), {
			type: CodeActionTriggerType.Invoke,
			triggerAction: CodeActionTriggerSource.OnSave,
			filter: { include: codeActionKind, excludes: excludes, includeSourceActions: true },
		}, progress, token);
	}
