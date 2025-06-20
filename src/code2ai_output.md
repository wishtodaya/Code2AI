# 项目导出

**文件数量**: 7  
**总大小**: 47.7 KB  
**Token 数量**: 13.1K  
**生成时间**: 6/20/2025, 8:41:22 AM

## 文件结构

```
📁 .
  📄 extension.ts
  📄 generator.ts
  📄 processor.ts
  📄 scanner.ts
  📄 types.ts
  📄 utils.ts
  📄 webview.ts
```

## 源文件

### extension.ts

*大小: 5.3 KB | Token: 1.5K*

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { Scanner } from './scanner';
import { Processor } from './processor';
import { Generator } from './generator';
import { WebviewManager } from './webview';
import { ScanOptions, ProcessOptions } from './types';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('code2ai.parse', async (uri: vscode.Uri) => {
        try {
            if (!uri) {
                const folders = vscode.workspace.workspaceFolders;
                if (!folders || folders.length === 0) {
                    vscode.window.showErrorMessage('请先打开一个文件夹或选择文件');
                    return;
                }
                uri = folders[0].uri;
            }

            const stats = await vscode.workspace.fs.stat(uri);
            const isFile = stats.type === vscode.FileType.File;
            
            const baseDirUri = isFile ? vscode.Uri.joinPath(uri, '..') : uri;
            const baseDirPath = baseDirUri.fsPath;
            const defaultSelectedPath = isFile ? uri.fsPath : undefined;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Code2AI",
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: "读取配置..." });
                const config = vscode.workspace.getConfiguration('code2ai');
                
                const scanOptions: ScanOptions = {
                    useGitignore: config.get<boolean>('useGitignore', true),
                    excludePatterns: config.get<string[]>('excludePatterns', []),
                    includePatterns: config.get<string[]>('includePatterns', [])
                };
                
                const processOptions: ProcessOptions = {
                    maxTokensPerChunk: config.get<number>('maxTokensPerChunk', 100000),
                    preserveFileIntegrity: config.get<boolean>('preserveFileIntegrity', true)
                };

                progress.report({ increment: 20, message: "扫描文件..." });
                const scanner = new Scanner(baseDirPath, scanOptions);
                const rootNode = await scanner.scan();
                
                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ increment: 30, message: "等待文件选择..." });
                const webview = new WebviewManager(context.extensionUri);
                const selectedFiles = await webview.show(rootNode, defaultSelectedPath);
                
                if (!selectedFiles || selectedFiles.length === 0) {
                    vscode.window.showInformationMessage('未选择任何文件');
                    return;
                }

                progress.report({ increment: 20, message: "处理文件..." });
                const processor = new Processor(processOptions);
                const chunks = await processor.process(selectedFiles);
                
                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ increment: 20, message: "生成 Markdown..." });
                const generator = new Generator();
                const outputs = generator.generate(chunks);

                progress.report({ increment: 10, message: "保存文件..." });
                const outputDir = config.get<string>('outputDirectory') || baseDirPath;
                const savedFiles: string[] = [];
                
                for (let i = 0; i < outputs.length; i++) {
                    const filename = outputs.length > 1 
                        ? `code2ai_output_${i + 1}_of_${outputs.length}.md`
                        : 'code2ai_output.md';
                    
                    const outputPath = vscode.Uri.joinPath(
                        vscode.Uri.file(outputDir), 
                        filename
                    );
                    
                    await vscode.workspace.fs.writeFile(
                        outputPath, 
                        Buffer.from(outputs[i], 'utf-8')
                    );
                    
                    savedFiles.push(outputPath.fsPath);
                }

                const openAction = '打开文件';
                const result = await vscode.window.showInformationMessage(
                    `成功生成 ${outputs.length} 个文件！`,
                    openAction
                );
                
                if (result === openAction && savedFiles.length > 0) {
                    const doc = await vscode.workspace.openTextDocument(savedFiles[0]);
                    await vscode.window.showTextDocument(doc);
                }
            });

        } catch (error) {
            console.error('Code2AI Error:', error);
            vscode.window.showErrorMessage(
                `Code2AI 错误: ${error instanceof Error ? error.message : '未知错误'}`
            );
        }
    });

    context.subscriptions.push(disposable);
    
    const configCommand = vscode.commands.registerCommand('code2ai.configure', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'code2ai');
    });
    
    context.subscriptions.push(configCommand);
}

