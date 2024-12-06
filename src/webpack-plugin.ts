import sharp from 'sharp';
import path from 'path';
import { Compilation, Compiler, sources, Chunk } from 'webpack';

export default class AVIFWebpackPlugin {
  private options: {
    test: RegExp;
    quality: number;
    effort: number;
    format?: 'avif' | 'jpeg' | 'png' | 'webp' | 'jpg';
    [key: string]: any;
  };

  constructor(
    options: Partial<typeof AVIFWebpackPlugin.prototype.options> = {},
  ) {
    this.options = {
      test: /\.(png|jpe?g|gif|webp)$/i,
      quality: 50,
      effort: 4,
      format: 'avif',
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
            const originalAssets = new Set<string>();

            for (const [fileName, asset] of Object.entries(assets)) {
              if (this.options.test.test(fileName)) {
                const originalExt = path
                  .parse(fileName)
                  .ext.toLowerCase()
                  .replace('.', '');
                // 只有需要格式转换的文件才加入到待删除集合中
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

            // 只删除需要格式转换的原始文件
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

      let buffer;
      switch (format) {
        case 'jpeg':
          buffer = await sharp(asset.buffer()).jpeg(sharpOptions).toBuffer();
          break;
        case 'png':
          buffer = await sharp(asset.buffer()).png(sharpOptions).toBuffer();
          break;
        case 'webp':
          buffer = await sharp(asset.buffer()).webp(sharpOptions).toBuffer();
          break;
        case 'avif':
        default:
          buffer = await sharp(asset.buffer()).avif(sharpOptions).toBuffer();
          break;
      }

      if (!needsFormatConversion) {
        compilation.updateAsset(fileName, new sources.RawSource(buffer), {
          source: buffer,
          size: buffer.length,
        });
      } else {
        const originalInfo = compilation.getAsset(fileName);
        if (!originalInfo) {
          return;
        }

        compilation.emitAsset(newFileName, new sources.RawSource(buffer), {
          ...originalInfo.info,
          source: buffer,
          size: buffer.length,
          sourceFilename: fileName,
        });
      }

      const affectedChunks = new Set<Chunk>();
      for (const chunk of compilation.chunks) {
        const modules = compilation.chunkGraph.getChunkModules(chunk);
        for (const module of modules) {
          const moduleAssets = module.buildInfo?.assets;
          if (moduleAssets?.[fileName]) {
            if (!chunk.files.has(newFileName)) {
              affectedChunks.add(chunk);
            }
            break;
          }
        }
      }

      if (affectedChunks.size > 0) {
        affectedChunks.forEach(chunk => {
          chunk.files.add(fileName);
          chunk.files.add(newFileName);
        });
      } else {
        const mainChunk = Array.from(compilation.chunks).find(
          chunk => chunk.name === 'main',
        );
        if (mainChunk) {
          mainChunk.files.add(fileName);
          mainChunk.files.add(newFileName);
        }
      }
    } catch (error) {
      console.error(
        `[ImageWebpackPlugin]: Error processing ${fileName}:`,
        error,
      );
      throw error;
    }
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
