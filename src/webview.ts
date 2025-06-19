import * as vscode from 'vscode';
import { TreeNode, FileNode, FileInfo } from './types';
import { FileUtils, TokenEstimator } from './utils';

export class WebviewManager {
    constructor(private extensionUri: vscode.Uri) {}

    async show(rootNode: TreeNode, defaultSelectedPath?: string): Promise<FileInfo[]> {
        return new Promise((resolve) => {
            const panel = vscode.window.createWebviewPanel(
                'code2ai',
                'Code2AI - 选择文件',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getHtml(rootNode, defaultSelectedPath);

            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'select':
                            resolve(message.files);
                            panel.dispose();
                            break;
                        case 'cancel':
                            resolve([]);
                            panel.dispose();
                            break;
                    }
                },
                undefined,
                []
            );

            panel.onDidDispose(() => resolve([]));
        });
    }

    private getHtml(rootNode: TreeNode, defaultSelectedPath?: string): string {
        const fileData = this.collectFileData(rootNode);
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code2AI - 文件选择</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            margin-bottom: 20px;
        }
        
        .header h2 {
            margin: 0 0 10px 0;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .header p {
            margin: 0;
            color: var(--vscode-descriptionForeground);
        }
        
        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-size: 13px;
            border-radius: 2px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button:active {
            transform: translateY(1px);
        }
        
        .file-tree {
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
            padding: 10px;
            max-height: 400px;
            overflow-y: auto;
            border-radius: 4px;
        }
        
        .tree-item {
            padding: 5px 0;
            user-select: none;
        }
        
        .tree-item label {
            display: flex;
            align-items: center;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 16px; 
        }
        
        .tree-item label:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .tree-item input[type="checkbox"] {
            margin-right: 10px;
            cursor: pointer;
        }
        
        .tree-icon {
            margin-right: 8px;
        }
        
        .tree-children {
            margin-left: 20px;
        }
        
        .stats {
            margin: 20px 0;
            padding: 15px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .stat-item {
            display: flex;
            flex-direction: column;
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        
        .stat-value {
            font-size: 18px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        .generate-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
        }
        
        .cancel-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 12px 24px;
            font-size: 14px;
        }
        
        .warning {
            background: var(--vscode-editorWarning-background);
            color: var(--vscode-editorWarning-foreground);
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Code2AI - 选择要导出的文件</h2>
            <p>选择您想要包含在 Markdown 导出中的文件。大文件将自动分割以适应 Token 限制。</p>
        </div>

        <div class="toolbar">
            <button onclick="selectAll()">全选</button>
            <button onclick="selectNone()">清空选择</button>
            <button onclick="selectCode()">仅代码文件</button>
            <button onclick="expandAll()">展开全部</button>
            <button onclick="collapseAll()">折叠全部</button>
        </div>

        <div class="file-tree" id="fileTree">
            ${this.renderTree(rootNode)}
        </div>

        <div class="stats">
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">已选择文件</span>
                    <span class="stat-value" id="fileCount">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">总大小</span>
                    <span class="stat-value" id="totalSize">0 B</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">预估 Token</span>
                    <span class="stat-value" id="totalTokens">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">预计生成文件数</span>
                    <span class="stat-value" id="chunkCount">0</span>
                </div>
            </div>
        </div>

        <div class="warning" id="warning">
            <strong>注意：</strong><span id="warningText"></span>
        </div>

        <div class="actions">
            <button class="generate-btn" onclick="generate()">生成 Markdown</button>
            <button class="cancel-btn" onclick="cancel()">取消</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const fileData = ${JSON.stringify(fileData)};
        const defaultSelectedPath = ${defaultSelectedPath ? JSON.stringify(defaultSelectedPath) : 'null'};
        
        function updateStats() {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
            let count = 0, size = 0, tokens = 0;
            
            checkboxes.forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file') {
                    count++;
                    size += data.size;
                    tokens += data.tokens;
                }
            });
            
            document.getElementById('fileCount').textContent = count.toString();
            document.getElementById('totalSize').textContent = formatBytes(size);
            document.getElementById('totalTokens').textContent = formatTokens(tokens);
            
            const maxTokensPerChunk = 100000;
            const estimatedChunks = Math.max(1, Math.ceil(tokens / maxTokensPerChunk));
            document.getElementById('chunkCount').textContent = estimatedChunks.toString();
            
            const warning = document.getElementById('warning');
            const warningText = document.getElementById('warningText');
            
            if (tokens > maxTokensPerChunk * 10) {
                warning.style.display = 'block';
                warningText.textContent = '选择的文件非常大，将生成多个输出文件。';
            } else if (count === 0) {
                warning.style.display = 'block';
                warningText.textContent = '请至少选择一个文件。';
            } else {
                warning.style.display = 'none';
            }
        }

        function formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        }

        function formatTokens(tokens) {
            if (tokens < 1000) return tokens.toString();
            if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
            return (tokens / 1000000).toFixed(2) + 'M';
        }

        function selectAll() {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file') {
                    cb.checked = true;
                }
            });
            updateStats();
        }

        function selectNone() {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            updateStats();
        }

        function selectCode() {
            const codeExts = ['.ts', '.js', '.jsx', '.tsx', '.py', '.java', '.cpp', '.go', '.rs', '.cs', '.php', '.rb'];
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file') {
                    cb.checked = codeExts.some(ext => data.name.endsWith(ext));
                } else {
                    cb.checked = false;
                }
            });
            updateStats();
        }

        function toggleNode(button) {
            const treeNode = button.closest('.tree-node');
            const children = treeNode.querySelector('.tree-children');
            
            if (children) {
                const isExpanded = children.style.display !== 'none';
                children.style.display = isExpanded ? 'none' : 'block';
                button.textContent = isExpanded ? '▶' : '▼';
            }
        }

        function expandAll() {
            document.querySelectorAll('.tree-children').forEach(children => {
                children.style.display = 'block';
            });
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.textContent = '▼';
            });
        }

        function collapseAll() {
            document.querySelectorAll('.tree-children').forEach(children => {
                children.style.display = 'none';
            });
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.textContent = '▶';
            });
        }

        function generate() {
            const selected = [];
            document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file') {
                    selected.push({
                        name: data.name,
                        path: data.path,
                        relativePath: data.relativePath,
                        size: data.size,
                        extension: data.extension
                    });
                }
            });
            
            if (selected.length === 0) {
                vscode.postMessage({ command: 'error', message: '请至少选择一个文件' });
                return;
            }
            
            vscode.postMessage({ command: 'select', files: selected });
        }

        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (defaultSelectedPath) {
                const selectorValue = defaultSelectedPath.replace(/\\\\/g, '\\\\\\\\');
                const checkbox = document.querySelector(\`input[type="checkbox"][value="\${selectorValue}"]\`);
                
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
            
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', updateStats);
            });
            
            updateStats();
        });
    </script>
</body>
</html>`;
    }

    private renderTree(node: TreeNode, level: number = 0): string {
        if (node.type === 'file') {
            return this.renderFileNode(node as FileNode, level);
        } else {
            return this.renderDirectoryNode(node, level);
        }
    }

    private renderFileNode(node: FileNode, level: number): string {
        const padding = level * 20;
        return `
            <div class="tree-item" style="padding-left: ${padding}px">
                <label>
                    <input type="checkbox" value="${node.path}" />
                    <span class="tree-icon">📄</span>
                    <span>${node.name}</span>
                </label>
            </div>
        `;
    }

    private renderDirectoryNode(node: TreeNode, level: number): string {
        const padding = level * 20;
        const hasChildren = 'children' in node && node.children.length > 0;
        
        let html = `
            <div class="tree-node">
                <div class="tree-item" style="padding-left: ${padding}px">
                    <label>
        `;
        
        if (hasChildren) {
            html += `<button class="toggle-btn" onclick="toggleNode(this)" style="margin-right: 4px;">▼</button>`;
        } else {
            html += `<span style="margin-right: 20px;"></span>`;
        }
        
        html += `
                        <span class="tree-icon">📁</span>
                        <span>${node.name}</span>
                    </label>
                </div>
        `;
        
        if (hasChildren && 'children' in node) {
            html += '<div class="tree-children">';
            node.children.forEach(child => {
                html += this.renderTree(child, level + 1);
            });
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    private collectFileData(node: TreeNode): Record<string, any> {
        const data: Record<string, any> = {};
        
        const collect = (n: TreeNode) => {
            data[n.path] = {
                name: n.name,
                path: n.path,
                relativePath: n.relativePath,
                type: n.type,
                size: n.type === 'file' ? (n as FileNode).size : 0,
                extension: n.type === 'file' ? (n as FileNode).extension : '',
                tokens: n.type === 'file' ? this.estimateFileTokens(n as FileNode) : 0
            };
            
            if ('children' in n) {
                n.children.forEach(collect);
            }
        };
        
        collect(node);
        return data;
    }

    private estimateFileTokens(node: FileNode): number {
        return Math.ceil(node.size * 0.25);
    }
}