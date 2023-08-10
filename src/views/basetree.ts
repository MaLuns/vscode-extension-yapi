import { Disposable, Event, EventEmitter, TreeDataProvider, TreeItem } from "vscode";

export abstract class ViewNode<T> {
    protected splatted = false;
    constructor(protected parent?: ViewNode<T>) { }

    abstract getChildren(): ViewNode<T>[] | Promise<ViewNode<T>[]>;
    abstract getTreeItem(node: ViewNode<T>): TreeItem | Promise<TreeItem>;

    getParent(): ViewNode<T> | undefined {
        return this.parent?.splatted ? this.parent?.getParent() : this.parent;
    }

    resolveTreeItem?(item: TreeItem): TreeItem | Promise<TreeItem>;
}

export abstract class BaseTree<T, RootNode extends ViewNode<T>> implements TreeDataProvider<ViewNode<T>>, Disposable {
    protected root: RootNode | undefined;
    protected disposables: Disposable[] = [];

    protected _onDidChangeTreeData: EventEmitter<ViewNode<T> | undefined | void> = new EventEmitter<ViewNode<T> | undefined>();
    readonly onDidChangeTreeData: Event<ViewNode<T> | undefined | void> = this._onDidChangeTreeData.event;

    refresh(node?: ViewNode<T>): void {
        return node ? this._onDidChangeTreeData.fire(node) : this._onDidChangeTreeData.fire();
    }

    constructor() {
        this.disposables.push(...this.registerCommands());
    }

    protected abstract registerCommands(): Disposable[];
    protected abstract getRoot(): RootNode;
    protected ensureRoot(force: boolean = false) {
        if (this.root === undefined || force) {
            this.root = this.getRoot();
        }
        return this.root;
    }

    getChildren(node?: ViewNode<T>): ViewNode<T>[] | Promise<ViewNode<T>[]> {
        if (node) {
            return node.getChildren();
        }
        const root = this.ensureRoot();
        return root?.getChildren() || [];
    }

    getParent(node: ViewNode<T>): ViewNode<T> | undefined {
        return node.getParent();
    }

    getTreeItem(node: ViewNode<T>): TreeItem | Promise<TreeItem> {
        return node.getTreeItem(node);
    }

    resolveTreeItem(item: TreeItem, node: ViewNode<T>): TreeItem | Promise<TreeItem> {
        return node.resolveTreeItem?.(item) ?? item;
    }

    dispose() {
        Disposable.from(...this.disposables).dispose();
    }
}