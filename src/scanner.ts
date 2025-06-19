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
