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