export function deactivate() {}
```

### generator.ts

*大小: 5.2 KB | Token: 1.4K*

```typescript
import * as path from 'path';
import { Chunk, FileContent } from './types';
import { FileUtils } from './utils';

export class Generator {
    generate(chunks: Chunk[]): string[] {
        if (chunks.length === 0) {
            return ['# 项目导出\n\n没有选择任何文件。'];
        }

        if (chunks.length === 1) {
            return [this.generateSingleChunk(chunks[0])];
        }

        return chunks.map(chunk => this.generateMultipleChunk(chunk));
    }

    private generateSingleChunk(chunk: Chunk): string {
        const output: string[] = [];
        
        // 标题和元信息
        output.push('# 项目导出\n');
        output.push(this.generateMetadata(chunk));
        
        // 文件树
        output.push('## 文件结构\n');
        output.push('```');
        output.push(this.generateFileTree(chunk.files));
        output.push('```\n');
        
        // 文件内容
        output.push('## 源文件\n');
        chunk.files.forEach(file => {
            output.push(this.generateFileSection(file));
        });

        return output.join('\n');
    }

    private generateMultipleChunk(chunk: Chunk): string {
        const output: string[] = [];
        
        // 标题和元信息
        output.push(`# 项目导出 - 第 ${chunk.index + 1} / ${chunk.total} 部分\n`);
        output.push(this.generateMetadata(chunk));
        
        // 文件列表
        output.push('## 本部分包含的文件\n');
        output.push('```');
        chunk.files.forEach(file => {
            output.push(`${file.relativePath} (${FileUtils.formatBytes(file.size)})`);
        });
        output.push('```\n');
        
        // 文件内容
        output.push('## 源文件\n');
        chunk.files.forEach(file => {
            output.push(this.generateFileSection(file));
        });

        return output.join('\n');
    }

    private generateMetadata(chunk: Chunk): string {
        const metadata: string[] = [];
        
        metadata.push(`**文件数量**: ${chunk.files.length}`);
        metadata.push(`**总大小**: ${FileUtils.formatBytes(chunk.totalSize)}`);
        metadata.push(`**Token 数量**: ${FileUtils.formatTokens(chunk.tokenCount)}`);
        metadata.push(`**生成时间**: ${new Date().toLocaleString()}`);
        
        return metadata.join('  \n') + '\n';
    }

    private generateFileTree(files: FileContent[]): string {
        // 构建目录结构
        const tree = new Map<string, Set<string>>();
        
        files.forEach(file => {
            const parts = file.relativePath.split(/[/\\]/);
            let currentPath = '';
            
            for (let i = 0; i < parts.length - 1; i++) {
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
                
                if (!tree.has(parentPath)) {
                    tree.set(parentPath, new Set());
                }
                tree.get(parentPath)!.add(currentPath);
            }
            
            // 添加文件到其父目录
            const parentPath = parts.slice(0, -1).join('/');
            if (!tree.has(parentPath)) {
                tree.set(parentPath, new Set());
            }
            tree.get(parentPath)!.add(file.relativePath);
        });

        // 生成树形输出
        const output: string[] = [];
        const visited = new Set<string>();
        
        const renderNode = (path: string, indent: number) => {
            if (visited.has(path)) return;
            visited.add(path);
            
            const name = path ? path.split('/').pop()! : '.';
            const isFile = files.some(f => f.relativePath === path);
            const prefix = '  '.repeat(indent);
            const icon = isFile ? '📄' : '📁';
            
            output.push(`${prefix}${icon} ${name}`);
            
            // 渲染子节点
            const children = tree.get(path) || new Set();
            const sortedChildren = Array.from(children).sort((a, b) => {
                const aIsFile = files.some(f => f.relativePath === a);
                const bIsFile = files.some(f => f.relativePath === b);
                if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
                return a.localeCompare(b);
            });
            
            sortedChildren.forEach(child => {
                renderNode(child, indent + 1);
            });
        };
        
        renderNode('', 0);
        return output.join('\n');
    }

