// declare module 'graceful-fs' {
//   import * as fs from 'fs';
//   const gracefulFs: typeof fs;
//   export = gracefulFs;
// }
// declare module 'fonteditor-core/src/ttf/ttftowoff2' {
//   export function ttftowoff2async(font: Buffer): Promise<Buffer>;
// }
declare module 'fonteditor-core/lib/ttf/ttftowoff2' {
  export default function ttftowoff2async(font: Buffer): Promise<Buffer>;
}
