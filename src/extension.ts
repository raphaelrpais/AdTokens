import * as vscode from 'vscode';

const AD_URL = 'https://raphaelrpais.com/AdTokens/';

let adPanel: vscode.WebviewPanel | undefined;
let hideTimer: NodeJS.Timeout | undefined;

// How long with NO activity before we assume the agent stopped
const INACTIVITY_TIMEOUT_MS = 45_000; // 45 seconds

export function activate(context: vscode.ExtensionContext) {
  watchAgentActivity(context);
}

export function deactivate() {
  closePanel();
}

// ─── Activity detection ───────────────────────────────────────────────────────

function watchAgentActivity(context: vscode.ExtensionContext) {

  // Document changes: agent writing code
  let docChangeCount = 0;
  let docChangeTimer: NodeJS.Timeout | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      docChangeCount++;
      if (docChangeTimer) clearTimeout(docChangeTimer);
      if (docChangeCount >= 3) keepAlive(); // 3+ rapid changes = agent writing
      docChangeTimer = setTimeout(() => { docChangeCount = 0; }, 1500);
    })
  );

  // File system: agent creating/modifying files
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  let fsChangeCount = 0;
  let fsTimer: NodeJS.Timeout | undefined;

  const onFsEvent = () => {
    fsChangeCount++;
    if (fsTimer) clearTimeout(fsTimer);
    if (fsChangeCount >= 2) keepAlive();
    fsTimer = setTimeout(() => { fsChangeCount = 0; }, 2000);
  };

  watcher.onDidChange(onFsEvent);
  watcher.onDidCreate(onFsEvent);
  context.subscriptions.push(watcher);

  // Terminal opened: agent using tools
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(() => keepAlive())
  );

  // Terminal data write: agent running commands
  context.subscriptions.push(
    vscode.window.onDidWriteTerminalData(() => keepAlive())
  );

  // Terminal closed without user interaction: agent finished a task
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(() => scheduleHide())
  );
}

// ─── Panel control ────────────────────────────────────────────────────────────

function keepAlive() {
  // Agent is active — show panel and reset the inactivity timer
  if (!adPanel) openPanel();

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => closePanel(), INACTIVITY_TIMEOUT_MS);
}

function scheduleHide() {
  // Something stopped — give a short grace period before closing
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => closePanel(), 5000);
}

function openPanel() {
  adPanel = vscode.window.createWebviewPanel(
    'agentAds',
    '📡 Agent Ads',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: []
    }
  );

  adPanel.webview.html = getHtml();
  adPanel.onDidDispose(() => { adPanel = undefined; });

  adPanel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'ad-impression') {
      console.log('[AgentAds] Impression recorded');
    }
  });
}

function closePanel() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = undefined;
  adPanel?.dispose();
  adPanel = undefined;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function getHtml(): string {
  return `<!DOCTYPE html>
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
      display:flex; flex-direction:column; overflow:hidden;
    }
    .header {
      display:flex; align-items:center; gap:6px;
      padding:5px 10px; background:#1f1f1f;
      border-bottom:1px solid #2a2a2a; flex-shrink:0;
    }
    .dot {
      width:6px; height:6px; border-radius:50%;
      background:#f0883e; animation:pulse 1.4s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
    .label {
      font-size:10px; color:#4a4a4a; font-family:sans-serif;
      text-transform:uppercase; letter-spacing:0.5px;
    }
    iframe { flex:1; border:none; width:100%; display:block; }
    .footer {
      padding:3px 8px; font-size:9px; color:#2e2e2e;
      border-top:1px solid #222; text-align:center;
      font-family:sans-serif; flex-shrink:0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="dot"></div>
    <span class="label">agent thinking · ad running</span>
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
