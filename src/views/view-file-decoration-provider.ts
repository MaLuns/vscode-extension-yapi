import { CancellationToken, Disposable, Event, EventEmitter, FileDecoration, FileDecorationProvider, FileSystemWatcher, ThemeColor, Uri, window } from "vscode";

export class ViewFileDecorationProvider implements FileDecorationProvider, Disposable {
    private readonly disposable: Disposable;

    protected _onDidChangeFileDecorations: EventEmitter<undefined | Uri | Uri[]> = new EventEmitter();
    readonly onDidChangeFileDecorations: Event<undefined | Uri | Uri[]> = this._onDidChangeFileDecorations.event;
    private watcher?: FileSystemWatcher;

    constructor() {
        this.disposable = Disposable.from(
            window.registerFileDecorationProvider(this),
        );
    }

    dispose(): void {
        this.watcher?.dispose();
        this.disposable.dispose();
    }

    change(data: undefined | Uri | Uri[]) {
        this._onDidChangeFileDecorations.fire(data);
    }

    provideFileDecoration(uri: Uri, token: CancellationToken): Promise<FileDecoration | undefined> | FileDecoration | undefined {
        if (uri.scheme === 'yapi-box') {
            switch (uri.authority) {
                case 'method':
                    return this.provideMethodStatusDecoration(uri, token);
                case 'log':
                    return this.provideLogStatusDecoration(uri, token);
            }
        }
        return undefined;
    }

    provideLogStatusDecoration(uri: Uri, token: CancellationToken): FileDecoration | undefined {
        const [, status] = uri.path.split('/');
        switch (status.toLocaleUpperCase()) {
            case 'ADD':
                return { color: new ThemeColor('yapi.getTagColor'), };
            case 'UPDATE':
                return { color: new ThemeColor('yapi.postTagColor'), };
            case 'DELETE':
                return { color: new ThemeColor('yapi.deleteTagColor'), };
            default:
                return undefined;
        }
    }

    provideMethodStatusDecoration(uri: Uri, token: CancellationToken): FileDecoration | undefined {
        const [, , status] = uri.path.split('/');
        switch (status.toLocaleUpperCase()) {
            case 'POST':
                return {
                    badge: 'P',
                    color: new ThemeColor('yapi.postTagColor'),
                    tooltip: 'Post',
                };
            case 'GET':
                return {
                    badge: 'G',
                    color: new ThemeColor('yapi.getTagColor'),
                    tooltip: 'Get',
                };
            case 'DELETE':
                return {
                    badge: 'D',
                    color: new ThemeColor('yapi.deleteTagColor'),
                    tooltip: 'Delete',
                };
            case 'PUT':
                return {
                    badge: 'P',
                    color: new ThemeColor('yapi.putTagColor'),
                    tooltip: 'PUT',
                };
            default:
                return undefined;
        }
    }
}