    private generateFileSection(file: FileContent): string {
        const language = FileUtils.getLanguage(file.extension);
        const sections: string[] = [];
        
        // 文件标题
        sections.push(`### ${file.relativePath}\n`);
        
        // 文件信息
        sections.push(`*大小: ${FileUtils.formatBytes(file.size)} | Token: ${FileUtils.formatTokens(file.tokenCount)}*\n`);
        
        // 文件内容
        sections.push(`\`\`\`${language}`);
        sections.push(file.content.trim());
        sections.push('```\n');
        
        return sections.join('\n');
    }
}
```

### processor.ts

*大小: 5.5 KB | Token: 1.5K*

```typescript
import * as fs from 'fs/promises';
import { FileInfo, FileContent, Chunk, ProcessOptions } from './types';
import { TokenEstimator } from './utils';

export class Processor {
    private options: ProcessOptions;

    constructor(options: ProcessOptions) {
        this.options = options;
    }

    async process(fileInfos: FileInfo[]): Promise<Chunk[]> {
        // 读取文件内容并计算 token
        const fileContents = await this.loadFileContents(fileInfos);
        
        // 根据选项决定处理策略
        if (this.options.preserveFileIntegrity) {
            return this.chunkByWholeFiles(fileContents);
        } else {
            return this.chunkWithSplitting(fileContents);
        }
    }

    private async loadFileContents(fileInfos: FileInfo[]): Promise<FileContent[]> {
        const loadPromises = fileInfos.map(async (info) => {
            try {
                const content = await fs.readFile(info.path, 'utf-8');
                const tokenCount = TokenEstimator.estimate(content);
                
                return {
                    ...info,
                    content,
                    tokenCount
                };
            } catch (error) {
                console.error(`Error reading file ${info.path}:`, error);
                return null;
            }
        });

        const results = await Promise.all(loadPromises);
        return results.filter((f): f is FileContent => f !== null);
    }

    private chunkByWholeFiles(files: FileContent[]): Chunk[] {
        const chunks: Chunk[] = [];
        let currentChunk: FileContent[] = [];
        let currentTokens = 0;
        let currentSize = 0;

        for (const file of files) {
            // 如果单个文件超过限制，单独作为一个 chunk
            if (file.tokenCount > this.options.maxTokensPerChunk) {
                if (currentChunk.length > 0) {
                    chunks.push(this.createChunk(currentChunk, currentTokens, currentSize, chunks.length));
                    currentChunk = [];
                    currentTokens = 0;
                    currentSize = 0;
                }
                
                // 对大文件进行智能分割
                const splitChunks = this.splitLargeFile(file, chunks.length);
                chunks.push(...splitChunks);
                continue;
            }

            // 如果添加此文件会超过限制，创建新 chunk
            if (currentTokens + file.tokenCount > this.options.maxTokensPerChunk && currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk, currentTokens, currentSize, chunks.length));
                currentChunk = [];
                currentTokens = 0;
                currentSize = 0;
            }

