const sharp = require('sharp');
const path = require('path');
const { RawSource } = require('webpack-sources');

class AVIFWebpackPlugin {
  constructor(options) {
    this.options = {
      test: /\.(png|jpe?g|gif|webp)$/i,
      quality: 50,
      effort: 4,
      ...options,
    };
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('AVIFWebpackPlugin', compilation => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'AVIFWebpackPlugin',
          stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async (assets, callback) => {
          const promises = [];

          for (const [fileName, asset] of Object.entries(assets)) {
            if (this.options.test.test(fileName)) {
              const newFileName = path.join(
                this.options.imagePath,
                `${path.parse(fileName).name}.avif`,
              );
              // const newFileName = `${path.parse(fileName).name}.avif`;
              promises.push(
                sharp(asset.buffer())
                  .avif({
                    quality: this.options.quality,
                    effort: this.options.effort,
                  })
                  .toBuffer()
                  .then(buffer => {
                    compilation.emitAsset(newFileName, {
                      source: () => buffer,
                      size: () => buffer.length,
                    });

                    // 删除原始资源
                    compilation.deleteAsset(fileName);

                    // 更新引用
                    this.updateReferences(compilation, fileName, newFileName);
                  }),
              );
            }
          }

          await Promise.all(promises);
          callback();
        },
      );
    });
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
          compilation.updateAsset(name, new RawSource(content));
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

module.exports = AVIFWebpackPlugin;
