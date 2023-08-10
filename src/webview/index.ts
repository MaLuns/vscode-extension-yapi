import { ViewColumn, WebviewPanel, window } from "vscode";


class WebViewManger {

    private webviewPanels: { [k: string]: WebviewPanel | null; } = {};

    createOrUpdateWebView = (id: string, title: string, html: string,) => {
        const webviewPanel = this.webviewPanels[id];
        if (webviewPanel) {
            webviewPanel.title = title;
            webviewPanel.webview.html = html;
            return { panel: webviewPanel, type: 'update' };
        } else {
            const column = window.activeTextEditor ? window.activeTextEditor.viewColumn : undefined;
            const panel = window.createWebviewPanel(id, title, column || ViewColumn.One, { enableScripts: true, });
            this.webviewPanels[id] = panel;
            panel.webview.html = html;
            panel.onDidDispose(() => {
                this.webviewPanels[id] = null;
            });
            return { panel, type: 'add' };
        }
    };


    remove(id: string) {
        const webviewPanel = this.webviewPanels[id];
        if (webviewPanel) {
            webviewPanel.dispose();
            this.webviewPanels[id] = null;
        }
    }
}


export default new WebViewManger();