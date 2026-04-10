"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const AD_URL = 'https://raphaelrpais.com/AdTokens/';
const VIEW_ID = 'agentAds.panel';
function activate(context) {
    console.log('[AgentAds] Extension activated');
    // Register the WebviewView provider (shows in the bottom panel)
    const provider = new AdPanelProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    // Status bar button
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(broadcast) Ads';
    statusBar.tooltip = 'Mostrar painel de anúncios';
    statusBar.command = 'agentAds.focus';
    statusBar.show();
    context.subscriptions.push(statusBar);
    // Command to focus/open the panel
    context.subscriptions.push(vscode.commands.registerCommand('agentAds.focus', () => {
        vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    }));
    // Auto-show when a terminal opens (agent heuristic)
    context.subscriptions.push(vscode.window.onDidOpenTerminal(() => {
        vscode.commands.executeCommand(`${VIEW_ID}.focus`);
    }));
}
function deactivate() { }
// ─── WebviewView Provider ─────────────────────────────────────────────────────
class AdPanelProvider {
    constructor(context) {
        this.context = context;
    }
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: []
        };
        webviewView.title = '📡 Agent Ads';
        webviewView.webview.html = this.getHtml();
        webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'ad-impression') {
                console.log('[AgentAds] Impression:', msg.payload);
            }
        });
    }
    getHtml() {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'unsafe-inline';
    style-src 'unsafe-inline';
    frame-src https://raphaelrpais.com;
    img-src https: data:;
  "/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      width:100%; height:100vh;
      background:#1a1a1a;
      display:flex; flex-direction:column;
      overflow:hidden;
    }
    .header {
      display:flex; align-items:center; gap:6px;
      padding:4px 8px;
      background:#222; border-bottom:1px solid #2a2a2a;
      flex-shrink:0;
    }
    .dot {
      width:6px; height:6px; border-radius:50%;
      background:#f0883e; animation:pulse 1.4s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .label { font-size:10px; color:#555; font-family:sans-serif;
             text-transform:uppercase; letter-spacing:0.5px; }
    iframe {
      flex:1; border:none; display:block; width:100%;
    }
    .footer {
      padding:2px 8px; font-size:9px; color:#333;
      border-top:1px solid #222; text-align:center;
      font-family:sans-serif; flex-shrink:0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="dot"></div>
    <span class="label">Agent thinking · ad running</span>
  </div>

  <iframe
    src="${AD_URL}"
    sandbox="allow-scripts allow-same-origin allow-popups"
    title="Advertisement"
    onload="onLoad()"
  ></iframe>

  <div class="footer">ads financiam tokens para você</div>

  <script>
    const vscode = acquireVsCodeApi();
    function onLoad() {
      vscode.postMessage({ type: 'ad-impression', payload: { ts: Date.now() } });
    }
  </script>
</body>
</html>`;
    }
}
//# sourceMappingURL=extension.js.map