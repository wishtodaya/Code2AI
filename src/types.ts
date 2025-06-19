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