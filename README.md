# FTOP

## Prerequisites

1. [Node.js LTS](https://github.com/nodejs/Release)
   - [Automatically call nvm use](https://github.com/nvm-sh/nvm#deeper-shell-integration)

## Get Started

按开发环境的要求，运行和调试项目

运行和调试组件

```
pnpm run dev
```

按照社区规范和最佳实践，生成构建产物

```
pnpm run build
```

继续创建更多项目要素

```
pnpm run new
```

其他

```
pnpm run lint         # 检查和修复所有代码
pnpm run change       # 添加 changeset，用于发版时生成 changelog
pnpm run bump         # 生成发版相关的修改，比如更新版本号、生成 changelog
pnpm run release      # 根据 bump 自动修改和人工修改的发版要求，发布项目

```

使用

```
import { sharpImageOptimizer } from 'rsbuild-plugin-sharp-image-optimizer';

sharpImageOptimizer({
  test: /\.(jpe?g|png|webp)$/i, # 匹配需要处理的图片格式
  quality: 75,                  # 图片质量 (1-100)
  effort: 6,                    # 压缩努力程度 (0-9)
  format: 'avif'                # 输出格式: 'jpeg', 'png', 'webp', 'avif'
})
```

