import type { CliPlugin, AppTools } from '@modern-js/app-tools';
import imageProcessorPlugin from './webpack-plugin';

export const imagePlugin = ({
  test,
  quality,
  effort,
}: {
  test: RegExp;
  quality: number;
  effort: number;
}): CliPlugin<AppTools> => ({
  name: 'image-compress-plugin',
  setup(api) {
    const config = api.useConfigContext();
    const imagePath = config.output?.distPath?.image || 'static/image';
    return {
      config: () => ({
        tools: {
          bundlerChain: (chain, { isProd }) => {
            if (isProd) {
              chain
                .plugin('image-compress-webpack-plugin')
                .use(imageProcessorPlugin, [
                  {
                    test,
                    quality,
                    effort,
                    imagePath,
                  },
                ]);
            }
          },
        },
      }),
    };
  },
});

export default imagePlugin;
