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
        // JavaScript/TypeScript 生态
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
        '.d.ts', '.vue', '.svelte', '.astro',
        
        // 配置文件
        '.json', '.jsonc', '.json5',
        '.yaml', '.yml',
        '.toml', '.ini', '.cfg', '.conf',
        '.env', '.env.local', '.env.development', '.env.production',
        
        // 编程语言
        '.py', '.pyw', '.pyi',                    // Python
        '.java', '.kt', '.kts', '.scala', '.groovy', // JVM
        '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx', // C/C++
        '.cs', '.fs', '.vb',                      // .NET
        '.go', '.rs',                             // Go/Rust
        '.php', '.rb', '.rake',                   // PHP/Ruby
        '.swift', '.m', '.mm',                    // Apple
        '.r', '.R', '.rmd',                       // R
        '.dart', '.lua', '.pl', '.pm',            // 其他
        
        // Shell/脚本
        '.sh', '.bash', '.zsh', '.fish',
        '.ps1', '.psm1', '.psd1',
        '.bat', '.cmd',
        
        // 标记语言
        '.md', '.mdx', '.markdown',
        '.rst', '.adoc', '.tex',
        
        // Web 技术
        '.html', '.htm', '.xhtml', '.ejs', '.hbs', '.pug',
        '.css', '.scss', '.sass', '.less', '.styl',
        '.xml', '.xsl', '.xsd',
        
        // 数据文件
        '.sql', '.graphql', '.gql', '.prisma',
        '.proto', '.thrift',
        
        // 文档
        '.txt', '.text', '.log',
        '.csv', '.tsv',
        
        // 构建配置
        '.dockerfile', '.dockerignore',
        '.gitignore', '.gitattributes',
        '.npmignore', '.npmrc',
        '.editorconfig', '.eslintrc', '.prettierrc',
        '.babelrc', '.webpack.config.js',
        
        // 特殊文件
        'Makefile', 'Dockerfile', 'README', 'LICENSE',
        'Gemfile', 'Rakefile', 'Procfile'
    ]);

    static readonly CODE_EXTENSIONS = new Set([
        // 编译型语言
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
        '.java', '.kt', '.scala',
        '.c', '.cpp', '.cc', '.h', '.hpp',
        '.cs', '.fs', '.vb',
        '.go', '.rs',
        '.swift', '.m', '.mm',
        
        // 脚本语言
        '.py', '.rb', '.php',
        '.lua', '.pl', '.r',
        
        // 前端框架
        '.vue', '.svelte', '.astro',
        
        // 其他
        '.dart', '.groovy', '.clj', '.ex', '.elm'
    ]);

    static isTextFile(filePath: string): boolean {
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase();
        
        // 检查扩展名
        if (this.TEXT_EXTENSIONS.has(ext)) {
            return true;
        }
        
        // 检查特殊文件名（无扩展名）
        const specialFiles = [
            'dockerfile', 'makefile', 'readme', 'license',
            'changelog', 'authors', 'contributors',
            'gemfile', 'rakefile', 'procfile', 'podfile',
            'gradlew', 'jenkinsfile', 'vagrantfile'
        ];
        
        if (specialFiles.includes(fileName.toLowerCase())) {
            return true;
        }
        
        // 检查复合扩展名（如 .d.ts, .config.js）
        const complexExtensions = [
            '.d.ts', '.d.tsx',
            '.config.js', '.config.ts',
            '.test.js', '.test.ts', '.spec.js', '.spec.ts',
            '.stories.js', '.stories.ts', '.stories.tsx'
        ];
        
        return complexExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    static isCodeFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.CODE_EXTENSIONS.has(ext);
    }

    static getLanguage(extension: string): string {
        const languageMap: Record<string, string> = {
            // JavaScript/TypeScript
            '.ts': 'typescript', '.tsx': 'typescript',
            '.js': 'javascript', '.jsx': 'javascript',
            '.mjs': 'javascript', '.cjs': 'javascript',
            
            // 配置文件
            '.json': 'json', '.jsonc': 'jsonc', '.json5': 'json5',
            '.yaml': 'yaml', '.yml': 'yaml',
            '.toml': 'toml',
            '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
            '.env': 'dotenv',
            
            // 编程语言
            '.py': 'python', '.pyw': 'python', '.pyi': 'python',
            '.java': 'java',
            '.kt': 'kotlin', '.kts': 'kotlin',
            '.scala': 'scala',
            '.groovy': 'groovy',
            '.c': 'c', '.h': 'c',
            '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
            '.hpp': 'cpp', '.hxx': 'cpp',
            '.cs': 'csharp',
            '.fs': 'fsharp',
            '.vb': 'vb',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.m': 'objc', '.mm': 'objc',
            '.r': 'r', '.R': 'r',
            '.dart': 'dart',
            '.lua': 'lua',
            '.pl': 'perl', '.pm': 'perl',
            
            // Shell
            '.sh': 'bash', '.bash': 'bash',
            '.zsh': 'zsh', '.fish': 'fish',
            '.ps1': 'powershell', '.psm1': 'powershell',
            '.bat': 'batch', '.cmd': 'batch',
            
            // 标记语言
            '.md': 'markdown', '.mdx': 'markdown',
            '.rst': 'restructuredtext',
            '.tex': 'latex',
            
            // Web
            '.html': 'html', '.htm': 'html',
            '.xml': 'xml', '.xsl': 'xml', '.xsd': 'xml',
            '.css': 'css',
            '.scss': 'scss', '.sass': 'sass',
            '.less': 'less', '.styl': 'stylus',
            '.vue': 'vue',
            '.svelte': 'svelte',
            '.astro': 'astro',
            
            // 数据/查询
            '.sql': 'sql',
            '.graphql': 'graphql', '.gql': 'graphql',
            '.prisma': 'prisma',
            '.proto': 'protobuf',
            
            // 其他
            '.dockerfile': 'dockerfile',
            '.gitignore': 'gitignore',
            '.makefile': 'makefile',
            '.csv': 'csv',
            '.log': 'log'
        };
        
        return languageMap[extension.toLowerCase()] || 'text';
    }

    static formatBytes(bytes: number): string {
        if (bytes < 1024) {return `${bytes} B`;}
        if (bytes < 1048576) {return `${(bytes / 1024).toFixed(1)} KB`;}
        if (bytes < 1073741824) {return `${(bytes / 1048576).toFixed(1)} MB`;}
        return `${(bytes / 1073741824).toFixed(2)} GB`;
    }

    static formatTokens(tokens: number): string {
        if (tokens < 1000) {return `${tokens}`;}
        if (tokens < 1000000) {return `${(tokens / 1000).toFixed(1)}K`;}
        if (tokens < 1000000000) {return `${(tokens / 1000000).toFixed(2)}M`;}
        return `${(tokens / 1000000000).toFixed(2)}B`;
    }
}