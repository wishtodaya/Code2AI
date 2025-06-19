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
            // 验证输入
            if (!uri) {
                const folders = vscode.workspace.workspaceFolders;
                if (!folders || folders.length === 0) {
                    vscode.window.showErrorMessage('请先打开一个文件夹或选择文件');
                    return;
                }
                uri = folders[0].uri;
            }

            // 显示进度
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Code2AI",
                cancellable: true
            }, async (progress, token) => {
                // 步骤 1: 读取配置
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

                // 步骤 2: 扫描文件
                progress.report({ increment: 20, message: "扫描文件..." });
                const scanner = new Scanner(uri.fsPath, scanOptions);
                const rootNode = await scanner.scan();
                
                if (token.isCancellationRequested) {
                    return;
                }

                // 步骤 3: 显示文件选择界面
                progress.report({ increment: 30, message: "等待文件选择..." });
                const webview = new WebviewManager(context.extensionUri);
                const selectedFiles = await webview.show(rootNode);
                
                if (!selectedFiles || selectedFiles.length === 0) {
                    vscode.window.showInformationMessage('未选择任何文件');
                    return;
                }

                // 步骤 4: 处理文件
                progress.report({ increment: 20, message: "处理文件..." });
                const processor = new Processor(processOptions);
                const chunks = await processor.process(selectedFiles);
                
                if (token.isCancellationRequested) {
                    return;
                }

                // 步骤 5: 生成输出
                progress.report({ increment: 20, message: "生成 Markdown..." });
                const generator = new Generator();
                const outputs = generator.generate(chunks);

                // 步骤 6: 保存文件
                progress.report({ increment: 10, message: "保存文件..." });
                const outputDir = config.get<string>('outputDirectory') || uri.fsPath;
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

                // 显示成功消息并提供打开文件的选项
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
    
    // 注册配置命令
    const configCommand = vscode.commands.registerCommand('code2ai.configure', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'code2ai');
    });
    
    context.subscriptions.push(configCommand);
}

export function deactivate() {
    // 清理资源
}