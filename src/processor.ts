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
