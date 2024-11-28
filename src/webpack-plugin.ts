import sharp from 'sharp';
import path from 'path';
import { Compilation, Compiler, sources, Chunk } from 'webpack';

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
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
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
            callback(error as Error);
          }
        },
      );
    });
  }

  async processImage(compilation: Compilation, fileName: string, asset: any) {
    try {
      const newFileName = path.join(
        this.options.imagePath || '',
        `${path.parse(fileName).name}.avif`,
      );

      const buffer = await sharp(asset.buffer())
        .avif({
          quality: this.options.quality,
          effort: this.options.effort,
        })
        .toBuffer();

      // 获取原始资源的信息
      const originalInfo = compilation.getAsset(fileName);

      // 使用与原始资源相同的信息创建新资源
      compilation.emitAsset(newFileName, new sources.RawSource(buffer), {
        ...originalInfo?.info, // 保留原始资源的所有信息
        source: buffer,
        size: buffer.length,
        sourceFilename: fileName, // 标记源文件
        immutable: true, // 标记为不可变资源
        chunk: originalInfo?.info.chunk as Chunk,
      });

      // 确保新资源与原始资源关联相同的 chunks
      compilation.chunks.forEach(chunk => {
        if (chunk.files.has(fileName)) {
          chunk.files.add(newFileName);
        }
      });

      console.log(
        `[AVIFWebpackPlugin]: Created ${newFileName} from ${fileName}`,
      );
    } catch (error) {
      console.error(
        `[AVIFWebpackPlugin]: Error processing ${fileName}:`,
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
          console.log(
            `[AVIFWebpackPlugin]: Updated reference in ${name}: ${oldFileName} -> ${newPath}`,
          );
        }
      }
    }
  }

  escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
