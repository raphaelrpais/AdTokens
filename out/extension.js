"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
// ─── State ────────────────────────────────────────────────────────────────────
let adPanel;
let statusBarItem;
let agentRunning = false;
// ─── Activation ───────────────────────────────────────────────────────────────
function activate(context) {
    console.log('[AgentAds] Extension activated');
    // Status bar toggle
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(broadcast) Ads: Off';
    statusBarItem.tooltip = 'Agent Ads – click to toggle';
    statusBarItem.command = 'agentAds.togglePanel';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Commands
    context.subscriptions.push(vscode.commands.registerCommand('agentAds.showPanel', () => showAdPanel(context)), vscode.commands.registerCommand('agentAds.hidePanel', () => hideAdPanel()), vscode.commands.registerCommand('agentAds.togglePanel', () => {
        if (adPanel) {
            hideAdPanel();
        }
        else {
            showAdPanel(context);
        }
    }));
    // Watch for chat / terminal activity as a proxy for "agent running"
    // VSCodium doesn't expose Copilot/Continue APIs directly, so we use
    // heuristics: terminal activity + text changes in untitled/output docs.
    watchForAgentActivity(context);
}
function deactivate() {
    adPanel?.dispose();
}
// ─── Agent detection ──────────────────────────────────────────────────────────
function watchForAgentActivity(context) {
    // Heuristic 1: terminal data write (agent tools often spawn processes)
    context.subscriptions.push(vscode.window.onDidOpenTerminal(() => onAgentStartDetected(context)));
    // Heuristic 2: output channel / log activity
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.uri.scheme === 'output' || doc.fileName.includes('agent')) {
            onAgentStartDetected(context);
        }
    }));
    // Heuristic 3: explicit "Continue" / Copilot extension events via workspace
    // They write to `.continue` or `.copilot` temp files — watch for those
    const watcher = vscode.workspace.createFileSystemWatcher('**/.{continue,copilot,aider}/**', false, false, false);
    watcher.onDidChange(() => onAgentStartDetected(context));
    watcher.onDidCreate(() => onAgentStartDetected(context));
    context.subscriptions.push(watcher);
}
function onAgentStartDetected(context) {
    const config = vscode.workspace.getConfiguration('agentAds');
    if (!config.get('enabled', true))
        return;
    if (agentRunning)
        return;
    agentRunning = true;
    showAdPanel(context);
    // Auto-hide after inactivity (30s debounce)
    scheduleAgentStop(context);
}
let stopTimer;
function scheduleAgentStop(context) {
    if (stopTimer)
        clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
        agentRunning = false;
        // Keep panel open until user closes manually – better UX
    }, 30000);
}
// ─── Ad Panel ─────────────────────────────────────────────────────────────────
function showAdPanel(context) {
    const config = vscode.workspace.getConfiguration('agentAds');
    const adUrl = config.get('adPageUrl', 'https://raphaelrpais.com/AdTokens/');
    if (adPanel) {
        adPanel.reveal(vscode.ViewColumn.Beside);
        updateStatusBar(true);
        return;
    }
    adPanel = vscode.window.createWebviewPanel('agentAds', '📡 Agent Ads', {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true // Don't steal focus from chat
    }, {
        enableScripts: true,
        // Allow loading the external ad page inside an iframe
        enableForms: false,
        retainContextWhenHidden: true,
        localResourceRoots: []
    });
    adPanel.webview.html = buildWebviewHtml(adPanel.webview, adUrl, context);
    adPanel.onDidDispose(() => {
        adPanel = undefined;
        updateStatusBar(false);
    });
    // Handle messages from webview (e.g. ad impression events)
    adPanel.webview.onDidReceiveMessage((message) => handleWebviewMessage(message), undefined, context.subscriptions);
    updateStatusBar(true);
}
function hideAdPanel() {
    adPanel?.dispose();
    adPanel = undefined;
    updateStatusBar(false);
}
function updateStatusBar(active) {
    if (active) {
        statusBarItem.text = '$(broadcast) Ads: On';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    else {
        statusBarItem.text = '$(broadcast) Ads: Off';
        statusBarItem.backgroundColor = undefined;
    }
}
function handleWebviewMessage(message) {
    switch (message.type) {
        case 'ad-impression':
            // Future: log impression, credit tokens
            console.log('[AgentAds] Ad impression recorded', message.payload);
            break;
        case 'ad-click':
            console.log('[AgentAds] Ad click recorded', message.payload);
            break;
        case 'close':
            hideAdPanel();
            break;
    }
}
// ─── Webview HTML ─────────────────────────────────────────────────────────────
function buildWebviewHtml(_webview, adUrl, _context) {
    // CSP: allow iframe from the configured ad URL origin
    const adOrigin = (() => {
        try {
            return new URL(adUrl).origin;
        }
        catch {
            return 'https://raphaelrpais.com';
        }
    })();
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      script-src 'unsafe-inline';
      style-src 'unsafe-inline';
      frame-src ${adOrigin};
      img-src ${adOrigin} data:;
    "
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent Ads</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--vscode-sideBar-background, #1e1e1e);
      color: var(--vscode-foreground, #ccc);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: 11px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header bar ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      background: var(--vscode-titleBar-activeBackground, #323232);
      border-bottom: 1px solid var(--vscode-panel-border, #444);
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #f0883e;
      animation: pulse 1.4s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    .label {
      color: var(--vscode-descriptionForeground, #aaa);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground, #888);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .close-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, #3c3c3c);
      color: var(--vscode-foreground, #eee);
    }

    /* ── Ad iframe container ── */
    .ad-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    /* ── Fallback / loading state ── */
    .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--vscode-descriptionForeground, #666);
      font-size: 11px;
    }
    .placeholder svg {
      opacity: 0.3;
    }
    .placeholder.hidden { display: none; }

    /* ── Footer ── */
    .footer {
      padding: 3px 8px;
      font-size: 9px;
      color: var(--vscode-descriptionForeground, #555);
      border-top: 1px solid var(--vscode-panel-border, #333);
      text-align: center;
      flex-shrink: 0;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <div class="dot"></div>
      <span class="label">Agent is thinking · Ad running</span>
    </div>
    <button class="close-btn" onclick="closePanel()" title="Fechar painel">✕</button>
  </div>

  <div class="ad-container">
    <!-- Placeholder shown while iframe loads -->
    <div class="placeholder" id="placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span>Carregando anúncio…</span>
    </div>

    <!--
      The iframe loads your hosted ad page.
      That page can contain AdSense, any ad SDK, or your own ad server.
      Replace the src below with your real URL via settings.
    -->
    <iframe
      id="adFrame"
      src="${adUrl}"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      title="Advertisement"
      onload="onFrameLoad()"
      onerror="onFrameError()"
    ></iframe>
  </div>

  <div class="footer">
    Ads financiam tokens para você · <a href="#" onclick="return false" style="color:inherit">Saiba mais</a>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function closePanel() {
      vscode.postMessage({ type: 'close' });
    }

    function onFrameLoad() {
      document.getElementById('placeholder').classList.add('hidden');
      // Report impression
      vscode.postMessage({
        type: 'ad-impression',
        payload: { timestamp: Date.now(), url: '${adUrl}' }
      });
    }

    function onFrameError() {
      document.getElementById('placeholder').innerHTML =
        '<span style="color:#cc6666">Não foi possível carregar o anúncio.<br>Verifique a URL em Settings → Agent Ads.</span>';
    }

    // Listen for messages from the extension (future: token balance update)
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'token-balance') {
        console.log('Token balance:', msg.payload);
      }
    });
  </script>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map