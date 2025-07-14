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

        const needsFormatConversion =
          this.options.format &&
          this.options.format !== originalFormat &&
          !(this.options.format === 'jpg' && originalFormat === 'jpeg') &&
          !(this.options.format === 'jpeg' && originalFormat === 'jpg');

        if (needsFormatConversion) {
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
              throw new Error(`Unsupported format: ${this.options.format}`);
          }

          compilation.emitAsset(newName, new RawSource(outputBuffer), {
            ...compilation.getAsset(name)?.info,
            sourceFilename: name,
          });
          processedAssets.set(name, newName);
        } else {
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
              throw new Error(`Unsupported format: ${originalFormat}`);
          }
          compilation.updateAsset(name, new RawSource(outputBuffer));
        }
      } catch (error) {
        compilation.errors.push(
          new compiler.webpack.WebpackError(
            `Failed to process image ${name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    }

    if (processedAssets.size > 0) {
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
            }
          }

          if (modified) {
            compilation.updateAsset(name, new RawSource(source));
          }
        }
      }

      for (const [oldName] of processedAssets) {
        compilation.deleteAsset(oldName);
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
