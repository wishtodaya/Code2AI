# Code2AI

`Code2AI` 是一款为开发者提供的 VS Code 插件，能够将项目代码导出为 Markdown 格式，以便快速生成文档，方便与 AI 模型（如 GPT、Claude）共享代码。插件帮助开发者将源代码转化为结构化文本，提升文档生成效率，支持多个编程语言和文件格式。

## 特性

- **自动生成 Markdown 文件**：将选定的代码文件导出为 Markdown 格式，包括代码文件内容和项目文件树结构。
- **支持自定义配置**：通过 VS Code 设置界面，用户可以灵活配置导出选项，如最大 token 数量、是否使用 `.gitignore` 规则、文件排除模式等。
- **文件分割**：针对大文件，插件会自动根据最大 token 数量进行智能分割，确保与 AI 模型兼容。
- **高效的文件扫描与处理**：支持快速扫描项目文件，并根据需要进行分割或合并处理。

## 配置

插件提供了多个配置项，用户可以通过以下方式进行配置：

### 通过设置界面进行配置

1. 打开 VS Code
2. 在搜索栏中搜索命令 `> Code2AI:打开设置`。
3. 修改配置项，如最大 token 数量、是否使用 `.gitignore`、输出目录路径等。


### 配置项说明

| 配置项                             | 说明                                                            |
| ---------------------------------- | --------------------------------------------------------------- |
| **`code2ai.maxTokensPerChunk`**    | 每个输出文件的最大 token 数量。可以调整为适应不同 AI 模型，如 GPT-3.5 或 GPT-4。 |
| **`code2ai.useGitignore`**         | 是否使用 `.gitignore` 文件来排除不需要导出的文件。                    |
| **`code2ai.preserveFileIntegrity`** | 是否保持文件完整性，防止在文件中间进行分割。                         |
| **`code2ai.outputDirectory`**      | 设置输出目录，可以使用 `${workspaceFolder}`（工作区根目录）或 `${sourceDir}`（源文件目录）。 |
| **`code2ai.includePatterns`**      | 指定需要包含的文件模式。                                            |
| **`code2ai.excludePatterns`**      | 指定需要排除的文件模式。                                            |
| **`code2ai.showFileTree`**         | 是否在输出的 Markdown 文件中展示文件树结构。                        |
| **`code2ai.autoOpenOutput`**       | 生成文件后是否自动打开输出的 Markdown 文件。                        |

## 插件使用方法

1. 打开项目文件夹。
2. 右键点击文件夹或单个文件，选择 **"Code2AI: 导出Markdown"**。
3. 在弹出的文件选择界面中选择要导出的文件。
4. 插件会生成一个或多个 Markdown 文件，存储在您指定的目录中。

生成完成后，您可以选择打开这些 Markdown 文件，或者将它们发送给 AI 模型进行分析或进一步处理。

## 开发者

* **插件名称**: `Code2AI`
* **版本**: `0.0.1`
* **贡献者**: \[wishtodaya]
* **GitHub 仓库**: [https://github.com/wishtodaya/Code2AI.git](https://github.com/wishtodaya/Code2AI.git)

## License

[MIT License](LICENSE)