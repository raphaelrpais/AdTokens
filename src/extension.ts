import * as vscode from 'vscode';

const AD_URL = 'https://raphaelrpais.com/AdTokens/';

let adPanel: vscode.WebviewPanel | undefined;
let hideTimer: NodeJS.Timeout | undefined;
let agentActive = false;

// ─── Activate ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  // Watch for signs that an AI agent is running
  watchAgentActivity(context);
}

export function deactivate() {
  closePanel();
}

// ─── Agent Detection ─────────────────────────────────────────────────────────

function watchAgentActivity(context: vscode.ExtensionContext) {

  // Heuristic 1: rapid successive document changes = agent writing code
  let changeCount = 0;
  let changeTimer: NodeJS.Timeout | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      changeCount++;
      if (changeTimer) clearTimeout(changeTimer);

      // 3+ changes within 1.5s = agent likely writing
      if (changeCount >= 3) {
        onAgentStart();
      }

      changeTimer = setTimeout(() => {
        changeCount = 0;
      }, 1500);
    })
  );

  // Heuristic 2: new terminal opened by agent tool use
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(() => onAgentStart())
  );

  // Heuristic 3: agent writes/creates files rapidly
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  let fileChangeCount = 0;
  let fileTimer: NodeJS.Timeout | undefined;

  const onFileEvent = () => {
    fileChangeCount++;
    if (fileTimer) clearTimeout(fileTimer);
    if (fileChangeCount >= 2) onAgentStart();
    fileTimer = setTimeout(() => { fileChangeCount = 0; }, 2000);
  };

  watcher.onDidChange(onFileEvent);
  watcher.onDidCreate(onFileEvent);
  context.subscriptions.push(watcher);

  // Heuristic 4: progress notifications (Copilot/Gemini show these while thinking)
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(() => {
      // Re-evaluate on focus changes — agents often trigger background tasks
    })
  );
}

// ─── Panel Lifecycle ──────────────────────────────────────────────────────────

function onAgentStart() {
  agentActive = true;

  // Reset the hide timer every time we detect activity
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => onAgentStop(), 8000);

  if (!adPanel) openPanel();
}

function onAgentStop() {
  agentActive = false;
  closePanel();
}

function openPanel() {
  adPanel = vscode.window.createWebviewPanel(
    'agentAds',
    '📡 Agent Ads',
    {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true  // never steal focus from chat
    },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: []
    }
  );

  adPanel.webview.html = getHtml();

  adPanel.onDidDispose(() => {
    adPanel = undefined;
  });

  adPanel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'ad-impression') {
      console.log('[AgentAds] Impression recorded');
    }
  });
}

function closePanel() {
  if (hideTimer) clearTimeout(hideTimer);
  adPanel?.dispose();
  adPanel = undefined;
}

// ─── Webview HTML ─────────────────────────────────────────────────────────────

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
      display:flex; flex-direction:column;
      overflow:hidden;
    }
    .header {
      display:flex; align-items:center; gap:6px;
      padding:5px 10px;
      background:#1f1f1f; border-bottom:1px solid #2a2a2a;
      flex-shrink:0;
    }
    .dot {
      width:6px; height:6px; border-radius:50%;
      background:#f0883e; animation:pulse 1.4s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
    .label {
      font-size:10px; color:#4a4a4a;
      font-family:sans-serif;
      text-transform:uppercase; letter-spacing:0.5px;
    }
    iframe { flex:1; border:none; width:100%; display:block; }
    .footer {
      padding:3px 8px; font-size:9px; color:#2e2e2e;
      border-top:1px solid #222;
      text-align:center; font-family:sans-serif; flex-shrink:0;
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
