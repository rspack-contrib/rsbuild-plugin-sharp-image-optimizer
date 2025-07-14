import type { RsbuildPlugin } from '@rsbuild/core';
import rspackPlugin from './rspack-plugins';

export interface SharpImageOptimizerOptions {
  /**
   * 正则表达式，用于匹配需要优化的图片文件
   */
  test?: RegExp;
  /**
   * 图片质量，范围 1-100
   */
  quality?: number;
  /**
   * 压缩努力程度，范围 0-9
   */
  effort?: number;
  /**
   * 其他选项
   */
  [key: string]: any;
}

/**
 * Sharp 图片优化 Rsbuild 插件
 * @param options 插件配置选项
 * @returns Rsbuild 插件
 */
export const sharpImageOptimizer = (
  options: SharpImageOptimizerOptions = {},
): RsbuildPlugin => {
  const {
    test = /\.(jpe?g|png|webp|avif)$/i,
    quality = 80,
    effort = 4,
    ...pluginOptions
  } = options;

  return {
    name: 'rsbuild-plugin-sharp-image-optimizer',
    setup(api) {
      api.modifyBundlerChain((chain, { isProd }) => {
        if (isProd) {
          const config = api.getNormalizedConfig();
          const imagePath = config.output?.distPath?.image ?? 'static/image';
          chain.plugin('sharp-image-optimizer-plugin').use(rspackPlugin, [
            {
              test,
              quality,
              effort,
              ...pluginOptions,
              imagePath,
            },
          ]);
        }
      });
    },
  };
};
