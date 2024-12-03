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
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async (assets, callback) => {
          try {
            const promises = [];
            const originalAssets = new Set<string>();

            for (const [fileName, asset] of Object.entries(assets)) {
              if (this.options.test.test(fileName)) {
                originalAssets.add(fileName);
                promises.push(this.processImage(compilation, fileName, asset));
              }
            }

            await Promise.all(promises);

            // 删除原始图片资源
            originalAssets.forEach(fileName => {
              compilation.deleteAsset(fileName);
              console.log(
                `[AVIFWebpackPlugin]: Deleted original asset ${fileName}`,
              );
            });

            // 打印最终的 chunk 信息
            console.log('\n[Final Chunk Information]');
            compilation.chunks.forEach(chunk => {
              console.log(`Chunk ${chunk.id}:`, {
                files: Array.from(chunk.files),
              });
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
      if (!originalInfo) {
        console.log(
          `[AVIFWebpackPlugin]: Original asset ${fileName} not found`,
        );
        return;
      }

      // 修改查找受影响 chunks 的逻辑
      const affectedChunks = new Set<Chunk>();
      for (const chunk of compilation.chunks) {
        // 检查 chunk 中的所有模块
        const modules = compilation.chunkGraph.getChunkModules(chunk);
        for (const module of modules) {
          // 获取模块的资源文件
          const moduleAssets = module.buildInfo?.assets;
          if (moduleAssets?.[fileName]) {
            affectedChunks.add(chunk);
            console.log(`Found chunk ${chunk.id} containing ${fileName}`);
            break;
          }
        }
      }

      // 创建新的 AVIF 资源
      compilation.emitAsset(newFileName, new sources.RawSource(buffer), {
        ...originalInfo.info,
        source: buffer,
        size: buffer.length,
        sourceFilename: fileName,
      });

      // 更新 chunks 的文件列表
      if (affectedChunks.size > 0) {
        affectedChunks.forEach(chunk => {
          // 确保原始图片和 AVIF 都在 chunk 的文件列表中
          chunk.files.add(fileName);
          chunk.files.add(newFileName);
          console.log(
            `Updated chunk ${chunk.id} with both ${fileName} and ${newFileName}`,
          );
        });
      } else {
        // 如果没有找到相关的 chunks，将文件添加到主 chunk
        const mainChunk = Array.from(compilation.chunks).find(
          chunk => chunk.name === 'main',
        );
        if (mainChunk) {
          mainChunk.files.add(fileName);
          mainChunk.files.add(newFileName);
          console.log('Added files to main chunk as fallback');
        }
      }

      console.log(
        `[AVIFWebpackPlugin]: Successfully processed ${fileName} to ${newFileName}`,
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
