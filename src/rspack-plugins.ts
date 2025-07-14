import sharp from 'sharp';
import path from 'path';
import { Compilation, Compiler } from '@rspack/core';

export default class SharpImageOptimizerPlugin {
  private options: {
    test: RegExp;
    quality: number;
    effort: number;
    format?: 'avif' | 'jpeg' | 'png' | 'webp' | 'jpg';
  };

  constructor(options = {}) {
    this.options = {
      test: /\.(png|jpe?g)$/i,
      quality: 85,
      effort: 6,
      ...options,
    };
  }

  async optimize(
    compiler: Compiler,
    compilation: Compilation,
    assets: Record<string, any>,
  ) {
    const { RawSource } = compiler.webpack.sources;
    const processedAssets = new Map<string, string>();

    // 第一步：处理图片资源
    for (const [name, asset] of Object.entries(assets)) {
      if (!this.options.test.test(name)) {
        continue;
      }

      try {
        const inputBuffer = asset.source();
        const ext = path.extname(name).toLowerCase();
        const originalFormat = ext.slice(1);
        const sharpInstance = sharp(inputBuffer);
        let outputBuffer: Buffer;
        let newName = name;

        // 检查是否需要格式转换
        const needsFormatConversion =
          this.options.format &&
          this.options.format !== originalFormat &&
          !(this.options.format === 'jpg' && originalFormat === 'jpeg') &&
          !(this.options.format === 'jpeg' && originalFormat === 'jpg');

        if (needsFormatConversion) {
          // 转换格式模式
          newName = name.replace(ext, `.${this.options.format}`);

          switch (this.options.format) {
            case 'webp':
              outputBuffer = await sharpInstance
                .webp({
                  quality: this.options.quality,
                  effort: this.options.effort,
                })
                .toBuffer();
              break;
            case 'avif':
              outputBuffer = await sharpInstance
                .avif({
                  quality: this.options.quality,
                  effort: this.options.effort,
                })
                .toBuffer();
              break;
            case 'png':
              outputBuffer = await sharpInstance
                .png({
                  quality: this.options.quality,
                  effort: this.options.effort,
                })
                .toBuffer();
              break;
            case 'jpeg':
            case 'jpg':
              outputBuffer = await sharpInstance
                .jpeg({ quality: this.options.quality })
                .toBuffer();
              break;
            default:
              throw new Error(`不支持的格式: ${this.options.format}`);
          }

          // 发出新资源
          compilation.emitAsset(newName, new RawSource(outputBuffer), {
            ...compilation.getAsset(name)?.info,
            sourceFilename: name,
          });
          processedAssets.set(name, newName);
        } else {
          // 仅压缩模式，保持原格式
          switch (originalFormat) {
            case 'png':
              outputBuffer = await sharpInstance
                .png({
                  quality: this.options.quality,
                  effort: this.options.effort,
                })
                .toBuffer();
              break;
            case 'jpg':
            case 'jpeg':
              outputBuffer = await sharpInstance
                .jpeg({ quality: this.options.quality })
                .toBuffer();
              break;
            case 'webp':
              outputBuffer = await sharpInstance
                .webp({
                  quality: this.options.quality,
                  effort: this.options.effort,
                })
                .toBuffer();
              break;
            default:
              console.log(`跳过不支持的格式: ${originalFormat}`);
              continue;
          }
          // 更新原资源
          compilation.updateAsset(name, new RawSource(outputBuffer));
        }

        console.log(
          `处理完成: ${name}${newName !== name ? ` -> ${newName}` : ''}`,
        );
        console.log(`原始大小: ${inputBuffer.length}`);
        console.log(`处理后大小: ${outputBuffer.length}`);
      } catch (error) {
        compilation.errors.push(
          new compiler.webpack.WebpackError(
            `处理图片失败 ${name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    }

    // 如果有格式转换，需要更新引用并删除原文件
    if (processedAssets.size > 0) {
      // 更新所有 JS 资源中的引用
      for (const [name, asset] of Object.entries(assets)) {
        if (name.endsWith('.js')) {
          let source = asset.source().toString();
          let modified = false;

          for (const [oldName, newName] of processedAssets.entries()) {
            const oldPath = oldName.replace(/\\/g, '/');
            const newPath = newName.replace(/\\/g, '/');
            if (source.includes(oldPath)) {
              source = source.replace(
                new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                newPath,
              );
              modified = true;
              console.log(
                `更新引用: 在 ${name} 中将 ${oldPath} 替换为 ${newPath}`,
              );
            }
          }

          if (modified) {
            compilation.updateAsset(name, new RawSource(source));
          }
        }
      }

      // 格式转换时一定删除原始图片资源
      for (const [oldName] of processedAssets) {
        compilation.deleteAsset(oldName);
        console.log(`删除原始文件: ${oldName}`);
      }
    }
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('SharpImageOptimizerPlugin', compilation => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: 'SharpImageOptimizerPlugin',
          stage:
            compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async assets => this.optimize(compiler, compilation, assets),
      );
    });
  }
}
