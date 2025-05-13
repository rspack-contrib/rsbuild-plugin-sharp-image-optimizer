import sharp from 'sharp';
import path from 'path';
import { Compilation, Compiler, sources } from '@rspack/core';

export default class SharpImageOptimizerPlugin {
  private options: {
    test: RegExp;
    quality: number;
    effort: number;
    format?: 'avif' | 'jpeg' | 'png' | 'webp' | 'jpg';
    [key: string]: any;
  };

  constructor(
    options: Partial<typeof SharpImageOptimizerPlugin.prototype.options> = {},
  ) {
    this.options = {
      test: /\.(png|jpe?g|webp|jpg)$/i,
      quality: 50,
      effort: 4,
      format: 'avif',
      ...options,
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('SharpImageOptimizerPlugin', compilation => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'SharpImageOptimizerPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async (assets, callback) => {
          try {
            const promises = [];
            const originalAssets = new Set<string>();

            for (const [fileName, asset] of Object.entries(assets)) {
              if (this.options.test.test(fileName)) {
                const originalExt = path
                  .parse(fileName)
                  .ext.toLowerCase()
                  .replace('.', '');

                if (
                  this.options.format !== originalExt &&
                  !(this.options.format === 'jpeg' && originalExt === 'jpg') &&
                  !(this.options.format === 'jpg' && originalExt === 'jpeg')
                ) {
                  originalAssets.add(fileName);
                }
                promises.push(this.processImage(compilation, fileName, asset));
              }
            }

            await Promise.all(promises);

            originalAssets.forEach(fileName => {
              compilation.deleteAsset(fileName);
            });

            callback();
          } catch (error) {
            callback(error as Error);
          }
        },
      );
    });
  }

  async processImage(compilation: Compilation, fileName: string, asset: any) {
    try {
      const { test, format, imagePath, publicPath, ...sharpOptions } =
        this.options;
      const originalExt = path
        .parse(fileName)
        .ext.toLowerCase()
        .replace('.', '');

      const needsFormatConversion =
        format !== originalExt &&
        !(format === 'jpeg' && originalExt === 'jpg') &&
        !(format === 'jpg' && originalExt === 'jpeg');

      const newFileName = needsFormatConversion
        ? path.join(
            imagePath || '',
            `${path.parse(fileName).name}.${format || 'avif'}`,
          )
        : fileName;

      // 获取资源内容
      const content = asset.source();
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

      let outputBuffer;
      switch (format) {
        case 'jpeg':
          outputBuffer = await sharp(buffer).jpeg(sharpOptions).toBuffer();
          break;
        case 'png':
          outputBuffer = await sharp(buffer).png(sharpOptions).toBuffer();
          break;
        case 'webp':
          outputBuffer = await sharp(buffer).webp(sharpOptions).toBuffer();
          break;
        case 'avif':
        default:
          outputBuffer = await sharp(buffer).avif(sharpOptions).toBuffer();
          break;
      }

      if (!needsFormatConversion) {
        compilation.updateAsset(fileName, new sources.RawSource(outputBuffer));
      } else {
        const originalInfo = compilation.getAsset(fileName);
        if (!originalInfo) {
          return;
        }

        compilation.emitAsset(
          newFileName,
          new sources.RawSource(outputBuffer),
          {
            ...originalInfo.info,
            sourceFilename: fileName,
          },
        );
      }

      // Rspack 处理 chunk 和文件关联的方式与 webpack 不同
      // 这里使用 rspack 的 API 来处理文件关联
      this.updateChunkRelations(compilation, fileName, newFileName);
    } catch (error) {
      console.error(
        `[SharpImageOptimizerPlugin]: Error processing ${fileName}:`,
        error,
      );
      throw error;
    }
  }

  updateChunkRelations(
    compilation: Compilation,
    oldFileName: string,
    newFileName: string,
  ) {
    // 检查 compilation 和 chunks 是否存在
    if (!compilation?.chunks) {
      return;
    }

    // 遍历所有的 chunks
    Array.from(compilation.chunks).forEach(chunk => {
      // 检查文件是否在当前 chunk 中
      if (chunk.files?.has(oldFileName)) {
        // 创建一个新的 Set，包含所有现有文件和新文件
        const newFiles = new Set([...Array.from(chunk.files), newFileName]);
        // 使用类型断言来更新 files
        (chunk as any).files = newFiles;
      }
    });
  }

  updateReferences(
    compilation: Compilation,
    oldFileName: string,
    newFileName: string,
  ) {
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
        }
      }
    }
  }

  escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
