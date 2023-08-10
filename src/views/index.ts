
import { Disposable, ExtensionContext, commands, window } from 'vscode';
import { ViewFileDecorationProvider } from './view-file-decoration-provider';
import { YapiTree, ServerTree, LogTree } from './yapi';
import { isCheckYapi } from './yapi/apis';

export default class ViewContainer {
    private _disposables: Disposable[] = [];

    constructor(context: ExtensionContext) {
        commands.executeCommand('setContext', 'yapi-view.api-list.show', isCheckYapi());
        this._disposables.push(
            new ViewFileDecorationProvider(),
            window.createTreeView('yapi-view.api-list', { treeDataProvider: new YapiTree() }),
            window.createTreeView('yapi-view.mock-server', { treeDataProvider: new ServerTree() }),
            window.createTreeView('yapi-view.log', { treeDataProvider: new LogTree() })
        );
    }

    dispose(): void {
        this._disposables.forEach(d => void d.dispose());
    }
}

