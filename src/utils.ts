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