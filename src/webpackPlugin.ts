// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sharp } = require('sharp');
import * as path from 'path';
import { Compilation, Compiler, sources } from 'webpack';

export default class AVIFWebpackPlugin {
  private options: {
    test: RegExp;
    quality: number;
    effort: number;
    [key: string]: any;
  };

  constructor(
    options: Partial<typeof AVIFWebpackPlugin.prototype.options> = {},
  ) {
    this.options = {
      test: /\.(png|jpe?g|gif|webp)$/i,
      quality: 50,
      effort: 4,
      ...options,
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('AVIFWebpackPlugin', compilation => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'AVIFWebpackPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async (assets, callback) => {
          try {
            const promises = [];

            for (const [fileName, asset] of Object.entries(assets)) {
              if (this.options.test.test(fileName)) {
                promises.push(this.processImage(compilation, fileName, asset));
              }
            }

            await Promise.all(promises);
            callback();
          } catch (error) {
            callback(error);
          }
        },
      );
    });
  }

  async processImage(compilation: Compilation, fileName: string, asset: any) {
    const newFileName = path.join(
      this.options.imagePath || '',
      `${path.parse(fileName).name}.avif`,
    );

    const chunks = Array.from(compilation.chunks).filter(chunk =>
      chunk.files.has(fileName),
    );

    try {
      const buffer = await sharp(asset.buffer())
        .avif({
          quality: this.options.quality,
          effort: this.options.effort,
        })
        .toBuffer();

      // 删除原始文件的引用
      compilation.chunks.forEach(chunk => {
        if (chunk.files.has(fileName)) {
          chunk.files.delete(fileName);
        }
      });

      // 从入口点中也删除引用
      compilation.entrypoints.forEach(entry => {
        entry.chunks.forEach(chunk => {
          chunk.files.delete(fileName);
        });
      });

      // 最后删除资产
      compilation.deleteAsset(fileName);

      // 添加新的 AVIF 资源
      compilation.emitAsset(newFileName, new sources.RawSource(buffer), {
        source: buffer,
        size: buffer.length,
        chunks,
      });

      // 如果没有找到原始的 chunks，将新文件添加到所有入口点
      if (chunks.length === 0) {
        Array.from(compilation.entrypoints.values()).forEach(entry => {
          entry.chunks.forEach(chunk => chunk.files.add(newFileName));
        });
      }

      // 更新文件引用
      await this.updateReferences(compilation, fileName, newFileName);

      console.log(
        `[AVIFWebpackPlugin]: Converted ${fileName} to ${newFileName}`,
      );
    } catch (error) {
      console.error(
        `[AVIFWebpackPlugin]: Error processing ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  updateReferences(compilation, oldFileName, newFileName) {
    const assets = compilation.getAssets();
    for (const { name, source } of assets) {
      if (name.endsWith('.css') || name.endsWith('.js')) {
        let content = source.source().toString();
        const regex = new RegExp(this.escapeRegExp(oldFileName), 'g');
        if (content.match(regex)) {
          const newPath = this.options.publicPath
            ? path.posix.join(this.options.publicPath, newFileName)
            : path.posix.join(newFileName);
          content = content.replace(regex, newPath);
          compilation.updateAsset(name, new sources.RawSource(content));
          console.log(
            `[AVIFWebpackPlugin]: Updated reference in ${name}: ${oldFileName} -> ${newPath}`,
          );
        }
      }
    }
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
