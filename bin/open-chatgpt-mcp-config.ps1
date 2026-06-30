param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectorUrl
)

$ErrorActionPreference = "Stop"

$safeUrl = $ConnectorUrl.Trim()
if ([string]::IsNullOrWhiteSpace($safeUrl)) {
  throw "ConnectorUrl is required."
}

$tempDir = Join-Path $env:TEMP "his-py-chatgpt"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$htmlPath = Join-Path $tempDir "chatgpt-mcp-config.html"

$escapedUrl = [System.Net.WebUtility]::HtmlEncode($safeUrl)
$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>his-py MCP setup</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: light;
      --bg: #f3efe6;
      --card: #fffaf2;
      --ink: #181512;
      --muted: #5f564b;
      --line: #d8cbb8;
      --accent: #0f766e;
      --accent-2: #134e4a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: linear-gradient(180deg, #efe7d7 0%, var(--bg) 100%);
      color: var(--ink);
      min-height: 100vh;
    }
    main {
      max-width: 840px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(24, 21, 18, 0.08);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 30px;
      line-height: 1.1;
    }
    p, li {
      color: var(--muted);
      font-size: 16px;
      line-height: 1.55;
    }
    ol {
      margin: 20px 0 0;
      padding-left: 20px;
    }
    code {
      display: block;
      width: 100%;
      overflow-wrap: anywhere;
      margin: 16px 0;
      padding: 14px 16px;
      border-radius: 14px;
      background: #f5efe3;
      border: 1px solid var(--line);
      color: var(--accent-2);
      font-size: 14px;
    }
    .row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    button, a.button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      background: var(--accent);
      color: white;
      font: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    a.button.alt, button.alt {
      background: transparent;
      color: var(--accent-2);
      border: 1px solid var(--line);
    }
    .note {
      margin-top: 18px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>Connect `his-py` to ChatGPT</h1>
      <p>This is the ChatGPT-side setup only. Claude keeps using the repo's local <code>.mcp.json</code> and is not changed by this flow.</p>
      <p>The launcher started the local MCP server and tunnel. Use this exact connector URL in ChatGPT.</p>
      <code id="url">$escapedUrl</code>
      <div class="row">
        <button onclick="copyUrl()">Copy connector URL</button>
        <a class="button alt" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT</a>
      </div>
      <ol>
        <li>Open ChatGPT.</li>
        <li>Go to the ChatGPT settings for apps, connectors, or MCP servers.</li>
        <li>Add a custom connector/server.</li>
        <li>Paste the URL shown above. It must end with <strong>/mcp</strong>.</li>
        <li>Save it, then test the connection.</li>
      </ol>
      <p class="note">If ChatGPT shows an old failing connection, remove that old entry first and add this fresh URL. Claude's local config does not need to be edited.</p>
    </div>
  </main>
  <script>
    async function copyUrl() {
      const text = document.getElementById('url').textContent;
      try {
        await navigator.clipboard.writeText(text);
        alert('Connector URL copied.');
      } catch (error) {
        alert('Copy failed. Copy it manually from the page.');
      }
    }
  </script>
</body>
</html>
"@

Set-Content -Path $htmlPath -Value $html -Encoding UTF8
Set-Clipboard -Value $safeUrl
Start-Process $htmlPath | Out-Null
Start-Process "https://chatgpt.com/" | Out-Null
