# Agent Ads – VSCodium Extension

> Monetize o tempo de raciocínio dos agentes de IA. Anúncios aparecem enquanto o agente pensa. Receita vira tokens para o usuário.

---

## Como funciona

```
┌─────────────────────────────────┐
│  VSCodium (extensão)            │
│                                 │
│  ┌──────────────────────────┐   │
│  │  Chat do Agente          │   │
│  │  (Continue / Copilot)    │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  📡 Agent Ads panel      │   │
│  │  ┌────────────────────┐  │   │
│  │  │  <iframe>          │  │   │
│  │  │  seu-dominio.com   │  │   │   ← AdSense roda aqui
│  │  │  /ads              │  │   │
│  │  └────────────────────┘  │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

O AdSense **não roda em apps locais** – por isso a extensão carrega um `<iframe>` apontando para uma página sua hospedada normalmente na web, onde o AdSense funciona sem restrições.

---

## Setup

### 1. Build da extensão

```bash
npm install
npm run compile
```

Para empacotar:

```bash
npm install -g @vscode/vsce
vsce package
# Gera: agent-ads-0.1.0.vsix
```

### 2. Instalar no VSCodium

```
Extensions → ... → Install from VSIX → agent-ads-0.1.0.vsix
```

### 3. Configurar sua página de anúncios

1. Suba `hosted-ad-page/index.html` para o seu domínio
2. Substitua `ca-pub-XXXXXXXXXXXXXXXX` e `data-ad-slot` pelos seus dados do AdSense
3. No VSCodium: `Settings → Agent Ads → Ad Page URL` → coloque sua URL

---

## Detecção de agente (heurísticas MVP)

| Trigger | Como detecta |
|---|---|
| Terminal aberto | `onDidOpenTerminal` |
| Output channel | `onDidOpenTextDocument` com `scheme=output` |
| Arquivos `.continue` / `.copilot` | `FileSystemWatcher` |

> Na próxima versão: integração direta com a API do Continue.dev e detecção de estado do agente via Language Model API do VS Code 1.90+.

---

## Roadmap

- [x] MVP: painel WebView com iframe de anúncios
- [x] Detecção heurística de agente rodando
- [x] Status bar toggle
- [ ] Integração nativa Continue.dev (evento `onAgentStart`)
- [ ] Backend de créditos: impressão → tokens
- [ ] Dashboard do usuário (saldo de tokens)
- [ ] Suporte a outras redes: Carbon Ads, EthicalAds, Publift