            currentChunk.push(file);
            currentTokens += file.tokenCount;
            currentSize += file.size;
        }

        // 处理剩余文件
        if (currentChunk.length > 0) {
            chunks.push(this.createChunk(currentChunk, currentTokens, currentSize, chunks.length));
        }

        // 更新 total 字段
        const total = chunks.length;
        return chunks.map(chunk => ({ ...chunk, total }));
    }

    private chunkWithSplitting(files: FileContent[]): Chunk[] {
        // 这里可以实现更复杂的分割策略
        return this.chunkByWholeFiles(files);
    }

    private splitLargeFile(file: FileContent, startIndex: number): Chunk[] {
        const chunks: Chunk[] = [];
        const lines = file.content.split('\n');
        const targetChunkTokens = this.options.maxTokensPerChunk * 0.8; // 留 20% 余量
        
        let currentLines: string[] = [];
        let currentTokens = 0;
        let partNumber = 1;

        for (const line of lines) {
            const lineTokens = TokenEstimator.estimate(line + '\n');
            
            if (currentTokens + lineTokens > targetChunkTokens && currentLines.length > 0) {
                // 创建分片
                const content = currentLines.join('\n');
                const partFile: FileContent = {
                    ...file,
                    name: `${file.name} (part ${partNumber})`,
                    content,
                    tokenCount: currentTokens,
                    size: content.length
                };
                
                chunks.push(this.createChunk([partFile], currentTokens, content.length, startIndex + chunks.length));
                
                currentLines = [];
                currentTokens = 0;
                partNumber++;
            }
            
            currentLines.push(line);
            currentTokens += lineTokens;
        }

        // 处理剩余行
        if (currentLines.length > 0) {
            const content = currentLines.join('\n');
            const partFile: FileContent = {
                ...file,
                name: `${file.name} (part ${partNumber})`,
                content,
                tokenCount: currentTokens,
                size: content.length
            };
            
            chunks.push(this.createChunk([partFile], currentTokens, content.length, startIndex + chunks.length));
        }

        return chunks;
    }

    private createChunk(files: FileContent[], tokenCount: number, totalSize: number, index: number): Chunk {
        return {
            files,
            tokenCount,
            totalSize,
            index,
            total: 0
        };
    }
}
```

### scanner.ts

*大小: 6.2 KB | Token: 1.7K*

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';
import { TreeNode, DirectoryNode, FileNode, ScanOptions, FileInfo } from './types';
import { FileUtils } from './utils';

export class Scanner {
    private ig = ignore();
    private basePath: string;
    private options: ScanOptions;

    constructor(basePath: string, options: ScanOptions) {
        this.basePath = basePath;
        this.options = options;
    }

    async scan(): Promise<TreeNode> {
        await this.initializeIgnore();
        const result = await this.scanNode(this.basePath);
        if (!result) {
            throw new Error(`无法扫描路径: ${this.basePath}`);
        }
        return result;
    }

    async scanForFiles(): Promise<FileInfo[]> {
        await this.initializeIgnore();
        const files: FileInfo[] = [];
        await this.collectFiles(this.basePath, files);
        return files;
    }

    private async initializeIgnore(): Promise<void> {
        // 默认忽略规则
        const defaultIgnores = [
            'node_modules/**',
            '.git/**',
            'dist/**',
            'build/**',
            '*.log',
            '.DS_Store',
            '**/*.min.js',
            '**/*.min.css',
            'coverage/**',
            '.vscode/**',
            '.idea/**'
        ];

        this.ig.add(defaultIgnores);

        // 添加自定义排除规则
        if (this.options.excludePatterns) {
            this.ig.add(this.options.excludePatterns);
        }

        // 读取 .gitignore
        if (this.options.useGitignore) {
            try {
                const gitignorePath = path.join(this.basePath, '.gitignore');
                const content = await fs.readFile(gitignorePath, 'utf-8');
                this.ig.add(content);
            } catch (error) {
                // .gitignore 不存在是正常情况
            }
        }
    }

    private async scanNode(nodePath: string): Promise<TreeNode | null> {
        try {
            const stats = await fs.stat(nodePath);
            const name = path.basename(nodePath);
            const relativePath = path.relative(this.basePath, nodePath);

            // 检查是否应该忽略
            if (relativePath && this.shouldIgnore(relativePath)) {
                return null;
            }

            if (stats.isDirectory()) {
                const dirNode = await this.scanDirectory(nodePath, name, relativePath);
                return dirNode;
            } else {
                return this.scanFile(nodePath, name, relativePath, stats);
            }
        } catch (error) {
            console.error(`Error scanning ${nodePath}:`, error);
            return null;
        }
    }

    private async scanDirectory(dirPath: string, name: string, relativePath: string): Promise<DirectoryNode | null> {
        const children: TreeNode[] = [];
        
        try {
            const entries = await fs.readdir(dirPath);
            
            // 并行扫描子节点
            const scanPromises = entries.map(entry => 
                this.scanNode(path.join(dirPath, entry))
            );
            
            const results = await Promise.all(scanPromises);
            
            for (const result of results) {
                if (result) {
                    children.push(result);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return null;
        }

        // 排序：目录在前，然后按名称排序
        children.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return {
            name,
            path: dirPath,
            relativePath,
            type: 'directory',
            children
        };
    }

    private scanFile(filePath: string, name: string, relativePath: string, stats: any): FileNode {
        const extension = path.extname(name).toLowerCase();
        
        return {
            name,
            path: filePath,
            relativePath,
            type: 'file',
            size: stats.size,
            extension,
            isSelected: false
        };
    }

    private async collectFiles(dirPath: string, files: FileInfo[]): Promise<void> {
        try {
            const entries = await fs.readdir(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                const relativePath = path.relative(this.basePath, fullPath);
                
                if (this.shouldIgnore(relativePath)) {
                    continue;
                }
                
                const stats = await fs.stat(fullPath);
                
                if (stats.isDirectory()) {
                    await this.collectFiles(fullPath, files);
                } else if (stats.isFile() && FileUtils.isTextFile(fullPath)) {
                    files.push({
                        name: entry,
                        path: fullPath,
                        relativePath,
                        size: stats.size,
                        extension: path.extname(entry).toLowerCase()
                    });
                }
            }
        } catch (error) {
            console.error(`Error collecting files from ${dirPath}:`, error);
        }
    }

    private shouldIgnore(relativePath: string): boolean {
        // 检查是否匹配包含规则
        if (this.options.includePatterns && this.options.includePatterns.length > 0) {
            const included = this.options.includePatterns.some(pattern => 
                this.matchesPattern(relativePath, pattern)
            );
            if (!included) return true;
        }
        
        return this.ig.ignores(relativePath);
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // 简单的通配符匹配
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(filePath);
    }
}
```

