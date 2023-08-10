import { ExtensionContext, workspace } from 'vscode';
import { clearCacheConfig } from './utils';
import ViewContainer from './views';

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		new ViewContainer(context),
		workspace.onDidChangeConfiguration(() => {
			clearCacheConfig();
		})
	);
}

export function deactivate() { }