### types.ts

*大小: 1.0 KB | Token: 291*

```typescript
// 统一的类型定义文件

export interface FileInfo {
    name: string;
    path: string;
    relativePath: string;
    size: number;
    extension: string;
}

export interface FileContent extends FileInfo {
    content: string;
    tokenCount: number;
}

export interface DirectoryNode {
    name: string;
    path: string;
    relativePath: string;
    type: 'directory';
    children: (DirectoryNode | FileNode)[];
}

export interface FileNode {
    name: string;
    path: string;
    relativePath: string;
    type: 'file';
    size: number;
    extension: string;
    isSelected?: boolean;
}

export type TreeNode = DirectoryNode | FileNode;

export interface Chunk {
    files: FileContent[];
    tokenCount: number;
    totalSize: number;
    index: number;
    total: number;
}

export interface ScanOptions {
    useGitignore: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
}

export interface ProcessOptions {
    maxTokensPerChunk: number;
    preserveFileIntegrity: boolean;
}
```

### utils.ts

*大小: 2.6 KB | Token: 731*

```typescript
// 工具函数

import * as path from 'path';

export class TokenEstimator {
    private static readonly CHARS_PER_TOKEN = 4;
    private static readonly CODE_MULTIPLIER = 1.1;

    static estimate(content: string): number {
        let tokens = content.length / this.CHARS_PER_TOKEN;
        
        // 检测是否为代码内容
        if (this.isCode(content)) {
            tokens *= this.CODE_MULTIPLIER;
        }
        
        return Math.ceil(tokens);
    }

    private static isCode(content: string): boolean {
        return /[{}()\[\];:]/.test(content);
    }
}

export class FileUtils {
    static readonly TEXT_EXTENSIONS = new Set([
        '.ts', '.js', '.jsx', '.tsx', '.json', '.md', '.txt',
        '.py', '.java', '.cpp', '.cs', '.go', '.rs', '.php',
        '.html', '.css', '.xml', '.yaml', '.yml', '.rb', '.swift',
        '.kt', '.scala', '.r', '.m', '.h', '.c', '.sh', '.ps1'
    ]);

    static readonly CODE_EXTENSIONS = new Set([
        '.ts', '.js', '.jsx', '.tsx', '.py', '.java', '.cpp',
        '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt',
        '.scala', '.c', '.h', '.m'
    ]);

    static isTextFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.TEXT_EXTENSIONS.has(ext);
    }

    static isCodeFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.CODE_EXTENSIONS.has(ext);
    }

    static getLanguage(extension: string): string {
        const languageMap: Record<string, string> = {
            '.ts': 'typescript', '.js': 'javascript', '.jsx': 'javascript', '.tsx': 'typescript',
            '.py': 'python', '.java': 'java', '.cpp': 'cpp', '.cs': 'csharp',
            '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby',
            '.html': 'html', '.css': 'css', '.json': 'json', '.xml': 'xml',
            '.yaml': 'yaml', '.yml': 'yaml', '.md': 'markdown',
            '.swift': 'swift', '.kt': 'kotlin', '.scala': 'scala',
            '.r': 'r', '.m': 'objc', '.h': 'objc', '.c': 'c', '.sh': 'bash'
        };
        return languageMap[extension] || 'text';
    }

    static formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    }

    static formatTokens(tokens: number): string {
        if (tokens < 1000) return `${tokens}`;
        if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
        return `${(tokens / 1000000).toFixed(2)}M`;
    }
}
```

### webview.ts

*大小: 21.7 KB | Token: 6.0K*

```typescript
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
        
        .dir-checkbox {
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Code2AI - 选择要导出的文件</h2>
            <p>选择您想要包含在 Markdown 导出中的文件。选中目录将自动包含其中的所有文件。</p>
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
        
        // 构建父子关系映射
        const parentChildMap = {};
        const childParentMap = {};
        
        Object.keys(fileData).forEach(path => {
            const item = fileData[path];
            if (item.children) {
                parentChildMap[path] = item.children;
                item.children.forEach(childPath => {
                    childParentMap[childPath] = path;
                });
            }
        });
        
        function getAllDescendantFiles(dirPath) {
            const files = [];
            const queue = [dirPath];
            
            while (queue.length > 0) {
                const current = queue.shift();
                const data = fileData[current];
                
                if (data.type === 'file') {
                    files.push(current);
                } else if (parentChildMap[current]) {
                    queue.push(...parentChildMap[current]);
                }
            }
            
            return files;
        }
        
        function updateParentState(childPath) {
            let current = childParentMap[childPath];
            
            while (current) {
                const checkbox = document.querySelector(\`input[value="\${CSS.escape(current)}"]\`);
                if (checkbox) {
                    const children = parentChildMap[current] || [];
                    const childCheckboxes = children.map(child => 
                        document.querySelector(\`input[value="\${CSS.escape(child)}"]\`)
                    ).filter(cb => cb !== null);
                    
                    const checkedCount = childCheckboxes.filter(cb => cb.checked).length;
                    
                    if (checkedCount === 0) {
                        checkbox.checked = false;
                        checkbox.indeterminate = false;
                    } else if (checkedCount === childCheckboxes.length) {
                        checkbox.checked = true;
                        checkbox.indeterminate = false;
                    } else {
                        checkbox.checked = false;
                        checkbox.indeterminate = true;
                    }
                }
                
                current = childParentMap[current];
            }
        }
        
        function onCheckboxChange(checkbox) {
            const path = checkbox.value;
            const data = fileData[path];
            
            if (data.type === 'directory') {
                // 如果是目录，更新所有子项
                const descendants = getAllDescendantFiles(path);
                descendants.forEach(filePath => {
                    const fileCheckbox = document.querySelector(\`input[value="\${CSS.escape(filePath)}"]\`);
                    if (fileCheckbox) {
                        fileCheckbox.checked = checkbox.checked;
                    }
                });
                
                // 更新所有子目录的状态
                const allDescendants = parentChildMap[path] || [];
                const queue = [...allDescendants];
                while (queue.length > 0) {
                    const current = queue.shift();
                    const cb = document.querySelector(\`input[value="\${CSS.escape(current)}"]\`);
                    if (cb && fileData[current].type === 'directory') {
                        cb.checked = checkbox.checked;
                        cb.indeterminate = false;
                        if (parentChildMap[current]) {
                            queue.push(...parentChildMap[current]);
                        }
                    }
                }
            }
            
            // 更新父级状态
            updateParentState(path);
            updateStats();
        }
        
        function updateStats() {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            let count = 0, size = 0, tokens = 0;
            const selectedFiles = new Set();
            
            checkboxes.forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file' && cb.checked) {
                    selectedFiles.add(cb.value);
                }
            });
            
            selectedFiles.forEach(path => {
                const data = fileData[path];
                count++;
                size += data.size;
                tokens += data.tokens;
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
                cb.checked = true;
                cb.indeterminate = false;
            });
            updateStats();
        }

        function selectNone() {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
                cb.indeterminate = false;
            });
            updateStats();
        }

        function selectCode() {
            const codeExts = ['.ts', '.js', '.jsx', '.tsx', '.py', '.java', '.cpp', '.go', '.rs', '.cs', '.php', '.rb'];
            
            // 先清空所有选择
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
                cb.indeterminate = false;
            });
            
            // 选中代码文件
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file') {
                    if (codeExts.some(ext => data.name.endsWith(ext))) {
                        cb.checked = true;
                        updateParentState(cb.value);
                    }
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
            const selected = new Set();
            
            // 只收集被选中的文件（不包括目录）
            document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                const data = fileData[cb.value];
                if (data && data.type === 'file') {
                    selected.add(cb.value);
                }
            });
            
            const selectedArray = Array.from(selected).map(path => {
                const data = fileData[path];
                return {
                    name: data.name,
                    path: data.path,
                    relativePath: data.relativePath,
                    size: data.size,
                    extension: data.extension
                };
            });
            
            if (selectedArray.length === 0) {
                vscode.postMessage({ command: 'error', message: '请至少选择一个文件' });
                return;
            }
            
            vscode.postMessage({ command: 'select', files: selectedArray });
        }

        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }

        document.addEventListener('DOMContentLoaded', () => {
            // 设置所有checkbox的事件监听
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', function() {
                    onCheckboxChange(this);
                });
            });
            
            // 处理默认选中
            if (defaultSelectedPath) {
                const checkbox = document.querySelector(\`input[value="\${CSS.escape(defaultSelectedPath)}"]\`);
                if (checkbox) {
                    checkbox.checked = true;
                    onCheckboxChange(checkbox);
                }
            }
            
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
                        <input type="checkbox" value="${node.path}" class="dir-checkbox" />
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
        
        const collect = (n: TreeNode, parentPath?: string) => {
            const nodeData = {
                name: n.name,
                path: n.path,
                relativePath: n.relativePath,
                type: n.type,
                size: n.type === 'file' ? (n as FileNode).size : 0,
                extension: n.type === 'file' ? (n as FileNode).extension : '',
                tokens: n.type === 'file' ? this.estimateFileTokens(n as FileNode) : 0,
                children: [] as string[]
            };
            
            data[n.path] = nodeData;
            
            if ('children' in n) {
                nodeData.children = n.children.map(child => child.path);
                n.children.forEach(child => collect(child, n.path));
            }
        };
        
        collect(node);
        return data;
    }

    private estimateFileTokens(node: FileNode): number {
        return Math.ceil(node.size * 0.25);
    }
}
```
